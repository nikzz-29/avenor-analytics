import io
from decimal import Decimal

import httpx
import openpyxl
import pytest
from pydantic import ValidationError

from app.modules.analytics import safe_cell
from app.modules.imports import parse_file, validate_rows
from app.modules.schemas import Filter, QueryIn
from tests.conftest import signup, workspace

CSV = b"order_id,order_date,customer_id,product_name,quantity,unit_price,discount,refund,status,category,channel\nA,2025-06-01,C1,Lamp,2,50,10,0,paid,Home,Web\nA,2025-06-01,C1,Desk,1,100,0,0,paid,Home,Web\nB,2025-06-02,C2,Bag,1,80,0,20,refunded,Accessories,Retail\nC,2025-06-03,C1,Tee,1,30,0,0,cancelled,Apparel,Web\n"


async def upload(
    client: httpx.AsyncClient, base: str, content: bytes = CSV, **data: str
) -> httpx.Response:
    return await client.post(
        base + "/datasets/import", files={"file": ("sales.csv", content, "text/csv")}, data=data
    )


async def test_auth_csrf_sessions(client: httpx.AsyncClient) -> None:
    await signup(client)
    assert (await client.get("/api/v1/auth/me")).status_code == 200
    client.headers.pop("x-csrf-token")
    assert (await client.post("/api/v1/workspaces", json={"name": "Forbidden"})).status_code == 403
    client.headers["x-csrf-token"] = client.cookies["avenor_csrf"]
    assert (await client.post("/api/v1/auth/logout")).status_code == 200
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": "alex@example.com", "password": "wrong"}
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": "alex@example.com", "password": "correct-horse-29"}
        )
    ).status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/login",
            headers={"origin": "https://evil.test"},
            json={"email": "alex@example.com", "password": "correct-horse-29"},
        )
    ).status_code == 403


async def test_money_import_query_export(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    response = await upload(client, base)
    assert response.status_code == 200, response.text
    assert response.json()["imported"] == 4
    overview = await client.get(
        base + "/analytics/overview", params={"start": "2025-06-01", "end": "2025-06-30"}
    )
    assert overview.status_code == 200, overview.text
    current = overview.json()["current"]
    assert Decimal(current["revenue"]) == 250
    assert current["orders"] == 2  # multi-line A counted once, cancelled C excluded
    assert Decimal(current["aov"]) == 125
    assert current["customers"] == 2
    assert current["refunds"] == "20.00"
    result = await client.post(
        base + "/analytics/query",
        json={
            "dimension": "category",
            "metric": "revenue",
            "filters": [{"field": "channel", "op": "eq", "values": ["Web"]}],
        },
    )
    assert sum(Decimal(p["value"]) for p in result.json()["points"]) == 190
    exported = await client.post(base + "/analytics/export", json={"dimension": "category"})
    assert "Home,190.00" in exported.text
    assert exported.headers["content-type"].startswith("text/csv")
    assert (await upload(client, base)).status_code == 409
    assert (await client.get(base + "/analytics/sales?page_size=2")).json()["total"] == 4
    empty = (await client.get(base + "/analytics/overview?start=2020-01-01&end=2020-01-02")).json()
    assert empty["current"]["aov"] is None
    assert empty["revenue_growth"] is None
    assert (
        await client.get(base + "/analytics/overview?start=2025-02-01&end=2025-01-01")
    ).status_code == 422


async def test_atomic_validation_and_replace(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    broken = CSV.replace(b"1,100", b"-1,100")
    result = await upload(client, base, broken)
    assert result.json()["status"] == "failed"
    assert result.json()["errors"][0]["row"] == 3
    assert (await client.get(base + "/datasets")).json() == []
    await upload(client, base)
    dataset = (await client.get(base + "/datasets")).json()[0]
    replaced = await upload(
        client, base, CSV.replace(b"2,50", b"2,60"), mode="replace", dataset_id=dataset["id"]
    )
    assert replaced.json()["imported"] == 4
    total = (await client.post(base + "/analytics/query", json={})).json()
    assert sum(Decimal(p["value"]) for p in total["points"]) == 270
    overlap = await upload(client, base, CSV.replace(b"2,50", b"2,70"))
    assert overlap.json()["status"] == "failed"


async def test_mapping_and_xlsx(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.append(["Order", "Date", "Customer", "Product", "Qty", "Price"])
    sheet.append(["X", "2025-01-01", "Alex", "Lamp", 2, 50])
    buffer = io.BytesIO()
    workbook.save(buffer)
    response = await client.post(
        base + "/datasets/preview", files={"file": ("input.xlsx", buffer.getvalue())}
    )
    assert response.status_code == 200, response.text
    assert response.json()["inferred_types"]["Price"] == "number"
    import json

    mapping = dict(
        zip(
            ["order_id", "order_date", "customer_id", "product_name", "quantity", "unit_price"],
            ["Order", "Date", "Customer", "Product", "Qty", "Price"],
            strict=True,
        )
    )
    response = await client.post(
        base + "/datasets/import",
        files={"file": ("input.xlsx", buffer.getvalue())},
        data={"mapping": json.dumps(mapping)},
    )
    assert response.json()["imported"] == 1


async def test_saved_resources_concurrency_and_isolation(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    await upload(client, base)
    widget = {"id": "w1", "title": "Revenue", "type": "bar", "query": {"dimension": "category"}}
    dashboard = (
        await client.post(base + "/dashboards", json={"name": "Board", "widgets": [widget]})
    ).json()
    assert dashboard["widgets"][0]["title"] == "Revenue"
    data = {"name": "Renamed", "widgets": [widget], "revision": dashboard["revision"]}
    assert (
        await client.patch(base + "/dashboards/" + dashboard["id"], json=data)
    ).status_code == 200
    assert (
        await client.patch(base + "/dashboards/" + dashboard["id"], json=data)
    ).status_code == 409
    report = await client.post(
        base + "/reports", json={"name": "Category", "query": {"dimension": "category"}}
    )
    assert report.status_code == 201
    # A different user cannot access any known IDs.
    client.cookies.clear()
    await signup(client, "other@example.com")
    assert (await client.get(base + "/datasets")).status_code == 404
    assert (await client.get(base + "/dashboards/" + dashboard["id"])).status_code == 404
    assert (await client.post(base + "/analytics/query", json={})).status_code == 404


async def test_viewer_permissions(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    owner_cookies = dict(client.cookies)
    client.cookies.clear()
    await signup(client, "viewer@example.com")
    viewer_cookies = dict(client.cookies)
    client.cookies.clear()
    client.cookies.update(owner_cookies)
    client.headers["x-csrf-token"] = client.cookies["avenor_csrf"]
    assert (
        await client.put(base + "/members", json={"email": "viewer@example.com", "role": "viewer"})
    ).status_code == 200
    client.cookies.clear()
    client.cookies.update(viewer_cookies)
    client.headers["x-csrf-token"] = client.cookies["avenor_csrf"]
    assert (await client.get(base + "/datasets")).status_code == 200
    assert (await client.post(base + "/analytics/query", json={})).status_code == 200
    assert (await client.post(base + "/analytics/sales/export", json={})).status_code == 200
    assert (await client.post(base + "/dashboards", json={"name": "No"})).status_code == 403
    assert (
        await client.put(base + "/members", json={"email": "viewer@example.com", "role": "admin"})
    ).status_code == 403


async def test_demo_is_deterministic_and_resettable(client: httpx.AsyncClient) -> None:
    response = await client.post("/api/v1/auth/demo")
    assert response.status_code == 200, response.text
    client.headers["x-csrf-token"] = client.cookies["avenor_csrf"]
    ws = (await client.get("/api/v1/workspaces")).json()[0]
    base = f"/api/v1/workspaces/{ws['id']}"
    before = (await client.get(base + "/analytics/overview")).json()
    assert before["current"]["orders"] > 2000
    assert len(before["trend"]) == 12
    assert (await client.post(base + "/reset-demo")).status_code == 200
    after = (await client.get(base + "/analytics/overview")).json()
    assert before == after


@pytest.mark.parametrize("prefix", ["=SUM(A1)", "+cmd", "-cmd", "@SUM", "  =cmd"])
def test_formula_export(prefix: str) -> None:
    assert safe_cell(prefix).startswith("'")


def test_file_and_schema_guards() -> None:
    with pytest.raises(ValueError):
        parse_file(b"", "empty.csv")
    with pytest.raises(ValueError):
        parse_file(b"<html></html>", "evil.xlsx")
    with pytest.raises(ValidationError):
        Filter(field="category", op="gt", values=["a"])
    with pytest.raises(ValidationError):
        QueryIn(start="2025-12-01", end="2025-01-01")
    cols, rows = parse_file(CSV, "sales.csv")
    valid, errors, rejected = validate_rows(rows + [rows[0]], {c: c for c in cols})
    assert len(valid) == 4 and rejected == 1
    assert "Duplicate" in errors[0].message


async def test_totals_are_not_sum_of_averages(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    await upload(client, base)
    result = await client.post(
        base + "/analytics/query", json={"metric": "aov", "dimension": "category"}
    )
    assert Decimal(result.json()["total"]) == 125
    result = await client.post(
        base + "/analytics/sales/export",
        json={"filters": [{"field": "status", "op": "eq", "values": ["paid"]}]},
    )
    assert "net_revenue" in result.text
    assert "cancelled" not in result.text
    assert result.text.count("\n") == 3


async def test_bad_numeric_filter_returns_validation_error(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    for value in ("hello", "NaN", "Infinity"):
        result = await client.post(
            base + "/analytics/query",
            json={"filters": [{"field": "quantity", "op": "gt", "values": [value]}]},
        )
        assert result.status_code == 422


async def test_oversized_chunked_body_is_bounded(client: httpx.AsyncClient) -> None:
    async def chunks():
        for _ in range(12):
            yield b" " * 1024 * 1024

    result = await client.post(
        "/api/v1/auth/login", content=chunks(), headers={"content-type": "application/json"}
    )
    assert result.status_code == 413


def test_order_consistency() -> None:
    cols, rows = parse_file(CSV, "sales.csv")
    rows[1]["customer_id"] = "someone-else"
    valid, errors, rejected = validate_rows(rows, {c: c for c in cols})
    assert rejected == 1 and len(valid) == 3
    assert "must share" in errors[0].message


async def test_password_reset_mail_is_one_time_and_revokes_sessions(
    client: httpx.AsyncClient,
) -> None:
    import re
    from uuid import uuid4

    email = f"reset-{uuid4().hex[:8]}@example.com"
    await signup(client, email)
    csrf = client.cookies["avenor_csrf"]
    requested = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert requested.status_code == 200
    async with httpx.AsyncClient(base_url="http://localhost:8025") as mailbox:
        messages = (await mailbox.get("/api/v1/messages")).json()["messages"]
        message_id = next(m["ID"] for m in messages if any(t["Address"] == email for t in m["To"]))
        body = (await mailbox.get("/api/v1/message/" + message_id)).json()["Text"]
    token = re.search(r"token=([\w-]+)", body)
    assert token is not None
    payload = {"token": token.group(1), "password": "new-strong-password"}
    assert (await client.post("/api/v1/auth/reset-password", json=payload)).status_code == 200
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    assert (await client.post("/api/v1/auth/reset-password", json=payload)).status_code == 400
    result = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "new-strong-password"}
    )
    assert result.status_code == 200
    assert client.cookies["avenor_csrf"] != csrf


async def test_raw_export_matches_customer_search(client: httpx.AsyncClient) -> None:
    base = await workspace(client)
    await upload(client, base)
    result = await client.post(
        base + "/analytics/sales/export", json={"search": "C2", "status": "refunded"}
    )
    assert result.status_code == 200
    assert "Bag" in result.text and "Lamp" not in result.text


async def test_transaction_is_committed_before_response_headers(client: httpx.AsyncClient) -> None:
    """A browser may refetch immediately after headers/body; it must see the new data."""
    import json
    from uuid import uuid4

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    from app.db.models import User
    from app.main import app
    from tests.conftest import TEST_URL

    email = f"commit-{uuid4().hex[:8]}@example.com"
    body = json.dumps(
        {"email": email, "name": "Commit timing", "password": "strong-password-2026"}
    ).encode()
    observed = []
    consumed = False

    async def receive():
        nonlocal consumed
        if consumed:
            import asyncio

            await asyncio.sleep(10)
            return {"type": "http.disconnect"}
        consumed = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start" and message["status"] == 201:
            engine = create_async_engine(TEST_URL, poolclass=NullPool)
            async with engine.connect() as connection:
                observed.append(await connection.scalar(select(User.id).where(User.email == email)))
            await engine.dispose()

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/auth/register",
        "raw_path": b"/api/v1/auth/register",
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode()),
        ],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    await app(scope, receive, send)
    assert len(observed) == 1 and observed[0] is not None
