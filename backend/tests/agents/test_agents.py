import json
from uuid import uuid4

import pytest

from app.agents.base import AgentOutputError, extract_object
from app.agents.discovery import QueryDiscoveryAgent
from app.agents.recommendation import ContentRecommendationAgent
from app.agents.scoring import VisibilityScoringAgent
from app.llm.base import LLMError
from app.llm.fake_client import FakeLLMClient

PROFILE = {
    "name": "Surfer SEO",
    "domain": "surferseo.com",
    "industry": "SEO Software",
    "competitors": ["clearscope.io", "frase.io"],
}


@pytest.mark.parametrize("behaviour", ["valid", "fenced_json", "prose_json"])
def test_discovery_output(behaviour: str) -> None:
    agent = QueryDiscoveryAgent(FakeLLMClient(behaviour))
    output = agent.run(PROFILE)
    assert len(output.queries) == 12
    assert len({item.query_text for item in output.queries}) == 12
    assert agent.tokens_used == 150


def test_repair_sums_tokens() -> None:
    fake = FakeLLMClient(responses=["bad JSON"])
    agent = QueryDiscoveryAgent(fake)
    assert len(agent.run(PROFILE).queries) == 12
    assert fake.calls == 2
    assert agent.tokens_used == 300


@pytest.mark.parametrize("behaviour", ["invalid_json", "wrong_schema"])
def test_invalid_twice_is_safe(behaviour: str) -> None:
    fake = FakeLLMClient(behaviour)
    agent = QueryDiscoveryAgent(fake)
    with pytest.raises(AgentOutputError):
        agent.run(PROFILE)
    assert fake.calls == 2
    assert agent.tokens_used == 300


def test_provider_failure_is_not_json_repair() -> None:
    fake = FakeLLMClient("raise_error")
    with pytest.raises(LLMError):
        QueryDiscoveryAgent(fake).run(PROFILE)
    assert fake.calls == 1


@pytest.mark.parametrize("count", [0, 7, 26])
def test_invalid_discovery_count(count: int) -> None:
    text = json.dumps(
        {
            "queries": [
                {"query_text": f"Question {i}?", "intent": "informational"}
                for i in range(count)
            ]
        }
    )
    with pytest.raises(AgentOutputError):
        QueryDiscoveryAgent(FakeLLMClient(responses=[text, text])).run(PROFILE)


def test_discovery_trim_and_dedupe() -> None:
    text = json.dumps(
        {
            "queries": [
                {"query_text": f"Question {i}?", "intent": "comparison"}
                for i in range(25)
            ]
        }
    )
    assert (
        len(QueryDiscoveryAgent(FakeLLMClient(responses=[text])).run(PROFILE).queries)
        == 20
    )
    text = json.dumps(
        {
            "queries": [
                {"query_text": "Same question?", "intent": "comparison"}
                for _ in range(10)
            ]
        }
    )
    with pytest.raises(AgentOutputError):
        QueryDiscoveryAgent(FakeLLMClient(responses=[text])).run(PROFILE)


def test_scoring_matches_normalised_text_and_subdomains() -> None:
    output = {
        "results": [
            {
                "query_text": "  BEST  tool? ",
                "estimated_search_volume": 500,
                "competitive_difficulty": 40,
                "cited_domains": ["clearscope.io", "docs.surferseo.com"],
            },
            {
                "query_text": "Unmatched?",
                "estimated_search_volume": 20,
                "competitive_difficulty": 0,
                "cited_domains": [],
            },
        ]
    }
    agent = VisibilityScoringAgent(FakeLLMClient(responses=[json.dumps(output)]))
    result = agent.score_batch(
        PROFILE, [{"query_text": "Best tool?"}, {"query_text": "Missing?"}]
    )
    assert len(result) == 1
    assert result[0].query_text == "Best tool?"
    assert result[0].domain_visible is True
    assert result[0].visibility_position == 2


@pytest.mark.parametrize(
    "domains,visible",
    [
        (["surferseo.com"], True),
        (["help.surferseo.com"], True),
        (["evilsurferseo.com"], False),
        (["surferseo.com.evil.com"], False),
        ([], False),
    ],
)
def test_visibility_is_derived(domains: list, visible: bool) -> None:
    text = json.dumps(
        {
            "results": [
                {
                    "query_text": "Q?",
                    "estimated_search_volume": 0,
                    "competitive_difficulty": 100,
                    "cited_domains": domains,
                    "domain_visible": not visible,
                }
            ]
        }
    )
    result = VisibilityScoringAgent(FakeLLMClient(responses=[text])).score_one(
        PROFILE, {"query_text": "Q?"}
    )
    assert result.domain_visible is visible
    assert result.visibility_position == (1 if visible else None)


@pytest.mark.parametrize(
    "field,value",
    [
        ("competitive_difficulty", 101),
        ("estimated_search_volume", -1),
        ("estimated_search_volume", True),
        ("cited_domains", ["https://surferseo.com"]),
    ],
)
def test_invalid_scoring_schema(field: str, value: object) -> None:
    item = {
        "query_text": "Q?",
        "estimated_search_volume": 100,
        "competitive_difficulty": 50,
        "cited_domains": [],
    }
    item[field] = value
    text = json.dumps({"results": [item]})
    with pytest.raises(AgentOutputError):
        VisibilityScoringAgent(FakeLLMClient(responses=[text, text])).score_one(
            PROFILE, {"query_text": "Q?"}
        )


def test_missing_or_duplicate_scoring_item() -> None:
    text = '{"results":[]}'
    with pytest.raises(AgentOutputError):
        VisibilityScoringAgent(FakeLLMClient(responses=[text])).score_one(
            PROFILE, {"query_text": "Q?"}
        )
    item = {
        "query_text": "Q?",
        "estimated_search_volume": 1,
        "competitive_difficulty": 1,
        "cited_domains": [],
    }
    text = json.dumps({"results": [item, item]})
    assert (
        VisibilityScoringAgent(FakeLLMClient(responses=[text])).score_batch(
            PROFILE, [{"query_text": "Q?"}]
        )
        == []
    )
    with pytest.raises(AgentOutputError):
        VisibilityScoringAgent(FakeLLMClient()).score_batch(PROFILE, [])


def test_recommendations_filter_unknown_uuid() -> None:
    known, unknown = str(uuid4()), str(uuid4())
    targets = [
        {"query_uuid": known, "query_text": "Best tool?", "opportunity_score": 0.8}
    ]
    fake = FakeLLMClient()
    agent = ContentRecommendationAgent(fake)
    assert len(agent.run(PROFILE, targets)) == 3
    response = fake.complete(
        "AGENT:recommendations", json.dumps({"profile": PROFILE, "targets": targets})
    ).text
    payload = json.loads(response)
    payload["recommendations"][0]["target_query_uuid"] = unknown
    result = ContentRecommendationAgent(
        FakeLLMClient(responses=[json.dumps(payload)])
    ).run(PROFILE, targets)
    assert len(result) == 2
    assert {str(item.target_query_uuid) for item in result} == {known}
    assert agent.run(PROFILE, []) == []


def test_invalid_recommendation_enum() -> None:
    targets = [
        {"query_uuid": str(uuid4()), "query_text": "Q?", "opportunity_score": 0.2}
    ]
    fake = FakeLLMClient()
    text = fake.complete(
        "AGENT:recommendations", json.dumps({"profile": PROFILE, "targets": targets})
    ).text
    text = text.replace('"blog_post"', '"video"')
    with pytest.raises(AgentOutputError):
        ContentRecommendationAgent(FakeLLMClient(responses=[text, text])).run(
            PROFILE, targets
        )


@pytest.mark.parametrize("text", [None, "", "{unclosed", "no object"])
def test_bad_json_extraction(text) -> None:
    with pytest.raises(ValueError):
        extract_object(text)


def test_extraction_respects_braces_in_strings() -> None:
    text = '{"x": "brace } and \\" quote", "y": {"a": 1}}'
    assert extract_object("prose " + text + " end") == text
