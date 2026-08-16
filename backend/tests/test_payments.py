import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _headers(tenant, tenant_owner_token):
    return auth_headers(tenant_owner_token, tenant["tenant"]["slug"])


async def _make_child(client, headers, name="Liam Carter"):
    resp = await client.post(
        "/api/v1/children",
        headers=headers,
        json={"name": name, "date_of_birth": "2015-03-12", "level": "beginner"},
    )
    return resp.json()["id"]


async def test_create_payment_defaults(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    child_id = await _make_child(client, headers)

    resp = await client.post(
        "/api/v1/payments",
        headers=headers,
        json={"child_id": child_id, "amount": 50, "month": "August", "year": 2026},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["due_date"] == "2026-01-01"
    assert body["paid_date"] is None


async def test_create_payment_requires_existing_child(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    resp = await client.post(
        "/api/v1/payments",
        headers=headers,
        json={
            "child_id": "00000000-0000-0000-0000-000000000000",
            "amount": 50,
            "month": "August",
            "year": 2026,
        },
    )
    assert resp.status_code == 404


async def test_list_payments_filters(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    child_id = await _make_child(client, headers)
    other_child_id = await _make_child(client, headers, name="Sofia Martinez")

    await client.post(
        "/api/v1/payments",
        headers=headers,
        json={"child_id": child_id, "amount": 50, "month": "July", "year": 2026, "status": "paid"},
    )
    await client.post(
        "/api/v1/payments",
        headers=headers,
        json={"child_id": other_child_id, "amount": 60, "month": "August", "year": 2026, "status": "overdue"},
    )

    resp = await client.get("/api/v1/payments", headers=headers, params={"status": "overdue"})
    assert len(resp.json()) == 1
    assert resp.json()[0]["child_id"] == other_child_id

    resp = await client.get("/api/v1/payments", headers=headers, params={"child_id": child_id})
    assert len(resp.json()) == 1
    assert resp.json()[0]["month"] == "July"


async def test_update_payment_marks_paid(client, tenant, tenant_owner_token):
    headers = await _headers(tenant, tenant_owner_token)
    child_id = await _make_child(client, headers)
    create_resp = await client.post(
        "/api/v1/payments",
        headers=headers,
        json={"child_id": child_id, "amount": 50, "month": "August", "year": 2026},
    )
    payment_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/payments/{payment_id}",
        headers=headers,
        json={"status": "paid", "paid_date": "2026-08-10"},
    )
    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["status"] == "paid"
    assert body["paid_date"] == "2026-08-10"
