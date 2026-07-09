"""Winner podium + prize management + points breakdown.

Flow
----
1. Admin clicks **Generate** -> the current top three are captured as a DRAFT
   (``published=False``, visible to admins only). The system auto-fills a
   suggested prize name and a suggested cash amount (a 50/30/20 split of the
   prize pool). Regenerating preserves any prize the admin already edited for a
   player who is still in the same position.
2. Admin edits each winner's prize / amount / notes.
3. Admin clicks **Reveal** -> the podium is published and becomes visible to
   everyone, with a celebration and a per-winner points breakdown.
4. **Hide** takes it back to a draft.

The breakdown endpoint explains exactly where each player's points came from
(every scored match prediction + the World Cup champion bonus). It is visible
to admins for anyone at any time, and to everyone once that player is a
published winner.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_admin, write_audit
from app.core.config import settings as app_settings
from app.db.session import get_db
from app.models.models import (
    ChampionPrediction,
    Match,
    Prediction,
    Team,
    User,
    UserRole,
    UserStatus,
    Winner,
)
from app.schemas.schemas import (
    BreakdownMatch,
    ChampionContribution,
    PointsBreakdown,
    WinnerEdit,
    WinnerOut,
)
from app.services.leaderboard import get_leaderboard

router = APIRouter(prefix="/winners", tags=["winners"])

# Default podium prize names and pool split used to pre-fill the draft.
_PRIZE_NAMES = {1: "Champion", 2: "Runner-up", 3: "Third Place"}
_POOL_SPLIT = {1: 0.50, 2: 0.30, 3: 0.20}


def _prize_pool(db: Session) -> int:
    """Total pool = active (paid) players x entry fee — same basis as the dashboard."""
    verified = db.scalar(
        select(func.count(User.id)).where(
            User.role == UserRole.staff, User.status == UserStatus.active
        )
    ) or 0
    return int(verified) * app_settings.ENTRY_FEE


def _suggested_amount(pool: int, position: int) -> int:
    return int(round(pool * _POOL_SPLIT.get(position, 0.0)))


def _to_out(db: Session, w: Winner) -> WinnerOut:
    out = WinnerOut.model_validate(w)
    user = db.get(User, w.user_id)
    if user:
        out.name = user.full_name
        out.department = user.department
        out.points = round(user.total_points, 2)
    return out


# ======================================================================
# Read
# ======================================================================
@router.get("", response_model=list[WinnerOut])
def list_winners(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Published podium (visible to all verified users). Empty when not revealed."""
    winners = db.scalars(
        select(Winner).where(Winner.published.is_(True)).order_by(Winner.position.asc())
    ).all()
    return [_to_out(db, w) for w in winners]


@router.get("/admin", response_model=list[WinnerOut], dependencies=[Depends(require_admin)])
def admin_list(db: Session = Depends(get_db)):
    """All podium rows (draft or published) — admin status view."""
    winners = db.scalars(select(Winner).order_by(Winner.position.asc())).all()
    return [_to_out(db, w) for w in winners]


# ======================================================================
# Draft / generate / edit / publish
# ======================================================================
@router.post("/generate", response_model=list[WinnerOut], dependencies=[Depends(require_admin)])
def generate(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Build/refresh the DRAFT podium from the current standings (admins only).

    Auto-fills a suggested prize + amount. Any prize the admin already edited for
    a player who is still in the same position is kept.
    """
    top = get_leaderboard(db, limit=3)
    pool = _prize_pool(db)

    # Remember existing (position -> row) so we can preserve edited prizes.
    existing = {w.position: w for w in db.scalars(select(Winner)).all()}

    keep_positions = set()
    for position, row in enumerate(top, start=1):
        keep_positions.add(position)
        w = existing.get(position)
        if w and w.user_id == row["user_id"]:
            # Same player in this slot: keep their (possibly edited) prize, just
            # ensure it stays a draft until the admin reveals again.
            w.published = False
            if w.prize is None:
                w.prize = _PRIZE_NAMES.get(position)
            if w.prize_amount is None:
                w.prize_amount = _suggested_amount(pool, position)
        elif w:
            # Different player now holds this slot: reset to suggested defaults.
            w.user_id = row["user_id"]
            w.prize = _PRIZE_NAMES.get(position)
            w.prize_amount = _suggested_amount(pool, position)
            w.notes = None
            w.published = False
        else:
            db.add(Winner(
                position=position, user_id=row["user_id"],
                prize=_PRIZE_NAMES.get(position),
                prize_amount=_suggested_amount(pool, position),
                published=False,
            ))

    # Drop any stale rows beyond the current podium size.
    for position, w in existing.items():
        if position not in keep_positions:
            db.delete(w)

    db.commit()
    write_audit(db, admin.id, "generate_winners", "winner", f"{len(top)} (draft)", request)
    winners = db.scalars(select(Winner).order_by(Winner.position.asc())).all()
    return [_to_out(db, w) for w in winners]


@router.put("/{winner_id}", response_model=WinnerOut, dependencies=[Depends(require_admin)])
def edit_winner(winner_id: int, payload: WinnerEdit, request: Request,
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: set/edit a single winner's prize, amount or note (before or after reveal)."""
    w = db.get(Winner, winner_id)
    if not w:
        raise HTTPException(status_code=404, detail="Winner not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(w, field, value)
    db.commit()
    db.refresh(w)
    write_audit(db, admin.id, "edit_winner", "winner", str(winner_id), request)
    return _to_out(db, w)


@router.post("/reveal", response_model=list[WinnerOut], dependencies=[Depends(require_admin)])
def reveal(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Publish the podium to everyone. Generates a draft first if none exists."""
    winners = db.scalars(select(Winner).order_by(Winner.position.asc())).all()
    if not winners:
        generate(request, admin, db)
        winners = db.scalars(select(Winner).order_by(Winner.position.asc())).all()
    if not winners:
        return []
    for w in winners:
        w.published = True
    db.commit()
    for w in winners:
        db.refresh(w)
    write_audit(db, admin.id, "reveal_winners", "winner", f"{len(winners)} published", request)
    return [_to_out(db, w) for w in winners]


@router.post("/hide", dependencies=[Depends(require_admin)])
def hide(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Take the podium back down to a draft (unpublish) without losing the prizes."""
    db.execute(update(Winner).values(published=False))
    db.commit()
    write_audit(db, admin.id, "hide_winners", "winner", None, request)
    return {"status": "hidden"}


# ======================================================================
# Points breakdown — "which points came from which prediction"
# ======================================================================
def _build_breakdown(db: Session, user: User) -> PointsBreakdown:
    # Every scored match prediction, chronological.
    rows = db.execute(
        select(Prediction, Match)
        .join(Match, Match.id == Prediction.match_id)
        .where(Prediction.user_id == user.id, Prediction.is_scored.is_(True))
        .order_by(Match.kickoff_at.asc())
    ).all()

    # Preload the teams we need for names/flags.
    team_ids = {m.home_team_id for _, m in rows} | {m.away_team_id for _, m in rows}
    teams = {t.id: t for t in db.scalars(select(Team).where(Team.id.in_(team_ids))).all()} if team_ids else {}

    matches: list[BreakdownMatch] = []
    match_points = 0.0
    for p, m in rows:
        home = teams.get(m.home_team_id)
        away = teams.get(m.away_team_id)
        match_points += p.points_awarded
        matches.append(BreakdownMatch(
            match_id=m.id,
            home_team=home.name if home else "?",
            away_team=away.name if away else "?",
            home_flag=home.flag_url if home else None,
            away_flag=away.flag_url if away else None,
            kickoff_at=m.kickoff_at,
            actual_home=m.home_score,
            actual_away=m.away_score,
            is_penalty=bool(m.is_penalty),
            actual_home_pen=m.home_penalty,
            actual_away_pen=m.away_penalty,
            pred_home=p.pred_home_score,
            pred_away=p.pred_away_score,
            pred_home_pen=p.pred_home_penalty,
            pred_away_pen=p.pred_away_penalty,
            outcome_points=p.outcome_points,
            closeness_points=p.closeness_points,
            penalty_points=p.penalty_points,
            difficulty_multiplier=p.difficulty_multiplier,
            points_awarded=p.points_awarded,
        ))

    # Champion bonus (only once settled).
    champion = None
    champion_points = 0.0
    cp = db.scalar(select(ChampionPrediction).where(ChampionPrediction.user_id == user.id))
    if cp and cp.is_settled:
        champion_points = cp.points_awarded
        team = db.get(Team, cp.team_id)
        champion = ChampionContribution(
            team_name=team.name if team else "?",
            team_flag=team.flag_url if team else None,
            is_correct=cp.is_correct,
            points_awarded=cp.points_awarded,
        )

    return PointsBreakdown(
        user_id=user.id,
        name=user.full_name,
        department=user.department,
        total_points=round(match_points + champion_points, 2),
        match_points=round(match_points, 2),
        champion_points=round(champion_points, 2),
        matches=matches,
        champion=champion,
    )


@router.get("/breakdown/{user_id}", response_model=PointsBreakdown)
def breakdown(user_id: int, viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Explain where a player's points came from.

    Visible to: admins (anyone), the player themselves, or everyone once that
    player is a *published* winner.
    """
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    is_admin = viewer.role == UserRole.admin
    is_self = viewer.id == user_id
    is_public_winner = db.scalar(
        select(func.count(Winner.id)).where(
            Winner.user_id == user_id, Winner.published.is_(True)
        )
    ) or 0

    if not (is_admin or is_self or is_public_winner):
        raise HTTPException(status_code=403, detail="This breakdown isn't available.")

    return _build_breakdown(db, target)
