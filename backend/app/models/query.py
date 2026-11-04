from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.mixins import UUIDMixin, utcnow

if TYPE_CHECKING:
    from app.models.profile import BusinessProfile
    from app.models.recommendation import ContentRecommendation
    from app.models.run import PipelineRun


class DiscoveredQuery(UUIDMixin, db.Model):
    __tablename__ = "discovered_queries"
    api_aliases = {"uuid": "query_uuid"}
    api_exclude = {"score_components"}

    profile_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("business_profiles.uuid", ondelete="CASCADE")
    )
    run_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("pipeline_runs.uuid", ondelete="CASCADE")
    )
    query_text: Mapped[str] = mapped_column(Text)
    estimated_search_volume: Mapped[int | None]
    competitive_difficulty: Mapped[int | None]
    opportunity_score: Mapped[float | None] = mapped_column()
    domain_visible: Mapped[bool | None] = mapped_column()
    visibility_position: Mapped[int | None]
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cited_domains: Mapped[list[str]] = mapped_column(JSON, default=list)
    score_components: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    profile: Mapped[BusinessProfile] = relationship(back_populates="queries")
    run: Mapped[PipelineRun] = relationship(back_populates="queries")
    recommendations: Mapped[list[ContentRecommendation]] = relationship(
        back_populates="query", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        Index("ix_queries_profile_score", profile_uuid, opportunity_score.desc()),
        Index("ix_queries_profile_visible", profile_uuid, domain_visible),
        Index(
            "uq_queries_profile_text_lower",
            profile_uuid,
            func.lower(query_text),
            unique=True,
        ),
        CheckConstraint(
            "competitive_difficulty BETWEEN 0 AND 100", name="difficulty_range"
        ),
        CheckConstraint("opportunity_score BETWEEN 0 AND 1", name="score_range"),
        CheckConstraint("estimated_search_volume >= 0", name="volume_nonnegative"),
        CheckConstraint("visibility_position > 0", name="position_positive"),
    )

    def to_dict(self) -> dict[str, Any]:
        result = super().to_dict()
        result["visibility_status"] = (
            "unknown"
            if self.domain_visible is None
            else "visible"
            if self.domain_visible
            else "not_visible"
        )
        result["data_source"] = "llm_estimate"
        return result
