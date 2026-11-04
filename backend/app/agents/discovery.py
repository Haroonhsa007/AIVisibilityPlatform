import json

from app.agents.base import AgentOutputError, BaseAgent, normalise_query
from app.agents.prompts.discovery import SYSTEM
from app.schemas.llm import DiscoveryResult


class QueryDiscoveryAgent(BaseAgent):
    def run(self, profile: dict) -> DiscoveryResult:
        output, _ = self.run_llm_json(
            SYSTEM, json.dumps({"profile": profile}), DiscoveryResult
        )
        unique = {}
        for query in output.queries:
            unique.setdefault(normalise_query(query.query_text), query)
        output.queries = list(unique.values())[:20]
        if len(output.queries) < 8:
            raise AgentOutputError(
                "Discovery returned fewer than eight distinct questions."
            )
        return output
