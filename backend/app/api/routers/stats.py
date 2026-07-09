"""Admin analytics: dashboard cards, charts, prediction statistics."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import settings as app_settings
from app.db.session import get_db
from app.models.models import (
    Match,
    MatchStatus,
    Payment,
    PaymentStatus,
    Prediction,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.schemas import DashboardStats
from app.services.leaderboard import get_leaderboard, prediction_statistics

router = APIRouter(prefix="/stats", tags=["statistics"])


@router.get("/dashboard", response_model=DashboardStats, dependencies=[Depends(require_admin)])
def dashboard(db: Session = Depends(get_db)):
    """Admin dashboard summary cards."""
    total_users = db.scalar(select(func.count(User.id)).where(User.role == UserRole.staff)) or 0
    verified = db.scalar(select(func.count(User.id)).where(
        User.role == UserRole.staff, User.status == UserStatus.active)) or 0
    pending_payments = db.scalar(select(func.count(Payment.id)).where(
        Payment.status == PaymentStatus.pending)) or 0
    upcoming = db.scalar(select(func.count(Match.id)).where(
        Match.status == MatchStatus.scheduled)) or 0
    completed = db.scalar(select(func.count(Match.id)).where(
        Match.status == MatchStatus.finished)) or 0
    predictions = db.scalar(select(func.count(Prediction.id))) or 0

    return DashboardStats(
        total_users=total_users,
        verified_users=verified,
        pending_payments=pending_payments,
        upcoming_games=upcoming,
        completed_games=completed,
        total_predictions=predictions,
        prize_pool=verified * app_settings.ENTRY_FEE,
    )


@router.get("/predictions", dependencies=[Depends(require_admin)])
def predictions_stats(db: Session = Depends(get_db)):
    """Charts: most/least predicted teams + score distribution."""
    return prediction_statistics(db)


@router.get("/leaderboard-extremes", dependencies=[Depends(require_admin)])
def extremes(db: Session = Depends(get_db)):
    """Top and lowest predictor for the analytics panel."""
    board = get_leaderboard(db)
    return {
        "top_predictor": board[0] if board else None,
        "lowest_predictor": board[-1] if board else None,
        "player_count": len(board),
    }
