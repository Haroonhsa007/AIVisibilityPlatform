from flask import Blueprint, Response, jsonify

from app.services.queries import dashboard as get_dashboard

bp = Blueprint("dashboard", __name__)


@bp.get("/dashboard")
def dashboard() -> Response:
    return jsonify(get_dashboard())
