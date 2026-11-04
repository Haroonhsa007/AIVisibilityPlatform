import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from uuid import UUID

from flask import current_app
from sqlalchemy import delete, func, inspect, select, update
from sqlalchemy.exc import IntegrityError

from app.agents.base import AgentOutputError, normalise_query
from app.agents.discovery import QueryDiscoveryAgent
from app.agents.recommendation import ContentRecommendationAgent
from app.agents.scoring import VisibilityScoringAgent
from app.errors import APIError, UpstreamError
from app.extensions import db
from app.llm.base import LLMClient, LLMError
from app.llm.factory import get_llm_client
from app.models import (
    ContentRecommendation,
    DiscoveredQuery,
    PipelineRun,
)
from app.models.mixins import utcnow
from app.schemas.llm import ScoredQuery
from app.services.profiles import get_profile
from app.utils.domains import domain_matches
from app.utils.scoring import opportunity_score

logger = logging.getLogger(__name__)
ACTIVE = ("queued", "running")
SCORE_FIELDS = (
    "estimated_search_volume",
    "competitive_difficulty",
    "opportunity_score",
    "domain_visible",
    "visibility_position",
    "last_checked_at",
)


def get_run(run_uuid: UUID) -> PipelineRun:
    run = db.session.get(PipelineRun, run_uuid)
    if run is None:
        raise APIError("Run not found.", 404, "not_found")
    return run


def list_runs(profile_uuid: UUID) -> dict:
    get_profile(profile_uuid)
    runs = db.session.scalars(
        select(PipelineRun)
        .where(PipelineRun.profile_uuid == profile_uuid)
        .order_by(PipelineRun.created_at.desc(), PipelineRun.uuid.desc())
    ).all()
    return {"items": [run.to_dict() for run in runs]}


def start_run(profile_uuid: UUID) -> dict:
    profile = get_profile(profile_uuid)
    exists = db.session.scalar(
        select(PipelineRun.uuid).where(
            PipelineRun.profile_uuid == profile_uuid, PipelineRun.status.in_(ACTIVE)
        )
    )
    if exists is not None:
        raise APIError("A run is already queued or running.", 409, "conflict")
    run = PipelineRun(profile=profile)
    db.session.add(run)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise APIError("A run is already queued or running.", 409, "conflict") from None
    response = run.to_dict()  # Queued snapshot, including in eager mode.
    from app.services.jobs import enqueue_pipeline

    try:
        enqueue_pipeline(run.uuid)
    except Exception:
        db.session.rollback()
        run = get_run(UUID(response["run_uuid"]))
        run.status, run.completed_at = "failed", utcnow()
        run.error_message = "Could not enqueue pipeline."
        run.profile.status = "failed"
        db.session.commit()
        raise UpstreamError("The pipeline queue is unavailable.") from None
    return response


def sweep_stale_runs() -> int:
    if not inspect(db.engine).has_table("pipeline_runs"):
        return 0
    cutoff = utcnow() - timedelta(minutes=current_app.config["RUN_STALE_MINUTES"])
    runs = db.session.scalars(
        select(PipelineRun).where(
            PipelineRun.status.in_(ACTIVE),
            func.coalesce(PipelineRun.started_at, PipelineRun.created_at) < cutoff,
        )
    ).all()
    for run in runs:
        run.status, run.completed_at = "failed", utcnow()
        run.error_message = "worker interrupted"
        run.profile.status = "failed"
    db.session.commit()
    return len(runs)


def apply_score(query: DiscoveredQuery, result: ScoredQuery, profile: dict) -> None:
    cited = sum(
        any(domain_matches(domain, competitor) for domain in result.cited_domains)
        for competitor in profile["competitors"]
    )
    score = opportunity_score(
        result.estimated_search_volume,
        result.competitive_difficulty,
        result.domain_visible,
        result.visibility_position,
        cited,
        len(profile["competitors"]),
    )
    for field in SCORE_FIELDS:
        if hasattr(result, field):
            setattr(query, field, getattr(result, field))
    query.cited_domains = result.cited_domains
    query.opportunity_score = score.score if score else None
    query.score_components = score.components if score else {}
    query.last_checked_at = utcnow()


def recheck_query(query: DiscoveredQuery) -> DiscoveredQuery:
    profile = query.profile.to_dict()
    try:
        agent = VisibilityScoringAgent(
            get_llm_client(model=current_app.config["SCORING_MODEL"])
        )
        result = agent.score_one(profile, {"query_text": query.query_text})
    except (AgentOutputError, LLMError):
        raise UpstreamError() from None
    apply_score(query, result, profile)
    db.session.commit()
    return query


class PipelineOrchestrator:
    def __init__(self, client: LLMClient | None = None) -> None:
        self.client = client
        self.total_tokens = 0

    def _client(self, stage: str) -> LLMClient:
        return self.client or get_llm_client(model=current_app.config[f"{stage}_MODEL"])

    def _stage(self, run: PipelineRun, stage: str) -> None:
        run.stage, run.tokens_used = stage, self.total_tokens
        db.session.commit()
        logger.info("pipeline stage=%s run_uuid=%s", stage, run.uuid)

    @staticmethod
    def _score_batch(client: LLMClient, profile: dict, batch: list[dict]) -> tuple:
        agent = VisibilityScoringAgent(client)
        try:
            return agent.score_batch(profile, batch), agent.tokens_used, None
        except (AgentOutputError, LLMError):
            return [], agent.tokens_used, "Scoring batch failed."

    def _discover(self, run: PipelineRun, snapshot: dict) -> list[DiscoveredQuery]:
        self._stage(run, "discovery")
        discovery = QueryDiscoveryAgent(self._client("DISCOVERY"))
        try:
            output = discovery.run(snapshot)
        finally:
            self.total_tokens += discovery.tokens_used
        queries = []
        for item in output.queries:
            text = " ".join(item.query_text.split())
            query = db.session.scalar(
                select(DiscoveredQuery).where(
                    DiscoveredQuery.profile_uuid == run.profile_uuid,
                    func.lower(DiscoveredQuery.query_text) == text.lower(),
                )
            )
            if query is None:
                query = DiscoveredQuery(profile=run.profile, run=run, query_text=text)
                db.session.add(query)
            query.run_uuid = run.uuid
            # Old scores must not be presented as fresh if this rerun fails.
            for field in SCORE_FIELDS:
                setattr(query, field, None)
            query.cited_domains, query.score_components = [], {}
            queries.append(query)
        db.session.flush()
        run.queries_discovered = len(queries)
        return queries

    def _score(self, run: PipelineRun, snapshot: dict, queries: list) -> list[str]:
        self._stage(run, "scoring")
        failures = []
        rows = {normalise_query(query.query_text): query for query in queries}
        batches = [
            [{"query_text": query.query_text} for query in queries[i : i + 5]]
            for i in range(0, len(queries), 5)
        ]
        # No Flask objects or DB sessions enter the worker threads.
        with ThreadPoolExecutor(
            max_workers=current_app.config["SCORING_CONCURRENCY"]
        ) as pool:
            pending = {
                pool.submit(
                    self._score_batch, self._client("SCORING"), snapshot, batch
                ): batch
                for batch in batches
            }
            for future in as_completed(pending):
                results, tokens, failure = future.result()
                self.total_tokens += tokens
                if failure or len(results) != len(pending[future]):
                    failures.append(failure or "Scoring response omitted queries.")
                for result in results:
                    apply_score(
                        rows[normalise_query(result.query_text)], result, snapshot
                    )
                    run.queries_scored += 1
                run.tokens_used = self.total_tokens
                db.session.commit()
        return failures

    def _recommend(self, run: PipelineRun, snapshot: dict, queries: list) -> list[str]:
        self._stage(run, "recommendations")
        targets = sorted(
            (
                query
                for query in queries
                if query.domain_visible is False and query.opportunity_score is not None
            ),
            key=lambda query: query.opportunity_score,
            reverse=True,
        )[: current_app.config["RECOMMENDATION_TOP_N"]]
        if not targets:
            if run.queries_scored:
                db.session.execute(
                    delete(ContentRecommendation).where(
                        ContentRecommendation.profile_uuid == run.profile_uuid
                    )
                )
            return []
        agent = ContentRecommendationAgent(self._client("RECOMMENDATION"))
        try:
            drafts = agent.run(
                snapshot,
                [
                    {
                        "query_uuid": str(query.uuid),
                        "query_text": query.query_text,
                        "opportunity_score": query.opportunity_score,
                        "competitors_cited": query.cited_domains,
                    }
                    for query in targets
                ],
            )
            if not drafts:
                raise AgentOutputError("No valid recommendation targets.")
            db.session.execute(
                delete(ContentRecommendation).where(
                    ContentRecommendation.profile_uuid == run.profile_uuid
                )
            )
            for draft in drafts:
                fields = draft.model_dump()
                query_uuid = fields.pop("target_query_uuid")
                db.session.add(
                    ContentRecommendation(
                        profile_uuid=run.profile_uuid,
                        run_uuid=run.uuid,
                        query_uuid=query_uuid,
                        **fields,
                    )
                )
            run.recommendations_created = len(drafts)
            return []
        except (AgentOutputError, LLMError):
            return ["Recommendations failed."]
        finally:
            self.total_tokens += agent.tokens_used

    def run(self, run_uuid: UUID) -> None:
        run = get_run(run_uuid)
        claimed = db.session.execute(
            update(PipelineRun)
            .where(PipelineRun.uuid == run_uuid, PipelineRun.status == "queued")
            .values(status="running", started_at=utcnow())
        )
        db.session.commit()
        if not claimed.rowcount:
            return
        try:
            run.profile.status = "running"
            db.session.commit()
            snapshot = run.profile.to_dict()
            queries = self._discover(run, snapshot)
            failures = self._score(run, snapshot, queries)
            failures += self._recommend(run, snapshot, queries)
            run.status = (
                "failed"
                if not run.queries_scored
                else "partial"
                if failures
                else "completed"
            )
            run.error_message = " ".join(dict.fromkeys(failures)) or None
            if not run.queries_scored:
                run.error_message = "No queries could be scored."
        except (LLMError, AgentOutputError) as exc:
            # Expected provider failures (bad key/model, rate limit, unusable output)
            # get an actionable message; LLMError text is documented as credential-safe.
            db.session.rollback()
            run = get_run(run_uuid)
            run.status = "failed"
            run.error_message = (
                f"AI provider error: {exc}"
                if isinstance(exc, LLMError)
                else "The AI model returned an unusable response. Please try again."
            )
            logger.warning(
                "pipeline failed run_uuid=%s stage=%s reason=%s",
                run_uuid,
                run.stage,
                type(exc).__name__,
                exc_info=True,
            )
        except Exception:
            db.session.rollback()
            run = get_run(run_uuid)
            run.status = "failed"
            run.error_message = "Pipeline failed unexpectedly."
            logger.exception(
                "pipeline failed run_uuid=%s stage=%s", run_uuid, run.stage
            )
        run.tokens_used, run.completed_at = self.total_tokens, utcnow()
        run.profile.status = "failed" if run.status == "failed" else "completed"
        db.session.commit()
