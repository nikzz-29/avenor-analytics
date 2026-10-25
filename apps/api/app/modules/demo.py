import calendar
import random
from datetime import date
from decimal import Decimal

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, Dashboard, Dataset, Sale, Workspace, uid
from app.modules.schemas import Widget

PRODUCTS = [
    ("Arc Desk Lamp", "Home & living", 89), ("Linen Throw", "Home & living", 68),
    ("Ceramic Pour-over", "Home & living", 42), ("Everyday Tote", "Accessories", 54),
    ("Weekender Bag", "Accessories", 148), ("Leather Cardholder", "Accessories", 48),
    ("Studio Headphones", "Electronics", 189), ("Wireless Charger", "Electronics", 39),
    ("Mechanical Keyboard", "Electronics", 129), ("Merino Crew", "Apparel", 95),
    ("Essential Tee", "Apparel", 35), ("Canvas Overshirt", "Apparel", 125),
]


async def seed_demo(db: AsyncSession, workspace: Workspace) -> None:
    rng = random.Random(41027)
    dataset = Dataset(workspace_id=workspace.id, name="Studio Commerce · 2025", fingerprint="demo-v1", row_count=0,
                      columns=[{"name": key, "type": "string"} for key in ("order_id", "order_date", "customer_id", "product_name", "category", "channel", "status", "quantity", "unit_price", "discount", "refund")])
    db.add(dataset)
    await db.flush()
    records: list[dict[str, object]] = []
    for month in range(1, 13):
        volume = int((105 + month * 13) * (1.6 if month in (11, 12) else 0.85 if month == 7 else 1))
        for i in range(volume):
            product, category, price = rng.choice(PRODUCTS)
            quantity = rng.choices([1, 2, 3, 4], [6, 3, 1, 0.3])[0]
            status = rng.choices(["paid", "refunded", "cancelled", "pending"], [89, 5, 4, 2])[0]
            gross = Decimal(price * quantity)
            discount = (gross * Decimal("0.10")) if rng.random() < 0.15 else Decimal(0)
            refund = (gross - discount) * (Decimal("0.5") if rng.random() < 0.3 else 1) if status == "refunded" else Decimal(0)
            records.append(dict(workspace_id=workspace.id, dataset_id=dataset.id,
                order_id=f"AV-{month:02d}{i:04d}", order_date=date(2025, month, rng.randint(1, calendar.monthrange(2025, month)[1])),
                customer_id=f"Customer {rng.randint(1, 480):03d}", product_name=product, category=category,
                channel=rng.choices(["Online store", "Marketplace", "Retail", "Social"], [55, 23, 15, 7])[0],
                status=status, quantity=quantity, unit_price=Decimal(price), discount=discount, refund=refund))
    await db.execute(insert(Sale), records)
    dataset.row_count = len(records)
    widgets = [Widget(id=uid(), title="Monthly revenue", type="area", width=2),
               Widget(id=uid(), title="Sales by category", type="horizontal", query={"dimension": "category", "sort": "-value"}),
               Widget(id=uid(), title="Sales channels", type="donut", query={"dimension": "channel"})]
    db.add(Dashboard(workspace_id=workspace.id, name="Commerce pulse", widgets=[w.model_dump(mode="json") for w in widgets]))
    db.add(AuditLog(workspace_id=workspace.id, action=f"Demo dataset created · {len(records):,} order lines"))
