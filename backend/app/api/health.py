from flask import Blueprint, Response, jsonify

from app.services.health import check_health

bp = Blueprint("health", __name__)


@bp.get("/health")
def health() -> Response:
    return jsonify(check_health())
