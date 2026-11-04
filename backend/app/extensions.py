import sqlite3

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from redis import Redis
from rq import Queue
from sqlalchemy import MetaData, event
from sqlalchemy.engine import Engine

db = SQLAlchemy(
    metadata=MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )
)
migrate = Migrate()
cors = CORS()


@event.listens_for(Engine, "connect")
def enable_sqlite_foreign_keys(connection: object, _record: object) -> None:
    if isinstance(connection, sqlite3.Connection):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_queue(app: Flask) -> None:
    """Configure per-app queue handles without connecting at app startup."""
    redis = (
        Redis.from_url(
            app.config["REDIS_URL"], socket_connect_timeout=2, socket_timeout=2
        )
        if app.config["REDIS_URL"]
        else None
    )
    app.extensions["redis"] = redis
    app.extensions["queue"] = (
        Queue(
            "pipeline",
            connection=redis,
            default_timeout=app.config["JOB_TIMEOUT_SECONDS"],
        )
        if redis is not None
        else None
    )
