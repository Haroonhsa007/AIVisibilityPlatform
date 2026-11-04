from abc import ABC, abstractmethod
from dataclasses import dataclass

from tenacity import Retrying, retry_if_exception_type, stop_after_attempt
from tenacity.wait import wait_exponential_jitter


@dataclass(frozen=True)
class LLMResult:
    text: str
    input_tokens: int
    output_tokens: int

    @property
    def tokens_used(self) -> int:
        return self.input_tokens + self.output_tokens


class LLMError(Exception):
    """Safe provider failure, without provider response bodies or credentials."""

    def __init__(self, message: str, tokens_used: int = 0) -> None:
        super().__init__(message)
        self.tokens_used = tokens_used


class RetryableLLMError(LLMError):
    pass


class NonRetryableLLMError(LLMError):
    pass


class LLMClient(ABC):
    @abstractmethod
    def complete(
        self, system: str, user: str, max_tokens: int = 4096, temperature: float = 0
    ) -> LLMResult:
        raise NotImplementedError


class SDKClient(LLMClient):
    def __init__(
        self,
        model: str,
        max_attempts: int = 3,
        retry_min_seconds: float = 1,
        retry_max_seconds: float = 8,
    ) -> None:
        self.model = model
        self.retry = Retrying(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential_jitter(
                initial=retry_min_seconds, max=retry_max_seconds
            ),
            retry=retry_if_exception_type(RetryableLLMError),
            reraise=True,
        )

    def complete(
        self, system: str, user: str, max_tokens: int = 4096, temperature: float = 0
    ) -> LLMResult:
        return self.retry(self._complete, system, user, max_tokens, temperature)

    @abstractmethod
    def _complete(
        self, system: str, user: str, max_tokens: int, temperature: float
    ) -> LLMResult:
        raise NotImplementedError
