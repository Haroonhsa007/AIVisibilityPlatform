from uuid import UUID

from flask import Blueprint, Response, jsonify, request

from app.errors import APIError
from app.schemas.pagination import Pagination
from app.schemas.profile import ProfileCreate
from app.services import profiles

bp = Blueprint("profiles", __name__)


@bp.post("/profiles")
def create_profile() -> tuple[Response, int]:
    if not request.is_json:
        raise APIError("A JSON request body is required.")
    data = ProfileCreate.model_validate(request.get_json())
    return jsonify(profiles.create_profile(data).to_dict()), 201


@bp.get("/profiles")
def list_profiles() -> Response:
    pagination = Pagination.model_validate(request.args.to_dict())
    return jsonify(profiles.list_profiles(pagination))


@bp.get("/profiles/<uuid:profile_uuid>")
def get_profile(profile_uuid: UUID) -> Response:
    return jsonify(profiles.get_profile(profile_uuid).to_dict())
