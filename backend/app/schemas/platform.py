import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.tenant import TenantStatus
from app.schemas.token import TokenResponse

SLUG_PATTERN = r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
RESERVED_SLUGS = {"admin", "api", "www", "platform", "app"}


class SuperUserLoginRequest(BaseModel):
    username: str
    password: str


class SuperUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    name: str


class SuperUserLoginResponse(TokenResponse):
    user: SuperUserOut


class TenantCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=3, max_length=63)
    owner_name: str = Field(min_length=1, max_length=255)
    owner_username: str = Field(min_length=1, max_length=255)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str | None) -> str | None:
        import re

        if value is None:
            return value
        value = value.lower()
        if not re.match(SLUG_PATTERN, value):
            raise ValueError(
                "slug must be lowercase alphanumeric with optional hyphens, 3-63 chars"
            )
        if value in RESERVED_SLUGS:
            raise ValueError(f"slug '{value}' is reserved")
        return value


class TenantUpdateRequest(BaseModel):
    name: str | None = None
    status: TenantStatus | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    status: TenantStatus
    url: str
    created_at: datetime
    updated_at: datetime


class TenantCreateResponse(BaseModel):
    tenant: TenantOut
    owner_username: str
    owner_temp_password: str


class SlugCheckResponse(BaseModel):
    slug: str
    available: bool
