from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.models.superuser import SuperUser
from app.schemas.platform import SuperUserLoginRequest, SuperUserLoginResponse, SuperUserOut
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/platform/auth", tags=["platform-auth"])


@router.post("/login", response_model=SuperUserLoginResponse)
async def login(
    request: Request,
    payload: SuperUserLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> SuperUserLoginResponse:
    client_host = request.client.host if request.client else "unknown"
    check_rate_limit(f"platform-login:{client_host}:{payload.username}")

    result = await db.execute(select(SuperUser).where(SuperUser.username == payload.username))
    superuser = result.scalar_one_or_none()

    if (
        superuser is None
        or not superuser.is_active
        or not verify_password(payload.password, superuser.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password"
        )

    token = create_access_token(subject=superuser.id, token_type="platform")
    return SuperUserLoginResponse(
        access_token=token, user=SuperUserOut.model_validate(superuser)
    )
