import pytest

from tests.conftest import auth_headers, tenant_login

pytestmark = pytest.mark.asyncio


async def _headers(tenant, tenant_owner_token):
    return auth_headers(tenant_owner_token, tenant["tenant"]["slug"])


async def test_create_and_list_levels(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    resp = await client.post(
        "/api/v1/levels", headers=headers, json={"name": "beginner", "description": "New players"}
    )
    assert resp.status_code == 201

    list_resp = await client.get("/api/v1/levels", headers=headers)
    assert list_resp.status_code == 200
    assert [lvl["name"] for lvl in list_resp.json()] == ["beginner"]


async def test_duplicate_level_name_rejected(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    await client.post("/api/v1/levels", headers=headers, json={"name": "beginner"})
    resp = await client.post("/api/v1/levels", headers=headers, json={"name": "beginner"})
    assert resp.status_code == 409


async def test_update_and_delete_level(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    create_resp = await client.post("/api/v1/levels", headers=headers, json={"name": "beginner"})
    level_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/levels/{level_id}", headers=headers, json={"description": "Updated"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["description"] == "Updated"

    delete_resp = await client.delete(f"/api/v1/levels/{level_id}", headers=headers)
    assert delete_resp.status_code == 204


async def test_cannot_delete_level_assigned_to_children(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    create_resp = await client.post("/api/v1/levels", headers=headers, json={"name": "beginner"})
    level_id = create_resp.json()["id"]

    await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Liam Carter", "date_of_birth": "2015-03-12", "level": "beginner"},
    )

    delete_resp = await client.delete(f"/api/v1/levels/{level_id}", headers=headers)
    assert delete_resp.status_code == 400


async def test_levels_readable_by_children_read_permission_alone(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    await client.post("/api/v1/levels", headers=headers, json={"name": "beginner"})

    roles = (await client.get("/api/v1/roles", headers=headers)).json()
    coach_role = next(r for r in roles if r["name"] == "Coach")  # children:read, no levels:manage

    await client.post(
        "/api/v1/users",
        headers=headers,
        json={"name": "Coach", "username": "coach1", "password": "coachpass1", "role_ids": [coach_role["id"]]},
    )
    login = await tenant_login(client, tenant["tenant"]["slug"], "coach1", "coachpass1")
    coach_headers = auth_headers(login.json()["access_token"], tenant["tenant"]["slug"])

    resp = await client.get("/api/v1/levels", headers=coach_headers)
    assert resp.status_code == 200

    create_resp = await client.post("/api/v1/levels", headers=coach_headers, json={"name": "advanced"})
    assert create_resp.status_code == 403
