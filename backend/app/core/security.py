"""Password hashing and JWT helpers."""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# --- Password hashing (bcrypt) -----------------------------------------
def hash_password(password: str) -> str:
    """Hash a plaintext password with a per-password salt."""
    pwd = password.encode("utf-8")
    return bcrypt.hashpw(pwd, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time verification of a plaintext password against a hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# --- JWT ----------------------------------------------------------------
def create_access_token(subject: str | int, role: str, expires_minutes: Optional[int] = None) -> str:
    """Create a signed JWT carrying the user id (sub) and role."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {"sub": str(subject), "role": role, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode + validate a JWT. Returns the payload or None if invalid/expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
