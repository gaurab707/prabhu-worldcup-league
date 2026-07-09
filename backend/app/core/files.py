"""Safe file-upload helper for QR images, logos, and payment screenshots."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

_ALLOWED = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
        "image/webp": ".webp", "image/gif": ".gif"}


def save_upload(file: UploadFile, subdir: str) -> str:
    """Validate + persist an uploaded image. Returns a web path like /uploads/...."""
    if file.content_type not in _ALLOWED:
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    data = file.file.read()
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")

    dest_dir = Path(settings.UPLOAD_DIR) / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{_EXT.get(file.content_type, '.png')}"
    (dest_dir / filename).write_bytes(data)
    return f"/uploads/{subdir}/{filename}"
