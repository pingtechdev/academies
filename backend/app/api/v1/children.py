import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_tenant, get_tenant_db, require_permission
from app.models.child import Child
from app.models.tenant import Tenant
from app.schemas.child import ChildCreateRequest, ChildOut, ChildUpdateRequest
from app.seed.permissions import CHILDREN_DELETE, CHILDREN_READ, CHILDREN_WRITE

router = APIRouter(prefix="/children", tags=["children"])


@router.get("", response_model=list[ChildOut], dependencies=[Depends(require_permission(CHILDREN_READ))])
async def list_children(
    level: str | None = None,
    search: str | None = None,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[Child]:
    query = select(Child).where(Child.tenant_id == tenant.id)
    if level:
        query = query.where(Child.level == level)
    if search:
        query = query.where(Child.name.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Child.created_at))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ChildOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(CHILDREN_WRITE))],
)
async def create_child(
    payload: ChildCreateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Child:
    child = Child(
        tenant_id=tenant.id,
        name=payload.name,
        date_of_birth=payload.date_of_birth,
        level=payload.level,
        has_kit=payload.has_kit,
        is_active=True,
        join_date=payload.join_date or date.today(),
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return child


async def _get_child_or_404(db: AsyncSession, tenant_id: uuid.UUID, child_id: uuid.UUID) -> Child:
    result = await db.execute(select(Child).where(Child.tenant_id == tenant_id, Child.id == child_id))
    child = result.scalar_one_or_none()
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
    return child


@router.get("/{child_id}", response_model=ChildOut, dependencies=[Depends(require_permission(CHILDREN_READ))])
async def get_child(
    child_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Child:
    return await _get_child_or_404(db, tenant.id, child_id)


@router.put("/{child_id}", response_model=ChildOut, dependencies=[Depends(require_permission(CHILDREN_WRITE))])
async def update_child(
    child_id: uuid.UUID,
    payload: ChildUpdateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Child:
    child = await _get_child_or_404(db, tenant.id, child_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(child, field, value)
    await db.commit()
    await db.refresh(child)
    return child


@router.delete(
    "/{child_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(CHILDREN_DELETE))],
)
async def delete_child(
    child_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    child = await _get_child_or_404(db, tenant.id, child_id)
    await db.delete(child)
    await db.commit()
