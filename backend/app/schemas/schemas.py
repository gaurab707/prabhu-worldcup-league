"""Pydantic v2 schemas for request validation and response serialisation."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.models import MatchStatus, PaymentStatus, UserRole, UserStatus


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    department: Optional[str] = Field(default=None, max_length=120)
    password: str = Field(min_length=1, max_length=200)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    department: Optional[str] = None
    role: UserRole
    status: UserStatus
    total_points: float
    created_at: datetime


class UserAdminOut(UserOut):
    payment_status: Optional[PaymentStatus] = None


# --------------------------------------------------------------------------
# Teams / Matches
# --------------------------------------------------------------------------
class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    short_code: Optional[str] = None
    flag_url: Optional[str] = None
    group_name: Optional[str] = None


class MatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    home_team: TeamOut
    away_team: TeamOut
    kickoff_at: datetime
    venue: Optional[str] = None
    group_name: Optional[str] = None
    round_name: Optional[str] = None
    status: MatchStatus
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    is_penalty: bool = False
    home_penalty: Optional[int] = None
    away_penalty: Optional[int] = None
    predictions_revealed: bool = False
    manually_locked: bool = False
    is_locked: bool = False               # computed
    my_prediction: Optional["PredictionOut"] = None  # populated per-request


class MatchCreate(BaseModel):
    home_team: str
    away_team: str
    kickoff_at: datetime
    venue: Optional[str] = None
    group_name: Optional[str] = None
    round_name: Optional[str] = None


class MatchUpdate(BaseModel):
    kickoff_at: Optional[datetime] = None
    venue: Optional[str] = None
    group_name: Optional[str] = None
    round_name: Optional[str] = None
    status: Optional[MatchStatus] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    is_penalty: Optional[bool] = None
    home_penalty: Optional[int] = None
    away_penalty: Optional[int] = None
    manually_locked: Optional[bool] = None
    predictions_revealed: Optional[bool] = None


# --------------------------------------------------------------------------
# Predictions
# --------------------------------------------------------------------------
class PredictionCreate(BaseModel):
    match_id: int
    pred_home_score: int = Field(ge=0, le=30)
    pred_away_score: int = Field(ge=0, le=30)
    pred_home_penalty: Optional[int] = Field(default=None, ge=0, le=30)
    pred_away_penalty: Optional[int] = Field(default=None, ge=0, le=30)


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    match_id: int
    pred_home_score: int
    pred_away_score: int
    pred_home_penalty: Optional[int] = None
    pred_away_penalty: Optional[int] = None
    outcome_points: float
    closeness_points: float
    penalty_points: float
    difficulty_multiplier: float
    points_awarded: float
    is_scored: bool


# --------------------------------------------------------------------------
# Champion (World Cup winner) prediction
# --------------------------------------------------------------------------
class ChampionPickCreate(BaseModel):
    """Payload for a one-time champion pick."""
    team_id: int = Field(gt=0)


class ChampionPickOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    team_id: int
    team: TeamOut
    is_correct: bool
    points_awarded: float
    is_settled: bool
    created_at: datetime


class ChampionStatus(BaseModel):
    """Everything a player needs to render the champion screen."""
    is_open: bool                       # picking currently allowed
    deadline: Optional[datetime] = None
    is_settled: bool = False            # winner declared
    bonus_points: int = 0               # points a correct pick earns
    prize: Optional[str] = None
    prize_amount: Optional[int] = None
    entry_fee: int = 0
    total_picks: int = 0
    my_pick: Optional[ChampionPickOut] = None
    actual_team: Optional[TeamOut] = None   # revealed only after settlement


class ChampionConfigUpdate(BaseModel):
    """Admin: configure the champion-pick window and prize."""
    is_open: Optional[bool] = None
    deadline: Optional[datetime] = None
    clear_deadline: bool = False
    bonus_points: Optional[int] = Field(default=None, ge=0, le=100000)
    prize: Optional[str] = Field(default=None, max_length=120)
    prize_amount: Optional[int] = Field(default=None, ge=0)


class ChampionSettleRequest(BaseModel):
    """Admin: declare the actual champion and award bonuses."""
    team_id: int = Field(gt=0)


class ChampionTeamTally(BaseModel):
    team_id: int
    name: str
    short_code: Optional[str] = None
    flag_url: Optional[str] = None
    count: int


class ChampionAdminSummary(BaseModel):
    is_open: bool
    deadline: Optional[datetime] = None
    is_settled: bool
    bonus_points: int
    prize: Optional[str] = None
    prize_amount: Optional[int] = None
    total_picks: int
    actual_team_id: Optional[int] = None
    actual_team: Optional[TeamOut] = None
    tally: list[ChampionTeamTally] = []


# --------------------------------------------------------------------------
# Payments
# --------------------------------------------------------------------------
class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    amount: int
    status: PaymentStatus
    remarks: Optional[str] = None
    screenshot_path: Optional[str] = None
    created_at: datetime


class PaymentReview(BaseModel):
    approve: bool
    note: Optional[str] = None


# --------------------------------------------------------------------------
# Settings / Winner / Stats
# --------------------------------------------------------------------------
class SettingOut(BaseModel):
    key: str
    value: Optional[str] = None


class WinnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    position: int
    user_id: int
    name: str = ""
    department: Optional[str] = None
    prize: Optional[str] = None
    prize_amount: Optional[int] = None
    notes: Optional[str] = None
    points: float = 0.0
    published: bool = False


class WinnerUpsert(BaseModel):
    position: int = Field(ge=1, le=3)
    user_id: int
    prize: Optional[str] = None
    prize_amount: Optional[int] = None
    notes: Optional[str] = None


class LeaderboardRow(BaseModel):
    rank: int
    user_id: int
    name: str
    department: Optional[str] = None
    points: float
    played: int
    accuracy: float
    winner_pct: float
    score_pct: float
    penalty_pct: float


class DashboardStats(BaseModel):
    total_users: int
    verified_users: int
    pending_payments: int
    upcoming_games: int
    completed_games: int
    total_predictions: int
    prize_pool: int


# Resolve forward refs
Token.model_rebuild()
MatchOut.model_rebuild()
