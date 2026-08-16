# Victory Academy Backend — Multi-Tenant FastAPI Plan

## 1. What this backend replaces

`frontend-next/app/api/v1/**` currently contains an in-memory mock (single tenant, one
hardcoded `admin`/`admin123` user, no real persistence) built purely so the ported Next.js
frontend could be clicked through without a real server. This document plans the real backend
that replaces it: a FastAPI service in `backend/`, backed by Postgres, with proper
multi-tenancy and RBAC. The domain surface (children, payments, levels) keeps the same field
shapes the frontend already speaks (`date_of_birth`, `has_kit`, `is_active`, `join_date`,
`child_id`, `due_date`, `paid_date`, error format `{"detail": "..."}` /
`{"detail": [{"loc": [...], "msg": "..."}]}`) so swapping `NEXT_PUBLIC_API_URL` back to a real
host is close to the only frontend change required once this ships — everything else was
already built to talk to exactly this contract.

## 2. Requirements, restated precisely

- One **super user** tier, outside and above all tenants, that can create new tenants.
- Creating a tenant assigns it a **slug** and a **URL** (the academy's own address).
- Each tenant manages its **own users**, each with **roles and permissions** scoped to that
  tenant — tenant A's admin cannot see or affect tenant B's data or users, ever.

That's three distinct identity tiers layered on top of each other: **platform** (super user) →
**tenant** (an academy) → **tenant user** (admin/coach/parent/etc. within one academy). The
architecture below is built around keeping those three tiers cleanly separated at the database,
auth-token, and API-routing level, because tenant isolation is the one thing that's
unacceptable to get wrong in a multi-tenant system.

## 3. Multi-tenancy strategy

**Shared database, shared schema, `tenant_id` discriminator column on every tenant-scoped
table.** This is the standard choice at this scale (an academy-management SaaS with dozens to
low-thousands of tenants, not a regulated-data enterprise product) — it's the cheapest to run,
the easiest to migrate (one Alembic history, not one per tenant), and the easiest to query
across tenants when the super user needs platform-wide visibility later (billing, support,
analytics). The alternative — schema-per-tenant or database-per-tenant — buys stronger physical
isolation at the cost of migration/ops complexity that multiplies with every tenant; not
justified here unless a specific customer later demands it contractually.

**Isolation is enforced twice, not once:**
1. Every tenant-scoped SQLAlchemy query is auto-filtered by `tenant_id` via a query-level guard
   (see §7) — not left to each endpoint author to remember a `WHERE tenant_id = ...` by hand.
2. Every authenticated request's JWT carries the `tenant_id` the token was issued for, and the
   resolved-tenant-from-URL (§4) must match the token's `tenant_id` or the request is rejected
   with 403 before it reaches any handler. A stolen or misrouted token for tenant A can't be
   replayed against tenant B's subdomain.

## 4. Tenant resolution: subdomain-based

Each tenant's URL is `https://{slug}.victory.pingtech.dev` (mirrors the domain the frontend
already special-cases in `lib/api.ts`'s `getApiBaseUrl()`). The backend resolves the active
tenant from the `Host` header on every request via a FastAPI middleware, before routing:

- `admin.victory.pingtech.dev` (or a reserved `platform.` subdomain) → super user surface.
- `{slug}.victory.pingtech.dev` → tenant surface, tenant loaded by slug, 404 if slug unknown or
  tenant suspended.
- Bare `victory.pingtech.dev` (no subdomain) → marketing/landing or a "which academy?" page —
  out of scope for this backend, frontend concern.

**Local development can't do real subdomains without `/etc/hosts` edits**, so the middleware
also accepts an `X-Tenant-Slug` header (and a `?tenant=` query param as a fallback for quick
`curl`/browser testing) when `ENVIRONMENT != production`. This keeps local dev frictionless
without weakening production tenant resolution — the header/query fallback is hard-disabled
outside dev/staging.

**Infra note (not this backend's code, but a hard dependency on it working):** production needs
wildcard DNS (`*.victory.pingtech.dev`) and a wildcard TLS cert. Flagging this now so it's not
a surprise at deploy time — it's the one piece of this plan that lives outside the FastAPI app.

## 5. Identity model

### 5.1 Super user (platform tier)
A `SuperUser` table, deliberately **separate** from the tenant `User` table rather than "a user
with a special role" — a super user has no `tenant_id`, must never be reachable through
tenant-scoped endpoints, and should never be representable as a valid state in a query that's
supposed to be tenant-scoped. Keeping it a distinct table makes that a schema-level guarantee,
not a runtime check that can be forgotten. Authenticates via
`POST /api/v1/platform/auth/login`, gets a JWT with `type: "platform"` that only platform
routers accept.

### 5.2 Tenant, and tenant provisioning
```
Tenant
  id            UUID (pk)
  slug          str, unique, url-safe (^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$), 3–63 chars
  name          str  (display name, e.g. "Victory Academy")
  status        enum: active | suspended
  created_by    FK -> SuperUser.id
  created_at / updated_at
```
Creating a tenant (`POST /api/v1/platform/tenants`, super user only) does four things in one
transaction:
1. Validate/derive the slug (accept an explicit slug or slugify from `name`; reject if taken,
   reject reserved words — `admin`, `api`, `www`, `platform`, `app`).
2. Insert the `Tenant` row.
3. Seed that tenant's **default roles** (§5.4) so it isn't born with zero usable roles.
4. Create the tenant's first user — an owner-level account — either with a temporary password
   returned once to the super user to hand off, or (better, once email sending exists) an
   invite-token flow. MVP: temporary password, since there's no email infra yet; track the
   invite-flow upgrade as a fast-follow, not a blocker.

Response includes the tenant's URL (`https://{slug}.victory.pingtech.dev`) so the super user
has the one thing they actually need to hand to a new customer.

### 5.3 Tenant users
```
User
  id            UUID (pk)
  tenant_id     FK -> Tenant.id   (NOT NULL — every user belongs to exactly one tenant)
  username      str, unique *within tenant* (unique constraint on (tenant_id, username))
  password_hash str
  name          str
  is_active     bool
  created_at / updated_at
```
`username` is unique per-tenant, not globally — two different academies can both have a user
named `admin` without collision, since every uniqueness constraint that matters is scoped by
`tenant_id`.

### 5.4 Roles & permissions (RBAC)
A fixed, versioned **permission catalog** (code-defined, not DB-editable — permissions are
"what the system can check," not tenant configuration):

```
children:read   children:write   children:delete
payments:read   payments:write
levels:manage
users:manage          # invite/edit/deactivate users within the tenant
roles:manage          # create/edit custom roles within the tenant
settings:manage
```
(Extend this list as real features land — it's the enum every `require_permission(...)`
dependency checks against, not something tenants request additions to.)

```
Role
  id            UUID (pk)
  tenant_id     FK -> Tenant.id
  name          str            (unique within tenant)
  is_system     bool           (seeded default roles, not deletable)
  permissions   [str]          (Postgres array column, or a RolePermission join table —
                                 array column is simpler and fine at this scale; switch to a
                                 join table only if permissions need their own metadata later)

UserRole (join table: user_id, role_id)  — many-to-many, a user can hold more than one role
```
Every new tenant is seeded with three `is_system=true` roles it can't delete (but *can* clone
into a custom role and edit):
- **Owner** — every permission, including `users:manage` and `roles:manage`. The first user
  created during tenant provisioning gets this role.
- **Coach** — `children:read`, `children:write`, `payments:read`.
- **Staff** — `children:read`, `payments:read`, `payments:write`.

Tenant admins (anyone holding `roles:manage`) can create additional custom roles from the same
fixed permission catalog via `POST /api/v1/roles`. This directly satisfies "add users with
roles and permissions" — permissions are the fixed atoms, roles are the tenant-defined bundles,
users hold roles.

**Migration note from the current mock:** the mock's `UserRole = 'admin' | 'parent' | 'coach'`
single-string field goes away entirely — the real system has no built-in notion of "parent" as
a role; if a tenant wants a parent-facing view later, `Coach`-style role composition already
covers it without a schema change. `ProtectedRoute`'s current hardcoded `user.role !== 'admin'`
check in the frontend becomes a permission check instead (`has_permission(user, 'children:read')`
or similar) — noted here since it's a real, if small, frontend follow-up this backend implies.

## 6. Auth & tokens

- Passwords hashed with `bcrypt` via `passlib`.
- JWT (via `python-jose` or `PyJWT`), short-lived access token (e.g. 60 min) — no refresh-token
  flow in MVP; re-login on expiry, matching the current frontend's simplicity. Flag refresh
  tokens as a fast-follow once the frontend is ready to handle silent renewal.
- Token claims: `sub` (user id), `tenant_id`, `type` (`"tenant"` or `"platform"`), `exp`.
  Permissions are **not** baked into the token — they're re-checked against the DB on every
  request via the current `UserRole`/`Role` rows, so revoking a role takes effect immediately
  instead of waiting for token expiry.
- `POST /api/v1/auth/login` (tenant surface): resolves tenant from `Host`/`X-Tenant-Slug`
  first, then authenticates the user *within that tenant* — the same username in two different
  tenants are two entirely different accounts, login must never cross that boundary.
- `GET /api/v1/auth/me`: returns the user plus their resolved roles/permissions, so the
  frontend can gate UI without a second round-trip.

## 7. FastAPI dependency chain (how isolation actually gets enforced in code)

```
get_current_tenant(request)        -> resolves Tenant from Host/header, 404 if unknown/suspended
get_current_user(token, tenant)    -> decodes JWT, loads User, 403 if token.tenant_id != tenant.id
require_permission(perm: str)      -> loads user's roles, 403 if perm not present
get_tenant_db(tenant)              -> yields a DB session with a query-level tenant_id filter
                                       (SQLAlchemy `with_loader_criteria` or an explicit
                                       repository-layer filter) so a handler that *forgets* to
                                       filter by tenant still can't see cross-tenant rows
```
Every tenant-scoped router endpoint depends on `get_current_user` (which transitively depends
on `get_current_tenant`) and, where relevant, `require_permission(...)`. Platform routers depend
on a separate `get_current_superuser` and never touch `get_current_tenant` at all — the two
dependency trees don't share a code path, so there's no scenario where a platform token
accidentally satisfies a tenant check or vice versa.

## 8. API surface

### Platform (super user only, `/api/v1/platform/*`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/platform/auth/login` | Super user login |
| GET | `/platform/tenants` | List all tenants |
| POST | `/platform/tenants` | Create tenant (slug + name) → returns tenant + URL + owner temp password |
| GET | `/platform/tenants/{id}` | Tenant detail |
| PATCH | `/platform/tenants/{id}` | Rename, suspend/reactivate |
| GET | `/platform/tenants/check-slug?slug=` | Availability check while super user types a slug |

### Tenant (`/api/v1/*`, resolved per-subdomain, matches the existing mock contract)
| Method | Path | Permission required |
|---|---|---|
| POST | `/auth/login` | — |
| GET | `/auth/me` | authenticated |
| GET/POST | `/children` | `children:read` / `children:write` |
| GET/PUT/DELETE | `/children/{id}` | `children:read` / `children:write` / `children:delete` |
| GET/POST | `/payments` | `payments:read` / `payments:write` |
| PUT | `/payments/{id}` | `payments:write` |
| GET/POST | `/levels` | `levels:manage` (read also allowed for anyone with `children:read`) |
| PUT/DELETE | `/levels/{id}` | `levels:manage` |
| GET/POST | `/users` | `users:manage` |
| PATCH/DELETE | `/users/{id}` | `users:manage` |
| GET/POST | `/roles` | `roles:manage` |
| GET | `/permissions` | `roles:manage` (catalog, to build the "assign permissions" UI) |

This is a strict superset of what `lib/api.ts` already calls — nothing in the existing frontend
needs new endpoints, it needs the existing ones to become real and tenant-aware, plus a new
Users/Roles admin screen that doesn't exist in the frontend yet (out of scope for this doc —
backend will be ready for it).

## 9. Data model summary (domain tables, all carrying `tenant_id`)

```
Child     id, tenant_id, name, date_of_birth, level, has_kit, is_active, join_date
Payment   id, tenant_id, child_id, amount, month, year, status, due_date, paid_date
Level     id, tenant_id, name, description
```
Field names deliberately match the current mock 1:1 — this is the part of the plan with zero
room for creative improvement, since every field name is already load-bearing in the shipped
frontend code (`Badge variant={child.level}`, `payment.status`, etc.).

## 10. Project structure

```
backend/
  app/
    main.py                     # FastAPI() app, mounts routers, exception handlers
    core/
      config.py                 # Settings (pydantic-settings): DB URL, JWT secret, env
      security.py                # password hashing, JWT encode/decode
      database.py                # SQLAlchemy engine/session
    middleware/
      tenant.py                  # Host-header tenant resolution
    deps.py                      # get_current_tenant, get_current_user, require_permission, ...
    models/                      # SQLAlchemy models
      superuser.py  tenant.py  user.py  role.py  child.py  payment.py  level.py
    schemas/                     # Pydantic request/response models (mirrors models/)
    services/                    # business logic (tenant provisioning, auth, rbac)
    api/v1/
      platform/
        auth.py  tenants.py
      auth.py  users.py  roles.py  children.py  payments.py  levels.py
    seed/
      permissions.py             # the fixed permission catalog
      default_roles.py           # Owner/Coach/Staff seed definitions
  alembic/                       # migrations
  tests/
    conftest.py                  # test DB fixture, tenant + user factories
    test_tenant_isolation.py     # the single most important test file in this backend
    test_platform_auth.py  test_tenant_auth.py  test_rbac.py
    test_children.py  test_payments.py  test_levels.py
  pyproject.toml  requirements.txt
  .env.example
  Dockerfile  docker-compose.yml   # postgres + backend, for local parity with prod
```

## 11. Tech stack

FastAPI · Pydantic v2 · SQLAlchemy 2.x (async) · Alembic (migrations) · PostgreSQL ·
`passlib[bcrypt]` · `python-jose` (JWT) · `pydantic-settings` (config) · `uvicorn` ·
`pytest` + `httpx.AsyncClient` (tests) · `python-slugify` (slug generation).

## 12. Phased implementation

1. **Scaffold** — project layout, config, DB connection, Alembic init, Docker Compose
   (Postgres), health-check endpoint. Nothing tenant-aware yet.
2. **Platform tier** — `SuperUser` model + seed script for the first super user, platform login,
   tenant CRUD, slug validation, tenant-resolution middleware. Deliverable: a super user can
   create a tenant and get back its URL.
3. **Tenant auth + RBAC** — `User`/`Role`/`UserRole` models, permission catalog, default-role
   seeding on tenant creation, tenant login/`me`, `require_permission` dependency, Users/Roles
   CRUD endpoints. Deliverable: a tenant owner can log in and add a coach user with a scoped
   role.
4. **Domain parity** — `Child`/`Payment`/`Level` models and endpoints, matching the mock's
   contract exactly. Deliverable: point `frontend-next`'s `NEXT_PUBLIC_API_URL` at this backend
   (per-tenant subdomain in prod, or the dev header fallback locally) and the existing frontend
   works against a real multi-tenant database with zero frontend code changes.
5. **Isolation hardening** — `test_tenant_isolation.py` (create two tenants, assert tenant A's
   token can never read/write tenant B's rows through any endpoint, assert slug-mismatched
   tokens are rejected), rate-limit login, structured audit log for platform actions
   (tenant created/suspended, role changed).
6. **Deploy** — Dockerfile, migration-on-deploy step, wildcard DNS/TLS (infra, tracked but
   outside this repo), CORS config allowing `https://*.victory.pingtech.dev`.

## 13. Open decisions (flagging rather than blocking on)

- **First user handoff for a new tenant**: temp password shown once to the super user (MVP,
  no email infra) vs. an invite-link email flow (better UX, needs a mail sender — SES/Resend/
  etc. — which doesn't exist anywhere in this project yet). Defaulting to temp password for
  MVP; revisit once/if transactional email is wired up.
- **Custom domains per tenant** (`app.customeracademy.com` instead of `{slug}.victory.
  pingtech.dev`): not requested, not planned for MVP, but the `Tenant` model's shape (adding a
  nullable `custom_domain` column later) doesn't need to change to support it eventually — worth
  knowing it's not a redesign if it comes up.
- **Single role vs. multiple roles per user**: modeled as many-to-many (`UserRole`) since it's
  barely more work than single-role and avoids a schema migration the day someone needs a user
  to be both Coach and Staff.
