import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_tenant, get_current_user, get_tenant_db, get_user_permissions, require_permission
from app.models.child import Child
from app.models.level import Level
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.level import LevelCreateRequest, LevelOut, LevelUpdateRequest
from app.seed.permissions import CHILDREN_READ, LEVELS_MANAGE

router = APIRouter(prefix="/levels", tags=["levels"])


async def require_levels_read(user: User = Depends(get_current_user)) -> User:
    permissions = get_user_permissions(user)
    if LEVELS_MANAGE not in permissions and CHILDREN_READ not in permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing required permission: {LEVELS_MANAGE}")
    return user


@router.get("", response_model=list[LevelOut], dependencies=[Depends(require_levels_read)])
async def list_levels(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[Level]:
    result = await db.execute(select(Level).where(Level.tenant_id == tenant.id).order_by(Level.created_at))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=LevelOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(LEVELS_MANAGE))],
)
async def create_level(
    payload: LevelCreateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Level:
    existing = await db.execute(
        select(Level.id).where(Level.tenant_id == tenant.id, Level.name == payload.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A level with this name already exists")

    level = Level(tenant_id=tenant.id, name=payload.name, description=payload.description)
    db.add(level)
    await db.commit()
    await db.refresh(level)
    return level


async def _get_level_or_404(db: AsyncSession, tenant_id: uuid.UUID, level_id: uuid.UUID) -> Level:
    result = await db.execute(select(Level).where(Level.tenant_id == tenant_id, Level.id == level_id))
    level = result.scalar_one_or_none()
    if level is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Level not found")
    return level


@router.put("/{level_id}", response_model=LevelOut, dependencies=[Depends(require_permission(LEVELS_MANAGE))])
async def update_level(
    level_id: uuid.UUID,
    payload: LevelUpdateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Level:
    level = await _get_level_or_404(db, tenant.id, level_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(level, field, value)
    await db.commit()
    await db.refresh(level)
    return level


@router.delete(
    "/{level_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(LEVELS_MANAGE))],
)
async def delete_level(
    level_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    level = await _get_level_or_404(db, tenant.id, level_id)

    in_use = await db.execute(
        select(Child.id).where(Child.tenant_id == tenant.id, Child.level == level.name).limit(1)
    )
    if in_use.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a level that is assigned to children",
        )

    await db.delete(level)
    await db.commit()
