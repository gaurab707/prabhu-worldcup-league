"""ORM models for the World Cup Prediction League.

Tables: users, teams, matches, predictions, payments, point_history,
settings, winners, audit_logs, scheduler_logs.

Leaderboard is computed on demand from point_history + predictions (a
materialised leaderboard table would add write-amplification for little gain
at office scale), so it is exposed as a query rather than a stored table.
"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


# --------------------------------------------------------------------------
# Enums
# --------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    admin = "admin"
    staff = "staff"


class UserStatus(str, enum.Enum):
    pending = "pending"      # registered, payment not verified
    active = "active"        # verified, can log in
    rejected = "rejected"    # payment rejected
    disabled = "disabled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class MatchStatus(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    finished = "finished"
    postponed = "postponed"
    cancelled = "cancelled"


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.staff, nullable=False)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.pending, nullable=False)

    # denormalised running total for fast leaderboard sort; recomputed by scorer
    total_points: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Payment.user_id",
    )
    point_history: Mapped[list["PointHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")


# --------------------------------------------------------------------------
# Teams
# --------------------------------------------------------------------------
class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    short_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)   # e.g. ARG
    flag_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    group_name: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)   # e.g. Group A
    external_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True) # id from data source


# --------------------------------------------------------------------------
# Matches
# --------------------------------------------------------------------------
class Match(Base, TimestampMixin):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)

    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)

    kickoff_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    venue: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    group_name: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    round_name: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)  # Group Stage / Round of 16 ...

    status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus), default=MatchStatus.scheduled, nullable=False)

    # Regulation (90' + ET) result
    home_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    away_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Penalty shootout result (knockout only)
    is_penalty: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    home_penalty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    away_penalty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Manual lock override; if null the match locks automatically at kickoff.
    lock_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    manually_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # When true, staff may see each other's predictions for this finished match.
    predictions_revealed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Marks that scoring has been applied so we do not double-award.
    scored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    home_team: Mapped["Team"] = relationship(foreign_keys=[home_team_id])
    away_team: Mapped["Team"] = relationship(foreign_keys=[away_team_id])
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="match", cascade="all, delete-orphan")


# --------------------------------------------------------------------------
# Predictions
# --------------------------------------------------------------------------
class Prediction(Base, TimestampMixin):
    __tablename__ = "predictions"
    __table_args__ = (UniqueConstraint("user_id", "match_id", name="uq_user_match"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)

    pred_home_score: Mapped[int] = mapped_column(Integer, nullable=False)
    pred_away_score: Mapped[int] = mapped_column(Integer, nullable=False)
    # optional shootout prediction (only meaningful for knockout matches)
    pred_home_penalty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pred_away_penalty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Points breakdown, filled once the match is scored.
    outcome_points: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    closeness_points: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    penalty_points: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    difficulty_multiplier: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    points_awarded: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_scored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="predictions")
    match: Mapped["Match"] = relationship(back_populates="predictions")


# --------------------------------------------------------------------------
# Champion (World Cup winner) prediction
# --------------------------------------------------------------------------
class ChampionPrediction(Base, TimestampMixin):
    """A player's single, one-time pick for the eventual World Cup champion.

    Business rules enforced elsewhere:
      * One row per user (``user_id`` is unique).
      * Immutable once created - there is no update endpoint, so a player can
        never change which country they backed. This is the whole point of the
        feature ("predict at the start, locked forever").
      * Settled by an admin when the tournament ends: correct pickers receive a
        configurable bonus that folds into their leaderboard total.
    """

    __tablename__ = "champion_predictions"
    __table_args__ = (UniqueConstraint("user_id", name="uq_champion_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)

    # Filled when the admin declares the real champion.
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    points_awarded: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_settled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship()
    team: Mapped["Team"] = relationship()


# --------------------------------------------------------------------------
# Payments
# --------------------------------------------------------------------------
class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    screenshot_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False)
    verified_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="payments", foreign_keys=[user_id])


# --------------------------------------------------------------------------
# Point history (audit trail of every award, powers "points over time" chart)
# --------------------------------------------------------------------------
class PointHistory(Base, TimestampMixin):
    __tablename__ = "point_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False)
    points: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), default="match_result")

    user: Mapped["User"] = relationship(back_populates="point_history")


# --------------------------------------------------------------------------
# Settings (single-row key/value: QR image, logo, banner text, ...)
# --------------------------------------------------------------------------
class Setting(Base, TimestampMixin):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


# --------------------------------------------------------------------------
# Winners (podium)
# --------------------------------------------------------------------------
class Winner(Base, TimestampMixin):
    __tablename__ = "winners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)  # 1,2,3
    prize: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    prize_amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship()


# --------------------------------------------------------------------------
# Audit + scheduler logs
# --------------------------------------------------------------------------
class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class SchedulerLog(Base, TimestampMixin):
    __tablename__ = "scheduler_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)  # success / error
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    matches_updated: Mapped[int] = mapped_column(Integer, default=0)
