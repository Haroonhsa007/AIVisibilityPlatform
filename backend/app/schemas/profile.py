from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
)

from app.utils.domains import normalise_domain

Domain = Annotated[str, AfterValidator(normalise_domain)]


class ProfileCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, strict=True)

    name: str = Field(min_length=1, max_length=120)
    domain: Domain
    industry: str = Field(max_length=120)
    description: str = Field(default="", max_length=1000)
    competitors: list[Domain] = Field(default_factory=list, max_length=10)

    @field_validator("competitors")
    @classmethod
    def validate_competitors(cls, value: list[str], info: ValidationInfo) -> list[str]:
        if info.data.get("domain") in value:
            raise ValueError("Competitors must not include the profile's own domain.")
        return list(dict.fromkeys(value))
