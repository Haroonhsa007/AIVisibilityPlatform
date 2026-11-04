from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.mixins import UUIDMixin, utcnow

if TYPE_CHECKING:
    from app.models.profile import BusinessProfile
    from app.models.query import DiscoveredQuery
    from app.models.run import PipelineRun


class ContentRecommendation(UUIDMixin, db.Model):
    __tablename__ = "content_recommendations"
    api_aliases = {"uuid": "recommendation_uuid", "query_uuid": "target_query_uuid"}
    api_exclude = {"run_uuid"}

    profile_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("business_profiles.uuid", ondelete="CASCADE")
    )
    query_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("discovered_queries.uuid", ondelete="CASCADE")
    )
    run_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("pipeline_runs.uuid", ondelete="CASCADE")
    )
    content_type: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    target_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    priority: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    profile: Mapped[BusinessProfile] = relationship(back_populates="recommendations")
    query: Mapped[DiscoveredQuery] = relationship(back_populates="recommendations")
    run: Mapped[PipelineRun] = relationship(back_populates="recommendations")

    __table_args__ = (
        CheckConstraint(
            "content_type IN ('blog_post', 'landing_page', 'faq')", name="content_type"
        ),
        CheckConstraint("priority IN ('high', 'medium', 'low')", name="priority"),
    )

    def to_dict(self) -> dict[str, Any]:
        result = super().to_dict()
        result["target_query_text"] = self.query.query_text
        return result
