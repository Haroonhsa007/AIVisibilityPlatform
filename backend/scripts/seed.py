"""Run with `python -m scripts.seed [--run]` from backend/."""

from app import create_app
from app.services.seed import seed_demo_command

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        seed_demo_command()
