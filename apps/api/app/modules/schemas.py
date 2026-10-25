from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

Name = Annotated[str, Field(min_length=1, max_length=100, pattern=r"\S")]
Role = Literal["owner", "admin", "editor", "viewer"]
Dimension = Literal["date", "category", "product_name", "customer_id", "channel", "status"]
Metric = Literal["revenue", "orders", "aov", "units", "customers", "sum", "count", "distinct_count", "average", "minimum", "maximum"]
ChartType = Literal["line", "area", "bar", "horizontal", "stacked", "donut", "table", "kpi", "text"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    name: Name


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileOut(ORM):
    id: str
    email: str
    name: str
    demo: bool
    preferences: dict[str, str]


class ProfileIn(BaseModel):
    name: Name
    preferences: dict[Literal["theme", "date_format", "number_format"], str] = Field(default_factory=dict, max_length=3)


class PasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class ResetRequest(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=10, max_length=128)


class Message(BaseModel):
    message: str


class WorkspaceIn(BaseModel):
    name: Name


class WorkspaceOut(ORM):
    id: str
    name: str
    currency: str
    demo: bool
    default_dashboard_id: str | None
    role: Role = "owner"


class WorkspacePatch(BaseModel):
    name: Name
    default_dashboard_id: str | None = None


class MemberIn(BaseModel):
    email: EmailStr
    role: Literal["admin", "editor", "viewer"]


class MemberOut(BaseModel):
    user_id: str
    name: str
    email: str
    role: Role


class Filter(BaseModel):
    field: Literal["category", "product_name", "customer_id", "channel", "status", "quantity", "unit_price", "order_date"]
    op: Literal["eq", "neq", "contains", "in", "gt", "lt", "between"]
    values: list[str] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def check_operator(self) -> "Filter":
        numeric = self.field in ("quantity", "unit_price")
        dated = self.field == "order_date"
        if self.op in ("gt", "lt", "between") and not (numeric or dated):
            raise ValueError("Range operators require numeric or date fields")
        if self.op == "contains" and (numeric or dated):
            raise ValueError("Contains requires a text field")
        expected = 2 if self.op == "between" else 1
        if self.op != "in" and len(self.values) != expected:
            raise ValueError(f"{self.op} needs {expected} value(s)")
        for value in self.values:
            if len(value) > 200:
                raise ValueError("Filter value too long")
            if numeric and not Decimal(value).is_finite():
                raise ValueError("Finite number required")
            if dated:
                date.fromisoformat(value)
        return self


class QueryIn(BaseModel):
    dataset_id: str | None = None
    metric: Metric = "revenue"
    dimension: Dimension = "date"
    start: date | None = None
    end: date | None = None
    grouping: Literal["day", "week", "month"] = "month"
    filters: list[Filter] = Field(default_factory=list, max_length=10)
    sort: Literal["label", "value", "-value"] = "label"
    limit: int = Field(default=100, ge=1, le=500)

    @model_validator(mode="after")
    def check_dates(self) -> "QueryIn":
        if self.start and self.end and self.start > self.end:
            raise ValueError("Start date must precede end date")
        return self


class Point(BaseModel):
    label: str
    value: Decimal


class QueryOut(BaseModel):
    points: list[Point]
    metric: Metric
    currency: str = "USD"


class KPI(BaseModel):
    revenue: Decimal
    orders: int
    aov: Decimal | None
    customers: int
    returning_customers: int
    units: int
    refunds: Decimal


class OverviewOut(BaseModel):
    current: KPI
    previous: KPI
    revenue_growth: Decimal | None
    start: date
    end: date
    trend: list[Point]
    comparison: list[Point]
    categories: list[Point]
    channels: list[Point]


class DatasetOut(ORM):
    id: str
    name: str
    row_count: int
    columns: list[dict[str, str]]
    created_at: datetime


class ImportErrorOut(BaseModel):
    row: int
    column: str
    message: str


class ImportOut(BaseModel):
    id: str
    status: Literal["completed", "failed"]
    imported: int
    rejected: int
    errors: list[ImportErrorOut]


class ImportJobOut(ORM):
    id: str
    filename: str
    status: str
    imported: int
    rejected: int
    errors: list[ImportErrorOut]
    created_at: datetime


class PreviewOut(BaseModel):
    columns: list[str]
    rows: list[dict[str, str]]
    total_rows: int
    inferred_types: dict[str, str]


class SaleOut(ORM):
    id: int
    order_id: str
    order_date: date
    customer_id: str
    product_name: str
    category: str
    channel: str
    status: str
    quantity: int
    unit_price: Decimal
    discount: Decimal
    refund: Decimal


class SalesPage(BaseModel):
    items: list[SaleOut]
    total: int
    page: int
    page_size: int


class EntityRow(BaseModel):
    name: str
    revenue: Decimal
    orders: int
    units: int
    first_order: date
    last_order: date


class EntityPage(BaseModel):
    items: list[EntityRow]
    total: int


class Widget(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: Name
    type: ChartType = "bar"
    query: QueryIn = Field(default_factory=QueryIn)
    width: Literal[1, 2] = 1
    height: Literal[1, 2] = 1
    notes: str = Field(default="", max_length=4000)


class DashboardIn(BaseModel):
    name: Name
    widgets: list[Widget] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def unique_ids(self) -> "DashboardIn":
        if len({w.id for w in self.widgets}) != len(self.widgets):
            raise ValueError("Widget IDs must be unique")
        return self


class DashboardPatch(DashboardIn):
    revision: int = Field(ge=1)


class DashboardOut(DashboardIn, ORM):
    id: str
    revision: int
    updated_at: datetime


class ReportIn(BaseModel):
    name: Name
    query: QueryIn


class ReportOut(ReportIn, ORM):
    id: str
    created_at: datetime


class ActivityOut(ORM):
    id: int
    action: str
    created_at: datetime
