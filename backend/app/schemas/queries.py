from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.pagination import Pagination


class QueryFilters(Pagination):
    min_score: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    status: Literal["visible", "not_visible", "unknown"] | None = None
    sort: Literal[
        "opportunity_score",
        "estimated_search_volume",
        "competitive_difficulty",
        "discovered_at",
    ] = "opportunity_score"
    order: Literal["asc", "desc"] = "desc"


class RecommendationFilters(BaseModel):
    priority: Literal["high", "medium", "low"] | None = None
