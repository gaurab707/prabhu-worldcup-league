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
    "AET": MatchStatus.finished,             # decided after extra time
    "After Extra Time": MatchStatus.finished,
    "AP": MatchStatus.finished,              # decided after penalties
    "PEN": MatchStatus.finished,
    "After Penalties": MatchStatus.finished,
    "Not Started": MatchStatus.scheduled,
    "NS": MatchStatus.scheduled,
    "1H": MatchStatus.live,
    "2H": MatchStatus.live,
    "HT": MatchStatus.live,                  # half time
    "ET": MatchStatus.live,                  # extra time in progress
    "BT": MatchStatus.live,                  # break before extra time
    "P": MatchStatus.live,                   # penalty shootout in progress
    "LIVE": MatchStatus.live,
    "Postponed": MatchStatus.postponed,
    "PST": MatchStatus.postponed,
    "Cancelled": MatchStatus.cancelled,
    "Abandoned": MatchStatus.cancelled,
    "ABD": MatchStatus.cancelled,
}

# Status strings that mean the match was (or is being) decided by a shootout.
_PENALTY_STATUSES = {"AP", "PEN", "After Penalties", "P"}


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


def _parse_penalties(event: dict) -> tuple[bool, Optional[int], Optional[int]]:
    """Detect a penalty shootout and, if present, its score.

    TheSportsDB's free feed doesn't guarantee a penalty field, so we (a) flag a
    shootout from the status text, and (b) read the shootout score from any of a
    few possible field names when the feed provides them. When the score isn't in
    the feed we still set the flag, so the shootout shows as pending and the admin
    can enter the two numbers.
    """
    status = (event.get("strStatus") or "").strip()
    is_pen = status in _PENALTY_STATUSES
    for hk, ak in (
        ("intHomeScorePenalty", "intAwayScorePenalty"),
        ("intHomePenalty", "intAwayPenalty"),
        ("strHomePenalty", "strAwayPenalty"),
    ):
        h, a = _to_int(event.get(hk)), _to_int(event.get(ak))
        if h is not None and a is not None:
            return True, h, a
    return is_pen, None, None


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
    is_pen, home_pen, away_pen = _parse_penalties(event)
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
        # intHomeScore/intAwayScore is the on-field score (includes extra-time
        # goals for AET matches); we sync it live and when finished.
        "home_score": _to_int(event.get("intHomeScore")),
        "away_score": _to_int(event.get("intAwayScore")),
        "is_penalty": is_pen,
        "home_penalty": home_pen,
        "away_penalty": away_pen,
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


# How far apart the admin's entered kickoff and the feed's kickoff may be and
# still count as "the same fixture" when adopting a hand-created match. Two days
# is comfortably wide enough to absorb time-zone/entry differences while still
# being unique for a given pair of teams in a tournament.
_ADOPT_WINDOW_SECONDS = 48 * 3600


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _flip_event(ev: dict) -> dict:
    """Return a copy of a feed event with home/away (and their scores) swapped.

    Used when an admin entered the two teams in the opposite order to the feed:
    we keep the admin's orientation (predictions are stored against it) and flip
    the incoming data so it is applied the right way round.
    """
    e = dict(ev)
    e["home"], e["away"] = ev["away"], ev["home"]
    e["home_badge"], e["away_badge"] = ev.get("away_badge"), ev.get("home_badge")
    e["home_score"], e["away_score"] = ev.get("away_score"), ev.get("home_score")
    e["home_penalty"], e["away_penalty"] = ev.get("away_penalty"), ev.get("home_penalty")
    return e


def _find_manual_match(db: Session, team_a_id: int, team_b_id: int, kickoff: datetime):
    """Find an admin-created match (no external_id) for the same fixture.

    Matches the same *pair* of teams (either home/away orientation) with a
    kickoff within ``_ADOPT_WINDOW_SECONDS``. Returns the Match or None.
    """
    ko = _as_utc(kickoff)
    pair = {team_a_id, team_b_id}
    for m in db.scalars(select(Match).where(Match.external_id.is_(None))).all():
        if {m.home_team_id, m.away_team_id} != pair or m.kickoff_at is None:
            continue
        if abs((_as_utc(m.kickoff_at) - ko).total_seconds()) <= _ADOPT_WINDOW_SECONDS:
            return m
    return None


def _upsert_match(db: Session, ev: dict) -> bool:
    """Insert or update a single match. Returns True if a change was made."""
    match = db.scalar(select(Match).where(Match.external_id == ev["external_id"]))

    # ADOPT a hand-created match, if one exists for this fixture. An admin can add
    # a match by hand before the data provider lists it (the free feed only exposes
    # one upcoming game at a time). That row has no external_id; when the feed finally
    # carries the fixture we link it to that row and keep updating it live - instead
    # of inserting a duplicate. We look teams up by name here (without creating them)
    # and adopt regardless of the feed status, so a result flows into the row too.
    adopted = False
    if match is None:
        ht = db.scalar(select(Team).where(Team.name == ev["home"]))
        at = db.scalar(select(Team).where(Team.name == ev["away"]))
        if ht is not None and at is not None:
            cand = _find_manual_match(db, ht.id, at.id, ev["kickoff_at"])
            if cand is not None:
                cand.external_id = ev["external_id"]
                # If the admin entered the teams the other way round, keep their
                # orientation and flip the feed data to match.
                if cand.home_team_id == at.id and cand.away_team_id == ht.id:
                    ev = _flip_event(ev)
                match = cand
                adopted = True

    # For a league that starts mid-tournament, do not ADD games nobody could have
    # predicted. The stable signal for that is the match being *finished* - NOT a
    # "kickoff < now" test. Keying the skip off the clock is a trap: a match that
    # is skipped is never inserted, so every later scrape still sees it as new and
    # skips it again -> it is dropped permanently. A single scrape that lands even
    # a second after kickoff (app was down, fixture published late, or an early
    # kickoff that is already past in UTC) would erase an otherwise-upcoming match
    # forever. So we only refuse games that have already finished; upcoming and
    # in-progress games are always ingested and simply lock at kickoff as usual.
    if match is None and settings.SPORTSDB_INGEST_FUTURE_ONLY:
        if ev.get("status") == MatchStatus.finished:
            return False

    home = _get_or_create_team(db, ev["home"], ev["home_badge"])
    away = _get_or_create_team(db, ev["away"], ev["away_badge"])

    changed = adopted   # linking a hand-created match to the feed is itself a change
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
        # Follow the source while WE haven't finalised the match; never downgrade
        # a finished match back to live/scheduled. Kickoff only moves before start.
        if match.status != MatchStatus.finished:
            if match.status == MatchStatus.scheduled and match.kickoff_at != ev["kickoff_at"]:
                match.kickoff_at = ev["kickoff_at"]; changed = True
            if ev["status"] != match.status:
                match.status = ev["status"]; changed = True

    # --- On-field score: kept in sync LIVE and when finished. The source score
    #     already includes extra-time goals (AET), so ET needs no special case. ---
    if ev["home_score"] is not None and ev["away_score"] is not None:
        if match.home_score != ev["home_score"] or match.away_score != ev["away_score"]:
            match.home_score = ev["home_score"]
            match.away_score = ev["away_score"]
            match.scored = False        # (re)award once the match settles
            changed = True

    # --- Penalty shootout: flag it, and store the shootout score when available. ---
    if ev.get("is_penalty") and not match.is_penalty:
        match.is_penalty = True; changed = True
    if ev.get("home_penalty") is not None and ev.get("away_penalty") is not None:
        if match.home_penalty != ev["home_penalty"] or match.away_penalty != ev["away_penalty"]:
            match.home_penalty = ev["home_penalty"]
            match.away_penalty = ev["away_penalty"]
            match.scored = False
            changed = True

    # --- Finished: mark it (status finish) and queue automatic (re)scoring. ---
    if ev["status"] == MatchStatus.finished and match.status != MatchStatus.finished:
        match.status = MatchStatus.finished
        match.scored = False
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
