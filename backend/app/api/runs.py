from uuid import UUID

from flask import Blueprint, Response, jsonify

from app.services import pipeline

bp = Blueprint("runs", __name__)


@bp.post("/profiles/<uuid:profile_uuid>/run")
def start_run(profile_uuid: UUID) -> tuple[Response, int]:
    return jsonify(pipeline.start_run(profile_uuid)), 202


@bp.get("/profiles/<uuid:profile_uuid>/runs")
def list_runs(profile_uuid: UUID) -> Response:
    return jsonify(pipeline.list_runs(profile_uuid))


@bp.get("/runs/<uuid:run_uuid>")
def get_run(run_uuid: UUID) -> Response:
    return jsonify(pipeline.get_run(run_uuid).to_dict())
