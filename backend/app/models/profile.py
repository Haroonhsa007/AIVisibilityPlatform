from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.mixins import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.query import DiscoveredQuery
    from app.models.recommendation import ContentRecommendation
    from app.models.run import PipelineRun


class BusinessProfile(UUIDMixin, TimestampMixin, db.Model):
    __tablename__ = "business_profiles"
    api_aliases = {"uuid": "profile_uuid"}

    name: Mapped[str] = mapped_column(String(120))
    domain: Mapped[str] = mapped_column(String(253))
    industry: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    competitors: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="new")

    runs: Mapped[list[PipelineRun]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", passive_deletes=True
    )
    queries: Mapped[list[DiscoveredQuery]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", passive_deletes=True
    )
    recommendations: Mapped[list[ContentRecommendation]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        Index("uq_business_profiles_domain_lower", func.lower(domain), unique=True),
        CheckConstraint(
            "status IN ('new', 'running', 'completed', 'failed')", name="status"
        ),
    )

    def to_dict(self) -> dict[str, Any]:
        result = super().to_dict()
        latest = max(
            self.runs, key=lambda run: (run.created_at, str(run.uuid)), default=None
        )
        result["latest_run"] = latest.to_dict() if latest else None
        return result
