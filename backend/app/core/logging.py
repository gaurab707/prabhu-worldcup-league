"""Central logging configuration."""
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core.config import BASE_DIR

_LOG_DIR = BASE_DIR / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once, with console + rotating file handlers."""
    root = logging.getLogger()
    if root.handlers:  # already configured
        return
    root.setLevel(level)

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(logging.Formatter(_FORMAT))
    root.addHandler(console)

    file_handler = RotatingFileHandler(
        _LOG_DIR / "app.log", maxBytes=2_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(logging.Formatter(_FORMAT))
    root.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
