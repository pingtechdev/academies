import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _headers(tenant, tenant_owner_token):
    return auth_headers(tenant_owner_token, tenant["tenant"]["slug"])


async def test_create_and_get_child(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    resp = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Liam Carter", "date_of_birth": "2015-03-12", "level": "beginner", "has_kit": True},
    )
    assert resp.status_code == 201
    child = resp.json()
    assert child["name"] == "Liam Carter"
    assert child["is_active"] is True
    assert child["has_kit"] is True
    assert "join_date" in child

    get_resp = await client.get(f"/api/v1/children/{child['id']}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == child["id"]


async def test_create_child_requires_fields(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    resp = await client.post("/api/v1/children", headers=headers, json={"name": "No DOB"})
    assert resp.status_code == 422


async def test_list_children_filters_by_level_and_search(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Liam Carter", "date_of_birth": "2015-03-12", "level": "beginner"},
    )
    await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Sofia Martinez", "date_of_birth": "2014-07-22", "level": "intermediate"},
    )

    resp = await client.get("/api/v1/children", headers=headers, params={"level": "beginner"})
    names = [c["name"] for c in resp.json()]
    assert names == ["Liam Carter"]

    resp = await client.get("/api/v1/children", headers=headers, params={"search": "sofia"})
    names = [c["name"] for c in resp.json()]
    assert names == ["Sofia Martinez"]


async def test_update_child(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    create_resp = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Ava Johnson", "date_of_birth": "2016-01-30", "level": "beginner"},
    )
    child_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/children/{child_id}", headers=headers, json={"has_kit": True, "is_active": False}
    )
    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["has_kit"] is True
    assert body["is_active"] is False
    assert body["name"] == "Ava Johnson"


async def test_delete_child_cascades_payments(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    create_resp = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": "Noah Thompson", "date_of_birth": "2013-11-05", "level": "advanced"},
    )
    child_id = create_resp.json()["id"]

    await client.post(
        "/api/v1/payments",
        headers=headers,
        json={"child_id": child_id, "amount": 50, "month": "August", "year": 2026},
    )

    delete_resp = await client.delete(f"/api/v1/children/{child_id}", headers=headers)
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/children/{child_id}", headers=headers)
    assert get_resp.status_code == 404

    payments_resp = await client.get("/api/v1/payments", headers=headers, params={"child_id": child_id})
    assert payments_resp.json() == []


async def test_child_not_found(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    resp = await client.get("/api/v1/children/00000000-0000-0000-0000-000000000000", headers=headers)
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Child not found"}
