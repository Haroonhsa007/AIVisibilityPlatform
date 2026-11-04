import json
from uuid import UUID

from app.agents.base import BaseAgent
from app.agents.prompts.recommendation import SYSTEM
from app.schemas.llm import RecommendationDraft, RecommendationOutput


class ContentRecommendationAgent(BaseAgent):
    def run(self, profile: dict, targets: list[dict]) -> list[RecommendationDraft]:
        if not targets:
            return []
        output, _ = self.run_llm_json(
            SYSTEM,
            json.dumps({"profile": profile, "targets": targets}),
            RecommendationOutput,
        )
        allowed = {UUID(str(target["query_uuid"])) for target in targets}
        return [
            item for item in output.recommendations if item.target_query_uuid in allowed
        ]
