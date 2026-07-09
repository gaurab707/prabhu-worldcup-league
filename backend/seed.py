"""Initialize the database for a LIVE launch.

This creates ONLY what the app needs to start:
  - the database tables
  - the default admin account
  - the core branding / payment settings

No demo users, teams, matches or predictions are created. Teams are created
automatically (with flags for known countries) when the admin adds fixtures,
and real fixtures/results flow in from the automatic sync once online.

Run with:  python seed.py
Safe to run multiple times (it won't duplicate the admin or settings).
"""
from __future__ import annotations

from app.bootstrap import create_tables, ensure_admin_and_settings
from app.core.config import settings


def main() -> None:
    create_tables()
    ensure_admin_and_settings()
    print("Database initialized for live use (admin + settings only, no demo data).")
    print(f"Admin login: {settings.ADMIN_EMAIL}  /  {settings.ADMIN_PASSWORD}")
    print("Remember to change the admin password after first login.")


if __name__ == "__main__":
    main()
