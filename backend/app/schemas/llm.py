from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.profile import Domain

NonEmpty = Annotated[str, Field(min_length=1, max_length=2000)]


class StructuredOutput(BaseModel):
    model_config = ConfigDict(strict=True, str_strip_whitespace=True)


class DiscoveredQuestion(StructuredOutput):
    query_text: NonEmpty
    intent: Literal["informational", "comparison", "transactional", "navigational"]


class DiscoveryResult(StructuredOutput):
    queries: list[DiscoveredQuestion] = Field(min_length=8, max_length=25)


class ScoringItem(StructuredOutput):
    query_text: NonEmpty
    estimated_search_volume: int = Field(ge=0)
    competitive_difficulty: int = Field(ge=0, le=100)
    cited_domains: list[Domain] = Field(max_length=8)


class ScoringOutput(StructuredOutput):
    results: list[ScoringItem] = Field(max_length=5)


class ScoredQuery(ScoringItem):
    domain_visible: bool
    visibility_position: int | None


class RecommendationDraft(StructuredOutput):
    target_query_uuid: UUID
    content_type: Literal["blog_post", "landing_page", "faq"]
    title: NonEmpty
    rationale: NonEmpty
    target_keywords: list[NonEmpty] = Field(min_length=3, max_length=6)
    priority: Literal["high", "medium", "low"]


class RecommendationOutput(StructuredOutput):
    recommendations: list[RecommendationDraft] = Field(min_length=3, max_length=5)
