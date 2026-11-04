import openai

from app.llm.base import (
    LLMResult,
    NonRetryableLLMError,
    RetryableLLMError,
    SDKClient,
)


class OpenAIClient(SDKClient):
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
            raise NonRetryableLLMError("OPENAI_API_KEY is required.")
        self.sdk = sdk_client or openai.OpenAI(
            api_key=api_key, timeout=timeout, max_retries=0
        )

    def _complete(
        self, system: str, user: str, max_tokens: int, temperature: float
    ) -> LLMResult:
        try:
            response = self.sdk.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                max_tokens=max_tokens,
                temperature=temperature,
            )
            choice = response.choices[0]
            if not choice.message.content or choice.finish_reason != "stop":
                raise NonRetryableLLMError(
                    "OpenAI returned empty or incomplete output.",
                    response.usage.prompt_tokens + response.usage.completion_tokens,
                )
            return LLMResult(
                choice.message.content,
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
            )
        except openai.APIConnectionError as exc:
            raise RetryableLLMError("OpenAI connection failed.") from exc
        except openai.APIStatusError as exc:
            error_type = (
                RetryableLLMError
                if exc.status_code == 429 or exc.status_code >= 500
                else NonRetryableLLMError
            )
            raise error_type("OpenAI request failed.") from exc
        except (AttributeError, IndexError, TypeError, ValueError) as exc:
            raise NonRetryableLLMError("OpenAI returned an invalid response.") from exc
