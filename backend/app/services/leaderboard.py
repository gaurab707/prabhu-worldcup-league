"""Leaderboard + statistics queries (computed on demand)."""
from __future__ import annotations

from collections import Counter
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.models import Match, Prediction, Team, User, UserRole, UserStatus


def _accuracy_row(db: Session, user: User) -> dict:
    """Per-user accuracy breakdown across scored predictions."""
    preds = db.scalars(
        select(Prediction).join(Match).where(
            Prediction.user_id == user.id, Prediction.is_scored.is_(True)
        )
    ).all()
    total = len(preds)
    if total == 0:
        return {"played": 0, "accuracy": 0.0, "winner_pct": 0.0,
                "score_pct": 0.0, "penalty_pct": 0.0}

    winner_correct = sum(1 for p in preds if p.outcome_points > 0)
    exact_correct = sum(
        1 for p in preds
        if p.match.home_score == p.pred_home_score and p.match.away_score == p.pred_away_score
    )
    pen_preds = [p for p in preds if p.match.is_penalty and p.pred_home_penalty is not None]
    pen_correct = sum(1 for p in pen_preds if p.penalty_points > 0)

    return {
        "played": total,
        "accuracy": round(100 * winner_correct / total, 1),
        "winner_pct": round(100 * winner_correct / total, 1),
        "score_pct": round(100 * exact_correct / total, 1),
        "penalty_pct": round(100 * pen_correct / len(pen_preds), 1) if pen_preds else 0.0,
    }


def get_leaderboard(db: Session, limit: Optional[int] = None, search: Optional[str] = None) -> list[dict]:
    """Ranked list of staff users with points + accuracy metrics."""
    q = select(User).where(User.role == UserRole.staff, User.status == UserStatus.active)
    if search:
        q = q.where(User.full_name.ilike(f"%{search}%"))
    q = q.order_by(User.total_points.desc(), User.full_name.asc())
    users = db.scalars(q).all()

    rows = []
    for rank, user in enumerate(users, start=1):
        acc = _accuracy_row(db, user)
        rows.append({
            "rank": rank,
            "user_id": user.id,
            "name": user.full_name,
            "department": user.department,
            "points": round(user.total_points, 2),
            **acc,
        })
    if limit:
        rows = rows[:limit]
    return rows


def prediction_statistics(db: Session) -> dict:
    """Aggregate statistics for the admin analytics dashboard."""
    # Most/least predicted team (as predicted winner).
    preds = db.scalars(select(Prediction)).all()
    team_names = {t.id: t.name for t in db.scalars(select(Team)).all()}
    match_teams = {m.id: (m.home_team_id, m.away_team_id)
                   for m in db.scalars(select(Match)).all()}

    winner_counter: Counter = Counter()
    score_counter: Counter = Counter()
    for p in preds:
        pair = match_teams.get(p.match_id)
        if pair:
            home_id, away_id = pair
            if p.pred_home_score > p.pred_away_score:
                winner_counter[team_names.get(home_id, "?")] += 1
            elif p.pred_away_score > p.pred_home_score:
                winner_counter[team_names.get(away_id, "?")] += 1
            else:
                winner_counter["Draw"] += 1
        score_counter[f"{p.pred_home_score}-{p.pred_away_score}"] += 1

    most_predicted = winner_counter.most_common(8)
    most_scores = score_counter.most_common(8)

    return {
        "total_predictions": len(preds),
        "most_predicted_teams": [{"name": n, "count": c} for n, c in most_predicted],
        "least_predicted_teams": [{"name": n, "count": c} for n, c in most_predicted[::-1][:5]],
        "most_predicted_scores": [{"score": s, "count": c} for s, c in most_scores],
    }
