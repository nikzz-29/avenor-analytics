"""Enforce monetary, status and membership invariants at the storage boundary."""

from alembic import op

revision = "5c0379b0ca07"
down_revision = "5ab88cc7b492"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint("ck_sales_quantity", "sales", "quantity > 0 AND quantity <= 100000")
    op.create_check_constraint(
        "ck_sales_nonnegative", "sales", "unit_price >= 0 AND discount >= 0 AND refund >= 0"
    )
    op.create_check_constraint(
        "ck_sales_net_amount", "sales", "discount + refund <= quantity * unit_price"
    )
    op.create_check_constraint(
        "ck_sales_status", "sales", "status IN ('paid','pending','cancelled','refunded')"
    )
    op.create_check_constraint(
        "ck_sales_refund_status", "sales", "refund = 0 OR status = 'refunded'"
    )
    op.create_check_constraint(
        "ck_members_role", "workspace_members", "role IN ('owner','admin','editor','viewer')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_members_role", "workspace_members", type_="check")
    for name in (
        "ck_sales_refund_status",
        "ck_sales_status",
        "ck_sales_net_amount",
        "ck_sales_nonnegative",
        "ck_sales_quantity",
    ):
        op.drop_constraint(name, "sales", type_="check")
