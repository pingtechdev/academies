"""Import all models so SQLAlchemy's mapper registry and Alembic autogenerate see every table."""

from app.models.audit_log import AuditLog
from app.models.child import Child
from app.models.level import Level
from app.models.payment import Payment
from app.models.role import Role, user_roles
from app.models.superuser import SuperUser
from app.models.tenant import Tenant, TenantStatus
from app.models.user import User

__all__ = [
    "AuditLog",
    "Child",
    "Level",
    "Payment",
    "Role",
    "user_roles",
    "SuperUser",
    "Tenant",
    "TenantStatus",
    "User",
]
