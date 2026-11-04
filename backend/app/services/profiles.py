from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.errors import APIError
from app.extensions import db
from app.models import BusinessProfile
from app.schemas.pagination import Pagination
from app.schemas.profile import ProfileCreate


def create_profile(data: ProfileCreate) -> BusinessProfile:
    profile = BusinessProfile(**data.model_dump())
    db.session.add(profile)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        # Translate only a domain collision; do not hide unrelated DB errors.
        existing = db.session.scalar(
            select(BusinessProfile.uuid).where(
                func.lower(BusinessProfile.domain) == data.domain
            )
        )
        if existing is not None:
            raise APIError(
                "A profile with this domain already exists.", 409, "conflict"
            ) from None
        raise
    return profile


def get_profile(profile_uuid: UUID) -> BusinessProfile:
    profile = db.session.get(BusinessProfile, profile_uuid)
    if profile is None:
        raise APIError("Profile not found.", 404, "not_found")
    return profile


def list_profiles(pagination: Pagination) -> dict:
    page = db.paginate(
        select(BusinessProfile)
        .options(selectinload(BusinessProfile.runs))
        .order_by(BusinessProfile.created_at.desc(), BusinessProfile.uuid.desc()),
        page=pagination.page,
        per_page=pagination.per_page,
        max_per_page=100,
        error_out=False,
    )
    return {
        "items": [profile.to_dict() for profile in page.items],
        "page": page.page,
        "per_page": page.per_page,
        "total": page.total,
        "pages": page.pages,
    }
