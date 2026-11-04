from datetime import UTC, datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Uuid, inspect
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC)


def serialise(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)  # SQLite drops timezone information.
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    return value


class SerialisationMixin:
    api_aliases: ClassVar[dict[str, str]] = {}
    api_exclude: ClassVar[set[str]] = set()

    def to_dict(self) -> dict[str, Any]:
        return {
            self.api_aliases.get(column.key, column.key): serialise(
                getattr(self, column.key)
            )
            for column in inspect(type(self)).columns
            if column.key not in self.api_exclude
        }


class UUIDMixin(SerialisationMixin):
    uuid: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
