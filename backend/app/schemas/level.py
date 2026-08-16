import uuid

from pydantic import BaseModel, ConfigDict, Field


class LevelCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class LevelUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class LevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
