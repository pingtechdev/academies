"""Registers a session-level ORM filter so every tenant-scoped SELECT is auto-filtered by
`tenant_id`, even if a handler/service forgets an explicit `WHERE tenant_id = ...`.

This is layer 1 of the two-layer isolation described in backend.md §3: a `do_orm_execute`
event applies `with_loader_criteria` for every tenant-scoped model whenever the executing
session carries a `tenant_id` in `session.info` (set by `get_tenant_db`, see app/deps.py).
Layer 2 is the JWT tenant_id / resolved-tenant match check in `get_current_user`.
"""

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from app.models.child import Child
from app.models.level import Level
from app.models.payment import Payment
from app.models.role import Role
from app.models.user import User

TENANT_SCOPED_MODELS = (Child, Level, Payment, Role, User)

_registered = False


def register_tenant_scope() -> None:
    global _registered
    if _registered:
        return
    _registered = True

    @event.listens_for(Session, "do_orm_execute")
    def _apply_tenant_filter(execute_state):
        if not execute_state.is_select:
            return
        tenant_id = execute_state.session.info.get("tenant_id")
        if tenant_id is None:
            return
        # `tenant_id` must be captured as a genuine closure variable (read from this local,
        # freshly assigned on every invocation of this listener) rather than a lambda default
        # argument. SQLAlchemy's lambda-caching machinery only tracks true closure cells to
        # re-extract fresh bound values on a compiled-SQL cache hit; a default argument isn't
        # tracked, so the first tenant's id would get baked into the cached plan and silently
        # reused for every later tenant's queries — this was a real bug caught by hand: tenant
        # #2's login failed because its user lookup was still filtered by tenant #1's id.
        for model in TENANT_SCOPED_MODELS:
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    model,
                    lambda cls: cls.tenant_id == tenant_id,
                    include_aliases=True,
                )
            )
