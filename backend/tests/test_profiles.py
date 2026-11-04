from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from flask.testing import FlaskClient

from app.extensions import db
from app.models import BusinessProfile
from app.models.mixins import utcnow


def test_create_and_get_profile(client: FlaskClient, profile_data: dict) -> None:
    response = client.post("/api/v1/profiles", json=profile_data)
    assert response.status_code == 201
    data = response.get_json()
    assert set(data) == set(profile_data) | {
        "profile_uuid",
        "status",
        "created_at",
        "updated_at",
        "latest_run",
    }
    assert UUID(data["profile_uuid"])
    assert data.items() >= profile_data.items()
    assert data["status"] == "new"
    assert data["latest_run"] is None
    for field in ("created_at", "updated_at"):
        assert data[field].endswith("Z")
        assert datetime.fromisoformat(data[field]).utcoffset() == timedelta(0)
    fetched = client.get(f"/api/v1/profiles/{data['profile_uuid']}")
    assert fetched.status_code == 200
    assert fetched.get_json() == data


def test_normalisation_and_competitor_deduplication(
    client: FlaskClient, profile_data: dict
) -> None:
    profile_data.update(
        name="  Surfer SEO  ",
        domain="  SURFERSEO.COM ",
        competitors=["CLEARScope.io", "clearscope.io", " marketmuse.com "],
    )
    response = client.post("/api/v1/profiles", json=profile_data)
    assert response.status_code == 201
    data = response.get_json()
    assert data["domain"] == "surferseo.com"
    assert data["name"] == "Surfer SEO"
    assert data["competitors"] == ["clearscope.io", "marketmuse.com"]


def test_duplicate_domain_and_session_recovery(
    client: FlaskClient, profile_data: dict
) -> None:
    assert client.post("/api/v1/profiles", json=profile_data).status_code == 201
    profile_data["domain"] = "SURFERSEO.COM"
    duplicate = client.post("/api/v1/profiles", json=profile_data)
    assert duplicate.status_code == 409
    assert duplicate.get_json()["error"]["code"] == "conflict"
    profile_data["domain"] = "other.com"
    assert client.post("/api/v1/profiles", json=profile_data).status_code == 201
    assert client.get("/api/v1/profiles").get_json()["total"] == 2


@pytest.mark.parametrize(
    ("field", "value", "detail"),
    [
        ("name", "", "name"),
        ("name", "   ", "name"),
        ("name", "a" * 121, "name"),
        ("name", 42, "name"),
        ("domain", "http://x.com", "domain"),
        ("domain", None, "domain"),
        ("industry", "a" * 121, "industry"),
        ("description", "a" * 1001, "description"),
        ("competitors", ["surferseo.com"], "competitors"),
        ("competitors", ["http://x.com"], "competitors.0"),
        ("competitors", [f"c{i}.com" for i in range(11)], "competitors"),
        ("competitors", "other.com", "competitors"),
    ],
)
def test_validation_errors(
    client: FlaskClient, profile_data: dict, field: str, value: object, detail: str
) -> None:
    profile_data[field] = value
    response = client.post("/api/v1/profiles", json=profile_data)
    assert response.status_code == 422
    error = response.get_json()["error"]
    assert error["code"] == "validation_error"
    assert isinstance(error["details"][detail], str)


@pytest.mark.parametrize("field", ["name", "domain", "industry"])
def test_required_fields(client: FlaskClient, profile_data: dict, field: str) -> None:
    del profile_data[field]
    response = client.post("/api/v1/profiles", json=profile_data)
    assert response.status_code == 422
    assert field in response.get_json()["error"]["details"]


def test_optional_defaults_and_maximum_lengths(client: FlaskClient) -> None:
    response = client.post(
        "/api/v1/profiles",
        json={"name": "a" * 120, "domain": "example.com", "industry": "b" * 120},
    )
    assert response.status_code == 201
    assert response.get_json()["competitors"] == []
    assert response.get_json()["description"] == ""


@pytest.mark.parametrize("body", [None, [], "text", 1])
def test_json_non_object(client: FlaskClient, body: object) -> None:
    import json

    response = client.post(
        "/api/v1/profiles", data=json.dumps(body), content_type="application/json"
    )
    assert response.status_code == 422
    assert "body" in response.get_json()["error"]["details"]


@pytest.mark.parametrize(
    ("data", "content_type"),
    [("{}", "text/plain"), ("{broken", "application/json"), ("", None)],
)
def test_bad_request_bodies(
    client: FlaskClient, data: str, content_type: str | None
) -> None:
    response = client.post("/api/v1/profiles", data=data, content_type=content_type)
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "bad_request"


@pytest.mark.parametrize("profile_uuid", ["invalid", str(uuid4())])
def test_missing_or_invalid_uuid(client: FlaskClient, profile_uuid: str) -> None:
    response = client.get(f"/api/v1/profiles/{profile_uuid}")
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_empty_profiles(client: FlaskClient) -> None:
    assert client.get("/api/v1/profiles").get_json() == {
        "items": [],
        "page": 1,
        "per_page": 20,
        "total": 0,
        "pages": 0,
    }


def test_pagination_and_newest_first(client: FlaskClient) -> None:
    now = utcnow()
    for i in range(3):
        db.session.add(
            BusinessProfile(
                name=f"Profile {i}",
                domain=f"site{i}.com",
                industry="SEO",
                created_at=now + timedelta(seconds=i),
            )
        )
    db.session.commit()
    first = client.get("/api/v1/profiles?per_page=2").get_json()
    second = client.get("/api/v1/profiles?per_page=2&page=2").get_json()
    assert [item["name"] for item in first["items"]] == ["Profile 2", "Profile 1"]
    assert [item["name"] for item in second["items"]] == ["Profile 0"]
    assert (first["total"], first["pages"], first["per_page"]) == (3, 2, 2)
    assert second["page"] == 2
    assert client.get("/api/v1/profiles?page=99").get_json()["items"] == []


@pytest.mark.parametrize(
    "query", ["page=0", "page=-1", "page=x", "per_page=101", "per_page=0", "page=1.5"]
)
def test_invalid_pagination(client: FlaskClient, query: str) -> None:
    response = client.get(f"/api/v1/profiles?{query}")
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"
