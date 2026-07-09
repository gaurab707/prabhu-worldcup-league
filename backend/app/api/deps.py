"""Shared FastAPI dependencies: authentication, role checks, auditing."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.models import AuditLog, User, UserRole, UserStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a bearer JWT."""
    if not token:
        raise _CREDENTIALS_EXC
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise _CREDENTIALS_EXC
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise _CREDENTIALS_EXC
    if user.status == UserStatus.disabled:
        raise HTTPException(status_code=403, detail="Account disabled")
    return user


def get_active_user(user: User = Depends(get_current_user)) -> User:
    """Require a verified (active) account."""
    if user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Account pending payment verification")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require an admin role."""
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


def write_audit(db: Session, actor_id: Optional[int], action: str,
                entity: Optional[str] = None, detail: Optional[str] = None,
                request: Optional[Request] = None) -> None:
    """Append an audit-log entry (best effort)."""
    ip = request.client.host if request and request.client else None
    db.add(AuditLog(actor_id=actor_id, action=action, entity=entity,
                    detail=detail, ip_address=ip))
    db.commit()
