"""Winner podium: auto-calculated from the live leaderboard, revealed by the admin.

The admin does not pick winners manually. When they click "Reveal Winners" the
current top three players (by total points) are captured as the podium and shown
to everyone with a celebratory animation. "Hide" takes the podium back down.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_admin, write_audit
from app.db.session import get_db
from app.models.models import User, Winner
from app.schemas.schemas import WinnerOut
from app.services.leaderboard import get_leaderboard

router = APIRouter(prefix="/winners", tags=["winners"])


def _to_out(db: Session, w: Winner) -> WinnerOut:
    out = WinnerOut.model_validate(w)
    user = db.get(User, w.user_id)
    if user:
        out.name = user.full_name
        out.department = user.department
        out.points = round(user.total_points, 2)
    return out


@router.get("", response_model=list[WinnerOut])
def list_winners(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Published podium (visible to all verified users). Empty when not revealed."""
    winners = db.scalars(
        select(Winner).where(Winner.published.is_(True)).order_by(Winner.position.asc())
    ).all()
    return [_to_out(db, w) for w in winners]


@router.get("/admin", response_model=list[WinnerOut], dependencies=[Depends(require_admin)])
def admin_list(db: Session = Depends(get_db)):
    """All podium rows regardless of published state (admin status view)."""
    winners = db.scalars(select(Winner).order_by(Winner.position.asc())).all()
    return [_to_out(db, w) for w in winners]


@router.post("/reveal", response_model=list[WinnerOut], dependencies=[Depends(require_admin)])
def reveal(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Auto-calculate the top three from the current standings and publish them."""
    top = get_leaderboard(db, limit=3)
    # Rebuild the podium from the current leaderboard each time.
    for old in db.scalars(select(Winner)).all():
        db.delete(old)
    db.flush()
    created: list[Winner] = []
    for position, row in enumerate(top, start=1):
        w = Winner(position=position, user_id=row["user_id"], published=True)
        db.add(w)
        created.append(w)
    db.commit()
    for w in created:
        db.refresh(w)
    write_audit(db, admin.id, "reveal_winners", "winner", f"{len(created)} winners", request)
    return [_to_out(db, w) for w in created]


@router.post("/hide", dependencies=[Depends(require_admin)])
def hide(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Take the podium back down (unpublish) without deleting the standings."""
    db.execute(update(Winner).values(published=False))
    db.commit()
    write_audit(db, admin.id, "hide_winners", "winner", None, request)
    return {"status": "hidden"}
