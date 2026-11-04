from collections.abc import Iterator

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app import create_app
from app.extensions import db


@pytest.fixture(autouse=True)
def forbid_provider_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Tests must not make real LLM HTTP requests")

    monkeypatch.setattr("httpx.Client.send", forbidden)


@pytest.fixture
def app() -> Iterator[Flask]:
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()


@pytest.fixture
def profile_data() -> dict:
    return {
        "name": "Surfer SEO",
        "domain": "surferseo.com",
        "industry": "SEO Software",
        "description": "AI-powered SEO content optimization tool",
        "competitors": ["clearscope.io", "marketmuse.com", "frase.io"],
    }
