import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_superuser
from app.models.superuser import SuperUser
from app.models.tenant import Tenant
from app.schemas.platform import (
    SlugCheckResponse,
    TenantCreateRequest,
    TenantCreateResponse,
    TenantOut,
    TenantUpdateRequest,
)
from app.services.audit import record_platform_action
from app.services.slugs import is_reserved
from app.services.tenant_provisioning import provision_tenant, slug_is_taken

router = APIRouter(prefix="/platform/tenants", tags=["platform-tenants"])


def _tenant_url(slug: str) -> str:
    settings = get_settings()
    return f"https://{slug}.{settings.base_domain}"


def _to_tenant_out(tenant: Tenant) -> TenantOut:
    return TenantOut(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        status=tenant.status,
        url=_tenant_url(tenant.slug),
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
    )


@router.get("", response_model=list[TenantOut])
async def list_tenants(
    superuser: SuperUser = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[TenantOut]:
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    return [_to_tenant_out(t) for t in result.scalars().all()]


@router.post("", response_model=TenantCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    payload: TenantCreateRequest,
    superuser: SuperUser = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> TenantCreateResponse:
    tenant, owner_username, owner_temp_password = await provision_tenant(
        db,
        name=payload.name,
        slug=payload.slug,
        owner_name=payload.owner_name,
        owner_username=payload.owner_username,
        created_by=superuser.id,
    )
    await record_platform_action(
        db,
        actor_id=superuser.id,
        action="tenant.created",
        tenant_id=tenant.id,
        details={"slug": tenant.slug, "name": tenant.name},
    )
    await db.commit()
    await db.refresh(tenant)

    return TenantCreateResponse(
        tenant=_to_tenant_out(tenant),
        owner_username=owner_username,
        owner_temp_password=owner_temp_password,
    )


@router.get("/check-slug", response_model=SlugCheckResponse)
async def check_slug(
    slug: str,
    superuser: SuperUser = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> SlugCheckResponse:
    slug = slug.lower()
    available = not is_reserved(slug) and not await slug_is_taken(db, slug)
    return SlugCheckResponse(slug=slug, available=available)


@router.get("/{tenant_id}", response_model=TenantOut)
async def get_tenant(
    tenant_id: uuid.UUID,
    superuser: SuperUser = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> TenantOut:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return _to_tenant_out(tenant)


@router.patch("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: uuid.UUID,
    payload: TenantUpdateRequest,
    superuser: SuperUser = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> TenantOut:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    changes: dict[str, str] = {}
    if payload.name is not None and payload.name != tenant.name:
        changes["name"] = payload.name
        tenant.name = payload.name
    if payload.status is not None and payload.status != tenant.status:
        changes["status"] = payload.status.value
        tenant.status = payload.status

    if changes:
        await record_platform_action(
            db,
            actor_id=superuser.id,
            action="tenant.updated",
            tenant_id=tenant.id,
            details=changes,
        )

    await db.commit()
    await db.refresh(tenant)
    return _to_tenant_out(tenant)
