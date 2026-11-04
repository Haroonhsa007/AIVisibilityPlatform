from pathlib import Path

import yaml
from sqlalchemy import func, select

from app.extensions import db
from app.models import BusinessProfile, DiscoveredQuery, PipelineRun


def test_seed_command_idempotent(app) -> None:
    runner = app.test_cli_runner()
    first = runner.invoke(args=["seed-demo", "--run"])
    assert first.exit_code == 0, first.output
    second = runner.invoke(args=["seed-demo", "--run"])
    assert second.exit_code == 0, second.output
    assert first.output == second.output
    assert db.session.scalar(select(func.count()).select_from(BusinessProfile)) == 1
    assert db.session.scalar(select(func.count()).select_from(PipelineRun)) == 1
    assert db.session.scalar(select(func.count()).select_from(DiscoveredQuery)) == 12


def test_workflow_and_compose_yaml() -> None:
    root = Path(__file__).resolve().parents[2]
    # BaseLoader preserves YAML 1.2's `on` instead of treating it as boolean.
    workflow = yaml.load(
        (root / ".github/workflows/backend.yml").read_text(), Loader=yaml.BaseLoader
    )
    assert set(workflow["on"]) == {"push", "pull_request"}
    commands = [step.get("run", "") for step in workflow["jobs"]["backend"]["steps"]]
    assert "pytest --cov=app --cov-fail-under=85" in commands
    compose = yaml.safe_load((root / "docker-compose.yml").read_text())
    assert set(compose["services"]) == {"api", "worker", "db", "redis", "frontend"}
    assert compose["services"]["api"]["environment"]["PIPELINE_EXECUTION"] == "queue"
    assert compose["services"]["worker"]["command"] == ["python", "worker.py"]
