"""The fixed permission catalog. Code-defined, not tenant-editable.

Every `require_permission(...)` dependency checks against this enum. Extend this list as real
features land; tenants never get to request additions.
"""

CHILDREN_READ = "children:read"
CHILDREN_WRITE = "children:write"
CHILDREN_DELETE = "children:delete"
PAYMENTS_READ = "payments:read"
PAYMENTS_WRITE = "payments:write"
LEVELS_MANAGE = "levels:manage"
USERS_MANAGE = "users:manage"
ROLES_MANAGE = "roles:manage"
SETTINGS_MANAGE = "settings:manage"

ALL_PERMISSIONS: tuple[str, ...] = (
    CHILDREN_READ,
    CHILDREN_WRITE,
    CHILDREN_DELETE,
    PAYMENTS_READ,
    PAYMENTS_WRITE,
    LEVELS_MANAGE,
    USERS_MANAGE,
    ROLES_MANAGE,
    SETTINGS_MANAGE,
)


def is_valid_permission(permission: str) -> bool:
    return permission in ALL_PERMISSIONS
