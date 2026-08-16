import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.role import Role, user_roles
from app.models.tenant import Tenant
from app.models.user import User
from app.seed.default_roles import DEFAULT_ROLES, OWNER
from app.services.passwords import generate_temp_password
from app.services.slugs import is_reserved, slug_from_name


async def slug_is_taken(db: AsyncSession, slug: str) -> bool:
    result = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
    return result.scalar_one_or_none() is not None


async def resolve_and_validate_slug(db: AsyncSession, *, slug: str | None, name: str) -> str:
    candidate = slug or slug_from_name(name)
    if is_reserved(candidate):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"slug '{candidate}' is reserved")
    if await slug_is_taken(db, candidate):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"slug '{candidate}' is already taken")
    return candidate


async def provision_tenant(
    db: AsyncSession,
    *,
    name: str,
    slug: str | None,
    owner_name: str,
    owner_username: str,
    created_by: uuid.UUID,
) -> tuple[Tenant, str, str]:
    """Create the tenant, seed its default roles, and create its owner user.

    Returns (tenant, owner_username, owner_temp_password). Caller commits.
    """
    resolved_slug = await resolve_and_validate_slug(db, slug=slug, name=name)

    tenant = Tenant(slug=resolved_slug, name=name, created_by=created_by)
    db.add(tenant)
    await db.flush()  # populate tenant.id

    roles: dict[str, Role] = {}
    for role_name, permissions in DEFAULT_ROLES.items():
        role = Role(tenant_id=tenant.id, name=role_name, is_system=True, permissions=permissions)
        db.add(role)
        roles[role_name] = role
    await db.flush()

    temp_password = generate_temp_password()
    owner = User(
        tenant_id=tenant.id,
        username=owner_username,
        password_hash=hash_password(temp_password),
        name=owner_name,
        is_active=True,
    )
    db.add(owner)
    await db.flush()

    await db.execute(
        user_roles.insert().values(user_id=owner.id, role_id=roles[OWNER].id)
    )

    return tenant, owner_username, temp_password
