# 🏆 Prabhu Capital — World Cup Prediction League

An internal, office-wide FIFA World Cup prediction game. Colleagues register, pay a
small entry fee, predict every fixture, and earn points on a **fair weighted scoring
system** that rewards being *close* — not just exactly right. A live leaderboard,
per-player analytics, an admin console, and an auto-calculated winners' podium round it out.

Built with **FastAPI + SQLite** on the backend and **React + TypeScript + MUI** on the
frontend, packaged to run on a single office machine and be reached by everyone on the
local network.

---

## ✨ Highlights

- **Weighted scoring, not exact-match.** A correct 2–1 call and a "close" 3–1 both score
  — the closer you are, the more you earn. Underdog picks that few others got right earn a
  popularity bonus. Full formula in [`docs/SCORING.md`](docs/SCORING.md).
- **Registration with payment verification.** New members upload a payment screenshot and
  stay *pending* until an admin verifies them.
- **Live leaderboard & personal dashboard** with points-over-time, rank, and accuracy.
- **Admin console** — manage fixtures, enter results (which auto-rescore everyone),
  verify payments, run the data sync, and publish the podium.
- **Automatic fixture sync** from TheSportsDB every 15 minutes (configurable), so real
  results flow in without manual entry once the tournament is live.
- **One-click winners.** When the tournament ends the admin hits *Reveal winners* and the
  top three are taken straight from the leaderboard and shown with a celebration.
- **Premium glassmorphism UI** with dark/light modes, on-brand colours, and confetti for
  the winners.

---

## 🚀 Quick start

### Windows (easiest)
Double-click **`scripts/start_all.bat`**. It opens the backend and frontend in two
windows, installing everything on first run, and prints the LAN address to share.

### macOS / Linux
```bash
# Terminal 1 – backend
./scripts/start_backend.sh
# Terminal 2 – frontend
./scripts/start_frontend.sh
```

Then open **http://localhost:3000**.

### Default logins
| Role  | Email                        | Password    |
|-------|------------------------------|-------------|
| Admin | `admin@prabhucapital.com`    | `Admin@123` |

Staff accounts are **not** pre-created — colleagues sign up themselves on the Register
page, and the admin verifies their payment to activate them.

> ⚠️ **Change the admin password** after first login for real use, and set your own
> `SECRET_KEY` in `backend/.env`.

The database starts **clean** — just the admin account, ready for a real league. Teams are
created automatically (with flags for known countries) when you add fixtures, and real
fixtures/results can flow in from the automatic sync once the app is online.

---

## 🧭 First things an admin should do

1. Log in as admin → **Winners & Prizes** → upload your real **payment QR** and set the
   payment message. (New registrations show this QR.)
2. **Manage Games** → the seeded fixtures are samples; the scheduler will replace them
   with real ones once online, or add/edit them manually.
3. Share the LAN web address (see `scripts/show_ip.bat`) with colleagues.

---

## 🗂️ Project structure

```
prabhu-worldcup-league/
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── core/            config, security (JWT/bcrypt), logging, file uploads
│   │   ├── db/              SQLAlchemy engine & base
│   │   ├── models/          ORM models (users, matches, predictions, payments, …)
│   │   ├── schemas/         Pydantic request/response models
│   │   ├── services/        scoring engine, scraper, results, leaderboard, scheduler
│   │   ├── api/routers/     auth, matches, predictions, leaderboard, users,
│   │   │                    payments, settings, stats, winner, admin
│   │   ├── bootstrap.py     seeds the default admin + settings on first boot
│   │   └── main.py          app factory, CORS, rate limiting, lifespan
│   ├── alembic/             database migrations
│   ├── tests/               scoring unit tests (pytest)
│   ├── seed.py              sample data loader
│   └── requirements.txt
├── frontend/                React + TypeScript + Vite + MUI
│   └── src/
│       ├── api/             typed API client + types
│       ├── context/         auth + colour-mode providers
│       ├── components/      layout, cards, countdown, guards
│       ├── pages/           dashboard, predictions, leaderboard, profile, winners, …
│       └── pages/admin/     admin dashboard, games, users, payments, winners
├── scripts/                 Windows .bat + macOS/Linux .sh launchers
└── docs/                    INSTALL, SCORING, ADMIN_MANUAL, API, DEPLOYMENT
```

---

## 🛠️ Tech stack

**Backend:** Python 3.12, FastAPI, SQLAlchemy 2, SQLite, Alembic, APScheduler,
python-jose (JWT), bcrypt, slowapi (rate limiting), Requests + BeautifulSoup (scraping).

**Frontend:** React 18, TypeScript, Vite, MUI 6, TanStack Query, Axios, Recharts,
notistack, canvas-confetti.

---

## 📚 Documentation

| Doc | What's inside |
|-----|----------------|
| [`docs/INSTALL.md`](docs/INSTALL.md)         | Detailed manual setup & prerequisites |
| [`docs/SCORING.md`](docs/SCORING.md)         | The full weighted scoring formula, worked examples |
| [`docs/ADMIN_MANUAL.md`](docs/ADMIN_MANUAL.md) | Running the league day-to-day |
| [`docs/API.md`](docs/API.md)                 | REST endpoint reference |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)   | LAN deployment, configuration, backup & restore |

---

## ✅ Testing

```bash
cd backend && source .venv/bin/activate
pytest -q          # scoring engine unit tests
```

---

*Internal tool for Prabhu Capital. Company logo and branding are property of Prabhu Capital.*
