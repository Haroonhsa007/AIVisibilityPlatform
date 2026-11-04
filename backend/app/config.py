"""Environment configuration, evaluated for each app factory invocation."""

import os


class Config:
    TESTING = False
    DEBUG = False
    SWEEP_STALE_RUNS = True
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    def __init__(self) -> None:
        database_url = os.getenv("DATABASE_URL", "sqlite:///dev.db")
        # SQLAlchemy's unqualified postgres URL otherwise selects psycopg2.
        if database_url.startswith(("postgres://", "postgresql://")):
            database_url = "postgresql+psycopg://" + database_url.split("://", 1)[1]
        self.SQLALCHEMY_DATABASE_URI = database_url
        self.REDIS_URL = os.getenv("REDIS_URL") or None
        self.PIPELINE_EXECUTION = os.getenv("PIPELINE_EXECUTION", "eager")
        if self.PIPELINE_EXECUTION not in {"eager", "queue"}:
            raise ValueError("PIPELINE_EXECUTION must be eager or queue")
        self.SCORING_CONCURRENCY = int(os.getenv("SCORING_CONCURRENCY", "4"))
        self.RECOMMENDATION_TOP_N = int(os.getenv("RECOMMENDATION_TOP_N", "8"))
        self.RUN_STALE_MINUTES = int(os.getenv("RUN_STALE_MINUTES", "30"))
        self.JOB_TIMEOUT_SECONDS = int(os.getenv("JOB_TIMEOUT_SECONDS", "900"))
        if (
            min(
                self.RECOMMENDATION_TOP_N,
                self.RUN_STALE_MINUTES,
                self.JOB_TIMEOUT_SECONDS,
            )
            < 1
        ):
            raise ValueError("Pipeline limits must be positive")
        if self.SCORING_CONCURRENCY < 1:
            raise ValueError("SCORING_CONCURRENCY must be positive")
        self.CORS_ORIGINS = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",")
            if origin.strip()
        ]
        self.SECRET_KEY = os.getenv("SECRET_KEY") or None
        self.LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
        self.LLM_MAX_ATTEMPTS = int(os.getenv("LLM_MAX_ATTEMPTS", "3"))
        self.LLM_RETRY_MIN_SECONDS = float(os.getenv("LLM_RETRY_MIN_SECONDS", "1"))
        self.LLM_RETRY_MAX_SECONDS = float(os.getenv("LLM_RETRY_MAX_SECONDS", "8"))
        if not 1 <= self.LLM_MAX_ATTEMPTS <= 3 or self.LLM_TIMEOUT_SECONDS <= 0:
            raise ValueError("LLM attempts must be 1-3 and timeout must be positive")
        if not 0 <= self.LLM_RETRY_MIN_SECONDS <= self.LLM_RETRY_MAX_SECONDS:
            raise ValueError("Invalid LLM retry interval")
        self.LLM_PROVIDER = os.getenv("LLM_PROVIDER", "fake")
        self.ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or None
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or None
        if self.LLM_PROVIDER not in {"fake", "anthropic", "openai"}:
            raise ValueError("LLM_PROVIDER must be fake, anthropic, or openai")
        defaults = (
            ("gpt-4o", "gpt-4o", "gpt-4o")
            if self.LLM_PROVIDER == "openai"
            else ("claude-haiku-5-5", "claude-haiku-5-5", "claude-sonnet-5-5")
        )
        for variable, default in zip(
            ("DISCOVERY_MODEL", "SCORING_MODEL", "RECOMMENDATION_MODEL"),
            defaults,
            strict=True,
        ):
            setattr(self, variable, os.getenv(variable) or default)


class DevelopmentConfig(Config):
    pass


class TestingConfig(Config):
    TESTING = True

    def __init__(self) -> None:
        super().__init__()
        self.SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
        self.PIPELINE_EXECUTION = "eager"
        self.LLM_PROVIDER = "fake"
        self.REDIS_URL = None
        self.SWEEP_STALE_RUNS = False


class ProductionConfig(Config):
    pass


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
