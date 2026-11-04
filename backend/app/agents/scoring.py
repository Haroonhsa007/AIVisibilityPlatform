import json

from app.agents.base import AgentOutputError, BaseAgent, normalise_query
from app.agents.prompts.scoring import SYSTEM
from app.schemas.llm import ScoredQuery, ScoringOutput
from app.utils.domains import domain_matches


class VisibilityScoringAgent(BaseAgent):
    def score_batch(self, profile: dict, queries: list[dict]) -> list[ScoredQuery]:
        if not 1 <= len(queries) <= 5:
            raise AgentOutputError("Scoring batches must contain one to five queries.")
        output, _ = self.run_llm_json(
            SYSTEM, json.dumps({"profile": profile, "queries": queries}), ScoringOutput
        )
        expected = {
            normalise_query(query["query_text"]): query["query_text"]
            for query in queries
        }
        matched = {}
        duplicate = set()
        for result in output.results:
            key = normalise_query(result.query_text)
            if key not in expected:
                continue
            if key in matched:
                duplicate.add(key)
                continue
            domains = list(dict.fromkeys(result.cited_domains))
            position = next(
                (
                    i + 1
                    for i, domain in enumerate(domains)
                    if domain_matches(domain, profile["domain"])
                ),
                None,
            )
            matched[key] = ScoredQuery(
                **(
                    result.model_dump()
                    | {"query_text": expected[key], "cited_domains": domains}
                ),
                domain_visible=position is not None,
                visibility_position=position,
            )
        return [item for key, item in matched.items() if key not in duplicate]

    def score_one(self, profile: dict, query: dict) -> ScoredQuery:
        results = self.score_batch(profile, [query])
        if len(results) != 1:
            raise AgentOutputError("Scoring did not return the requested query.")
        return results[0]
