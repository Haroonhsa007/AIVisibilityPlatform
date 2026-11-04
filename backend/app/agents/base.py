import json
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.llm.base import LLMClient, LLMError

Output = TypeVar("Output", bound=BaseModel)


class AgentOutputError(Exception):
    """Provider output could not be safely validated, even after one repair."""


def extract_object(text: str) -> str:
    """Locate the first balanced JSON object, respecting escaped string quotes."""
    if not isinstance(text, str):
        raise ValueError("Expected text output")
    start = text.find("{")
    if start < 0:
        raise ValueError("Expected a JSON object")
    depth, quoted, escaped = 0, False, False
    for index in range(start, len(text)):
        character = text[index]
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
        elif character == '"':
            quoted = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    raise ValueError("Incomplete JSON object")


def normalise_query(text: str) -> str:
    return " ".join(text.split()).lower()


class BaseAgent:
    def __init__(self, client: LLMClient) -> None:
        self.client = client
        self.tokens_used = 0

    def run_llm_json(
        self, system: str, user: str, schema: type[Output], max_tokens: int = 4096
    ) -> tuple[Output, int]:
        tokens = 0
        request = user
        for attempt in range(2):
            try:
                result = self.client.complete(
                    system, request, max_tokens, temperature=0
                )
            except LLMError as exc:
                self.tokens_used += exc.tokens_used
                raise
            tokens += result.tokens_used
            self.tokens_used += result.tokens_used
            try:
                parsed = schema.model_validate_json(extract_object(result.text))
                return parsed, tokens
            except (ValidationError, ValueError, TypeError) as exc:
                if attempt:
                    raise AgentOutputError(
                        "Invalid agent output after repair."
                    ) from exc
                # Never echo provider output or validation input into logs.
                if isinstance(exc, ValidationError):
                    reason = json.dumps(
                        exc.errors(include_input=False, include_url=False), default=str
                    )
                else:
                    reason = str(exc)
                request = user + "\nREPAIR: Your previous output was invalid: " + reason
                request += "\nPrevious output: " + str(result.text)[:12000]
                request += "\nReturn only corrected JSON for the original task."
        raise AgentOutputError("No validated output.")
