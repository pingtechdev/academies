import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_tenant, get_current_user, get_tenant_db, require_permission
from app.models.role import Role
from app.models.tenant import Tenant
from app.schemas.role import PermissionOut, RoleCreateRequest, RoleOut, RoleUpdateRequest
from app.seed.permissions import ALL_PERMISSIONS, ROLES_MANAGE

router = APIRouter(tags=["roles"])


@router.get("/permissions", response_model=list[PermissionOut], dependencies=[Depends(get_current_user)])
async def list_permissions() -> list[PermissionOut]:
    return [PermissionOut(code=p) for p in ALL_PERMISSIONS]


@router.get("/roles", response_model=list[RoleOut], dependencies=[Depends(require_permission(ROLES_MANAGE))])
async def list_roles(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[Role]:
    result = await db.execute(select(Role).where(Role.tenant_id == tenant.id).order_by(Role.created_at))
    return list(result.scalars().all())


@router.post(
    "/roles",
    response_model=RoleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(ROLES_MANAGE))],
)
async def create_role(
    payload: RoleCreateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Role:
    existing = await db.execute(
        select(Role.id).where(Role.tenant_id == tenant.id, Role.name == payload.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A role with this name already exists")

    role = Role(tenant_id=tenant.id, name=payload.name, is_system=False, permissions=payload.permissions)
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


async def _get_role_or_404(db: AsyncSession, tenant_id: uuid.UUID, role_id: uuid.UUID) -> Role:
    result = await db.execute(select(Role).where(Role.tenant_id == tenant_id, Role.id == role_id))
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleOut, dependencies=[Depends(require_permission(ROLES_MANAGE))])
async def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> Role:
    role = await _get_role_or_404(db, tenant.id, role_id)
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System roles cannot be edited; clone it into a custom role instead")

    if payload.name is not None:
        role.name = payload.name
    if payload.permissions is not None:
        role.permissions = payload.permissions

    await db.commit()
    await db.refresh(role)
    return role


@router.delete(
    "/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(ROLES_MANAGE))],
)
async def delete_role(
    role_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    role = await _get_role_or_404(db, tenant.id, role_id)
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System roles cannot be deleted")

    await db.delete(role)
    await db.commit()
