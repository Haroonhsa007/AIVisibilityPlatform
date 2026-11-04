from uuid import UUID

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)


def make_graph() -> tuple:
    profile = BusinessProfile(name="Example", domain="example.com", industry="SEO")
    run = PipelineRun(profile=profile)
    query = DiscoveredQuery(profile=profile, run=run, query_text="Best SEO tools?")
    recommendation = ContentRecommendation(
        profile=profile,
        run=run,
        query=query,
        content_type="blog_post",
        title="Guide",
        rationale="Fill the gap",
        target_keywords=["SEO"],
        priority="high",
    )
    db.session.add(profile)
    db.session.commit()
    return profile, run, query, recommendation


def test_serialisation_and_defaults(app) -> None:
    profile, run, query, recommendation = make_graph()
    assert isinstance(profile.uuid, UUID)
    run_data = run.to_dict()
    assert run_data["run_uuid"] == str(run.uuid)
    assert run_data["profile_uuid"] == str(profile.uuid)
    assert run_data["status"] == "queued"
    assert run_data["tokens_used"] == 0
    assert run_data["queries_discovered"] == 0
    assert run_data["started_at"] is None
    assert run_data["created_at"].endswith("Z")
    query_data = query.to_dict()
    assert query_data["query_uuid"] == str(query.uuid)
    assert query_data["opportunity_score"] is None
    assert query_data["domain_visible"] is None
    assert query_data["visibility_status"] == "unknown"
    assert query_data["data_source"] == "llm_estimate"
    assert query_data["cited_domains"] == []
    assert "score_components" not in query_data
    for visible, expected in [(True, "visible"), (False, "not_visible")]:
        query.domain_visible = visible
        assert query.to_dict()["visibility_status"] == expected
    data = recommendation.to_dict()
    assert data["recommendation_uuid"] == str(recommendation.uuid)
    assert data["target_query_uuid"] == str(query.uuid)
    assert data["target_query_text"] == query.query_text
    assert "query_uuid" not in data and "run_uuid" not in data
    assert data["created_at"].endswith("Z")


@pytest.mark.parametrize("delete_via_sql", [False, True])
def test_profile_cascades(app, delete_via_sql: bool) -> None:
    profile, _, _, _ = make_graph()
    profile_uuid = profile.uuid
    db.session.expunge_all()
    if delete_via_sql:
        db.session.execute(
            delete(BusinessProfile).where(BusinessProfile.uuid == profile_uuid)
        )
    else:
        db.session.delete(db.session.get(BusinessProfile, profile_uuid))
    db.session.commit()
    for model in (BusinessProfile, PipelineRun, DiscoveredQuery, ContentRecommendation):
        assert db.session.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.parametrize("parent", [PipelineRun, DiscoveredQuery])
def test_child_cascades(app, parent) -> None:
    _, run, query, _ = make_graph()
    selected = run if parent is PipelineRun else query
    selected_uuid = selected.uuid
    db.session.expunge_all()
    db.session.execute(delete(parent).where(parent.uuid == selected_uuid))
    db.session.commit()
    assert (
        db.session.scalar(select(func.count()).select_from(ContentRecommendation)) == 0
    )
    assert db.session.scalar(select(func.count()).select_from(BusinessProfile)) == 1


def test_case_insensitive_domain_unique_index(app) -> None:
    make_graph()
    db.session.add(
        BusinessProfile(name="Duplicate", domain="EXAMPLE.COM", industry="SEO")
    )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_case_insensitive_query_unique_index(app) -> None:
    profile, run, _, _ = make_graph()
    db.session.add(
        DiscoveredQuery(profile=profile, run=run, query_text="BEST SEO TOOLS?")
    )
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("competitive_difficulty", 101),
        ("opportunity_score", 1.1),
        ("estimated_search_volume", -1),
        ("visibility_position", 0),
    ],
)
def test_query_range_constraints(app, field: str, value: object) -> None:
    _, _, query, _ = make_graph()
    setattr(query, field, value)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
