"""Prediction submission, editing (until kickoff), and history."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, write_audit
from app.api.routers.matches import is_match_locked
from app.db.session import get_db
from app.models.models import Match, MatchStatus, Prediction, User
from app.schemas.schemas import PredictionCreate, PredictionOut

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("", response_model=PredictionOut)
def upsert_prediction(payload: PredictionCreate, request: Request,
                      user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Create or update the caller's prediction for a match.

    Editing is allowed only while the match is unlocked (before kickoff). After
    kickoff the prediction becomes read-only.
    """
    match = db.get(Match, payload.match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if is_match_locked(match) or match.status != MatchStatus.scheduled:
        raise HTTPException(status_code=403, detail="This match is locked. Predictions are closed.")

    pred = db.scalar(
        select(Prediction).where(
            Prediction.user_id == user.id, Prediction.match_id == match.id
        )
    )
    action = "update_prediction" if pred else "create_prediction"
    if pred is None:
        pred = Prediction(user_id=user.id, match_id=match.id,
                          pred_home_score=0, pred_away_score=0)
        db.add(pred)

    pred.pred_home_score = payload.pred_home_score
    pred.pred_away_score = payload.pred_away_score
    pred.pred_home_penalty = payload.pred_home_penalty
    pred.pred_away_penalty = payload.pred_away_penalty
    db.commit()
    db.refresh(pred)
    write_audit(db, user.id, action, "prediction", f"match {match.id}", request)
    return pred


@router.get("/mine", response_model=list[PredictionOut])
def my_predictions(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """All predictions belonging to the caller."""
    preds = db.scalars(
        select(Prediction).where(Prediction.user_id == user.id)
        .order_by(Prediction.created_at.desc())
    ).all()
    return preds


@router.get("/match/{match_id}", response_model=list[PredictionOut])
def match_predictions(match_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Predictions for a match.

    Privacy rule: other users' predictions are only visible once the match is
    finished AND an admin has revealed them. Otherwise the caller sees only
    their own.
    """
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    revealed = match.status == MatchStatus.finished and match.predictions_revealed
    q = select(Prediction).where(Prediction.match_id == match_id)
    if not revealed:
        q = q.where(Prediction.user_id == user.id)
    return db.scalars(q).all()
