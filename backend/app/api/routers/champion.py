"""World Cup champion prediction: a one-time, non-editable pick for the winner.

Flow
----
1. Admin opens the champion-pick window (optionally with a deadline) and sets the
   bonus points + prize via ``PUT /champion/admin/config``.
2. Each player submits exactly one pick via ``POST /champion/pick``. There is no
   update route, and a uniqueness constraint guards the DB, so the pick is
   permanently locked the moment it is saved.
3. When the tournament ends the admin declares the real champion via
   ``POST /champion/admin/settle``. Every correct pick is awarded the configured
   bonus, which folds into the leaderboard total (see services/results.py).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_admin, write_audit
from app.api.routers.settings import get_setting, set_setting
from app.core.config import settings as app_settings
from app.db.session import get_db
from app.models.models import ChampionPrediction, Team, User
from app.schemas.schemas import (
    ChampionAdminSummary,
    ChampionConfigUpdate,
    ChampionPickCreate,
    ChampionPickOut,
    ChampionSettleRequest,
    ChampionStatus,
    ChampionTeamTally,
    TeamOut,
)
from app.services.results import recompute_user_totals

router = APIRouter(prefix="/champion", tags=["champion"])

# --- Setting keys ------------------------------------------------------
OPEN_KEY = "champion_pick_open"
DEADLINE_KEY = "champion_pick_deadline"
BONUS_KEY = "champion_bonus_points"
PRIZE_KEY = "champion_prize"
PRIZE_AMT_KEY = "champion_prize_amount"
ACTUAL_KEY = "champion_actual_team_id"
SETTLED_KEY = "champion_settled"


# --- Small typed helpers over the key/value settings table -------------
def _get_bool(db: Session, key: str, default: bool = False) -> bool:
    val = get_setting(db, key)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def _get_int(db: Session, key: str, default: int = 0) -> int:
    val = get_setting(db, key)
    try:
        return int(str(val))
    except (TypeError, ValueError):
        return default


def _get_dt(db: Session, key: str) -> Optional[datetime]:
    val = get_setting(db, key)
    if not val:
        return None
    try:
        dt = datetime.fromisoformat(str(val))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _picking_open(db: Session) -> bool:
    """Picking is open only if enabled, not yet settled, and before the deadline."""
    if _get_bool(db, SETTLED_KEY, False):
        return False
    if not _get_bool(db, OPEN_KEY, False):
        return False
    deadline = _get_dt(db, DEADLINE_KEY)
    if deadline is not None and datetime.now(timezone.utc) >= deadline:
        return False
    return True


def _pick_out(db: Session, pick: ChampionPrediction) -> ChampionPickOut:
    out = ChampionPickOut.model_validate(pick)
    team = db.get(Team, pick.team_id)
    if team:
        out.team = TeamOut.model_validate(team)
    return out


def _total_picks(db: Session) -> int:
    return db.scalar(select(func.count(ChampionPrediction.id))) or 0


# ======================================================================
# Player endpoints
# ======================================================================
@router.get("/teams", response_model=list[TeamOut])
def pickable_teams(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """All teams a player may choose from, alphabetical."""
    teams = db.scalars(select(Team).order_by(Team.name.asc())).all()
    return [TeamOut.model_validate(t) for t in teams]


@router.get("/status", response_model=ChampionStatus)
def champion_status(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Full champion-screen state for the calling player."""
    settled = _get_bool(db, SETTLED_KEY, False)

    my = db.scalar(select(ChampionPrediction).where(ChampionPrediction.user_id == user.id))

    actual_team_out = None
    if settled:
        actual_id = _get_int(db, ACTUAL_KEY, 0)
        if actual_id:
            team = db.get(Team, actual_id)
            if team:
                actual_team_out = TeamOut.model_validate(team)

    return ChampionStatus(
        is_open=_picking_open(db),
        deadline=_get_dt(db, DEADLINE_KEY),
        is_settled=settled,
        bonus_points=_get_int(db, BONUS_KEY, app_settings.CHAMPION_BONUS_POINTS),
        prize=get_setting(db, PRIZE_KEY),
        prize_amount=_get_int(db, PRIZE_AMT_KEY, 0) or None,
        entry_fee=app_settings.ENTRY_FEE,
        total_picks=_total_picks(db),
        my_pick=_pick_out(db, my) if my else None,
        actual_team=actual_team_out,
    )


@router.post("/pick", response_model=ChampionPickOut, status_code=201)
def make_pick(payload: ChampionPickCreate, request: Request,
              user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Submit the caller's ONE-TIME champion pick. Cannot be changed later."""
    if _get_bool(db, SETTLED_KEY, False):
        raise HTTPException(status_code=403, detail="The champion has already been declared. Picks are closed.")
    if not _picking_open(db):
        raise HTTPException(status_code=403, detail="Champion picks are closed.")

    existing = db.scalar(select(ChampionPrediction).where(ChampionPrediction.user_id == user.id))
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You have already locked in your champion pick. This choice cannot be changed.",
        )

    team = db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    pick = ChampionPrediction(user_id=user.id, team_id=team.id)
    db.add(pick)
    db.commit()
    db.refresh(pick)
    write_audit(db, user.id, "champion_pick", "champion", f"team {team.name}", request)
    return _pick_out(db, pick)


# ======================================================================
# Admin endpoints
# ======================================================================
@router.get("/admin/summary", response_model=ChampionAdminSummary, dependencies=[Depends(require_admin)])
def admin_summary(db: Session = Depends(get_db)):
    """Admin: window config, prize, settlement state and the pick distribution."""
    # Count picks per team.
    rows = db.execute(
        select(ChampionPrediction.team_id, func.count(ChampionPrediction.id))
        .group_by(ChampionPrediction.team_id)
    ).all()
    team_ids = [tid for tid, _ in rows]
    teams = {t.id: t for t in db.scalars(select(Team).where(Team.id.in_(team_ids))).all()} if team_ids else {}
    tally = [
        ChampionTeamTally(
            team_id=tid,
            name=teams[tid].name if tid in teams else "?",
            short_code=teams[tid].short_code if tid in teams else None,
            flag_url=teams[tid].flag_url if tid in teams else None,
            count=cnt,
        )
        for tid, cnt in sorted(rows, key=lambda r: r[1], reverse=True)
    ]

    actual_id = _get_int(db, ACTUAL_KEY, 0) or None
    actual_team_out = None
    if actual_id:
        t = db.get(Team, actual_id)
        if t:
            actual_team_out = TeamOut.model_validate(t)

    return ChampionAdminSummary(
        is_open=_get_bool(db, OPEN_KEY, False),
        deadline=_get_dt(db, DEADLINE_KEY),
        is_settled=_get_bool(db, SETTLED_KEY, False),
        bonus_points=_get_int(db, BONUS_KEY, 500),
        prize=get_setting(db, PRIZE_KEY),
        prize_amount=_get_int(db, PRIZE_AMT_KEY, 0) or None,
        total_picks=_total_picks(db),
        actual_team_id=actual_id,
        actual_team=actual_team_out,
        tally=tally,
    )


@router.put("/admin/config", response_model=ChampionAdminSummary, dependencies=[Depends(require_admin)])
def update_config(payload: ChampionConfigUpdate, request: Request,
                  admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: open/close picking, set the deadline, bonus points and prize."""
    if payload.is_open is not None:
        set_setting(db, OPEN_KEY, "true" if payload.is_open else "false")
    if payload.clear_deadline:
        set_setting(db, DEADLINE_KEY, "")
    elif payload.deadline is not None:
        set_setting(db, DEADLINE_KEY, payload.deadline.isoformat())
    if payload.bonus_points is not None:
        set_setting(db, BONUS_KEY, str(payload.bonus_points))
    if payload.prize is not None:
        set_setting(db, PRIZE_KEY, payload.prize)
    if payload.prize_amount is not None:
        set_setting(db, PRIZE_AMT_KEY, str(payload.prize_amount))

    write_audit(db, admin.id, "champion_config", "champion", None, request)
    return admin_summary(db)


@router.post("/admin/settle", response_model=ChampionAdminSummary, dependencies=[Depends(require_admin)])
def settle(payload: ChampionSettleRequest, request: Request,
           admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: declare the real champion, award bonuses, and close picking."""
    team = db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    bonus = _get_int(db, BONUS_KEY, 500)

    # Award every pick: correct ones get the bonus, the rest reset to zero.
    picks = db.scalars(select(ChampionPrediction)).all()
    correct = 0
    for p in picks:
        p.is_correct = p.team_id == team.id
        p.points_awarded = float(bonus) if p.is_correct else 0.0
        p.is_settled = True
        if p.is_correct:
            correct += 1

    set_setting(db, ACTUAL_KEY, str(team.id))
    set_setting(db, SETTLED_KEY, "true")
    set_setting(db, OPEN_KEY, "false")
    db.commit()

    # Fold champion bonuses into leaderboard totals.
    recompute_user_totals(db)

    write_audit(db, admin.id, "champion_settle", "champion",
                f"{team.name}: {correct}/{len(picks)} correct", request)
    return admin_summary(db)


@router.post("/admin/reopen", response_model=ChampionAdminSummary, dependencies=[Depends(require_admin)])
def reopen(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: undo a settlement (clears the declared champion and all bonuses).

    Existing picks are kept (they are still immutable to players); only the
    awarded points and the 'settled' flag are reset so a mistaken declaration
    can be corrected. Picking is re-opened.
    """
    for p in db.scalars(select(ChampionPrediction)).all():
        p.is_correct = False
        p.points_awarded = 0.0
        p.is_settled = False
    set_setting(db, SETTLED_KEY, "false")
    set_setting(db, ACTUAL_KEY, "")
    set_setting(db, OPEN_KEY, "true")
    db.commit()
    recompute_user_totals(db)
    write_audit(db, admin.id, "champion_reopen", "champion", None, request)
    return admin_summary(db)
