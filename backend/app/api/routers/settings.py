"""Public settings (QR, logo, banner) + admin uploads."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin, write_audit
from app.core.files import save_upload
from app.db.session import get_db
from app.models.models import Setting, User

router = APIRouter(prefix="/settings", tags=["settings"])

# Keys used across the app.
QR_KEY = "payment_qr_url"
LOGO_KEY = "company_logo_url"
BANNER_KEY = "winner_banner_text"
PAYMENT_MSG_KEY = "payment_message"

_PUBLIC_KEYS = [QR_KEY, LOGO_KEY, BANNER_KEY, PAYMENT_MSG_KEY]


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.get(Setting, key)
    return row.value if row and row.value is not None else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


@router.get("/public")
def public_settings(db: Session = Depends(get_db)):
    """Settings safe to expose to any client (branding + payment info)."""
    return {
        "company_logo_url": get_setting(db, LOGO_KEY, "https://www.prabhucapital.com/brand-logo.png"),
        "payment_qr_url": get_setting(db, QR_KEY),
        "payment_message": get_setting(
            db, PAYMENT_MSG_KEY,
            "Please pay Rs. 1000 and write your Full Name in the payment Remarks for verification.",
        ),
        "winner_banner_text": get_setting(db, BANNER_KEY, "Congratulations to our champions!"),
    }


# --- Admin -------------------------------------------------------------
@router.post("/qr", dependencies=[Depends(require_admin)])
def upload_qr(request: Request, file: UploadFile = File(...),
              admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: upload the payment QR image."""
    path = save_upload(file, "branding")
    set_setting(db, QR_KEY, path)
    write_audit(db, admin.id, "upload_qr", "setting", path, request)
    return {"payment_qr_url": path}


@router.post("/logo", dependencies=[Depends(require_admin)])
def upload_logo(request: Request, file: UploadFile = File(...),
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: upload/override the company logo."""
    path = save_upload(file, "branding")
    set_setting(db, LOGO_KEY, path)
    write_audit(db, admin.id, "upload_logo", "setting", path, request)
    return {"company_logo_url": path}


@router.put("/{key}", dependencies=[Depends(require_admin)])
def update_setting(key: str, value: str = Form(...),
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin: set any text setting (e.g. payment message, banner)."""
    set_setting(db, key, value)
    return {"key": key, "value": value}
