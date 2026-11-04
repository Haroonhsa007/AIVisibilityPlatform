from flask import current_app
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db


def check_health() -> dict[str, str]:
    database = "ok"
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        db.session.rollback()
        database = "error"

    queue = "skipped"
    if current_app.config["PIPELINE_EXECUTION"] != "eager":
        redis = current_app.extensions["redis"]
        queue = "unconfigured" if redis is None else "error"
        if redis is not None:
            try:
                queue = "ok" if redis.ping() else "error"
            except RedisError:
                queue = "error"
    return {
        "status": (
            "ok" if database == "ok" and queue in {"ok", "skipped"} else "degraded"
        ),
        "database": database,
        "queue": queue,
    }
