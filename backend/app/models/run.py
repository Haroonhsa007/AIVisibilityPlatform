from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.mixins import UUIDMixin, utcnow

if TYPE_CHECKING:
    from app.models.profile import BusinessProfile
    from app.models.query import DiscoveredQuery
    from app.models.recommendation import ContentRecommendation


class PipelineRun(UUIDMixin, db.Model):
    __tablename__ = "pipeline_runs"
    api_aliases = {"uuid": "run_uuid"}

    profile_uuid: Mapped[UUID] = mapped_column(
        ForeignKey("business_profiles.uuid", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(String(20), default="queued")
    stage: Mapped[str | None] = mapped_column(String(20))
    queries_discovered: Mapped[int] = mapped_column(default=0)
    queries_scored: Mapped[int] = mapped_column(default=0)
    recommendations_created: Mapped[int] = mapped_column(default=0)
    tokens_used: Mapped[int] = mapped_column(default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profile: Mapped[BusinessProfile] = relationship(back_populates="runs")
    queries: Mapped[list[DiscoveredQuery]] = relationship(
        back_populates="run", cascade="all, delete-orphan", passive_deletes=True
    )
    recommendations: Mapped[list[ContentRecommendation]] = relationship(
        back_populates="run", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        Index(
            "uq_runs_one_active_profile",
            profile_uuid,
            unique=True,
            sqlite_where=text("status IN ('queued', 'running')"),
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
        Index("ix_pipeline_runs_profile_created", profile_uuid, created_at.desc()),
        CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'partial', 'failed')",
            name="status",
        ),
        CheckConstraint(
            "stage IN ('discovery', 'scoring', 'recommendations')", name="stage"
        ),
    )

    def to_dict(self, include_profile_name: bool = False) -> dict[str, Any]:
        result = super().to_dict()
        if include_profile_name:
            result["profile_name"] = self.profile.name
        return result
