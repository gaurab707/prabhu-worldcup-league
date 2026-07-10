"""Application configuration loaded from environment variables.

All tunable behaviour (secrets, DB URL, scheduler interval, scoring weights,
scraper source) is centralised here so nothing is hard-coded across the app.
"""
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory (two levels up from this file: app/core/config.py -> backend/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Strongly-typed settings container."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- General ---------------------------------------------------------
    PROJECT_NAME: str = "Prabhu Capital World Cup Prediction League"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # --- Security --------------------------------------------------------
    SECRET_KEY: str = "CHANGE_ME_super_secret_key_for_jwt_signing_prabhu_capital"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days ("remember me")

    # First admin bootstrapped on startup / seed
    ADMIN_EMAIL: str = "admin@prabhucapital.com"
    ADMIN_PASSWORD: str = "Admin@123"
    ADMIN_NAME: str = "League Administrator"

    # --- Database --------------------------------------------------------
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'database' / 'worldcup.db').as_posix()}"

    # --- CORS (LAN access) ----------------------------------------------
    # Comma separated list in the env file, e.g. "http://localhost:3000,http://192.168.1.10:3000"
    BACKEND_CORS_ORIGINS: str = "*"

    # --- Uploads ---------------------------------------------------------
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_UPLOAD_MB: int = 5

    # --- Scheduler / Scraper --------------------------------------------
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_MINUTES: int = 10        # when nothing is live
    SCHEDULER_LIVE_INTERVAL_MINUTES: int = 2    # faster polling while a match is live
    # Which competition to pull from TheSportsDB (free API; "123" is the current public key)
    SPORTSDB_API_KEY: str = "123"
    SPORTSDB_LEAGUE_ID: str = "4429"          # FIFA World Cup league id on TheSportsDB
    SPORTSDB_SEASON: str = "2025-2026"        # TheSportsDB labels the current WC season "2025-2026"
    SCRAPER_ENABLED: bool = True
    # When true, the auto-sync only ADDS matches whose kickoff is still in the future.
    # This keeps already-finished games (which nobody could predict) out of a league
    # that starts mid-tournament. Matches already in the DB are always kept up to date.
    SPORTSDB_INGEST_FUTURE_ONLY: bool = True

    # --- Payment ---------------------------------------------------------
    ENTRY_FEE: int = 1000  # Rs.

    # --- Champion (World Cup winner) prediction --------------------------
    CHAMPION_BONUS_POINTS: int = 500          # default points a correct pick earns
    CHAMPION_PRIZE_AMOUNT: int = 2000         # default cash prize (Rs.)

    @property
    def cors_origins(self) -> List[str]:
        raw = self.BACKEND_CORS_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so settings are parsed only once."""
    return Settings()


settings = get_settings()
