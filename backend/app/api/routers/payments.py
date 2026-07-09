"""Payment status (staff) + verification workflow (admin)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, write_audit
from app.db.session import get_db
from app.models.models import Payment, PaymentStatus, User, UserStatus
from app.schemas.schemas import PaymentOut, PaymentReview

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/mine", response_model=PaymentOut | None)
def my_payment(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The caller's latest payment record (drives the 'pending' banner)."""
    return db.scalar(
        select(Payment).where(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
    )


# --- Admin -------------------------------------------------------------
@router.get("", response_model=list[PaymentOut], dependencies=[Depends(require_admin)])
def list_payments(db: Session = Depends(get_db), status: PaymentStatus | None = None):
    """Admin: list payments, optionally filtered by status."""
    q = select(Payment).order_by(Payment.created_at.desc())
    if status:
        q = q.where(Payment.status == status)
    return db.scalars(q).all()


@router.post("/{payment_id}/review", dependencies=[Depends(require_admin)])
def review_payment(payment_id: int, review: PaymentReview, request: Request,
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: approve or reject a payment.

    Approving activates the user's account so they can log in. Rejecting marks
    both the payment and the account as rejected.
    """
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    user = db.get(User, payment.user_id)

    if review.approve:
        payment.status = PaymentStatus.verified
        payment.verified_by = admin.id
        payment.verified_at = datetime.now(timezone.utc)
        if user:
            user.status = UserStatus.active
        action = "verify_payment"
    else:
        payment.status = PaymentStatus.rejected
        if user:
            user.status = UserStatus.rejected
        action = "reject_payment"

    if review.note:
        payment.remarks = (payment.remarks or "") + f" | admin: {review.note}"
    db.commit()
    write_audit(db, admin.id, action, "payment", str(payment_id), request)
    return {"payment_id": payment_id, "status": payment.status,
            "user_status": user.status if user else None}
