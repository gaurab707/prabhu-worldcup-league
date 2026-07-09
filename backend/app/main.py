"""FastAPI application factory + lifespan wiring."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.bootstrap import create_tables, ensure_admin_and_settings
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.api.routers import (
    admin,
    auth,
    champion,
    leaderboard,
    matches,
    payments,
    predictions,
    settings as settings_router,
    stats,
    users,
    winner,
)
from app.services.scheduler import start_scheduler, stop_scheduler

configure_logging()
logger = get_logger("main")

# Global, IP-keyed rate limiter (basic abuse protection).
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup (tables, admin, scheduler) and shutdown (scheduler stop)."""
    create_tables()
    ensure_admin_and_settings()
    start_scheduler()
    logger.info("%s started.", settings.PROJECT_NAME)
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Internal FIFA World Cup prediction league for Prabhu Capital.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS (LAN access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images (QR, logos, payment screenshots).
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# API routers
_PREFIX = settings.API_V1_PREFIX
for r in (auth, matches, predictions, leaderboard, users, payments,
          settings_router, stats, winner, champion, admin):
    app.include_router(r.router, prefix=_PREFIX)


@app.get("/", tags=["health"])
def root():
    return {"app": settings.PROJECT_NAME, "status": "ok", "docs": "/docs"}


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "healthy"}
