import pytest

from tests.conftest import auth_headers, tenant_login

pytestmark = pytest.mark.asyncio


async def test_permissions_catalog_lists_all_codes(client, tenant, tenant_owner_token):
    resp = await client.get(
        "/api/v1/permissions", headers=auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    )
    assert resp.status_code == 200
    codes = {p["code"] for p in resp.json()}
    assert codes == {
        "children:read",
        "children:write",
        "children:delete",
        "payments:read",
        "payments:write",
        "levels:manage",
        "users:manage",
        "roles:manage",
        "settings:manage",
    }


async def test_default_roles_seeded_on_tenant_creation(client, tenant, tenant_owner_token):
    resp = await client.get(
        "/api/v1/roles", headers=auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    )
    assert resp.status_code == 200
    names = {r["name"] for r in resp.json()}
    assert names == {"Owner", "Coach", "Staff"}
    assert all(r["is_system"] for r in resp.json())


async def test_missing_permission_returns_403(client, tenant, tenant_owner_token):
    headers = auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    roles = (await client.get("/api/v1/roles", headers=headers)).json()
    staff_role = next(r for r in roles if r["name"] == "Staff")

    # Create a coach-only user (children:read/write, payments:read -- no roles:manage).
    coach_resp = await client.post(
        "/api/v1/users",
        headers=headers,
        json={"name": "Coach", "username": "coach1", "password": "coachpass1", "role_ids": [staff_role["id"]]},
    )
    assert coach_resp.status_code == 201

    login = await tenant_login(client, tenant["tenant"]["slug"], "coach1", "coachpass1")
    assert login.status_code == 200
    coach_token = login.json()["access_token"]
    coach_headers = auth_headers(coach_token, tenant["tenant"]["slug"])

    # Staff has payments:write but not roles:manage or children:delete.
    resp = await client.get("/api/v1/roles", headers=coach_headers)
    assert resp.status_code == 403

    resp = await client.post(
        "/api/v1/children",
        headers=coach_headers,
        json={"name": "Kid", "date_of_birth": "2015-01-01", "level": "beginner"},
    )
    assert resp.status_code == 403  # Staff lacks children:write


async def test_create_custom_role_from_catalog(client, tenant, tenant_owner_token):
    headers = auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    resp = await client.post(
        "/api/v1/roles",
        headers=headers,
        json={"name": "Front Desk", "permissions": ["children:read", "payments:read"]},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_system"] is False
    assert body["permissions"] == ["children:read", "payments:read"]


async def test_create_role_rejects_unknown_permission(client, tenant, tenant_owner_token):
    headers = auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    resp = await client.post(
        "/api/v1/roles", headers=headers, json={"name": "Bogus", "permissions": ["not:a:real:perm"]}
    )
    assert resp.status_code == 422


async def test_system_role_cannot_be_edited_or_deleted(client, tenant, tenant_owner_token):
    headers = auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    roles = (await client.get("/api/v1/roles", headers=headers)).json()
    owner_role = next(r for r in roles if r["name"] == "Owner")

    resp = await client.patch(
        f"/api/v1/roles/{owner_role['id']}", headers=headers, json={"name": "Renamed"}
    )
    assert resp.status_code == 400

    resp = await client.delete(f"/api/v1/roles/{owner_role['id']}", headers=headers)
    assert resp.status_code == 400


async def test_custom_role_can_be_edited_and_deleted(client, tenant, tenant_owner_token):
    headers = auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    create_resp = await client.post(
        "/api/v1/roles", headers=headers, json={"name": "Temp Role", "permissions": ["children:read"]}
    )
    role_id = create_resp.json()["id"]

    update_resp = await client.patch(
        f"/api/v1/roles/{role_id}", headers=headers, json={"permissions": ["children:read", "payments:read"]}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["permissions"] == ["children:read", "payments:read"]

    delete_resp = await client.delete(f"/api/v1/roles/{role_id}", headers=headers)
    assert delete_resp.status_code == 204


async def test_user_can_hold_multiple_roles(client, tenant, tenant_owner_token):
    headers = auth_headers(tenant_owner_token, tenant["tenant"]["slug"])
    roles = (await client.get("/api/v1/roles", headers=headers)).json()
    coach_role = next(r for r in roles if r["name"] == "Coach")
    staff_role = next(r for r in roles if r["name"] == "Staff")

    create_resp = await client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "name": "Multi",
            "username": "multi1",
            "password": "multipass1",
            "role_ids": [coach_role["id"], staff_role["id"]],
        },
    )
    assert create_resp.status_code == 201
    body = create_resp.json()
    assert {r["name"] for r in body["roles"]} == {"Coach", "Staff"}
