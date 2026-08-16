import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.payment import PaymentStatus


class PaymentCreateRequest(BaseModel):
    child_id: uuid.UUID
    amount: float = Field(gt=0)
    month: str = Field(min_length=1, max_length=20)
    year: int
    status: PaymentStatus = PaymentStatus.pending
    due_date: date | None = None
    paid_date: date | None = None


class PaymentUpdateRequest(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    month: str | None = None
    year: int | None = None
    status: PaymentStatus | None = None
    due_date: date | None = None
    paid_date: date | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    child_id: uuid.UUID
    amount: float
    month: str
    year: int
    status: PaymentStatus
    due_date: date
    paid_date: date | None
