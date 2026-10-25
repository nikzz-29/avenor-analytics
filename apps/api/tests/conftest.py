import os
from collections.abc import AsyncIterator

import httpx
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import _attempts
from app.db.session import Base, get_db
from app.main import app

TEST_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://avenor:avenor@localhost:5432/avenor_test"
)
if not TEST_URL.rsplit("/", 1)[-1].endswith("_test"):
    raise RuntimeError("Integration tests must use a dedicated database ending in _test")


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    engine = create_async_engine(TEST_URL, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        tables = ", ".join(f'"{table.name}"' for table in reversed(Base.metadata.sorted_tables))
        await connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))

    async def override_db():
        async with factory() as session, session.begin():
            yield session

    app.dependency_overrides[get_db] = override_db
    _attempts.clear()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def signup(client: httpx.AsyncClient, email: str = "alex@example.com") -> str:
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse-29", "name": "Alex"},
    )
    assert response.status_code == 201, response.text
    client.headers["x-csrf-token"] = client.cookies["avenor_csrf"]
    return response.json()["id"]


async def workspace(client: httpx.AsyncClient) -> str:
    await signup(client)
    response = await client.post("/api/v1/workspaces", json={"name": "Test studio"})
    assert response.status_code == 201, response.text
    return f"/api/v1/workspaces/{response.json()['id']}"
