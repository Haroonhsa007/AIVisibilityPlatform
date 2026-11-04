from datetime import timedelta
from unittest.mock import patch
from uuid import UUID, uuid4

import fakeredis
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.llm.fake_client import FakeLLMClient
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)
from app.models.mixins import utcnow
from app.services.jobs import enqueue_pipeline
from app.services.pipeline import PipelineOrchestrator, sweep_stale_runs
from app.utils.scoring import opportunity_score


def make_run(data: dict) -> PipelineRun:
    profile = BusinessProfile(**data)
    run = PipelineRun(profile=profile)
    db.session.add(run)
    db.session.commit()
    return run


def test_worked_example_and_ordering() -> None:
    # volume=100000 => norm=1, ease=.8, gap=.75 => .4+.2+.2625=.8625.
    score = opportunity_score(100_000, 20, False, None, 1, 2)
    assert score.score == 0.863
    assert score.components == {"volume_norm": 1, "ease": 0.8, "gap": 0.75}
    best = opportunity_score(100_000, 10, False, None, 2, 2).score
    poor = opportunity_score(100, 90, True, 1, 0, 2).score
    assert best > poor
    assert (
        opportunity_score(1000, 50, True, 5, 0, 1).score
        > opportunity_score(1000, 50, True, 1, 0, 1).score
    )
    assert opportunity_score(1000, 50, None, None, 0, 0).components["gap"] == 0.5
    assert opportunity_score(1_000_000, 20, False, None, 1, 2).score == score.score
    assert opportunity_score(None, 30, False, None, 0, 0) is None
    assert opportunity_score(100, None, False, None, 0, 0) is None


@pytest.mark.parametrize(
    "volume,difficulty,visible,position",
    [
        (0, 100, True, 1),
        (100_000, 0, False, None),
        (0, 0, None, None),
        (1000, 50, True, None),
        (-1, 150, False, None),
    ],
)
def test_score_bounds(volume, difficulty, visible, position) -> None:
    assert (
        0 <= opportunity_score(volume, difficulty, visible, position, 0, 0).score <= 1
    )


def test_happy_path_and_rerun(app, profile_data) -> None:
    run = make_run(profile_data)
    PipelineOrchestrator(FakeLLMClient()).run(run.uuid)
    assert run.status == "completed"
    assert run.profile.status == "completed"
    assert (
        run.queries_discovered,
        run.queries_scored,
        run.recommendations_created,
    ) == (12, 12, 3)
    assert run.tokens_used == 750
    assert run.started_at and run.completed_at
    queries = db.session.scalars(select(DiscoveredQuery)).all()
    uuids = {query.uuid for query in queries}
    assert all(query.opportunity_score is not None for query in queries)
    assert all(query.score_components for query in queries)
    assert (
        db.session.scalar(select(func.count()).select_from(ContentRecommendation)) == 3
    )
    second = PipelineRun(profile=run.profile)
    db.session.add(second)
    db.session.commit()
    PipelineOrchestrator(FakeLLMClient()).run(second.uuid)
    assert second.status == "completed"
    assert {
        query.uuid for query in db.session.scalars(select(DiscoveredQuery))
    } == uuids
    assert all(query.run_uuid == second.uuid for query in queries)
    assert (
        db.session.scalar(select(func.count()).select_from(ContentRecommendation)) == 3
    )
    assert second.profile.to_dict()["latest_run"]["run_uuid"] == str(second.uuid)
    fake = FakeLLMClient()
    PipelineOrchestrator(fake).run(second.uuid)
    assert fake.calls == 0


@pytest.mark.parametrize(
    "behaviours,expected",
    [
        ({"discovery": "invalid_json"}, "failed"),
        ({"scoring": "raise_error"}, "failed"),
        ({"recommendations": "raise_error"}, "partial"),
        ({"scoring": "all_visible"}, "completed"),
    ],
)
def test_failure_modes_and_skip(app, profile_data, behaviours, expected) -> None:
    run = make_run(profile_data)
    PipelineOrchestrator(FakeLLMClient(behaviours=behaviours)).run(run.uuid)
    assert run.status == expected
    assert run.completed_at
    if "discovery" in behaviours:
        assert run.tokens_used == 300
    if behaviours.get("scoring") == "all_visible":
        assert run.recommendations_created == 0
        assert run.tokens_used == 600


def test_partial_batch_preserves_unknowns(app, profile_data) -> None:
    run = make_run(profile_data)
    PipelineOrchestrator(FakeLLMClient(fail_on_call_n=2)).run(run.uuid)
    assert run.status == "partial"
    assert run.queries_scored == 7
    assert (
        db.session.scalar(
            select(func.count())
            .select_from(DiscoveredQuery)
            .where(DiscoveredQuery.domain_visible.is_(None))
        )
        == 5
    )


def test_recommendation_failure_preserves_previous(app, profile_data) -> None:
    first = make_run(profile_data)
    PipelineOrchestrator(FakeLLMClient()).run(first.uuid)
    ids = set(db.session.scalars(select(ContentRecommendation.uuid)))
    second = PipelineRun(profile=first.profile)
    db.session.add(second)
    db.session.commit()
    PipelineOrchestrator(
        FakeLLMClient(behaviours={"recommendations": "invalid_json"})
    ).run(second.uuid)
    assert second.status == "partial"
    assert second.tokens_used == 900
    assert set(db.session.scalars(select(ContentRecommendation.uuid))) == ids


def test_unexpected_failure_terminal(app, profile_data) -> None:
    run = make_run(profile_data)
    with patch.object(
        PipelineOrchestrator, "_score", side_effect=RuntimeError("private")
    ):
        PipelineOrchestrator(FakeLLMClient()).run(run.uuid)
    assert run.status == "failed"
    assert "private" not in run.error_message
    assert run.completed_at


@pytest.mark.parametrize(
    "behaviour,message",
    [
        ("raise_error", "AI provider error: Fake provider failure."),
        ("invalid_json", "The AI model returned an unusable response."),
    ],
)
def test_discovery_failure_message_is_actionable(
    app, profile_data, behaviour, message
) -> None:
    run = make_run(profile_data)
    PipelineOrchestrator(FakeLLMClient(behaviours={"discovery": behaviour})).run(
        run.uuid
    )
    assert run.status == "failed"
    assert run.error_message.startswith(message)
    assert "unexpectedly" not in run.error_message
    assert run.completed_at


def test_active_run_unique_constraint(app, profile_data) -> None:
    run = make_run(profile_data)
    db.session.add(PipelineRun(profile=run.profile))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_eager_endpoints(client, profile_data) -> None:
    profile = client.post("/api/v1/profiles", json=profile_data).get_json()
    profile_uuid = profile["profile_uuid"]
    response = client.post(f"/api/v1/profiles/{profile_uuid}/run")
    assert response.status_code == 202
    assert response.get_json()["status"] == "queued"
    run_uuid = response.get_json()["run_uuid"]
    result = client.get(f"/api/v1/runs/{run_uuid}").get_json()
    assert result["status"] == "completed"
    assert (
        client.get(f"/api/v1/profiles/{profile_uuid}").get_json()["latest_run"]
        == result
    )
    assert client.get(f"/api/v1/profiles/{profile_uuid}/runs").get_json()["items"] == [
        result
    ]
    assert client.get(f"/api/v1/runs/{uuid4()}").status_code == 404
    assert client.post(f"/api/v1/profiles/{uuid4()}/run").status_code == 404
    assert client.get(f"/api/v1/profiles/{uuid4()}/runs").status_code == 404


def test_active_run_conflict(client, profile_data) -> None:
    run = make_run(profile_data)
    response = client.post(f"/api/v1/profiles/{run.profile_uuid}/run")
    assert response.status_code == 409


def test_queue_enqueue_and_failure(app, client, profile_data) -> None:
    run = make_run(profile_data)
    app.config["PIPELINE_EXECUTION"] = "queue"
    from rq import Queue

    app.extensions["queue"] = Queue("pipeline", connection=fakeredis.FakeRedis())
    enqueue_pipeline(run.uuid)
    assert app.extensions["queue"].count == 1
    run.status = "completed"
    db.session.commit()
    app.extensions["queue"] = None
    response = client.post(f"/api/v1/profiles/{run.profile_uuid}/run")
    assert response.status_code == 502
    failed_uuid = client.get(f"/api/v1/profiles/{run.profile_uuid}/runs").get_json()[
        "items"
    ][0]["run_uuid"]
    assert db.session.get(PipelineRun, UUID(failed_uuid)).status == "failed"


def test_stale_sweep(app, profile_data) -> None:
    run = make_run(profile_data)
    run.created_at = utcnow() - timedelta(minutes=31)
    db.session.commit()
    assert sweep_stale_runs() == 1
    assert run.status == "failed"
    assert run.error_message == "worker interrupted"
    assert run.profile.status == "failed"
    assert sweep_stale_runs() == 0
