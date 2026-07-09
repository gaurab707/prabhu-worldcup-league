"""Batch processing of match results: locking, scoring, points, history.

Called by the scheduler (every N minutes) and available to admins via a
"recalculate" endpoint. Idempotent: a finished match is scored once (guarded
by ``Match.scored``); recalculation resets and re-applies cleanly.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.models import (
    Match,
    MatchStatus,
    PointHistory,
    Prediction,
    SchedulerLog,
    User,
)
from app.services.scoring import compute_consensus, score_prediction

logger = get_logger("results")


def lock_started_matches(db: Session) -> int:
    """Mark matches whose kickoff has passed as locked-for-prediction.

    Locking is implicit (predictions check kickoff time), but we also flip
    ``scheduled`` -> ``live`` so the UI reflects reality even without a scrape.
    Returns number of matches transitioned.
    """
    now = datetime.now(timezone.utc)
    changed = 0
    matches = db.scalars(
        select(Match).where(Match.status == MatchStatus.scheduled)
    ).all()
    for m in matches:
        ko = m.kickoff_at
        if ko.tzinfo is None:
            ko = ko.replace(tzinfo=timezone.utc)
        if ko <= now:
            m.status = MatchStatus.live
            changed += 1
    if changed:
        db.commit()
    return changed


def score_match(db: Session, match: Match) -> int:
    """Score every prediction for one finished match. Returns count scored."""
    if match.home_score is None or match.away_score is None:
        return 0

    preds = db.scalars(select(Prediction).where(Prediction.match_id == match.id)).all()
    if not preds:
        match.scored = True
        db.commit()
        return 0

    # Popularity: fraction of players who called the outcome correctly.
    consensus = compute_consensus(
        ((p.pred_home_score, p.pred_away_score) for p in preds),
        match.home_score,
        match.away_score,
    )

    for p in preds:
        breakdown = score_prediction(
            p.pred_home_score, p.pred_away_score,
            match.home_score, match.away_score,
            pred_hp=p.pred_home_penalty, pred_ap=p.pred_away_penalty,
            act_hp=match.home_penalty if match.is_penalty else None,
            act_ap=match.away_penalty if match.is_penalty else None,
            consensus_fraction=consensus,
        )
        p.outcome_points = breakdown.outcome_points
        p.closeness_points = breakdown.closeness_points
        p.penalty_points = breakdown.penalty_points
        p.difficulty_multiplier = breakdown.difficulty_multiplier
        p.points_awarded = breakdown.total
        p.is_scored = True

        # Refresh point-history row for this (user, match).
        existing = db.scalar(
            select(PointHistory).where(
                PointHistory.user_id == p.user_id, PointHistory.match_id == match.id
            )
        )
        if existing:
            existing.points = breakdown.total
        else:
            db.add(PointHistory(user_id=p.user_id, match_id=match.id,
                                points=breakdown.total, reason="match_result"))

    match.scored = True
    db.commit()
    logger.info("Scored match %s (%s-%s), consensus=%.2f, %d predictions",
                match.id, match.home_score, match.away_score, consensus, len(preds))
    return len(preds)


def recompute_user_totals(db: Session) -> None:
    """Recompute every user's denormalised total from point_history.

    The champion-prediction bonus (a one-off award for correctly picking the
    World Cup winner) is stored on the champion_predictions row rather than in
    point_history, so it is added on top here. This keeps the bonus durable
    across match rescoring (which only rewrites match point-history rows).
    """
    # Import locally to avoid a circular import at module load time.
    from app.models.models import ChampionPrediction

    champion_bonus: dict[int, float] = {}
    for cp in db.scalars(
        select(ChampionPrediction).where(ChampionPrediction.is_settled.is_(True))
    ).all():
        if cp.points_awarded:
            champion_bonus[cp.user_id] = champion_bonus.get(cp.user_id, 0.0) + cp.points_awarded

    users = db.scalars(select(User)).all()
    for u in users:
        rows = db.scalars(
            select(PointHistory.points).where(PointHistory.user_id == u.id)
        ).all()
        u.total_points = round(sum(rows) + champion_bonus.get(u.id, 0.0), 2)
    db.commit()


def process_finished_matches(db: Session, *, force: bool = False) -> dict:
    """Full results pass. Set ``force=True`` to rescore already-scored matches."""
    log = SchedulerLog(job="score_results", status="success")
    scored_matches = 0
    scored_predictions = 0
    try:
        lock_started_matches(db)
        query = select(Match).where(Match.status == MatchStatus.finished)
        if not force:
            query = query.where(Match.scored.is_(False))
        for match in db.scalars(query).all():
            if force:
                match.scored = False
            n = score_match(db, match)
            scored_matches += 1
            scored_predictions += n
        recompute_user_totals(db)
        log.matches_updated = scored_matches
        log.message = f"Scored {scored_matches} matches / {scored_predictions} predictions."
        logger.info(log.message)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        log.status = "error"
        log.message = str(exc)
        logger.exception("process_finished_matches failed")
    finally:
        db.add(log)
        db.commit()
    return {"matches": scored_matches, "predictions": scored_predictions, "status": log.status}
