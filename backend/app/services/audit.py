import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def record_platform_action(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID,
    action: str,
    tenant_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_type="platform",
            actor_id=actor_id,
            tenant_id=tenant_id,
            action=action,
            details=details or {},
        )
    )
