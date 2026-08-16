from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.deps import get_current_tenant, get_current_user, get_tenant_db, get_user_permissions
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import MeResponse, UserLoginRequest, UserLoginResponse
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_me_response(user: User) -> MeResponse:
    return MeResponse(
        id=user.id,
        name=user.name,
        username=user.username,
        is_active=user.is_active,
        roles=list(user.roles),
        permissions=sorted(get_user_permissions(user)),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("/login", response_model=UserLoginResponse)
async def login(
    request: Request,
    payload: UserLoginRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_tenant_db),
) -> UserLoginResponse:
    client_host = request.client.host if request.client else "unknown"
    check_rate_limit(f"tenant-login:{tenant.id}:{client_host}:{payload.username}")

    result = await db.execute(
        select(User).where(User.tenant_id == tenant.id, User.username == payload.username)
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password"
        )

    token = create_access_token(subject=user.id, token_type="tenant", tenant_id=tenant.id)
    return UserLoginResponse(access_token=token, user=_to_me_response(user))


@router.get("/me", response_model=MeResponse)
async def me(user: User = Depends(get_current_user)) -> MeResponse:
    return _to_me_response(user)
