"""The dependency chain that enforces tenant isolation and RBAC (backend.md §7).

    get_current_tenant(request)        -> resolves Tenant from Host/header, 404 if unknown/suspended
    get_current_user(token, tenant)    -> decodes JWT, loads User, 403 if token.tenant_id != tenant.id
    require_permission(perm: str)      -> loads user's roles, 403 if perm not present
    get_tenant_db(tenant)              -> yields a DB session with a query-level tenant_id filter

Platform routers depend on `get_current_superuser` and never touch `get_current_tenant` — the
two dependency trees don't share a code path.
"""

import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.security import InvalidTokenError, decode_access_token
from app.models.superuser import SuperUser
from app.models.tenant import Tenant, TenantStatus
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


async def get_current_tenant(request: Request, db: AsyncSession = Depends(get_db)) -> Tenant:
    slug = getattr(request.state, "tenant_slug", None)
    if not slug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    tenant = result.scalar_one_or_none()
    if tenant is None or tenant.status != TenantStatus.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


async def get_tenant_db(
    tenant: Tenant = Depends(get_current_tenant),
) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal(info={"tenant_id": tenant.id}) as session:
        yield session


def _decode_bearer_token(credentials: HTTPAuthorizationCredentials | None) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        return decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise _unauthorized() from exc


async def get_current_user(
    tenant: Tenant = Depends(get_current_tenant),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_tenant_db),
) -> User:
    payload = _decode_bearer_token(credentials)

    if payload.get("type") != "tenant":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this surface")

    token_tenant_id = payload.get("tenant_id")
    if token_tenant_id is None or uuid.UUID(token_tenant_id) != tenant.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token is not valid for this tenant")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise _unauthorized() from exc

    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant.id)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _unauthorized()
    return user


def get_user_permissions(user: User) -> set[str]:
    permissions: set[str] = set()
    for role in user.roles:
        permissions.update(role.permissions)
    return permissions


def require_permission(permission: str):
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if permission not in get_user_permissions(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return user

    return dependency


async def get_current_superuser(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> SuperUser:
    payload = _decode_bearer_token(credentials)

    if payload.get("type") != "platform":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this surface")

    try:
        superuser_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise _unauthorized() from exc

    result = await db.execute(select(SuperUser).where(SuperUser.id == superuser_id))
    superuser = result.scalar_one_or_none()
    if superuser is None or not superuser.is_active:
        raise _unauthorized()
    return superuser
