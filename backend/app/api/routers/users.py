"""Staff dashboard + admin user management."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_admin
from app.db.session import get_db
from app.models.models import (
    Match,
    MatchStatus,
    Payment,
    PaymentStatus,
    PointHistory,
    Prediction,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.schemas import UserAdminOut
from app.services.leaderboard import _accuracy_row, get_leaderboard

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/dashboard")
def my_dashboard(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Aggregate data for the staff dashboard."""
    acc = _accuracy_row(db, user)

    # Rank from the full leaderboard.
    board = get_leaderboard(db)
    rank = next((r["rank"] for r in board if r["user_id"] == user.id), None)

    upcoming = db.scalar(
        select(func.count(Match.id)).where(Match.status == MatchStatus.scheduled)
    )
    completed_preds = db.scalar(
        select(func.count(Prediction.id)).where(
            Prediction.user_id == user.id, Prediction.is_scored.is_(True)
        )
    )

    # Points-over-time series from point history.
    history = db.scalars(
        select(PointHistory).where(PointHistory.user_id == user.id)
        .order_by(PointHistory.created_at.asc())
    ).all()
    running = 0.0
    series = []
    for h in history:
        running = round(running + h.points, 2)
        series.append({"date": h.created_at.isoformat(), "points": running})

    return {
        "total_points": round(user.total_points, 2),
        "rank": rank,
        "total_players": len(board),
        "played": acc["played"],
        "accuracy": acc["accuracy"],
        "winner_pct": acc["winner_pct"],
        "score_pct": acc["score_pct"],
        "upcoming_games": upcoming or 0,
        "completed_predictions": completed_preds or 0,
        "points_over_time": series,
    }


# --- Admin -------------------------------------------------------------
@router.get("", response_model=list[UserAdminOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    """Admin: list every user with their latest payment status."""
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    out = []
    for u in users:
        latest_payment = db.scalar(
            select(Payment).where(Payment.user_id == u.id)
            .order_by(Payment.created_at.desc())
        )
        row = UserAdminOut.model_validate(u)
        row.payment_status = latest_payment.status if latest_payment else None
        out.append(row)
    return out


@router.post("/{user_id}/status", dependencies=[Depends(require_admin)])
def set_status(user_id: int, status: UserStatus, db: Session = Depends(get_db)):
    """Admin: enable/disable a user account."""
    user = db.get(User, user_id)
    if not user:
        return {"error": "not found"}
    user.status = status
    db.commit()
    return {"user_id": user_id, "status": status}
