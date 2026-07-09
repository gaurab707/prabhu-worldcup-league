"""Authentication + registration (with payment-verification workflow)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, write_audit
from app.core.config import settings
from app.core.files import save_upload
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.models import Payment, PaymentStatus, User, UserRole, UserStatus
from app.schemas.schemas import LoginRequest, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    request: Request,
    email: str = Form(...),
    full_name: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    department: Optional[str] = Form(None),
    payment_screenshot: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Register a staff user.

    Creates the account in ``pending`` status plus a ``pending`` payment record
    (with the uploaded screenshot). The user cannot log in until an admin
    verifies the payment.
    """
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    email = email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        full_name=full_name.strip(),
        department=department,
        hashed_password=hash_password(password),
        role=UserRole.staff,
        status=UserStatus.pending,
    )
    db.add(user)
    db.flush()

    screenshot_path = None
    if payment_screenshot is not None:
        screenshot_path = save_upload(payment_screenshot, "payments")

    db.add(Payment(
        user_id=user.id,
        amount=settings.ENTRY_FEE,
        screenshot_path=screenshot_path,
        remarks=full_name.strip(),
        status=PaymentStatus.pending,
    ))
    db.commit()
    db.refresh(user)
    write_audit(db, user.id, "register", "user", email, request)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate and return a JWT. Only verified accounts may log in."""
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status == UserStatus.pending:
        raise HTTPException(status_code=403, detail="Payment pending verification. Please wait for admin approval.")
    if user.status in (UserStatus.rejected, UserStatus.disabled):
        raise HTTPException(status_code=403, detail="Account is not active. Contact the administrator.")

    token = create_access_token(user.id, user.role.value)
    write_audit(db, user.id, "login", "user", user.email, request)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    """Return the current authenticated user."""
    return user
