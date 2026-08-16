import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.role import RoleOut
from app.schemas.token import TokenResponse


class UserLoginRequest(BaseModel):
    username: str
    password: str


class UserCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    role_ids: list[uuid.UUID] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    name: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=255)
    is_active: bool | None = None
    role_ids: list[uuid.UUID] | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    username: str
    is_active: bool
    roles: list[RoleOut]
    created_at: datetime
    updated_at: datetime


class MeResponse(UserOut):
    permissions: list[str]


class UserLoginResponse(TokenResponse):
    user: MeResponse
