from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.extensions import db
from app.models import BusinessProfile, DiscoveredQuery, PipelineRun


def test_sqlite_migration_roundtrip(tmp_path: Path) -> None:
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
        }
    )
    runner = app.test_cli_runner()
    result = runner.invoke(args=["db", "upgrade"])
    assert result.exit_code == 0, result.output
    with app.app_context():
        assert set(inspect(db.engine).get_table_names()) == {
            "alembic_version",
            "business_profiles",
            "pipeline_runs",
            "discovered_queries",
            "content_recommendations",
        }
        # SQLAlchemy cannot reflect SQLite expression indexes; inspect the catalog.
        indexes = dict(
            db.session.execute(
                text("SELECT name, sql FROM sqlite_master WHERE type = 'index'")
            ).all()
        )
        assert "lower(domain)" in indexes["uq_business_profiles_domain_lower"]
        assert "lower(query_text)" in indexes["uq_queries_profile_text_lower"]
        profile = BusinessProfile(name="Example", domain="example.com", industry="SEO")
        run = PipelineRun(profile=profile)
        query = DiscoveredQuery(profile=profile, run=run, query_text="Best tools?")
        db.session.add(query)
        db.session.commit()
        assert query.to_dict()["visibility_status"] == "unknown"
        db.session.add(
            BusinessProfile(name="Duplicate", domain="EXAMPLE.COM", industry="SEO")
        )
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        db.session.add(
            DiscoveredQuery(profile=profile, run=run, query_text="BEST TOOLS?")
        )
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        db.session.add(
            DiscoveredQuery(profile_uuid=uuid4(), run=run, query_text="Orphan?")
        )
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        db.session.remove()
    result = runner.invoke(args=["db", "downgrade", "base"])
    assert result.exit_code == 0, result.output
    with app.app_context():
        assert inspect(db.engine).get_table_names() == ["alembic_version"]
    result = runner.invoke(args=["db", "upgrade"])
    assert result.exit_code == 0, result.output
