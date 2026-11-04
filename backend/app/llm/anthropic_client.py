import anthropic

from app.llm.base import (
    LLMResult,
    NonRetryableLLMError,
    RetryableLLMError,
    SDKClient,
)


class AnthropicClient(SDKClient):
    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        timeout: float = 45,
        sdk_client: object | None = None,
        **retry_options: object,
    ) -> None:
        super().__init__(model, **retry_options)
        if sdk_client is None and not api_key:
            raise NonRetryableLLMError("ANTHROPIC_API_KEY is required.")
        self.sdk = sdk_client or anthropic.Anthropic(
            api_key=api_key, timeout=timeout, max_retries=0
        )

    def _complete(
        self, system: str, user: str, max_tokens: int, temperature: float
    ) -> LLMResult:
        try:
            response = self.sdk.messages.create(
                model=self.model,
                system=system,
                messages=[{"role": "user", "content": user}],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            text = "".join(
                block.text for block in response.content if block.type == "text"
            )
            if not text or response.stop_reason == "max_tokens":
                raise NonRetryableLLMError(
                    "Anthropic returned empty or truncated output.",
                    response.usage.input_tokens + response.usage.output_tokens,
                )
            return LLMResult(
                text, response.usage.input_tokens, response.usage.output_tokens
            )
        except anthropic.APIConnectionError as exc:
            raise RetryableLLMError("Anthropic connection failed.") from exc
        except anthropic.APIStatusError as exc:
            error_type = (
                RetryableLLMError
                if exc.status_code == 429 or exc.status_code >= 500
                else NonRetryableLLMError
            )
            raise error_type("Anthropic request failed.") from exc
        except (AttributeError, IndexError, TypeError, ValueError) as exc:
            raise NonRetryableLLMError(
                "Anthropic returned an invalid response."
            ) from exc
