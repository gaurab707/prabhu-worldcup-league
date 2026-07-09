"""Import all models here so Alembic + create_all can see the metadata."""
from app.db.base_class import Base  # noqa: F401
from app.models.models import (  # noqa: F401
    AuditLog,
    Match,
    Payment,
    PointHistory,
    Prediction,
    SchedulerLog,
    Setting,
    Team,
    User,
    Winner,
)
