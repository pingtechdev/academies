"""The single most important test file in this backend (backend.md §10).

Creates two tenants and asserts tenant A's token/session can never read or write tenant B's
rows through any endpoint, and that a token issued for one tenant is rejected outright when
presented against a different tenant's subdomain.
"""

import pytest

from tests.conftest import auth_headers, create_tenant, tenant_login

pytestmark = pytest.mark.asyncio


@pytest.fixture
def tenant_a(tenant):
    return tenant


@pytest.fixture
async def tenant_b(client, superuser_token):
    return await create_tenant(client, superuser_token, name="Second Academy", slug="second-academy", owner_username="owner2")


async def _owner_token(client, t):
    resp = await tenant_login(client, t["tenant"]["slug"], t["owner_username"], t["owner_temp_password"])
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def test_token_for_tenant_a_rejected_on_tenant_b_subdomain(client, tenant_a, tenant_b):
    token_a = await _owner_token(client, tenant_a)

    resp = await client.get("/api/v1/auth/me", headers=auth_headers(token_a, tenant_b["tenant"]["slug"]))
    assert resp.status_code == 403


async def test_children_isolated_across_tenants(client, tenant_a, tenant_b):
    token_a = await _owner_token(client, tenant_a)
    token_b = await _owner_token(client, tenant_b)
    headers_a = auth_headers(token_a, tenant_a["tenant"]["slug"])
    headers_b = auth_headers(token_b, tenant_b["tenant"]["slug"])

    create_resp = await client.post(
        "/api/v1/children",
        headers=headers_a,
        json={"name": "Tenant A Kid", "date_of_birth": "2015-01-01", "level": "beginner"},
    )
    child_id = create_resp.json()["id"]

    # Tenant B's list must never show tenant A's child.
    list_resp = await client.get("/api/v1/children", headers=headers_b)
    assert list_resp.json() == []

    # Tenant B can't fetch, update, or delete tenant A's child by id either.
    assert (await client.get(f"/api/v1/children/{child_id}", headers=headers_b)).status_code == 404
    assert (
        await client.put(f"/api/v1/children/{child_id}", headers=headers_b, json={"has_kit": True})
    ).status_code == 404
    assert (await client.delete(f"/api/v1/children/{child_id}", headers=headers_b)).status_code == 404

    # It's still there, untouched, from tenant A's perspective.
    still_there = await client.get(f"/api/v1/children/{child_id}", headers=headers_a)
    assert still_there.status_code == 200
    assert still_there.json()["has_kit"] is False


async def test_payments_isolated_across_tenants(client, tenant_a, tenant_b):
    token_a = await _owner_token(client, tenant_a)
    token_b = await _owner_token(client, tenant_b)
    headers_a = auth_headers(token_a, tenant_a["tenant"]["slug"])
    headers_b = auth_headers(token_b, tenant_b["tenant"]["slug"])

    child_resp = await client.post(
        "/api/v1/children",
        headers=headers_a,
        json={"name": "Tenant A Kid", "date_of_birth": "2015-01-01", "level": "beginner"},
    )
    child_id = child_resp.json()["id"]
    payment_resp = await client.post(
        "/api/v1/payments",
        headers=headers_a,
        json={"child_id": child_id, "amount": 50, "month": "August", "year": 2026},
    )
    payment_id = payment_resp.json()["id"]

    assert (await client.get("/api/v1/payments", headers=headers_b)).json() == []
    update_resp = await client.put(
        f"/api/v1/payments/{payment_id}", headers=headers_b, json={"status": "paid"}
    )
    assert update_resp.status_code == 404

    # Tenant B can't even use tenant A's child_id to create a payment under its own tenant.
    cross_create = await client.post(
        "/api/v1/payments",
        headers=headers_b,
        json={"child_id": child_id, "amount": 999, "month": "August", "year": 2026},
    )
    assert cross_create.status_code == 404


async def test_levels_isolated_across_tenants(client, tenant_a, tenant_b):
    token_a = await _owner_token(client, tenant_a)
    token_b = await _owner_token(client, tenant_b)
    headers_a = auth_headers(token_a, tenant_a["tenant"]["slug"])
    headers_b = auth_headers(token_b, tenant_b["tenant"]["slug"])

    await client.post("/api/v1/levels", headers=headers_a, json={"name": "beginner"})

    # Same level name is free to use in tenant B -- uniqueness is scoped per tenant.
    resp = await client.post("/api/v1/levels", headers=headers_b, json={"name": "beginner"})
    assert resp.status_code == 201

    assert len((await client.get("/api/v1/levels", headers=headers_a)).json()) == 1
    assert len((await client.get("/api/v1/levels", headers=headers_b)).json()) == 1


async def test_users_and_roles_isolated_across_tenants(client, tenant_a, tenant_b):
    token_a = await _owner_token(client, tenant_a)
    token_b = await _owner_token(client, tenant_b)
    headers_a = auth_headers(token_a, tenant_a["tenant"]["slug"])
    headers_b = auth_headers(token_b, tenant_b["tenant"]["slug"])

    # Usernames may collide across tenants -- they're two entirely different accounts.
    resp = await client.post(
        "/api/v1/users",
        headers=headers_b,
        json={"name": "Owner B2", "username": tenant_a["owner_username"], "password": "differentpass1"},
    )
    assert resp.status_code == 201

    users_b = (await client.get("/api/v1/users", headers=headers_b)).json()
    usernames_b = {u["username"] for u in users_b}
    assert usernames_b == {tenant_b["owner_username"], tenant_a["owner_username"]}
    assert len(users_b) == 2  # tenant B's own owner + the new same-named user

    users_a = (await client.get("/api/v1/users", headers=headers_a)).json()
    assert len(users_a) == 1

    roles_a = {r["id"] for r in (await client.get("/api/v1/roles", headers=headers_a)).json()}
    roles_b = {r["id"] for r in (await client.get("/api/v1/roles", headers=headers_b)).json()}
    assert roles_a.isdisjoint(roles_b)


async def test_suspended_tenant_returns_404_not_403(client, superuser_token, tenant_a):
    tenant_id = tenant_a["tenant"]["id"]
    await client.patch(
        f"/api/v1/platform/tenants/{tenant_id}",
        headers={"Authorization": f"Bearer {superuser_token}"},
        json={"status": "suspended"},
    )

    resp = await client.get("/api/v1/children", headers={"X-Tenant-Slug": tenant_a["tenant"]["slug"]})
    assert resp.status_code == 404
