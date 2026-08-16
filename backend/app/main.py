from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, children, levels, payments, roles, users
from app.api.v1.platform import auth as platform_auth
from app.api.v1.platform import tenants as platform_tenants
from app.core.config import get_settings
from app.core.tenant_scope import register_tenant_scope
from app.middleware.tenant import TenantResolutionMiddleware

settings = get_settings()

app = FastAPI(title="Victory Academy Backend", version="0.1.0")

register_tenant_scope()

app.add_middleware(TenantResolutionMiddleware)

# In production, any tenant subdomain (https://{slug}.victory.pingtech.dev) must be allowed to
# call the API, which is an open-ended set of origins -- hence the regex instead of a fixed
# allow_origins list. Outside production, a fixed localhost origin list is enough.
if settings.is_production:
    escaped_base_domain = settings.base_domain.replace(".", r"\.")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=rf"^https://([a-z0-9-]+\.)?{escaped_base_domain}$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(platform_auth.router, prefix="/api/v1")
app.include_router(platform_tenants.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(children.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(levels.router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
