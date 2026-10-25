import csv
import io
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import case, distinct, false, func, select
from sqlalchemy.sql.elements import ColumnElement

from app.core.security import DB, Membership
from app.db.models import Dataset, Sale
from app.modules.schemas import (
    KPI,
    EntityPage,
    EntityRow,
    OverviewOut,
    Point,
    QueryIn,
    QueryOut,
    SalesExportIn,
    SalesPage,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/analytics", tags=["Analytics"])
ZERO = Decimal(0)
ELIGIBLE = ("paid", "refunded")
NET = case(
    (Sale.status.in_(ELIGIBLE), Sale.quantity * Sale.unit_price - Sale.discount - Sale.refund),
    else_=0,
)
UNITS = case((Sale.status.in_(ELIGIBLE), Sale.quantity), else_=0)
ORDER = case((Sale.status.in_(ELIGIBLE), Sale.order_id), else_=None)
CUSTOMER = case((Sale.status.in_(ELIGIBLE), Sale.customer_id), else_=None)


async def scope(db: DB, workspace_id: str, query: QueryIn) -> list[ColumnElement[bool]]:
    clauses = [Sale.workspace_id == workspace_id]
    if query.dataset_id:
        exists = await db.scalar(
            select(Dataset.id).where(
                Dataset.id == query.dataset_id, Dataset.workspace_id == workspace_id
            )
        )
        if not exists:
            raise HTTPException(404, "Dataset not found; select a current source")
        clauses.append(Sale.dataset_id == query.dataset_id)
    if query.start:
        clauses.append(Sale.order_date >= query.start)
    if query.end:
        clauses.append(Sale.order_date <= query.end)
    for f in query.filters:
        column = getattr(Sale, f.field)
        values: list[Any] = list(f.values)
        if f.field in ("quantity", "unit_price"):
            values = [Decimal(v) for v in f.values]
        elif f.field == "order_date":
            values = [date.fromisoformat(v) for v in f.values]
        if f.op == "eq":
            clause = column == values[0]
        elif f.op == "neq":
            clause = column != values[0]
        elif f.op == "contains":
            clause = column.icontains(values[0], autoescape=True)
        elif f.op == "in":
            clause = column.in_(values)
        elif f.op == "gt":
            clause = column > values[0]
        elif f.op == "lt":
            clause = column < values[0]
        else:
            clause = column.between(values[0], values[1])
        clauses.append(clause)
    return clauses


async def execute_query(db: DB, workspace_id: str, query: QueryIn) -> QueryOut:
    clauses = await scope(db, workspace_id, query)
    if query.dimension == "date":
        dimension = func.to_char(func.date_trunc(query.grouping, Sale.order_date), "YYYY-MM-DD")
    else:
        dimension = getattr(Sale, query.dimension)
    count = func.count(distinct(ORDER))
    revenue = func.coalesce(func.sum(NET), 0)
    expressions = {
        "revenue": revenue,
        "orders": count,
        "aov": revenue / func.nullif(count, 0),
        "units": func.sum(UNITS),
        "customers": func.count(distinct(CUSTOMER)),
        "sum": revenue,
        "count": func.count(Sale.id),
        "distinct_count": func.count(distinct(CUSTOMER)),
        "average": func.avg(NET),
        "minimum": func.min(NET),
        "maximum": func.max(NET),
    }
    value = func.coalesce(expressions[query.metric], 0)
    statement = (
        select(dimension.label("label"), value.label("value")).where(*clauses).group_by(dimension)
    )
    ordering = (
        value.desc()
        if query.sort == "-value"
        else value.asc()
        if query.sort == "value"
        else dimension.asc()
    )
    result = await db.execute(statement.order_by(ordering).limit(query.limit))
    total = await db.scalar(select(expressions[query.metric]).where(*clauses))
    return QueryOut(
        total=Decimal(str(total)).quantize(Decimal("0.01")) if total is not None else None,
        points=[
            Point(label=str(label), value=Decimal(str(v)).quantize(Decimal("0.01")))
            for label, v in result
        ],
        metric=query.metric,
    )


@router.post("/query", response_model=QueryOut)
async def query(data: QueryIn, member: Membership, db: DB) -> QueryOut:
    return await execute_query(db, member.workspace_id, data)


async def calculate_kpi(db: DB, workspace_id: str, query: QueryIn) -> KPI:
    clauses = await scope(db, workspace_id, query)
    result = (
        await db.execute(
            select(
                func.coalesce(func.sum(NET), 0),
                func.count(distinct(ORDER)),
                func.count(distinct(CUSTOMER)),
                func.coalesce(func.sum(UNITS), 0),
                func.coalesce(func.sum(case((Sale.status.in_(ELIGIBLE), Sale.refund), else_=0)), 0),
            ).where(*clauses)
        )
    ).one()
    revenue, orders, customers, units, refunds = result
    # Returning = active customers with an earlier eligible order before this window.
    prior = select(Sale.customer_id).where(
        Sale.workspace_id == workspace_id, Sale.status.in_(ELIGIBLE)
    )
    if query.start:
        prior = prior.where(Sale.order_date < query.start)
    else:
        prior = prior.where(false())
    if query.dataset_id:
        prior = prior.where(Sale.dataset_id == query.dataset_id)
    returning = await db.scalar(
        select(func.count(distinct(CUSTOMER))).where(*clauses, Sale.customer_id.in_(prior))
    )
    return KPI(
        revenue=revenue,
        orders=orders,
        aov=Decimal(revenue / orders).quantize(Decimal("0.01")) if orders else None,
        customers=customers,
        returning_customers=returning or 0,
        units=units,
        refunds=refunds,
    )


@router.get("/overview", response_model=OverviewOut)
async def overview(
    member: Membership,
    db: DB,
    start: date = date(2025, 1, 1),
    end: date = date(2025, 12, 31),
    grouping: str = "month",
    dataset_id: str | None = None,
) -> OverviewOut:
    if start > end or grouping not in ("day", "week", "month"):
        raise HTTPException(422, "Invalid date range or grouping")
    current_query = QueryIn(start=start, end=end, grouping=grouping, dataset_id=dataset_id)
    duration = end - start + timedelta(days=1)
    previous_query = current_query.model_copy(
        update={"start": start - duration, "end": start - timedelta(days=1)}
    )
    current = await calculate_kpi(db, member.workspace_id, current_query)
    previous = await calculate_kpi(db, member.workspace_id, previous_query)
    trend = await execute_query(db, member.workspace_id, current_query)
    comparison = await execute_query(db, member.workspace_id, previous_query)
    categories = await execute_query(
        db,
        member.workspace_id,
        current_query.model_copy(update={"dimension": "category", "sort": "-value"}),
    )
    channels = await execute_query(
        db,
        member.workspace_id,
        current_query.model_copy(update={"dimension": "channel", "sort": "-value"}),
    )
    growth = (
        ((current.revenue - previous.revenue) / previous.revenue * 100).quantize(Decimal("0.01"))
        if previous.revenue
        else None
    )
    return OverviewOut(
        current=current,
        previous=previous,
        revenue_growth=growth,
        start=start,
        end=end,
        trend=trend.points,
        comparison=comparison.points,
        categories=categories.points,
        channels=channels.points,
    )


@router.get("/sales", response_model=SalesPage)
async def sales(
    member: Membership,
    db: DB,
    start: date | None = None,
    end: date | None = None,
    search: str = Query(default="", max_length=100),
    status: str | None = None,
    page: int = Query(default=1, ge=1, le=100000),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: str = "-date",
) -> SalesPage:
    clauses = await scope(db, member.workspace_id, QueryIn(start=start, end=end))
    if search:
        clauses.append(
            Sale.order_id.icontains(search, autoescape=True)
            | Sale.product_name.icontains(search, autoescape=True)
            | Sale.customer_id.icontains(search, autoescape=True)
        )
    if status:
        clauses.append(Sale.status == status)
    sorts = {
        "-date": Sale.order_date.desc(),
        "date": Sale.order_date.asc(),
        "-revenue": NET.desc(),
        "revenue": NET.asc(),
    }
    if sort not in sorts:
        raise HTTPException(422, "Invalid sort")
    total = await db.scalar(select(func.count()).select_from(Sale).where(*clauses))
    rows = list(
        await db.scalars(
            select(Sale)
            .where(*clauses)
            .order_by(sorts[sort], Sale.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return SalesPage(items=rows, total=total or 0, page=page, page_size=page_size)


@router.get("/entities/{kind}", response_model=EntityPage)
async def entities(
    kind: str,
    member: Membership,
    db: DB,
    start: date | None = None,
    end: date | None = None,
    search: str = Query(default="", max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> EntityPage:
    if kind not in ("customers", "products"):
        raise HTTPException(404, "Unknown entity")
    dimension = Sale.customer_id if kind == "customers" else Sale.product_name
    clauses = await scope(db, member.workspace_id, QueryIn(start=start, end=end))
    clauses.append(Sale.status.in_(ELIGIBLE))
    if search:
        clauses.append(dimension.icontains(search, autoescape=True))
    total = await db.scalar(select(func.count(distinct(dimension))).where(*clauses))
    rows = await db.execute(
        select(
            dimension,
            func.sum(NET),
            func.count(distinct(Sale.order_id)),
            func.sum(Sale.quantity),
            func.min(Sale.order_date),
            func.max(Sale.order_date),
        )
        .where(*clauses)
        .group_by(dimension)
        .order_by(func.sum(NET).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return EntityPage(
        items=[
            EntityRow(name=n, revenue=r, orders=o, units=u, first_order=f, last_order=last)
            for n, r, o, u, f, last in rows
        ],
        total=total or 0,
    )


def safe_cell(value: str) -> str:
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value


def csv_response(rows: list[list[str]], filename: str = "avenor-report.csv") -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows([[safe_cell(cell) for cell in row] for row in rows])
    return Response(
        output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/export")
async def export(data: QueryIn, member: Membership, db: DB) -> Response:
    result = await execute_query(db, member.workspace_id, data)
    return csv_response(
        [[data.dimension, data.metric], *[[p.label, str(p.value)] for p in result.points]]
    )


@router.post("/sales/export")
async def export_sales(data: SalesExportIn, member: Membership, db: DB) -> Response:
    from app.modules.schemas import SaleOut

    clauses = await scope(db, member.workspace_id, data)
    if data.search:
        clauses.append(
            Sale.order_id.icontains(data.search, autoescape=True)
            | Sale.product_name.icontains(data.search, autoescape=True)
            | Sale.customer_id.icontains(data.search, autoescape=True)
        )
    if data.status:
        clauses.append(Sale.status == data.status)
    count = await db.scalar(select(func.count()).select_from(Sale).where(*clauses))
    if count and count > 100_000:
        raise HTTPException(422, "Narrow the filters to export at most 100,000 lines")
    ordering = {
        "-date": Sale.order_date.desc(),
        "date": Sale.order_date.asc(),
        "-revenue": NET.desc(),
        "revenue": NET.asc(),
    }[data.order_sort]
    rows = await db.scalars(select(Sale).where(*clauses).order_by(ordering, Sale.id))
    header = [
        "order_id",
        "order_date",
        "customer_id",
        "product_name",
        "channel",
        "status",
        "quantity",
        "unit_price",
        "discount",
        "refund",
        "net_revenue",
    ]
    output = [header]
    for row in rows:
        item = SaleOut.model_validate(row).model_dump(mode="json")
        output.append([str(item[key]) for key in header])
    return csv_response(output, "avenor-sales.csv")
