import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class ChildCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    date_of_birth: date
    level: str = Field(min_length=1, max_length=100)
    has_kit: bool = False
    join_date: date | None = None


class ChildUpdateRequest(BaseModel):
    name: str | None = None
    date_of_birth: date | None = None
    level: str | None = None
    has_kit: bool | None = None
    is_active: bool | None = None
    join_date: date | None = None


class ChildOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    date_of_birth: date
    level: str
    has_kit: bool
    is_active: bool
    join_date: date
