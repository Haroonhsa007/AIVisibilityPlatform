from types import SimpleNamespace as NS
from unittest.mock import Mock

import anthropic
import httpx
import openai
import pytest

from app.agents.discovery import QueryDiscoveryAgent
from app.llm.anthropic_client import AnthropicClient
from app.llm.base import NonRetryableLLMError, RetryableLLMError
from app.llm.fake_client import FakeLLMClient
from app.llm.openai_client import OpenAIClient


@pytest.mark.parametrize("kind", ["anthropic", "openai"])
def test_timeouts_mapped_and_bounded(kind) -> None:
    sdk = Mock()
    module, cls, endpoint = (
        (openai, OpenAIClient, sdk.chat.completions.create)
        if kind == "openai"
        else (anthropic, AnthropicClient, sdk.messages.create)
    )
    endpoint.side_effect = module.APITimeoutError(
        request=httpx.Request("POST", "https://example.com")
    )
    client = cls(model="test", sdk_client=sdk, retry_min_seconds=0, retry_max_seconds=0)
    with pytest.raises(RetryableLLMError):
        client.complete("system", "user")
    assert endpoint.call_count == 3


@pytest.mark.parametrize("kind", ["anthropic", "openai"])
def test_truncated_output_usage_preserved(kind) -> None:
    sdk = Mock()
    if kind == "anthropic":
        sdk.messages.create.return_value = NS(
            content=[NS(type="text", text="{cut")],
            stop_reason="max_tokens",
            usage=NS(input_tokens=100, output_tokens=50),
        )
        cls = AnthropicClient
    else:
        sdk.chat.completions.create.return_value = NS(
            choices=[NS(message=NS(content="{cut"), finish_reason="length")],
            usage=NS(prompt_tokens=100, completion_tokens=50),
        )
        cls = OpenAIClient
    agent = QueryDiscoveryAgent(cls(model="test", sdk_client=sdk))
    with pytest.raises(NonRetryableLLMError):
        agent.run({"name": "Example", "domain": "example.com", "industry": "SEO"})
    assert agent.tokens_used == 150


def test_scripted_provider_failure_usage() -> None:
    agent = QueryDiscoveryAgent(
        FakeLLMClient(responses=[NonRetryableLLMError("failure", tokens_used=40)])
    )
    with pytest.raises(NonRetryableLLMError):
        agent.run({})
    assert agent.tokens_used == 40
