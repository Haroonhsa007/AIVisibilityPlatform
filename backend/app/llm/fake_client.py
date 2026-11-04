"""Explicit offline provider for tests and demos; never used as a live fallback."""

import hashlib
import json
from threading import Lock

from app.llm.base import LLMClient, LLMError, LLMResult, NonRetryableLLMError


class FakeLLMClient(LLMClient):
    def __init__(
        self,
        behaviour: str = "valid",
        fail_on_call_n: int | None = None,
        responses: list[str | LLMError] | None = None,
        behaviours: dict[str, str] | None = None,
    ) -> None:
        self.behaviour = behaviour
        self.behaviours = behaviours or {}
        self.fail_on_call_n = fail_on_call_n
        self.responses = responses or []
        self.calls = 0
        self._lock = Lock()

    def complete(
        self, system: str, user: str, max_tokens: int = 4096, temperature: float = 0
    ) -> LLMResult:
        with self._lock:
            self.calls += 1
            call = self.calls
            scripted = self.responses[call - 1] if call <= len(self.responses) else None
        if isinstance(scripted, LLMError):
            raise scripted
        if scripted is not None:
            return LLMResult(scripted, 100, 50)
        stage = next(
            (
                name
                for name in ("discovery", "scoring", "recommendations")
                if f"AGENT:{name}" in system
            ),
            None,
        )
        behaviour = self.behaviours.get(stage, self.behaviour)
        if behaviour == "raise_error" or call == self.fail_on_call_n:
            raise NonRetryableLLMError("Fake provider failure.")
        if behaviour == "invalid_json":
            return LLMResult("{invalid", 100, 50)
        if behaviour == "wrong_schema":
            return LLMResult('{"unexpected": true}', 100, 50)
        # Agent user messages are machine-generated JSON, never model output.
        payload = json.loads(user.split("\nREPAIR:", 1)[0])
        profile = payload["profile"]
        if stage == "discovery":
            industry, name = profile["industry"], profile["name"]
            competitor = next(iter(profile.get("competitors", [])), "other tools")
            questions = [
                f"What are the best {industry} tools for small businesses?",
                f"How does {name} compare with {competitor}?",
                f"How can a team get started with {industry}?",
                f"What does {name} cost for a growing team?",
                f"What are the alternatives to {name}?",
                f"Is {name} worth the investment?",
                f"Which {industry} platform works best for agencies?",
                f"How do I choose a {industry} solution?",
                f"Which {industry} tools offer a free trial?",
                f"Where can I find {name} documentation?",
                f"What should I measure when using {industry} tools?",
                f"Which {industry} platforms integrate with existing workflows?",
            ]
            result = {
                "queries": [
                    {
                        "query_text": question,
                        "intent": (
                            "informational",
                            "comparison",
                            "transactional",
                            "navigational",
                        )[i % 4],
                    }
                    for i, question in enumerate(questions)
                ]
            }
        elif stage == "scoring":
            results = []
            for query in payload["queries"]:
                digest = int(
                    hashlib.sha256(query["query_text"].encode()).hexdigest(), 16
                )
                cited = list(profile.get("competitors", []))[:7]
                if behaviour == "all_visible" or digest % 3 == 0:
                    cited.insert(0, profile["domain"])
                results.append(
                    {
                        "query_text": query["query_text"],
                        "estimated_search_volume": 100 + digest % 9900,
                        "competitive_difficulty": 15 + digest % 70,
                        "cited_domains": cited,
                    }
                )
            result = {"results": results}
        elif stage == "recommendations":
            targets = payload["targets"]
            result = {
                "recommendations": [
                    {
                        "target_query_uuid": targets[i % len(targets)]["query_uuid"],
                        "content_type": ("blog_post", "landing_page", "faq")[i % 3],
                        "title": (
                            "Practical guide: "
                            + targets[i % len(targets)]["query_text"]
                        ),
                        "rationale": (
                            "Answer this question with clear examples and evidence. "
                            "Structured facts help AI assistants cite the business."
                        ),
                        "target_keywords": [profile["industry"], "comparison", "guide"],
                        "priority": "high"
                        if targets[i % len(targets)]["opportunity_score"] >= 0.7
                        else "medium",
                    }
                    for i in range(3)
                ]
            }
        else:
            raise NonRetryableLLMError("Unknown fake agent prompt.")
        text = json.dumps(result)
        if behaviour == "fenced_json":
            text = f"```json\n{text}\n```"
        elif behaviour == "prose_json":
            text = f"Here is the result:\n{text}\nDone."
        return LLMResult(text, 100, 50)
