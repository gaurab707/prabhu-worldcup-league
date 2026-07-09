"""Match listing + admin match management."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, write_audit
from app.core.flags import flag_for
from app.db.session import get_db
from app.models.models import Match, MatchStatus, Prediction, Team, User
from app.schemas.schemas import MatchCreate, MatchOut, MatchUpdate, PredictionOut
from app.services.results import recompute_user_totals, score_match

router = APIRouter(prefix="/matches", tags=["matches"])


def is_match_locked(match: Match) -> bool:
    """A match is locked when manually locked, past its lock time, or kicked off."""
    if match.manually_locked:
        return True
    now = datetime.now(timezone.utc)
    lock = match.lock_at or match.kickoff_at
    if lock.tzinfo is None:
        lock = lock.replace(tzinfo=timezone.utc)
    return now >= lock


def serialize_match(match: Match, user: Optional[User], db: Session) -> MatchOut:
    """Build a MatchOut, attaching the caller's own prediction if present."""
    out = MatchOut.model_validate(match)
    out.is_locked = is_match_locked(match)
    if user is not None:
        pred = db.scalar(
            select(Prediction).where(
                Prediction.user_id == user.id, Prediction.match_id == match.id
            )
        )
        if pred:
            out.my_prediction = PredictionOut.model_validate(pred)
    return out


def _get_or_create_team(db: Session, name: str) -> Team:
    team = db.scalar(select(Team).where(Team.name == name.strip()))
    if not team:
        team = Team(
            name=name.strip(),
            short_code=name.strip()[:3].upper(),
            flag_url=flag_for(name),
        )
        db.add(team)
        db.flush()
    return team


@router.get("", response_model=list[MatchOut])
def list_matches(
    status_filter: Optional[MatchStatus] = Query(None, alias="status"),
    upcoming: bool = Query(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List matches (optionally filtered), newest kickoff first for finished,
    soonest first for upcoming."""
    q = select(Match)
    if status_filter:
        q = q.where(Match.status == status_filter)
    if upcoming:
        q = q.where(Match.status.in_([MatchStatus.scheduled, MatchStatus.live]))
        q = q.order_by(Match.kickoff_at.asc())
    else:
        q = q.order_by(Match.kickoff_at.asc())
    matches = db.scalars(q).all()
    return [serialize_match(m, user, db) for m in matches]


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return serialize_match(match, user, db)


# --- Admin -------------------------------------------------------------
@router.post("", response_model=MatchOut, status_code=201, dependencies=[Depends(require_admin)])
def create_match(payload: MatchCreate, request: Request,
                 admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: create a match manually."""
    home = _get_or_create_team(db, payload.home_team)
    away = _get_or_create_team(db, payload.away_team)
    if home.id == away.id:
        raise HTTPException(status_code=400, detail="Home and away teams must differ")
    match = Match(
        home_team_id=home.id, away_team_id=away.id,
        kickoff_at=payload.kickoff_at, venue=payload.venue,
        group_name=payload.group_name, round_name=payload.round_name,
        status=MatchStatus.scheduled,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    write_audit(db, admin.id, "create_match", "match", f"{home.name} v {away.name}", request)
    return serialize_match(match, admin, db)


@router.patch("/{match_id}", response_model=MatchOut, dependencies=[Depends(require_admin)])
def update_match(match_id: int, payload: MatchUpdate, request: Request,
                 admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: edit a match. Entering a final score triggers rescoring on the
    next results pass (Match.scored is reset)."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    data = payload.model_dump(exclude_unset=True)
    result_changed = any(k in data for k in ("home_score", "away_score", "home_penalty", "away_penalty", "is_penalty"))
    for field, value in data.items():
        setattr(match, field, value)
    if result_changed:
        match.scored = False
    db.commit()
    db.refresh(match)

    # If a final score was entered, score this match immediately so players see
    # their points right away (rather than waiting for the next scheduler pass).
    if (result_changed and match.status == MatchStatus.finished
            and match.home_score is not None and match.away_score is not None):
        score_match(db, match)
        recompute_user_totals(db)
        db.refresh(match)

    write_audit(db, admin.id, "update_match", "match", str(match_id), request)
    return serialize_match(match, admin, db)


@router.post("/{match_id}/lock", dependencies=[Depends(require_admin)])
def toggle_lock(match_id: int, lock: bool = Query(True),
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: manually lock/unlock a match for predictions."""
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    match.manually_locked = lock
    db.commit()
    return {"match_id": match_id, "manually_locked": lock}


@router.delete("/{match_id}", dependencies=[Depends(require_admin)])
def delete_match(match_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    db.delete(match)
    db.commit()
    return {"deleted": match_id}
