import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask

from app.config import CONFIGS
from app.errors import register_error_handlers
from app.extensions import cors, db, init_queue, migrate


def create_app(config_name: str | dict | None = None) -> Flask:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app = Flask(__name__)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    logging.getLogger("app").setLevel(logging.INFO)
    overrides = config_name if isinstance(config_name, dict) else {}
    name = (
        config_name
        if isinstance(config_name, str)
        else os.getenv("FLASK_ENV", "development")
    )
    app.config.from_object(CONFIGS[name]())
    app.config.update(overrides)
    db.init_app(app)
    from app import models  # noqa: F401 -- register all tables with metadata

    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    init_queue(app)
    register_error_handlers(app)
    from app.services.seed import seed_demo_command

    app.cli.add_command(seed_demo_command)

    from app.api.dashboard import bp as dashboard_bp
    from app.api.health import bp as health_bp
    from app.api.profiles import bp as profiles_bp
    from app.api.queries import bp as queries_bp
    from app.api.runs import bp as runs_bp

    app.register_blueprint(profiles_bp, url_prefix="/api/v1")
    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(runs_bp, url_prefix="/api/v1")
    app.register_blueprint(queries_bp, url_prefix="/api/v1")
    app.register_blueprint(dashboard_bp, url_prefix="/api/v1")
    if app.config["SWEEP_STALE_RUNS"]:
        from app.services.pipeline import sweep_stale_runs

        with app.app_context():
            sweep_stale_runs()
    return app
