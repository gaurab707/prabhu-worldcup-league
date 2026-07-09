"""Public (authenticated) leaderboard endpoint."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_active_user
from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import LeaderboardRow
from app.services.leaderboard import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardRow])
def leaderboard(
    limit: Optional[int] = Query(None, ge=1, le=500),
    search: Optional[str] = Query(None),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Ranked leaderboard with points + accuracy metrics."""
    return get_leaderboard(db, limit=limit, search=search)
