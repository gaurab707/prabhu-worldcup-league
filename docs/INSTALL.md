# 🧰 Installation & Setup

## Prerequisites

- **Python 3.12+** — <https://www.python.org/downloads/> (tick "Add Python to PATH" on Windows)
- **Node.js 18+** (20/22 recommended) — <https://nodejs.org/>
- ~500 MB free disk space

Check they're installed:
```bash
python --version    # or python3 --version
node --version
npm --version
```

---

## Option A — one-click (Windows)

1. Extract the project somewhere convenient (e.g. `C:\worldcup-league`).
2. Open the `scripts` folder and double-click **`start_all.bat`**.
3. First run installs the Python venv and Node modules automatically (a few minutes),
   initializes the database (admin account only), then launches both servers.
4. Open **http://localhost:3000**.

---

## Option B — manual setup

### Backend
```bash
cd backend
python -m venv .venv

# activate:
#   Windows:  .venv\Scripts\activate
#   mac/Linux: source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env        # Windows   (mac/Linux: cp .env.example .env)
python seed.py                # create the admin account + settings (no demo data)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Backend is now at <http://localhost:8000> (Swagger at `/docs`).

### Frontend (second terminal)
```bash
cd frontend
npm install
copy .env.example .env        # mac/Linux: cp .env.example .env
npm run dev
```
Frontend is now at <http://localhost:3000>.

---

## Database migrations (optional)

The app **auto-creates** its tables on first boot, so migrations aren't required for normal
use. If you prefer managed migrations (or are upgrading a schema):

```bash
cd backend && source .venv/bin/activate
alembic upgrade head            # apply migrations
alembic revision --autogenerate -m "my change"   # after editing models
```

---

## Configuration

All backend settings live in `backend/.env` (see `.env.example` for the full list). The
important ones:

| Variable | Default | Notes |
|----------|---------|-------|
| `SECRET_KEY` | dev value | **Change for production** — signs JWT tokens. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@prabhucapital.com` / `Admin@123` | Seeded on first boot. |
| `ENTRY_FEE` | `1000` | Entry fee shown to members. |
| `SCHEDULER_ENABLED` | `true` | Background fixture sync on/off. |
| `SCHEDULER_INTERVAL_MINUTES` | `15` | Sync frequency. |
| `SCRAPER_ENABLED` | `true` | Toggle external data fetching. |
| `SPORTSDB_API_KEY` / `LEAGUE_ID` / `SEASON` | TheSportsDB free tier | Data source. |
| `CORS_ORIGINS` | `*` | Restrict for production if desired. |

Frontend config is `frontend/.env`:

| Variable | Default | Notes |
|----------|---------|-------|
| `VITE_API_URL` | `http://localhost:8000` | **Set to your machine's LAN IP** so other PCs can reach the API (see `docs/DEPLOYMENT.md`). |

---

## Resetting the database

Stop the backend, delete `backend/database/worldcup.db`, then run `python seed.py` again
(or just restart — an empty DB is created automatically, and the admin + settings are
re-seeded, but sample fixtures/users come only from `seed.py`).

---

## Troubleshooting

- **"python is not recognized"** → reinstall Python with "Add to PATH", or use `python3`.
- **Port already in use** → change the port in the launch command / `vite.config.ts`.
- **Other PCs can't log in** → `VITE_API_URL` still points at `localhost`. Set it to the
  host's LAN IP and restart the frontend. See `docs/DEPLOYMENT.md`.
- **Payment QR not showing on registration** → an admin must upload it under
  **Winners & Prizes → Payment & branding**.
