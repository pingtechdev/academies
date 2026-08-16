import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_tenant, get_tenant_db, require_permission
from app.models.child import Child
from app.models.payment import Payment, PaymentStatus
from app.models.tenant import Tenant
from app.schemas.payment import PaymentCreateRequest, PaymentOut, PaymentUpdateRequest
from app.seed.permissions import PAYMENTS_READ, PAYMENTS_WRITE

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=list[PaymentOut], dependencies=[Depends(require_permission(PAYMENTS_READ))])
async def list_payments(
    child_id: uuid.UUID | None = None,
    status_: PaymentStatus | None = Query(default=None, alias="status"),
    month: str | None = None,
    year: int | None = None,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[Payment]:
    query = select(Payment).where(Payment.tenant_id == tenant.id)
    if child_id:
        query = query.where(Payment.child_id == child_id)
    if status_:
        query = query.where(Payment.status == status_)
    if month:
        query = query.where(Payment.month == month)
    if year:
        query = query.where(Payment.year == year)
    result = await db.execute(query.order_by(Payment.created_at))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(PAYMENTS_WRITE))],
)
async def create_payment(
    payload: PaymentCreateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Payment:
    child_result = await db.execute(
        select(Child.id).where(Child.tenant_id == tenant.id, Child.id == payload.child_id)
    )
    if child_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

    payment = Payment(
        tenant_id=tenant.id,
        child_id=payload.child_id,
        amount=payload.amount,
        month=payload.month,
        year=payload.year,
        status=payload.status,
        due_date=payload.due_date or date(payload.year, 1, 1),
        paid_date=payload.paid_date,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


@router.put("/{payment_id}", response_model=PaymentOut, dependencies=[Depends(require_permission(PAYMENTS_WRITE))])
async def update_payment(
    payment_id: uuid.UUID,
    payload: PaymentUpdateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Payment:
    result = await db.execute(
        select(Payment).where(Payment.tenant_id == tenant.id, Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(payment, field, value)

    await db.commit()
    await db.refresh(payment)
    return payment
