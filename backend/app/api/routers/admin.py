"""Admin operations: manual sync, recalculation, scheduler + audit logs."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.api.deps import require_admin, write_audit
from app.db.session import get_db
from app.models.models import (
    AuditLog,
    Match,
    PointHistory,
    Prediction,
    SchedulerLog,
    User,
)
from fastapi import Request
from app.services.results import process_finished_matches
from app.services.scheduler import run_once
from app.services.scraper import sync_matches

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/sync-now", dependencies=[Depends(require_admin)])
def sync_now(db: Session = Depends(get_db)):
    """Admin: trigger an immediate fixtures+results sync."""
    changed = sync_matches(db)
    result = process_finished_matches(db)
    return {"matches_changed": changed, **result}


@router.post("/clear-matches", dependencies=[Depends(require_admin)])
def clear_matches(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: delete ALL fixtures, predictions and awarded points, then reset
    every player's total to zero.

    Use this to wipe auto-imported or already-finished games and start the
    league from a clean slate (teams are kept so flags are reused). After this,
    add real fixtures manually or run a sync - only future games are imported.
    """
    # FK-safe order: point_history and predictions reference matches.
    n_points = db.execute(delete(PointHistory)).rowcount
    n_preds = db.execute(delete(Prediction)).rowcount
    n_matches = db.execute(delete(Match)).rowcount
    db.execute(update(User).values(total_points=0.0))
    db.commit()
    write_audit(db, admin.id, "clear_matches", "match", f"{n_matches or 0} matches", request)
    return {
        "matches_deleted": n_matches or 0,
        "predictions_deleted": n_preds or 0,
        "points_deleted": n_points or 0,
    }


@router.post("/recalculate", dependencies=[Depends(require_admin)])
def recalculate(db: Session = Depends(get_db)):
    """Admin: force a full rescore of all finished matches (e.g. after editing
    a result or changing scoring weights)."""
    return process_finished_matches(db, force=True)


@router.get("/scheduler-logs", dependencies=[Depends(require_admin)])
def scheduler_logs(db: Session = Depends(get_db), limit: int = 50):
    """Admin: recent scheduler run history."""
    rows = db.scalars(
        select(SchedulerLog).order_by(SchedulerLog.created_at.desc()).limit(limit)
    ).all()
    return [
        {"id": r.id, "job": r.job, "status": r.status, "message": r.message,
         "matches_updated": r.matches_updated, "at": r.created_at.isoformat()}
        for r in rows
    ]


@router.get("/audit-logs", dependencies=[Depends(require_admin)])
def audit_logs(db: Session = Depends(get_db), limit: int = 100):
    """Admin: recent audit trail."""
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    ).all()
    return [
        {"id": r.id, "actor_id": r.actor_id, "action": r.action, "entity": r.entity,
         "detail": r.detail, "ip": r.ip_address, "at": r.created_at.isoformat()}
        for r in rows
    ]
