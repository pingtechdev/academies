"""Host-header tenant resolution.

Runs before routing on every request and stamps `request.state.tenant_slug` /
`request.state.is_platform_host` from the `Host` header. This middleware only *parses* the
host — it never touches the database (middleware runs outside any request-scoped DB session).
The actual "does this tenant exist / is it suspended" check happens in the `get_current_tenant`
dependency (see app/deps.py), which is what actually enforces isolation.

Local development can't do real subdomains without `/etc/hosts` edits, so outside of production
we also accept an `X-Tenant-Slug` header and a `?tenant=` query param as fallbacks. These are
hard-disabled in production so they can never be used to spoof a tenant in prod.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings


def _extract_slug_from_host(host: str, base_domain: str) -> str | None:
    host = host.split(":")[0].lower()
    base_domain = base_domain.lower()

    if host == base_domain or host == f"www.{base_domain}":
        return None  # bare domain: marketing/landing, not a tenant

    suffix = f".{base_domain}"
    if host.endswith(suffix):
        subdomain = host[: -len(suffix)]
        if subdomain and "." not in subdomain:
            return subdomain
    return None


class TenantResolutionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        host = request.headers.get("host", "")
        slug = _extract_slug_from_host(host, settings.base_domain)

        if not settings.is_production:
            header_slug = request.headers.get("x-tenant-slug")
            query_slug = request.query_params.get("tenant")
            slug = header_slug or query_slug or slug

        is_platform_host = slug in settings.platform_subdomains if slug else False
        if is_platform_host:
            slug = None

        request.state.tenant_slug = slug
        request.state.is_platform_host = is_platform_host

        return await call_next(request)
