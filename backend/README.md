# AI Visibility Intelligence API

Flask 3 API with SQLAlchemy 2, PostgreSQL/SQLite, Pydantic-validated agents and
Redis/RQ background execution. The backend implements every endpoint in
`../docs/api/openapi.yaml`. All discovery, volume, difficulty and
visibility results are **LLM estimates**, not observed searches or live AI-answer
measurements. Query responses include `data_source: "llm_estimate"`.

## Quick start with Docker

Requires Docker Compose v2.24+ and curl/jq for the smoke script. From the repository root:

```sh
cp backend/.env.example backend/.env
docker compose up --build -d --wait
curl -4 http://localhost:5000/api/v1/health
bash backend/scripts/smoke.sh
docker compose exec api flask seed-demo --run
```

The default provider is `fake`: the complete pipeline works offline without API
keys. Compose overrides the local SQLite/eager settings with PostgreSQL and queue
mode; a separate worker container processes runs. Gunicorn serves on port 5000
with two workers. Set `API_PORT=5001` before `docker compose up` to change the host
port (then set `BASE_URL=http://localhost:5001` for the smoke script).
Use IPv4 loopback (`127.0.0.1` or `curl -4`) on macOS if AirPlay owns IPv6 port 5000. The smoke script selects IPv4 to match the Compose port binding.

```sh
docker compose logs -f api worker
docker compose up -d --scale worker=2
docker compose down
docker compose up -d --wait
```

The named PostgreSQL volume preserves data across down/up. `down -v` removes it.
The local demo DB uses trust authentication on the internal Compose network;
PostgreSQL and Redis have no published host ports. API is bound to loopback.
For an externally deployed database, supply an authenticated `DATABASE_URL` via
that deployment's environment. No credentials are stored in the repository.
No frontend container is included; T10 owns frontend integration.

## Local setup

Python 3.12 is required. From `backend/`:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
flask db upgrade
flask run -p 5000
```

Alternatively, `uv venv --python 3.12 --seed .venv` creates the environment.
Flask discovers `wsgi.py`; the example also sets `FLASK_APP=wsgi:app`.
`sqlite:///dev.db` stores data in the ignored `backend/instance/` directory.
The default eager mode runs the job inline for local demos/tests and still returns
202 with a queued snapshot; polling GET returns the persisted terminal result.

For local background execution, run Redis separately and set the following in
both terminals (use an absolute SQLite path or a PostgreSQL URL):

```sh
export PIPELINE_EXECUTION=queue REDIS_URL=redis://localhost:6379/0 LLM_PROVIDER=fake
flask db upgrade
python worker.py
# In a second terminal with the same environment:
gunicorn wsgi:app --workers 2 --bind 127.0.0.1:5000
```

`flask seed-demo` creates the brief's Surfer SEO profile. `flask seed-demo --run`
also starts a run; repeating it does not duplicate the profile or a successful,
partial, queued, or running demo run. A failed demo run can be retried. The same
command is available as `python -m scripts.seed --run` from `backend/`.

## Configuration

Environment takes precedence over the optional ignored `backend/.env`.
Model names and defaults are centralized in `app/config.py`.

| Variable                | Local default / purpose                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `FLASK_APP`             | `wsgi:app` (also auto-discovered)                                                 |
| `FLASK_ENV`             | `development`; also `testing`, `production`. Debug is opt-in via `flask --debug`. |
| `DATABASE_URL`          | `sqlite:///dev.db`; PostgreSQL URLs select psycopg 3 automatically                |
| `REDIS_URL`             | Empty; needed for queue mode                                                      |
| `PIPELINE_EXECUTION`    | `eager`; Compose explicitly uses `queue`                                          |
| `SCORING_CONCURRENCY`   | `4`, maximum simultaneous scoring batches per run                                 |
| `RECOMMENDATION_TOP_N`  | `8` absent-domain queries passed to agent 3                                       |
| `RUN_STALE_MINUTES`     | `30`; stale queued/running rows fail on API/worker startup                        |
| `JOB_TIMEOUT_SECONDS`   | `900`; RQ job timeout, keep below stale threshold                                 |
| `CORS_ORIGINS`          | `http://localhost:4200`, comma-separated allowlist                                |
| `SECRET_KEY`            | Empty; optional because this API has no sessions/auth                             |
| `LLM_PROVIDER`          | `fake`, or `anthropic` / `openai`                                                 |
| `ANTHROPIC_API_KEY`     | Empty; required only for Anthropic                                                |
| `OPENAI_API_KEY`        | Empty; required only for OpenAI                                                   |
| `DISCOVERY_MODEL`       | Empty selects provider default below                                              |
| `SCORING_MODEL`         | Empty selects provider default below                                              |
| `RECOMMENDATION_MODEL`  | Empty selects provider default below                                              |
| `LLM_TIMEOUT_SECONDS`   | `45` per provider request                                                         |
| `LLM_MAX_ATTEMPTS`      | `3` total attempts (1–3 supported)                                                |
| `LLM_RETRY_MIN_SECONDS` | `1`, exponential-backoff starting delay with jitter                               |
| `LLM_RETRY_MAX_SECONDS` | `8`, delay cap                                                                    |

Compose reads provider keys/models and optional limits from `backend/.env`.
Its internal database URL, Redis URL, production environment and queue execution
mode are fixed in Compose so copying the local example does not break the stack.
Restart/recreate API and worker after changing provider configuration.

## Providers and model selection

The architecture prescribes Anthropic `claude-haiku-5-5` for discovery/scoring and
`claude-sonnet-5-5` for recommendations: lighter models handle structured batch
estimates, while the larger model handles content rationale. OpenAI uses `gpt-4o`
for all three stages, as requested in the brief. These are configurable architecture
defaults; account/model availability has not been tested with live calls.

Choose `LLM_PROVIDER=anthropic` or `openai`, add only that provider's key to your
local environment, and optionally override each model. No source changes are
needed. Anthropic uses Messages; OpenAI uses Chat Completions with JSON-object
response format. Override OpenAI models only with models supporting that API,
JSON mode and the configured generation parameters. Both adapters disable SDK
retries and use one bounded Tenacity retry policy for 429, 5xx and connection/
timeout failures. Other provider errors fail immediately. Keys and prompts are
never logged at INFO. No real LLM calls were used during backend verification.

`FakeLLMClient` is an explicit offline provider, never a silent fallback after a
live-provider failure. It returns stable questions, estimates, citations and
recommendations, with injectable invalid/fenced/prose/schema/failure scenarios.

## API overview

All responses are JSON under `/api/v1`, with UUID identifiers and UTC `Z` dates.

| Method | Path                                       | Result                                                              |
| ------ | ------------------------------------------ | ------------------------------------------------------------------- |
| GET    | `/health`                                  | Database/queue status                                               |
| GET    | `/dashboard`                               | Aggregate counts, average score, latest ten runs with profile names |
| POST   | `/profiles`                                | Create profile (201); duplicate normalized domain is 409            |
| GET    | `/profiles`                                | Newest-first profile page                                           |
| GET    | `/profiles/{profile_uuid}`                 | Profile with nullable latest_run                                    |
| POST   | `/profiles/{profile_uuid}/run`             | Queued run snapshot (202); active run is 409                        |
| GET    | `/profiles/{profile_uuid}/runs`            | Newest-first run history                                            |
| GET    | `/runs/{run_uuid}`                         | Poll persisted stage, counters and terminal state                   |
| GET    | `/profiles/{profile_uuid}/queries`         | Filtered/sorted query page                                          |
| GET    | `/profiles/{profile_uuid}/recommendations` | High/medium/low priority, then newest                               |
| POST   | `/queries/{query_uuid}/recheck`            | Synchronous score refresh; 502 leaves row unchanged                 |

```sh
curl -i -X POST http://localhost:5000/api/v1/profiles \
  -H 'Content-Type: application/json' \
  -d '{"name":"Surfer SEO","domain":"surferseo.com","industry":"SEO Software","description":"AI-powered SEO content optimization tool","competitors":["clearscope.io","marketmuse.com","frase.io"]}'
# Use profile_uuid from the response:
curl -X POST http://localhost:5000/api/v1/profiles/PROFILE_UUID/run
curl http://localhost:5000/api/v1/runs/RUN_UUID
curl 'http://localhost:5000/api/v1/profiles/PROFILE_UUID/queries?min_score=0.5&status=not_visible&page=1&per_page=20&sort=opportunity_score&order=desc'
curl 'http://localhost:5000/api/v1/profiles/PROFILE_UUID/recommendations?priority=high'
curl -X POST http://localhost:5000/api/v1/queries/QUERY_UUID/recheck
```

Query `status` accepts `visible`, `not_visible`, `unknown` (null visibility).
Sort fields: `opportunity_score`, `estimated_search_volume`,
`competitive_difficulty`, `discovered_at`; direction is `asc` or `desc`, nulls
last. Pagination is one-based with `per_page` 1–100. Beyond-range pages are empty.
Profile domains reject schemes, paths, ports and internal spaces; competitor
hostnames are normalized/deduplicated and cannot include the target domain.

Errors use `{"error":{"code":"validation_error","message":"...","details":{"domain":"..."}}}`.
Malformed/non-JSON create bodies return 400, field/query validation 422,
missing/invalid UUIDs 404, conflicts 409, upstream errors 502, unexpected errors 500.
Health retains the contract's HTTP 200 and reports `status: degraded` if a
configured dependency fails. Eager mode reports `queue: skipped`. Docker health
checks additionally require the JSON status to be `ok`.

## Architecture and agent design

```text
Angular SPA (Tailwind + CDK) ──HTTP/JSON──> Flask API (gunicorn) ──> PostgreSQL
                                                │
                                                └─enqueue─> Redis ──> RQ worker ──> LLM provider
                                                                         (Anthropic | OpenAI | Fake)
```

1. **Discovery** generates varied informational/comparison/transactional/navigation
   questions. Prompts request 10–20; validation tolerates 8–25, deduplicates and
   trims to 20. Persisted questions are upserted by profile + lowercase text.
2. **Scoring** estimates volume/difficulty and ordered cited domains in batches
   of at most five. The main thread builds plain input dictionaries, dispatches
   bounded LLM threads, then writes results/counters after each completed batch.
   Worker threads never use ORM rows, DB sessions or Flask context. Visibility
   and one-based position are derived in code using exact/subdomain matches;
   `evilsurferseo.com` cannot match `surferseo.com`. Missing, ambiguous or unmatched
   scoring results leave those questions unknown.
3. **Recommendations** sees the top absent-domain scored queries and requests
   3–5 actionable pieces, valid content/priority enums and 3–6 keywords. Unknown
   target UUIDs are dropped. Existing recommendations are replaced only after a
   new validated result; failure preserves the previous set. When all scored
   queries are visible, old recommendations are cleared and this stage is skipped.

Prompts live in `app/agents/prompts/` with role, constraints, JSON shape and example.
`BaseAgent` extracts the first balanced top-level JSON object (including fenced or
prose-wrapped output), validates through Pydantic, then makes one repair call on
invalid JSON/schema. Invalid twice raises `AgentOutputError`. Provider failures
are `LLMError` subclasses. Usage includes repairs and reported usage on incomplete
provider responses. Agents are pure and do not access the database.

Discovery failure or zero scored questions means `failed`; failed batches or
recommendation generation with some scores means `partial`; otherwise `completed`.
Profiles map partial/completed runs to `completed` (the profile enum has no partial).
Unexpected exceptions persist a safe terminal failure. Atomic job claims prevent
redelivery from running a job twice; a partial unique index enforces at most one
queued/running run per profile. Startup sweeps fail interrupted runs older than
the stale threshold. Each stage logs its run UUID without prompts or keys.

## Opportunity score

Volume and difficulty are estimates. The score is computed in code:

```text
volume_norm = min(1, log10(1 + volume) / log10(100001))
ease = 1 - difficulty / 100
gap = 0.5 + 0.5 * competitors_cited / max(1, competitor_count)  # absent
    = min(0.3, 0.1 * (position - 1))                           # visible
    = 0.5                                                    # unknown
score = round(clamp(0.40*volume_norm + 0.25*ease + 0.35*gap, 0, 1), 3)
```

Null volume/difficulty yields null score. Competitor counts are subdomain-aware.
Components are persisted internally for explainability. The weights balance
log-scaled demand, winnability, and competitive gap; already-visible #1 results
have less headroom.

Worked example: volume **100,000**, difficulty **20**, target **absent**, **1 of 2**
competitors cited. `volume_norm=1`, `ease=0.8`, `gap=0.75`; raw score is
`0.4 + 0.2 + 0.2625 = 0.8625`, reported as **0.863**. This exact example is asserted
in `tests/test_pipeline.py::test_worked_example_and_ordering`.

## Testing and schema management

```sh
# From backend/ with the environment activated:
ruff check .
ruff format --check .
pytest --cov=app --cov-fail-under=85
pip check
python -m compileall -q app wsgi.py worker.py scripts migrations
# With a running offline-provider API:
BASE_URL=http://localhost:5000 bash scripts/smoke.sh
```

Tests use SQLite, fakeredis, FakeLLMClient and mocked SDKs. A global HTTPX guard
prevents accidental real provider requests. Coverage is gated at 85%. Contract
conformance loads `docs/api/openapi.yaml` (tracked in git so CI can read it) relative to the tests and
handles OpenAPI 3.0 nullable semantics. CI checks out the full repository, runs
lint/format/tests/coverage on Python 3.12 and builds the runtime image.

Migrations support both SQLite and PostgreSQL; use `flask db upgrade`. To create
a future revision, use `flask db migrate -m 'description'` and review it before the
Director commits it. SQLite autogeneration cannot reflect expression indexes:
preserve the explicit lowercase domain/query indexes. `0002` adds the partial
active-run index. API containers migrate before Gunicorn; workers wait for API
health so they cannot consume jobs against an uninitialized schema.

## Project structure

```text
backend/
  app/
    __init__.py, config.py, extensions.py, errors.py
    api/           thin profile, run, query, dashboard and health blueprints
    models/        profiles, runs, questions, recommendations and serializers
    schemas/       request and structured LLM-output validation
    llm/           provider interface, two adapters, fake and factory
    agents/        three pure agents, shared validation/repair, prompts/
    services/      database operations, pipeline, RQ jobs, health, demo seed
    utils/         hostname matching and score formula
  migrations/      initial schema and active-run constraint
  tests/           agents/, llm/, API, schema, pipeline and contract tests
  scripts/         smoke.sh and seed.py
  wsgi.py, worker.py, Dockerfile, requirements*.txt, .env.example
```

## Tradeoffs and scaling

The API is stateless and can scale behind a load balancer; workers scale separately
with `docker compose up -d --scale worker=N`. PostgreSQL indexes support profile
history, scoring/filter access and case-insensitive uniqueness. LLM concurrency
is bounded per run and provider retries are capped. SQLite/eager mode is for
quick local use; PostgreSQL/queue mode is the Compose default.

Volume/difficulty/visibility remain simulated estimates. Real volume providers
(such as DataForSEO), actual AI-answer sampling, caching/ETags, provider-wide rate
coordination and per-profile caching are future upgrades. API auth/multi-tenancy
is intentionally outside the assessment scope. This implementation favors clear
service boundaries and a small queue over heavier distributed orchestration.

Codex implemented and locally verified backend tasks T01–T05 with fake provider
calls and mocked adapters. The Lead (Claude) owns independent review; the Director
owns git commits and provider spot checks.

## Guided walkthrough

See the [ten-minute frontend/backend explanation](../docs/WALKTHROUGH.md), [captioned product recording](../docs/media/platform-walkthrough.mp4), and [Loom narration](../docs/LOOM_SCRIPT.md). The recording uses an isolated fake-provider stack and is separate from any live-provider setup.
