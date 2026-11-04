from types import SimpleNamespace as NS
from unittest.mock import Mock, patch

import anthropic
import httpx
import openai
import pytest

from app.llm.anthropic_client import AnthropicClient
from app.llm.base import NonRetryableLLMError, RetryableLLMError
from app.llm.factory import get_llm_client
from app.llm.fake_client import FakeLLMClient
from app.llm.openai_client import OpenAIClient


@pytest.mark.parametrize("kind", ["openai", "anthropic"])
def test_adapters_and_retry(kind: str) -> None:
    sdk = Mock()
    response = httpx.Response(429, request=httpx.Request("POST", "https://example.com"))
    if kind == "openai":
        success = NS(
            choices=[NS(message=NS(content='{"ok":true}'), finish_reason="stop")],
            usage=NS(prompt_tokens=12, completion_tokens=8),
        )
        endpoint = sdk.chat.completions.create
        error = openai.RateLimitError("rate", response=response, body=None)
        cls = OpenAIClient
    else:
        success = NS(
            content=[NS(type="text", text='{"ok":true}')],
            stop_reason="end_turn",
            usage=NS(input_tokens=12, output_tokens=8),
        )
        endpoint = sdk.messages.create
        error = anthropic.RateLimitError("rate", response=response, body=None)
        cls = AnthropicClient
    endpoint.side_effect = [error, success]
    client = cls(
        model="test-model", sdk_client=sdk, retry_min_seconds=0, retry_max_seconds=0
    )
    output = client.complete("system JSON", "user", 500, 0.2)
    assert output.text == '{"ok":true}'
    assert output.tokens_used == 20
    assert endpoint.call_count == 2
    assert endpoint.call_args.kwargs["model"] == "test-model"
    if kind == "openai":
        assert endpoint.call_args.kwargs["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize("kind", ["openai", "anthropic"])
@pytest.mark.parametrize("status", [400, 500])
def test_status_mapping_and_attempt_limit(kind: str, status: int) -> None:
    sdk = Mock()
    response = httpx.Response(
        status, request=httpx.Request("POST", "https://example.com")
    )
    module, cls, endpoint = (
        (openai, OpenAIClient, sdk.chat.completions.create)
        if kind == "openai"
        else (anthropic, AnthropicClient, sdk.messages.create)
    )
    endpoint.side_effect = module.APIStatusError(
        "private provider message", response=response, body=None
    )
    client = cls(
        model="test-model", sdk_client=sdk, retry_min_seconds=0, retry_max_seconds=0
    )
    with pytest.raises(
        RetryableLLMError if status == 500 else NonRetryableLLMError
    ) as error:
        client.complete("system", "user")
    assert "private" not in str(error.value)
    assert endpoint.call_count == (3 if status == 500 else 1)


@pytest.mark.parametrize("cls", [AnthropicClient, OpenAIClient])
def test_missing_api_key(cls) -> None:
    with pytest.raises(NonRetryableLLMError):
        cls(model="test-model")


def test_factory_configuration(app) -> None:
    assert isinstance(get_llm_client(), FakeLLMClient)
    for provider, target in [
        ("openai", "OpenAIClient"),
        ("anthropic", "AnthropicClient"),
    ]:
        with patch(f"app.llm.{provider}_client.{target}") as constructor:
            get_llm_client(provider, "per-agent-model")
            assert constructor.call_args.kwargs["model"] == "per-agent-model"
            assert constructor.call_args.kwargs["timeout"] == 45
    with pytest.raises(NonRetryableLLMError):
        get_llm_client("unsupported")


def test_fake_fail_on_call() -> None:
    fake = FakeLLMClient(fail_on_call_n=1)
    with pytest.raises(NonRetryableLLMError):
        fake.complete("AGENT:discovery", "{}")
