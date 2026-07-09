"""World Cup data ingestion service.

Primary source: TheSportsDB (https://www.thesportsdb.com) which offers a free,
open JSON API (public dev key "3"). The service is written defensively:

* network calls retry with exponential backoff,
* a failure is logged to ``scheduler_logs`` but never crashes the caller,
* parsing is separated from I/O so it is unit-testable without a network.

The same design (an upsert over a normalised event list) makes it easy to plug
in an alternative source (Football-Data.org, API-Football, or an HTML scrape
with BeautifulSoup) by implementing ``fetch_events`` differently.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.models import Match, MatchStatus, SchedulerLog, Team

logger = get_logger("scraper")

_BASE = "https://www.thesportsdb.com/api/v1/json"
_TIMEOUT = 15
_RETRIES = 3


# --------------------------------------------------------------------------
# HTTP with retry
# --------------------------------------------------------------------------
def _get_json(url: str) -> Optional[dict]:
    """GET a URL returning parsed JSON, retrying on transient failures."""
    last_err: Optional[Exception] = None
    for attempt in range(1, _RETRIES + 1):
        try:
            resp = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": "PrabhuWC/1.0"})
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001 - we want to retry on anything
            last_err = exc
            wait = 2 ** attempt
            logger.warning("scraper GET failed (attempt %s/%s): %s; retrying in %ss",
                           attempt, _RETRIES, exc, wait)
            time.sleep(wait)
    logger.error("scraper GET permanently failed for %s: %s", url, last_err)
    return None


def _fetch_events_from(url: str) -> list[dict[str, Any]]:
    data = _get_json(url)
    if not data:
        return []
    return data.get("events") or []


def fetch_events() -> list[dict[str, Any]]:
    """Fetch raw event dicts for the configured league.

    We combine two sources and de-duplicate by event id:
      * ``eventsnextleague.php`` - the next upcoming fixtures for the league
        (this is what powers the "Upcoming" list; the season endpoint alone is
        often sparse for a tournament that hasn't fully started),
      * ``eventsseason.php``     - all events for the configured season (this is
        what brings finished results in for matches we already track).
    """
    key = settings.SPORTSDB_API_KEY
    league = settings.SPORTSDB_LEAGUE_ID
    season = settings.SPORTSDB_SEASON

    upcoming = _fetch_events_from(f"{_BASE}/{key}/eventsnextleague.php?id={league}")
    season_events = _fetch_events_from(f"{_BASE}/{key}/eventsseason.php?id={league}&s={season}")

    merged: dict[str, dict] = {}
    for ev in [*upcoming, *season_events]:
        eid = str(ev.get("idEvent"))
        if eid and eid not in merged:
            merged[eid] = ev
    return list(merged.values())


# --------------------------------------------------------------------------
# Parsing (pure, unit-testable)
# --------------------------------------------------------------------------
_STATUS_MAP = {
    "Match Finished": MatchStatus.finished,
    "FT": MatchStatus.finished,
    "AET": MatchStatus.finished,
    "Not Started": MatchStatus.scheduled,
    "NS": MatchStatus.scheduled,
    "1H": MatchStatus.live,
    "2H": MatchStatus.live,
    "HT": MatchStatus.live,
    "LIVE": MatchStatus.live,
    "Postponed": MatchStatus.postponed,
    "PST": MatchStatus.postponed,
    "Cancelled": MatchStatus.cancelled,
}


def _parse_kickoff(event: dict) -> Optional[datetime]:
    """Parse an event's kickoff into an aware UTC datetime.

    TheSportsDB gives times in UTC. We must NEVER use ``.astimezone()`` on a
    naive value here: that would interpret it in the *server's* local timezone,
    so the same data would be parsed differently depending on how the box clock
    is set. Instead, naive values are labelled UTC directly, and aware values
    are converted to UTC. The result is independent of the server timezone.
    """
    ts = event.get("strTimestamp")
    if ts:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except ValueError:
            pass
    date_s, time_s = event.get("dateEvent"), event.get("strTime") or "00:00:00"
    if date_s:
        try:
            return datetime.fromisoformat(f"{date_s}T{time_s}").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _to_int(v: Any) -> Optional[int]:
    try:
        return int(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


def normalise_event(event: dict) -> Optional[dict]:
    """Turn a raw TheSportsDB event into our internal shape, or None if unusable."""
    home = (event.get("strHomeTeam") or "").strip()
    away = (event.get("strAwayTeam") or "").strip()
    if not home or not away:
        return None
    kickoff = _parse_kickoff(event)
    if kickoff is None:
        return None
    status = _STATUS_MAP.get((event.get("strStatus") or "").strip(), MatchStatus.scheduled)
    return {
        "external_id": str(event.get("idEvent")),
        "home": home,
        "away": away,
        "home_badge": event.get("strHomeTeamBadge"),
        "away_badge": event.get("strAwayTeamBadge"),
        "kickoff_at": kickoff,
        "venue": event.get("strVenue"),
        "round_name": event.get("strStage") or event.get("intRound"),
        "status": status,
        "home_score": _to_int(event.get("intHomeScore")),
        "away_score": _to_int(event.get("intAwayScore")),
    }


# --------------------------------------------------------------------------
# Upsert into DB
# --------------------------------------------------------------------------
def _get_or_create_team(db: Session, name: str, badge: Optional[str]) -> Team:
    team = db.scalar(select(Team).where(Team.name == name))
    if team is None:
        team = Team(name=name, flag_url=badge, short_code=name[:3].upper())
        db.add(team)
        db.flush()
    elif badge and not team.flag_url:
        team.flag_url = badge
    return team


def _upsert_match(db: Session, ev: dict) -> bool:
    """Insert or update a single match. Returns True if a change was made."""
    match = db.scalar(select(Match).where(Match.external_id == ev["external_id"]))

    # For a league that starts mid-tournament, do not ADD games that are already
    # in the past (nobody could have predicted them). Existing matches always
    # continue to update (so a game we tracked still gets its final score).
    if match is None and settings.SPORTSDB_INGEST_FUTURE_ONLY:
        ko = ev["kickoff_at"]
        if ko.tzinfo is None:
            ko = ko.replace(tzinfo=timezone.utc)
        if ko < datetime.now(timezone.utc):
            return False

    home = _get_or_create_team(db, ev["home"], ev["home_badge"])
    away = _get_or_create_team(db, ev["away"], ev["away_badge"])

    changed = False
    if match is None:
        match = Match(
            external_id=ev["external_id"],
            home_team_id=home.id,
            away_team_id=away.id,
            kickoff_at=ev["kickoff_at"],
            venue=ev["venue"],
            round_name=str(ev["round_name"]) if ev["round_name"] else None,
            status=ev["status"],
        )
        db.add(match)
        changed = True
    else:
        # Never rewrite an admin-finalised match; only advance data forward.
        if match.status != MatchStatus.finished:
            if match.kickoff_at != ev["kickoff_at"]:
                match.kickoff_at = ev["kickoff_at"]; changed = True
            if match.status != ev["status"]:
                match.status = ev["status"]; changed = True

    # Result: fill scores when the source reports a finished match.
    if ev["status"] == MatchStatus.finished and ev["home_score"] is not None:
        if match.home_score != ev["home_score"] or match.away_score != ev["away_score"]:
            match.home_score = ev["home_score"]
            match.away_score = ev["away_score"]
            match.status = MatchStatus.finished
            match.scored = False  # ask the scorer to (re)award this match
            changed = True
    return changed


def sync_matches(db: Session) -> int:
    """Fetch + upsert all events. Returns number of matches changed. Logs result."""
    log = SchedulerLog(job="scrape_matches", status="success")
    updated = 0
    try:
        events = fetch_events()
        for raw in events:
            norm = normalise_event(raw)
            if norm and _upsert_match(db, norm):
                updated += 1
        db.commit()
        log.matches_updated = updated
        log.message = f"Synced {len(events)} events, {updated} changed."
        logger.info(log.message)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        log.status = "error"
        log.message = str(exc)
        logger.exception("sync_matches failed")
    finally:
        db.add(log)
        db.commit()
    return updated
