"""APScheduler wiring.

A single background job runs every ``SCHEDULER_INTERVAL_MINUTES``:
    1. scrape latest fixtures + results (TheSportsDB),
    2. lock started matches,
    3. score finished matches + recompute leaderboard totals.

The scheduler holds its own DB session per run and is started/stopped from the
FastAPI lifespan. It is safe to disable via SCHEDULER_ENABLED=false.
"""
from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.services.results import process_finished_matches
from app.services.scraper import sync_matches

logger = get_logger("scheduler")

_scheduler: BackgroundScheduler | None = None


def _job() -> None:
    """One scheduler tick. Never raises (each stage logs its own errors)."""
    db = SessionLocal()
    try:
        if settings.SCRAPER_ENABLED:
            sync_matches(db)
        process_finished_matches(db)
    finally:
        db.close()


def start_scheduler() -> None:
    """Start the background scheduler if enabled and not already running."""
    global _scheduler
    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler disabled by configuration.")
        return
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _job,
        trigger=IntervalTrigger(minutes=settings.SCHEDULER_INTERVAL_MINUTES),
        id="worldcup_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info("Scheduler started (every %s min).", settings.SCHEDULER_INTERVAL_MINUTES)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


def run_once() -> None:
    """Trigger a manual sync (used by the admin 'sync now' endpoint)."""
    _job()
