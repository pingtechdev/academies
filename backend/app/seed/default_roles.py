"""Default is_system=true roles seeded into every new tenant."""

from app.seed.permissions import (
    ALL_PERMISSIONS,
    CHILDREN_READ,
    CHILDREN_WRITE,
    PAYMENTS_READ,
    PAYMENTS_WRITE,
)

OWNER = "Owner"
COACH = "Coach"
STAFF = "Staff"

DEFAULT_ROLES: dict[str, list[str]] = {
    OWNER: list(ALL_PERMISSIONS),
    COACH: [CHILDREN_READ, CHILDREN_WRITE, PAYMENTS_READ],
    STAFF: [CHILDREN_READ, PAYMENTS_READ, PAYMENTS_WRITE],
}
