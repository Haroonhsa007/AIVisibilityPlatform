from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import event

from app.extensions import db
from app.llm.fake_client import FakeLLMClient
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)
from app.models.mixins import utcnow


@pytest.fixture
def dataset(app, profile_data):
    profile = BusinessProfile(**profile_data)
    run = PipelineRun(profile=profile, status="completed")
    db.session.add(run)
    queries = []
    for i, (visible, score, volume, difficulty) in enumerate(
        [
            (False, 0.8, 500, 20),
            (True, 0.2, 100, 50),
            (None, None, None, None),
            (False, 0.5, 1000, 10),
        ]
    ):
        query = DiscoveredQuery(
            profile=profile,
            run=run,
            query_text=f"Question {i}?",
            domain_visible=visible,
            opportunity_score=score,
            estimated_search_volume=volume,
            competitive_difficulty=difficulty,
            discovered_at=utcnow() + timedelta(seconds=i),
        )
        queries.append(query)
        db.session.add(query)
    for i, priority in enumerate(["low", "high", "medium", "high"]):
        db.session.add(
            ContentRecommendation(
                profile=profile,
                run=run,
                query=queries[0],
                content_type="faq",
                title=f"Recommendation {i}",
                rationale="Evidence helps.",
                target_keywords=["SEO"],
                priority=priority,
                created_at=utcnow() + timedelta(seconds=i),
            )
        )
    db.session.commit()
    return profile, run, queries


def test_query_defaults_and_filters(client, dataset) -> None:
    profile, _, _ = dataset
    path = f"/api/v1/profiles/{profile.uuid}/queries"
    data = client.get(path).get_json()
    assert [query["opportunity_score"] for query in data["items"]] == [
        0.8,
        0.5,
        0.2,
        None,
    ]
    assert (data["page"], data["per_page"], data["total"], data["pages"]) == (
        1,
        20,
        4,
        1,
    )
    for status, count in [("visible", 1), ("not_visible", 2), ("unknown", 1)]:
        result = client.get(path + f"?status={status}").get_json()["items"]
        assert len(result) == count
        assert all(query["visibility_status"] == status for query in result)
    assert client.get(path + "?min_score=.6").get_json()["total"] == 1
    assert client.get(path + "?min_score=.4&status=visible").get_json()["total"] == 0
    assert (
        client.get(path + "?min_score=.4&status=not_visible").get_json()["total"] == 2
    )
    assert client.get(path + "?page=99").get_json()["items"] == []
    assert len(client.get(path + "?page=2&per_page=3").get_json()["items"]) == 1


@pytest.mark.parametrize(
    "sort",
    [
        "opportunity_score",
        "estimated_search_volume",
        "competitive_difficulty",
        "discovered_at",
    ],
)
@pytest.mark.parametrize("order", ["asc", "desc"])
def test_query_sorting(client, dataset, sort, order) -> None:
    profile, _, _ = dataset
    data = client.get(
        f"/api/v1/profiles/{profile.uuid}/queries?sort={sort}&order={order}"
    ).get_json()
    values = [item[sort] for item in data["items"]]
    nonnull = [value for value in values if value is not None]
    assert nonnull == sorted(nonnull, reverse=order == "desc")
    assert values == nonnull + [None] * (len(values) - len(nonnull))


@pytest.mark.parametrize(
    "params",
    [
        "min_score=-.1",
        "min_score=1.1",
        "min_score=nan",
        "min_score=inf",
        "status=bad",
        "sort=uuid",
        "order=bad",
        "page=0",
        "per_page=101",
    ],
)
def test_query_invalid_params(client, dataset, params) -> None:
    profile, _, _ = dataset
    response = client.get(f"/api/v1/profiles/{profile.uuid}/queries?{params}")
    assert response.status_code == 422
    assert response.get_json()["error"]["details"]


def test_recommendations(client, dataset) -> None:
    profile, _, _ = dataset
    path = f"/api/v1/profiles/{profile.uuid}/recommendations"
    items = client.get(path).get_json()["items"]
    assert [item["title"] for item in items] == [
        "Recommendation 3",
        "Recommendation 1",
        "Recommendation 2",
        "Recommendation 0",
    ]
    assert all(item["target_query_text"] == "Question 0?" for item in items)
    for priority, count in [("high", 2), ("medium", 1), ("low", 1)]:
        filtered = client.get(path + f"?priority={priority}").get_json()["items"]
        assert len(filtered) == count
        assert all(item["priority"] == priority for item in filtered)
    assert client.get(path + "?priority=urgent").status_code == 422


@pytest.mark.parametrize("suffix", ["queries", "recommendations"])
def test_missing_profile(client, suffix) -> None:
    assert client.get(f"/api/v1/profiles/{uuid4()}/{suffix}").status_code == 404


def test_recheck_success_failure_unchanged(client, dataset) -> None:
    _, _, queries = dataset
    query_uuid = queries[0].uuid
    path = f"/api/v1/queries/{query_uuid}/recheck"
    response = client.post(path)
    assert response.status_code == 200
    assert response.get_json()["last_checked_at"].endswith("Z")
    before = db.session.get(DiscoveredQuery, query_uuid).to_dict()
    with patch(
        "app.services.pipeline.get_llm_client",
        return_value=FakeLLMClient("invalid_json"),
    ):
        response = client.post(path)
    assert response.status_code == 502
    assert response.get_json()["error"]["code"] == "upstream_error"
    db.session.expire_all()
    assert db.session.get(DiscoveredQuery, query_uuid).to_dict() == before
    assert client.post(f"/api/v1/queries/{uuid4()}/recheck").status_code == 404
    assert client.post("/api/v1/queries/invalid/recheck").status_code == 404


def test_dashboard_empty(client) -> None:
    assert client.get("/api/v1/dashboard").get_json() == {
        "total_profiles": 0,
        "total_queries": 0,
        "avg_opportunity_score": None,
        "recent_runs": [],
    }


def test_dashboard_populated_and_latest_ten(client, dataset) -> None:
    profile, run, _ = dataset
    for i in range(12):
        db.session.add(
            PipelineRun(
                profile=profile,
                status="completed",
                created_at=utcnow() + timedelta(seconds=i),
            )
        )
    db.session.commit()
    result = client.get("/api/v1/dashboard").get_json()
    assert result["total_profiles"] == 1
    assert result["total_queries"] == 4
    assert result["avg_opportunity_score"] == pytest.approx(0.5)
    assert len(result["recent_runs"]) == 10
    assert all(item["profile_name"] == profile.name for item in result["recent_runs"])
    assert str(run.uuid) not in {item["run_uuid"] for item in result["recent_runs"]}


def test_list_endpoints_do_not_n_plus_one(app, client, dataset) -> None:
    profile, _, _ = dataset
    profile_uuid = str(profile.uuid)
    for i in range(4):
        other = BusinessProfile(name="Other", domain=f"other{i}.com", industry="SEO")
        db.session.add(PipelineRun(profile=other, status="completed"))
    db.session.commit()
    for path, maximum in [
        ("/api/v1/profiles", 3),
        ("/api/v1/dashboard", 4),
        (f"/api/v1/profiles/{profile_uuid}/recommendations", 2),
    ]:
        db.session.remove()
        statements = []

        def count(
            conn,
            cursor,
            statement,
            parameters,
            context,
            executemany,
            counter=statements,
        ):
            counter.append(statement)

        event.listen(db.engine, "before_cursor_execute", count)
        try:
            assert client.get(path).status_code == 200
        finally:
            event.remove(db.engine, "before_cursor_execute", count)
        assert len(statements) <= maximum, statements
