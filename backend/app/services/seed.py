import click
from sqlalchemy import select

from app.extensions import db
from app.models import BusinessProfile
from app.schemas.profile import ProfileCreate
from app.services.pipeline import ACTIVE, start_run
from app.services.profiles import create_profile

DEMO = {
    "name": "Surfer SEO",
    "domain": "surferseo.com",
    "industry": "SEO Software",
    "description": "AI-powered SEO content optimization tool",
    "competitors": ["clearscope.io", "marketmuse.com", "frase.io"],
}


def seed_demo(run_pipeline: bool = False) -> BusinessProfile:
    profile = db.session.scalar(
        select(BusinessProfile).where(BusinessProfile.domain == DEMO["domain"])
    )
    if profile is None:
        profile = create_profile(ProfileCreate.model_validate(DEMO))
    # Idempotent: do not duplicate a queued, successful or partial demo run.
    if run_pipeline and not any(
        run.status in (*ACTIVE, "completed", "partial") for run in profile.runs
    ):
        start_run(profile.uuid)
    return profile


@click.command("seed-demo")
@click.option("--run", "run_pipeline", is_flag=True, help="Also run the demo pipeline.")
def seed_demo_command(run_pipeline: bool) -> None:
    profile = seed_demo(run_pipeline)
    click.echo(f"Demo profile: {profile.uuid} ({profile.domain})")
