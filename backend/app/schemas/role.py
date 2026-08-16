import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.seed.permissions import is_valid_permission


class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    permissions: list[str] = Field(default_factory=list)

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[str]) -> list[str]:
        invalid = [p for p in value if not is_valid_permission(p)]
        if invalid:
            raise ValueError(f"Unknown permission(s): {', '.join(invalid)}")
        return value


class RoleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    permissions: list[str] | None = None

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        invalid = [p for p in value if not is_valid_permission(p)]
        if invalid:
            raise ValueError(f"Unknown permission(s): {', '.join(invalid)}")
        return value


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    is_system: bool
    permissions: list[str]
    created_at: datetime
    updated_at: datetime


class PermissionOut(BaseModel):
    code: str
