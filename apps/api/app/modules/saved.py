from fastapi import APIRouter, HTTPException
from sqlalchemy import select, update

from app.core.security import DB, Membership, lock_workspace
from app.db.models import AuditLog, Dashboard, Report, now
from app.modules.analytics import execute_query
from app.modules.schemas import (
    DashboardIn,
    DashboardOut,
    DashboardPatch,
    Message,
    ReportIn,
    ReportOut,
)

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["Dashboards and reports"])


@router.get("/dashboards", response_model=list[DashboardOut])
async def dashboards(member: Membership, db: DB) -> list[Dashboard]:
    return list(
        await db.scalars(
            select(Dashboard)
            .where(Dashboard.workspace_id == member.workspace_id)
            .order_by(Dashboard.updated_at.desc())
        )
    )


@router.post("/dashboards", response_model=DashboardOut, status_code=201)
async def create_dashboard(data: DashboardIn, member: Membership, db: DB) -> Dashboard:
    for widget in data.widgets:
        if widget.type != "text":
            await execute_query(db, member.workspace_id, widget.query)
    dashboard = Dashboard(
        workspace_id=member.workspace_id,
        name=data.name.strip(),
        widgets=[w.model_dump(mode="json") for w in data.widgets],
    )
    db.add(dashboard)
    db.add(
        AuditLog(workspace_id=member.workspace_id, action=f"Created dashboard · {dashboard.name}")
    )
    await db.flush()
    return dashboard


@router.get("/dashboards/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(dashboard_id: str, member: Membership, db: DB) -> Dashboard:
    dashboard = await db.scalar(
        select(Dashboard).where(
            Dashboard.id == dashboard_id, Dashboard.workspace_id == member.workspace_id
        )
    )
    if not dashboard:
        raise HTTPException(404, "Dashboard not found")
    return dashboard


@router.patch("/dashboards/{dashboard_id}", response_model=DashboardOut)
async def patch_dashboard(
    dashboard_id: str, data: DashboardPatch, member: Membership, db: DB
) -> Dashboard:
    result = await db.scalar(
        update(Dashboard)
        .where(
            Dashboard.id == dashboard_id,
            Dashboard.workspace_id == member.workspace_id,
            Dashboard.revision == data.revision,
        )
        .values(
            name=data.name.strip(),
            widgets=[w.model_dump(mode="json") for w in data.widgets],
            revision=Dashboard.revision + 1,
            updated_at=now(),
        )
        .returning(Dashboard)
    )
    if not result:
        exists = await db.scalar(
            select(Dashboard.id).where(
                Dashboard.id == dashboard_id, Dashboard.workspace_id == member.workspace_id
            )
        )
        raise HTTPException(
            409 if exists else 404,
            "Dashboard changed in another tab. Reload before saving."
            if exists
            else "Dashboard not found",
        )
    return result


@router.delete("/dashboards/{dashboard_id}", response_model=Message)
async def delete_dashboard(dashboard_id: str, member: Membership, db: DB) -> Message:
    workspace = await lock_workspace(db, member.workspace_id)
    dashboard = await get_dashboard(dashboard_id, member, db)
    if workspace and workspace.default_dashboard_id == dashboard_id:
        workspace.default_dashboard_id = None
    await db.delete(dashboard)
    return Message(message="Dashboard deleted")


@router.get("/reports", response_model=list[ReportOut])
async def reports(member: Membership, db: DB) -> list[Report]:
    return list(
        await db.scalars(
            select(Report)
            .where(Report.workspace_id == member.workspace_id)
            .order_by(Report.created_at.desc())
        )
    )


@router.post("/reports", response_model=ReportOut, status_code=201)
async def create_report(data: ReportIn, member: Membership, db: DB) -> Report:
    await execute_query(db, member.workspace_id, data.query)
    report = Report(
        workspace_id=member.workspace_id,
        name=data.name.strip(),
        query=data.query.model_dump(mode="json"),
    )
    db.add(report)
    db.add(AuditLog(workspace_id=member.workspace_id, action=f"Saved report · {report.name}"))
    await db.flush()
    return report


@router.patch("/reports/{report_id}", response_model=ReportOut)
async def patch_report(report_id: str, data: ReportIn, member: Membership, db: DB) -> Report:
    report = await db.scalar(
        select(Report).where(Report.id == report_id, Report.workspace_id == member.workspace_id)
    )
    if not report:
        raise HTTPException(404, "Report not found")
    await execute_query(db, member.workspace_id, data.query)
    report.name, report.query = data.name.strip(), data.query.model_dump(mode="json")
    return report


@router.delete("/reports/{report_id}", response_model=Message)
async def delete_report(report_id: str, member: Membership, db: DB) -> Message:
    report = await db.scalar(
        select(Report).where(Report.id == report_id, Report.workspace_id == member.workspace_id)
    )
    if not report:
        raise HTTPException(404, "Report not found")
    await db.delete(report)
    return Message(message="Report deleted")
