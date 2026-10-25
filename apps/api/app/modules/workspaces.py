import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from starlette.concurrency import run_in_threadpool

from app.core.security import (
    DB,
    CurrentUser,
    Membership,
    check_origin,
    hasher,
    lock_workspace,
    rate_limit,
    require_admin,
)
from app.db.models import AuditLog, Dashboard, Dataset, Member, User, Workspace
from app.modules.auth import establish_session
from app.modules.demo import seed_demo
from app.modules.schemas import (
    ActivityOut,
    MemberIn,
    MemberOut,
    Message,
    ProfileOut,
    WorkspaceIn,
    WorkspaceOut,
    WorkspacePatch,
)

router = APIRouter(tags=["Workspaces"])


@router.post(
    "/auth/demo",
    response_model=ProfileOut,
    dependencies=[Depends(rate_limit), Depends(check_origin)],
)
async def demo(response: Response, db: DB) -> User:
    user = User(
        email=f"demo-{secrets.token_hex(12)}@avenor.local",
        name="Alex Morgan",
        demo=True,
        password_hash=await run_in_threadpool(hasher.hash, secrets.token_urlsafe(32)),
    )
    db.add(user)
    await db.flush()
    ws = Workspace(name="Studio Commerce", demo=True)
    db.add(ws)
    await db.flush()
    db.add(Member(workspace_id=ws.id, user_id=user.id, role="owner"))
    await seed_demo(db, ws)
    await establish_session(user, response, db)
    return user


@router.get("/workspaces", response_model=list[WorkspaceOut])
async def list_workspaces(user: CurrentUser, db: DB) -> list[WorkspaceOut]:
    rows = (
        await db.execute(
            select(Workspace, Member.role).join(Member).where(Member.user_id == user.id)
        )
    ).all()
    return [WorkspaceOut.model_validate(w).model_copy(update={"role": role}) for w, role in rows]


@router.post("/workspaces", response_model=WorkspaceOut, status_code=201)
async def create_workspace(data: WorkspaceIn, user: CurrentUser, db: DB) -> Workspace:
    ws = Workspace(name=data.name.strip())
    db.add(ws)
    await db.flush()
    db.add(Member(workspace_id=ws.id, user_id=user.id, role="owner"))
    db.add(AuditLog(workspace_id=ws.id, action="Workspace created"))
    return ws


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(data: WorkspacePatch, member: Membership, db: DB) -> WorkspaceOut:
    require_admin(member)
    ws = await lock_workspace(db, member.workspace_id)
    assert ws is not None
    if data.default_dashboard_id:
        dashboard = await db.get(Dashboard, data.default_dashboard_id)
        if not dashboard or dashboard.workspace_id != ws.id:
            raise HTTPException(404, "Dashboard not found")
    if data.name is not None:
        ws.name = data.name.strip()
    if "default_dashboard_id" in data.model_fields_set:
        ws.default_dashboard_id = data.default_dashboard_id
    await db.flush()
    return WorkspaceOut.model_validate(ws).model_copy(update={"role": member.role})


@router.get("/workspaces/{workspace_id}/members", response_model=list[MemberOut])
async def members(member: Membership, db: DB) -> list[MemberOut]:
    rows = (
        await db.execute(
            select(User, Member.role).join(Member).where(Member.workspace_id == member.workspace_id)
        )
    ).all()
    return [MemberOut(user_id=u.id, name=u.name, email=u.email, role=role) for u, role in rows]


@router.put("/workspaces/{workspace_id}/members", response_model=Message)
async def add_member(data: MemberIn, member: Membership, db: DB) -> Message:
    require_admin(member)
    if member.role == "admin" and data.role == "admin":
        raise HTTPException(403, "Only the owner can assign admins")
    await lock_workspace(db, member.workspace_id)
    user = await db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not user:
        raise HTTPException(404, "Ask this person to create an account first")
    target = await db.get(Member, (member.workspace_id, user.id))
    if target:
        if target.role == "owner" or (target.role == "admin" and member.role != "owner"):
            raise HTTPException(403, "Cannot change this member's role")
        target.role = data.role
    else:
        db.add(Member(workspace_id=member.workspace_id, user_id=user.id, role=data.role))
    return Message(message="Member access saved")


@router.delete("/workspaces/{workspace_id}/members/{user_id}", response_model=Message)
async def remove_member(user_id: str, member: Membership, db: DB) -> Message:
    require_admin(member)
    await lock_workspace(db, member.workspace_id)
    target = await db.get(Member, (member.workspace_id, user_id))
    if not target:
        raise HTTPException(404, "Member not found")
    if target.role == "owner" or (target.role == "admin" and member.role != "owner"):
        raise HTTPException(403, "Cannot remove this member")
    await db.delete(target)
    return Message(message="Member removed")


@router.post("/workspaces/{workspace_id}/demo", response_model=Message)
async def populate(member: Membership, db: DB) -> Message:
    require_admin(member)
    ws = await lock_workspace(db, member.workspace_id)
    assert ws is not None
    exists = await db.scalar(select(Dataset.id).where(Dataset.workspace_id == ws.id).limit(1))
    if exists:
        raise HTTPException(409, "Demo data can only be added to an empty workspace")
    await seed_demo(db, ws)
    return Message(message="Demo data added")


@router.post("/workspaces/{workspace_id}/reset-demo", response_model=Message)
async def reset_demo(member: Membership, db: DB) -> Message:
    require_admin(member)
    ws = await lock_workspace(db, member.workspace_id)
    assert ws is not None
    if not ws.demo:
        raise HTTPException(400, "Only isolated demo workspaces can be reset")
    from app.db.models import ImportJob, Report

    for model in (Dataset, Dashboard, ImportJob, Report, AuditLog):
        await db.execute(delete(model).where(model.workspace_id == ws.id))
    ws.default_dashboard_id = None
    await seed_demo(db, ws)
    return Message(message="Demo workspace reset")


@router.get("/workspaces/{workspace_id}/activity", response_model=list[ActivityOut])
async def activity(member: Membership, db: DB) -> list[AuditLog]:
    return list(
        await db.scalars(
            select(AuditLog)
            .where(AuditLog.workspace_id == member.workspace_id)
            .order_by(AuditLog.created_at.desc())
            .limit(10)
        )
    )
