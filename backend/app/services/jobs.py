from uuid import UUID

from flask import current_app

from app.services.pipeline import PipelineOrchestrator


def run_pipeline_job(run_uuid: str) -> None:
    from app import create_app

    app = create_app()
    with app.app_context():
        PipelineOrchestrator().run(UUID(run_uuid))


def enqueue_pipeline(run_uuid: UUID) -> None:
    if current_app.config["PIPELINE_EXECUTION"] == "eager":
        PipelineOrchestrator().run(run_uuid)
    else:
        queue = current_app.extensions["queue"]
        if queue is None:
            raise RuntimeError("REDIS_URL is required in queue mode.")
        queue.enqueue(run_pipeline_job, str(run_uuid), job_id=str(run_uuid))
