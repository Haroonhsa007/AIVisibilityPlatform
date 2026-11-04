from unittest.mock import patch

import fakeredis
import pytest
from flask import Flask, abort
from flask.testing import FlaskClient
from redis.exceptions import ConnectionError
from sqlalchemy.exc import OperationalError

from app.errors import APIError


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "bad_request"),
        (404, "not_found"),
        (405, "bad_request"),
        (409, "conflict"),
        (422, "validation_error"),
        (500, "internal_error"),
    ],
)
def test_http_error_envelopes(app: Flask, status: int, code: str) -> None:
    @app.get("/test-error")
    def fail() -> None:
        abort(status)

    response = app.test_client().get("/test-error")
    assert response.status_code == status
    assert response.is_json
    error = response.get_json()["error"]
    assert error["code"] == code
    assert isinstance(error["message"], str)


def test_method_not_allowed_preserves_allow(client: FlaskClient) -> None:
    response = client.delete("/api/v1/profiles")
    assert response.status_code == 405
    assert {"GET", "POST"}.issubset(set(response.headers["Allow"].split(", ")))


def test_unexpected_error_does_not_expose_internals(app: Flask) -> None:
    @app.get("/test-unexpected")
    def fail() -> None:
        raise RuntimeError("private exception text")

    response = app.test_client().get("/test-unexpected")
    assert response.status_code == 500
    assert response.get_json() == {
        "error": {"code": "internal_error", "message": "An internal error occurred."}
    }


def test_api_error_details(app: Flask) -> None:
    @app.get("/test-api-error")
    def fail() -> None:
        raise APIError("Invalid input.", 422, "validation_error", {"field": "invalid"})

    response = app.test_client().get("/test-api-error")
    assert response.status_code == 422
    assert response.get_json()["error"]["details"] == {"field": "invalid"}


def test_cors(client: FlaskClient, profile_data: dict) -> None:
    origin = "http://localhost:4200"
    response = client.post(
        "/api/v1/profiles", json=profile_data, headers={"Origin": origin}
    )
    assert response.headers["Access-Control-Allow-Origin"] == origin
    preflight = client.options(
        "/api/v1/profiles",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert preflight.status_code == 200
    assert "POST" in preflight.headers["Access-Control-Allow-Methods"]
    assert "Content-Type" in preflight.headers["Access-Control-Allow-Headers"]
    error = client.get("/api/v1/profiles/invalid", headers={"Origin": origin})
    assert error.headers["Access-Control-Allow-Origin"] == origin
    denied = client.get("/api/v1/health", headers={"Origin": "https://untrusted.com"})
    assert "Access-Control-Allow-Origin" not in denied.headers


def test_health_eager_does_not_contact_redis(app: Flask, client: FlaskClient) -> None:
    with patch("redis.Redis.ping", side_effect=AssertionError("Unexpected Redis call")):
        assert client.get("/api/v1/health").get_json() == {
            "status": "ok",
            "database": "ok",
            "queue": "skipped",
        }


def test_health_queue(app: Flask, client: FlaskClient) -> None:
    app.config["PIPELINE_EXECUTION"] = "queue"
    app.extensions["redis"] = fakeredis.FakeRedis()
    assert client.get("/api/v1/health").get_json() == {
        "status": "ok",
        "database": "ok",
        "queue": "ok",
    }


@pytest.mark.parametrize("configured", [True, False])
def test_health_queue_unavailable(
    app: Flask, client: FlaskClient, configured: bool
) -> None:
    app.config["PIPELINE_EXECUTION"] = "queue"
    app.extensions["redis"] = fakeredis.FakeRedis() if configured else None
    with patch("fakeredis.FakeRedis.ping", side_effect=ConnectionError()):
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.get_json() == {
        "status": "degraded",
        "database": "ok",
        "queue": "error" if configured else "unconfigured",
    }


def test_health_database_unavailable(client: FlaskClient) -> None:
    with patch(
        "app.services.health.db.session.execute",
        side_effect=OperationalError("SELECT 1", {}, Exception("Unavailable")),
    ):
        response = client.get("/api/v1/health")
    assert response.get_json() == {
        "status": "degraded",
        "database": "error",
        "queue": "skipped",
    }
