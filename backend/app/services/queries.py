from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import joinedload

from app.errors import APIError
from app.extensions import db
from app.models import (
    BusinessProfile,
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)
from app.schemas.queries import QueryFilters, RecommendationFilters
from app.services.pipeline import recheck_query
from app.services.profiles import get_profile


def list_queries(profile_uuid: UUID, filters: QueryFilters) -> dict:
    get_profile(profile_uuid)
    statement = select(DiscoveredQuery).where(
        DiscoveredQuery.profile_uuid == profile_uuid
    )
    if filters.min_score is not None:
        statement = statement.where(
            DiscoveredQuery.opportunity_score >= filters.min_score
        )
    if filters.status is not None:
        visible = {"visible": True, "not_visible": False, "unknown": None}[
            filters.status
        ]
        statement = statement.where(DiscoveredQuery.domain_visible.is_(visible))
    column = getattr(DiscoveredQuery, filters.sort)
    order = (column.asc() if filters.order == "asc" else column.desc()).nulls_last()
    page = db.paginate(
        statement.order_by(order, DiscoveredQuery.uuid),
        page=filters.page,
        per_page=filters.per_page,
        error_out=False,
    )
    return {
        "items": [query.to_dict() for query in page.items],
        "page": page.page,
        "per_page": page.per_page,
        "total": page.total,
        "pages": page.pages,
    }


def recheck(query_uuid: UUID) -> DiscoveredQuery:
    query = db.session.get(DiscoveredQuery, query_uuid)
    if query is None:
        raise APIError("Query not found.", 404, "not_found")
    return recheck_query(query)


def list_recommendations(profile_uuid: UUID, filters: RecommendationFilters) -> dict:
    get_profile(profile_uuid)
    statement = (
        select(ContentRecommendation)
        .options(joinedload(ContentRecommendation.query))
        .where(ContentRecommendation.profile_uuid == profile_uuid)
    )
    if filters.priority is not None:
        statement = statement.where(ContentRecommendation.priority == filters.priority)
    priority = case(
        (ContentRecommendation.priority == "high", 0),
        (ContentRecommendation.priority == "medium", 1),
        else_=2,
    )
    items = db.session.scalars(
        statement.order_by(
            priority,
            ContentRecommendation.created_at.desc(),
            ContentRecommendation.uuid,
        )
    ).all()
    return {"items": [item.to_dict() for item in items]}


def dashboard() -> dict:
    runs = db.session.scalars(
        select(PipelineRun)
        .options(joinedload(PipelineRun.profile))
        .order_by(PipelineRun.created_at.desc(), PipelineRun.uuid.desc())
        .limit(10)
    ).all()
    return {
        "total_profiles": db.session.scalar(
            select(func.count()).select_from(BusinessProfile)
        ),
        "total_queries": db.session.scalar(
            select(func.count()).select_from(DiscoveredQuery)
        ),
        "avg_opportunity_score": db.session.scalar(
            select(func.avg(DiscoveredQuery.opportunity_score))
        ),
        "recent_runs": [run.to_dict(include_profile_name=True) for run in runs],
    }
