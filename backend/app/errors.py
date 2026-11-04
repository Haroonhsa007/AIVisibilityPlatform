from typing import Any

from flask import Flask, Response, current_app, jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

from app.extensions import db


class APIError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        code: str = "bad_request",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details


class UpstreamError(APIError):
    def __init__(
        self, message: str = "The LLM provider could not score this query."
    ) -> None:
        super().__init__(message, 502, "upstream_error")


def envelope(
    code: str, message: str, status: int, details: dict | None = None
) -> Response:
    error = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    response = jsonify(error=error)
    response.status_code = status
    return response


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(APIError)
    def handle_api_error(error: APIError) -> Response:
        return envelope(error.code, error.message, error.status_code, error.details)

    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError) -> Response:
        details = {
            ".".join(str(part) for part in item["loc"]) or "body": item["msg"]
            for item in error.errors(include_input=False, include_url=False)
        }
        return envelope("validation_error", "Validation failed.", 422, details)

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException) -> Response:
        status = error.code or 500
        code = {
            404: "not_found",
            409: "conflict",
            422: "validation_error",
        }.get(status, "internal_error" if status >= 500 else "bad_request")
        message = "An internal error occurred." if status >= 500 else error.description
        response = error.get_response()
        response.data = envelope(code, message, status).get_data()
        response.content_type = "application/json"
        return response

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception) -> Response:
        db.session.rollback()
        current_app.logger.error("Unhandled request error", exc_info=error)
        return envelope("internal_error", "An internal error occurred.", 500)
