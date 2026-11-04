from flask import current_app

from app.llm.base import LLMClient, NonRetryableLLMError


def get_llm_client(provider: str | None = None, model: str | None = None) -> LLMClient:
    config = current_app.config
    provider = provider or config["LLM_PROVIDER"]
    if provider == "fake":
        from app.llm.fake_client import FakeLLMClient

        return FakeLLMClient()
    options = {
        "model": model or config["DISCOVERY_MODEL"],
        "timeout": config["LLM_TIMEOUT_SECONDS"],
        "max_attempts": config["LLM_MAX_ATTEMPTS"],
        "retry_min_seconds": config["LLM_RETRY_MIN_SECONDS"],
        "retry_max_seconds": config["LLM_RETRY_MAX_SECONDS"],
    }
    if provider == "anthropic":
        from app.llm.anthropic_client import AnthropicClient

        return AnthropicClient(api_key=config["ANTHROPIC_API_KEY"], **options)
    if provider == "openai":
        from app.llm.openai_client import OpenAIClient

        return OpenAIClient(api_key=config["OPENAI_API_KEY"], **options)
    raise NonRetryableLLMError("Unsupported LLM provider.")
