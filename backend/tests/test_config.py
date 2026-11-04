from app import create_app
from app.config import DevelopmentConfig


def test_config_reads_env_per_instance(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("CORS_ORIGINS", "https://one.com, https://two.com")
    monkeypatch.setenv("DISCOVERY_MODEL", "custom-model")
    config = DevelopmentConfig()
    assert config.SQLALCHEMY_DATABASE_URI == "postgresql+psycopg://example/db"
    assert config.SCORING_MODEL == "gpt-4o"
    assert config.DISCOVERY_MODEL == "custom-model"
    assert config.CORS_ORIGINS == ["https://one.com", "https://two.com"]
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    assert DevelopmentConfig().SQLALCHEMY_DATABASE_URI == "sqlite:///:memory:"


def test_redis_handles_are_per_app_and_lazy() -> None:
    first = create_app({"REDIS_URL": "redis://localhost:6379/0"})
    second = create_app({"REDIS_URL": None})
    assert first.extensions["redis"] is not None
    assert first.extensions["queue"].connection is first.extensions["redis"]
    assert second.extensions["redis"] is None
    assert second.extensions["queue"] is None
