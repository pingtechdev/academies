import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/academy_backend_test"
)
os.environ.setdefault("JWT_SECRET", "test-secret")

import uuid  # noqa: E402

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.database import AsyncSessionLocal, Base, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.superuser import SuperUser  # noqa: E402


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def superuser_creds():
    username = f"platform-{uuid.uuid4().hex[:8]}"
    password = "platform-pass-123"
    async with AsyncSessionLocal() as db:
        db.add(SuperUser(username=username, name="Platform Admin", password_hash=hash_password(password)))
        await db.commit()
    return {"username": username, "password": password}


@pytest_asyncio.fixture
async def superuser_token(client, superuser_creds):
    resp = await client.post("/api/v1/platform/auth/login", json=superuser_creds)
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def create_tenant(client, superuser_token, *, name, slug=None, owner_username="owner"):
    resp = await client.post(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {superuser_token}"},
        json={
            "name": name,
            "slug": slug,
            "owner_name": f"{name} Owner",
            "owner_username": owner_username,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def tenant_login(client, slug, username, password):
    resp = await client.post(
        "/api/v1/auth/login",
        headers={"X-Tenant-Slug": slug},
        json={"username": username, "password": password},
    )
    return resp


@pytest_asyncio.fixture
async def tenant(client, superuser_token):
    return await create_tenant(client, superuser_token, name="Victory Academy", slug="victory-academy")


@pytest_asyncio.fixture
async def tenant_owner_token(client, tenant):
    resp = await tenant_login(
        client, tenant["tenant"]["slug"], tenant["owner_username"], tenant["owner_temp_password"]
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token, slug):
    return {"Authorization": f"Bearer {token}", "X-Tenant-Slug": slug}
