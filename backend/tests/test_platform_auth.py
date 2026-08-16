import pytest

from tests.conftest import create_tenant

pytestmark = pytest.mark.asyncio


async def test_superuser_login_success(client, superuser_creds):
    resp = await client.post("/api/v1/platform/auth/login", json=superuser_creds)
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == superuser_creds["username"]


async def test_superuser_login_wrong_password(client, superuser_creds):
    resp = await client.post(
        "/api/v1/platform/auth/login",
        json={"username": superuser_creds["username"], "password": "wrong"},
    )
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Incorrect username or password"}


async def test_superuser_login_unknown_user(client):
    resp = await client.post(
        "/api/v1/platform/auth/login", json={"username": "nobody", "password": "whatever"}
    )
    assert resp.status_code == 401


async def test_platform_routes_require_platform_token(client, tenant_owner_token, tenant):
    resp = await client.get(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {tenant_owner_token}"},
    )
    assert resp.status_code == 403


async def test_create_tenant_returns_url_and_owner_password(client, superuser_token):
    body = await create_tenant(client, superuser_token, name="Falcon Academy", slug="falcons")
    assert body["tenant"]["slug"] == "falcons"
    assert body["tenant"]["url"] == "https://falcons.victory.pingtech.dev"
    assert body["owner_username"] == "owner"
    assert len(body["owner_temp_password"]) >= 8


async def test_create_tenant_slugifies_name_when_slug_omitted(client, superuser_token):
    body = await create_tenant(client, superuser_token, name="Great Academy!!", slug=None)
    assert body["tenant"]["slug"] == "great-academy"


@pytest.mark.parametrize("reserved", ["admin", "api", "www", "platform", "app"])
async def test_create_tenant_rejects_reserved_slug(client, superuser_token, reserved):
    resp = await client.post(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {superuser_token}"},
        json={
            "name": "Whatever",
            "slug": reserved,
            "owner_name": "Owner",
            "owner_username": "owner",
        },
    )
    assert resp.status_code == 422


async def test_create_tenant_rejects_duplicate_slug(client, superuser_token):
    await create_tenant(client, superuser_token, name="Dupe Academy", slug="dupe")
    resp = await client.post(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {superuser_token}"},
        json={"name": "Dupe Again", "slug": "dupe", "owner_name": "Owner", "owner_username": "owner"},
    )
    assert resp.status_code == 409


async def test_check_slug_availability(client, superuser_token):
    resp = await client.get(
        "/api/v1/platform/tenants/check-slug",
        params={"slug": "brand-new-slug"},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"slug": "brand-new-slug", "available": True}

    await create_tenant(client, superuser_token, name="Taken Academy", slug="taken-slug")
    resp = await client.get(
        "/api/v1/platform/tenants/check-slug",
        params={"slug": "taken-slug"},
        headers={"Authorization": f"Bearer {superuser_token}"},
    )
    assert resp.json() == {"slug": "taken-slug", "available": False}


async def test_suspend_tenant_blocks_tenant_login(client, superuser_token, tenant):
    tenant_id = tenant["tenant"]["id"]
    resp = await client.patch(
        f"/api/v1/platform/tenants/{tenant_id}",
        headers={"Authorization": f"Bearer {superuser_token}"},
        json={"status": "suspended"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"

    login_resp = await client.post(
        "/api/v1/auth/login",
        headers={"X-Tenant-Slug": tenant["tenant"]["slug"]},
        json={"username": tenant["owner_username"], "password": tenant["owner_temp_password"]},
    )
    assert login_resp.status_code == 404
