import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.deps import get_current_tenant, get_tenant_db, require_permission
from app.models.role import Role, user_roles
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import UserCreateRequest, UserOut, UserUpdateRequest
from app.seed.permissions import USERS_MANAGE

router = APIRouter(prefix="/users", tags=["users"])


async def _get_roles_by_ids(db: AsyncSession, tenant_id: uuid.UUID, role_ids: list[uuid.UUID]) -> list[Role]:
    if not role_ids:
        return []
    result = await db.execute(
        select(Role).where(Role.tenant_id == tenant_id, Role.id.in_(role_ids))
    )
    roles = result.scalars().all()
    if len(roles) != len(set(role_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more role_ids are invalid")
    return list(roles)


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_permission(USERS_MANAGE))])
async def list_users(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[User]:
    result = await db.execute(select(User).where(User.tenant_id == tenant.id).order_by(User.created_at))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(USERS_MANAGE))],
)
async def create_user(
    payload: UserCreateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> User:
    existing = await db.execute(
        select(User.id).where(User.tenant_id == tenant.id, User.username == payload.username)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username is already taken")

    roles = await _get_roles_by_ids(db, tenant.id, payload.role_ids)

    user = User(
        tenant_id=tenant.id,
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    for role in roles:
        await db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))

    await db.commit()
    await db.refresh(user, attribute_names=["roles"])
    return user


async def _get_user_or_404(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.tenant_id == tenant_id, User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_permission(USERS_MANAGE))])
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> User:
    user = await _get_user_or_404(db, tenant.id, user_id)

    if payload.name is not None:
        user.name = payload.name
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role_ids is not None:
        roles = await _get_roles_by_ids(db, tenant.id, payload.role_ids)
        user.roles = roles

    await db.commit()
    await db.refresh(user, attribute_names=["roles"])
    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(USERS_MANAGE))],
)
async def deactivate_user(
    user_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> None:
    user = await _get_user_or_404(db, tenant.id, user_id)
    user.is_active = False
    await db.commit()
