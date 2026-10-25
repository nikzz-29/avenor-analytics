from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str]
    demo: Mapped[bool] = mapped_column(default=False)
    preferences: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)


class Session(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf_hash: Mapped[str]
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PasswordReset(Base):
    __tablename__ = "password_resets"
    token_hash: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(default="USD")
    demo: Mapped[bool] = mapped_column(default=False)
    default_dashboard_id: Mapped[str | None]


class Member(Base):
    __tablename__ = "workspace_members"
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(default="owner")


class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    fingerprint: Mapped[str]
    row_count: Mapped[int]
    columns: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("workspace_id", "fingerprint"),)


class Sale(Base):
    """One fact per order/product line. Financial values are line-level, never order totals."""
    __tablename__ = "sales"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    order_id: Mapped[str] = mapped_column(String(200))
    order_date: Mapped[date]
    customer_id: Mapped[str] = mapped_column(String(200))
    product_name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(200))
    channel: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    refund: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    __table_args__ = (
        UniqueConstraint("dataset_id", "order_id", "product_name"),
        Index("ix_sales_workspace_date", "workspace_id", "order_date"),
        Index("ix_sales_workspace_customer", "workspace_id", "customer_id"),
    )


class ImportJob(Base):
    __tablename__ = "import_jobs"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str]
    status: Mapped[str]
    imported: Mapped[int] = mapped_column(default=0)
    rejected: Mapped[int] = mapped_column(default=0)
    errors: Mapped[list[dict[str, str | int]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Dashboard(Base):
    __tablename__ = "dashboards"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    widgets: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    revision: Mapped[int] = mapped_column(default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    query: Mapped[dict[str, object]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    action: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
