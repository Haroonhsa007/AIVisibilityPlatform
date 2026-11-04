from uuid import UUID

from flask import Blueprint, Response, jsonify, request

from app.schemas.queries import QueryFilters, RecommendationFilters
from app.services import queries

bp = Blueprint("queries", __name__)


@bp.get("/profiles/<uuid:profile_uuid>/queries")
def list_queries(profile_uuid: UUID) -> Response:
    filters = QueryFilters.model_validate(request.args.to_dict())
    return jsonify(queries.list_queries(profile_uuid, filters))


@bp.get("/profiles/<uuid:profile_uuid>/recommendations")
def list_recommendations(profile_uuid: UUID) -> Response:
    filters = RecommendationFilters.model_validate(request.args.to_dict())
    return jsonify(queries.list_recommendations(profile_uuid, filters))


@bp.post("/queries/<uuid:query_uuid>/recheck")
def recheck(query_uuid: UUID) -> Response:
    return jsonify(queries.recheck(query_uuid).to_dict())
