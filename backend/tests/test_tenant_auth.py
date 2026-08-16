import pytest

from tests.conftest import auth_headers, tenant_login

pytestmark = pytest.mark.asyncio


async def test_tenant_login_success(client, tenant):
    resp = await tenant_login(
        client, tenant["tenant"]["slug"], tenant["owner_username"], tenant["owner_temp_password"]
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["username"] == tenant["owner_username"]
    assert "roles:manage" in body["user"]["permissions"]


async def test_tenant_login_wrong_password(client, tenant):
    resp = await tenant_login(client, tenant["tenant"]["slug"], tenant["owner_username"], "wrong-password")
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Incorrect username or password"}


async def test_tenant_login_unknown_tenant(client):
    resp = await tenant_login(client, "does-not-exist", "owner", "whatever")
    assert resp.status_code == 404


async def test_tenant_login_requires_tenant_context(client, tenant):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": tenant["owner_username"], "password": tenant["owner_temp_password"]},
    )
    assert resp.status_code == 404


async def test_me_requires_authentication(client, tenant):
    resp = await client.get("/api/v1/auth/me", headers={"X-Tenant-Slug": tenant["tenant"]["slug"]})
    assert resp.status_code == 401


async def test_me_returns_user_and_permissions(client, tenant, tenant_owner_token):
    resp = await client.get(
        "/api/v1/auth/me", headers=auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == tenant["owner_username"]
    assert set(body["permissions"]) >= {"children:read", "payments:read", "users:manage"}


async def test_inactive_user_cannot_login(client, tenant, tenant_owner_token):
    users_resp = await client.get(
        "/api/v1/users", headers=auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    )
    owner_id = users_resp.json()[0]["id"]

    deactivate_resp = await client.delete(
        f"/api/v1/users/{owner_id}", headers=auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    )
    assert deactivate_resp.status_code == 204

    login_resp = await tenant_login(
        client, tenant["tenant"]["slug"], tenant["owner_username"], tenant["owner_temp_password"]
    )
    assert login_resp.status_code == 401
