from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from app.llm.fake_client import FakeLLMClient


def openapi_schema_to_json_schema(value):
    """OpenAPI 3.0 nullable applies to references/allOf and enum as well as types."""
    if isinstance(value, list):
        return [openapi_schema_to_json_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    converted = {
        key: openapi_schema_to_json_schema(item)
        for key, item in value.items()
        if key != "nullable"
    }
    return (
        {"anyOf": [converted, {"type": "null"}]} if value.get("nullable") else converted
    )


def test_every_endpoint_matches_contract(client, profile_data) -> None:
    path = Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml"
    contract = openapi_schema_to_json_schema(yaml.safe_load(path.read_text()))
    registry = Registry().with_resource(
        "urn:aivis:contract",
        Resource.from_contents(contract, default_specification=DRAFT202012),
    )
    exercised = set()

    def check(method, path_template, path_actual=None, **kwargs):
        response = getattr(client, method)(path_actual or path_template, **kwargs)
        operation = contract["paths"][path_template][method]
        status = str(response.status_code)
        assert status in operation["responses"], (
            path_template,
            status,
            response.get_json(),
        )
        definition = operation["responses"][status]
        if "$ref" in definition:
            definition = contract["components"]["responses"][
                definition["$ref"].rsplit("/", 1)[1]
            ]
        schema = definition["content"]["application/json"]["schema"]

        # Absolute internal refs resolve against the authoritative OpenAPI document.
        def absolute(value):
            if isinstance(value, list):
                return [absolute(item) for item in value]
            if isinstance(value, dict):
                return {
                    key: "urn:aivis:contract" + item
                    if key == "$ref" and item.startswith("#")
                    else absolute(item)
                    for key, item in value.items()
                }
            return value

        Draft202012Validator(
            absolute(schema), registry=registry, format_checker=FormatChecker()
        ).validate(response.get_json())
        exercised.add((path_template, method))
        return response.get_json()

    check("get", "/api/v1/health")
    check("get", "/api/v1/dashboard")
    profile = check("post", "/api/v1/profiles", json=profile_data)
    profile_uuid = profile["profile_uuid"]
    check("get", "/api/v1/profiles")
    check("get", "/api/v1/profiles/{profile_uuid}", f"/api/v1/profiles/{profile_uuid}")
    run = check(
        "post",
        "/api/v1/profiles/{profile_uuid}/run",
        f"/api/v1/profiles/{profile_uuid}/run",
    )
    check("get", "/api/v1/runs/{run_uuid}", f"/api/v1/runs/{run['run_uuid']}")
    check(
        "get",
        "/api/v1/profiles/{profile_uuid}/runs",
        f"/api/v1/profiles/{profile_uuid}/runs",
    )
    queries = check(
        "get",
        "/api/v1/profiles/{profile_uuid}/queries",
        f"/api/v1/profiles/{profile_uuid}/queries",
    )
    check(
        "get",
        "/api/v1/profiles/{profile_uuid}/recommendations",
        f"/api/v1/profiles/{profile_uuid}/recommendations",
    )
    query_uuid = queries["items"][0]["query_uuid"]
    check(
        "post",
        "/api/v1/queries/{query_uuid}/recheck",
        f"/api/v1/queries/{query_uuid}/recheck",
    )
    check("get", "/api/v1/dashboard")
    check("get", "/api/v1/profiles/{profile_uuid}", f"/api/v1/profiles/{profile_uuid}")
    check("post", "/api/v1/profiles", json=profile_data)  # 409
    check("post", "/api/v1/profiles", json={**profile_data, "domain": "http://x.com"})
    check("get", "/api/v1/profiles/{profile_uuid}", f"/api/v1/profiles/{uuid4()}")
    check(
        "get",
        "/api/v1/profiles/{profile_uuid}/queries",
        f"/api/v1/profiles/{profile_uuid}/queries?status=invalid",
    )
    with patch(
        "app.services.pipeline.get_llm_client",
        return_value=FakeLLMClient("raise_error"),
    ):
        check(
            "post",
            "/api/v1/queries/{query_uuid}/recheck",
            f"/api/v1/queries/{query_uuid}/recheck",
        )
    assert exercised == {
        (path, method)
        for path, methods in contract["paths"].items()
        for method in methods
    }
