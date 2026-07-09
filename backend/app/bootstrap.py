"""First-run bootstrap: create tables (dev), seed the admin + core settings."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.flags import flag_for
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.models import Setting, Team, User, UserRole, UserStatus

logger = get_logger("bootstrap")

# Canonical list of nations offered for the "World Cup champion" pick before any
# fixtures exist. Idempotent (seeded by name); admins can still add more teams by
# creating matches. Names match the flag lookup so each gets a flag automatically.
CHAMPION_TEAM_SEED = [
    "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Cameroon",
    "Canada", "Chile", "Colombia", "Costa Rica", "Croatia", "Czech Republic",
    "Denmark", "Ecuador", "Egypt", "England", "France", "Germany", "Ghana",
    "Iran", "Italy", "Ivory Coast", "Japan", "Mexico", "Morocco", "Netherlands",
    "New Zealand", "Nigeria", "Norway", "Panama", "Paraguay", "Peru", "Poland",
    "Portugal", "Qatar", "Saudi Arabia", "Senegal", "Serbia", "South Korea",
    "Spain", "Sweden", "Switzerland", "Tunisia", "Turkey", "United States",
    "Uruguay", "Wales",
]


def create_tables() -> None:
    """Create tables if they do not exist (convenient for dev / first run)."""
    Base.metadata.create_all(bind=engine)


def _seed_teams(db) -> None:
    """Insert any missing canonical teams (idempotent, by unique name)."""
    existing = {t.name for t in db.scalars(select(Team)).all()}
    added = 0
    for name in CHAMPION_TEAM_SEED:
        if name not in existing:
            db.add(Team(name=name, short_code=name[:3].upper(), flag_url=flag_for(name)))
            added += 1
    if added:
        db.commit()
        logger.info("Seeded %d champion-pick teams", added)


def ensure_admin_and_settings() -> None:
    """Create the default admin account + seed branding settings once."""
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        admin = db.scalar(select(User).where(User.email == settings.ADMIN_EMAIL.lower()))
        if not admin:
            db.add(User(
                email=settings.ADMIN_EMAIL.lower(),
                full_name=settings.ADMIN_NAME,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=UserRole.admin,
                status=UserStatus.active,
            ))
            logger.info("Created default admin: %s", settings.ADMIN_EMAIL)

        defaults = {
            "company_logo_url": "https://www.prabhucapital.com/brand-logo.png",
            "payment_message": (
                "Please pay Rs. 1000 and write your Full Name in the payment "
                "Remarks for verification."
            ),
            "winner_banner_text": "Congratulations to our champions!",
            # --- Champion (World Cup winner) prediction defaults ---
            "champion_pick_open": "true",
            "champion_bonus_points": "500",
            "champion_prize": "World Cup Champion Predictor",
            "champion_prize_amount": "2000",
            "champion_settled": "false",
        }
        for key, value in defaults.items():
            if not db.get(Setting, key):
                db.add(Setting(key=key, value=value))
        db.commit()

        _seed_teams(db)
    finally:
        db.close()
