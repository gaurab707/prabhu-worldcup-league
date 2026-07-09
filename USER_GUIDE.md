# Prabhu Capital — World Cup Prediction League
## How to use it (Admin & Staff guide)

This explains how to open the app, **where games are listed and what staff see**,
how to run the **Admin** side, and how scoring and privacy work. It matches the
current build.

---

### 1. Opening the app

| What | Address |
|------|---------|
| The app everyone uses | **http://localhost:3000** |
| Technical API docs (optional) | http://localhost:8000/docs |

- **First time:** double-click `SETUP_AND_RUN.bat`. It installs everything, starts
  both servers in their own windows, and opens your browser automatically.
- **After that:** just double-click `run-api.bat` and `run-web.bat`.
- Keep the two server windows open while people are using the app; closing them
  stops the app.

**Admin login:** `admin@prabhucapital.com` / `Admin@123`
Staff create their own accounts on the **Register** page.

---

### 2. What a STAFF member sees

After a staff member registers, their account is **Pending** until an admin
verifies their payment. Once **Active**, they can predict. Their menu has
**Dashboard**, **Predictions**, **World Cup Winner**, **Leaderboard**, and
**Winners**.

**Predictions** is the heart of it, with two tabs:

- **Upcoming** — one card per game that hasn't kicked off yet. The staff member
  taps the + / − steppers to set a score for each team and presses **Save
  prediction** (they can change it any time until kickoff, after which it locks).
  For knockout games they've drawn, a penalty-shootout predictor appears.
- **Completed** — one card per finished game, showing the **final score**, what
  **they** predicted, and the **points they personally earned** for that game
  (with a small breakdown: W = correct result, S = score closeness, P = penalty,
  ×N = underdog bonus). If a game shows **"Awaiting scoring"**, it either hasn't
  been scored yet or they didn't predict it.

**Privacy (important):** on the Completed tab each person sees **only their own**
prediction and points — never anyone else's. The **Leaderboard** shows everyone's
running **total** points and accuracy (that's the ranking), but not the game-by-game
breakdown of other people. An admin can optionally "reveal" a finished game so
staff can compare picks, and even then no names are attached.

---

### 2b. World Cup Winner — the champion prediction (with prize)

**World Cup Winner** is a separate, one-time prediction: each player picks the
**country they think will win the whole tournament**.

- It's a **single pick, and it's permanent** — once locked in, it can **never** be
  changed (unlike match predictions, which stay editable until kickoff). A
  confirmation step makes sure the player is certain.
- Players pick from a searchable list of countries (flags included). If the admin
  set a **deadline**, picking closes then.
- There's a **prize**: whoever correctly predicts the champion earns a big
  **bonus** (default **500 points**), plus whatever cash prize the admin
  configures. Those bonus points fold straight into the **Leaderboard** total, so
  a correct champion pick can decide the whole league.
- When the tournament ends and the admin **declares the winner**, each player
  immediately sees whether they were right and how many bonus points they earned.
  The Dashboard also shows a reminder to pick (and later, the result).

---

### 3. Running the ADMIN side — Manage Games

Everything about fixtures is on **Admin → Manage Games**. Top-right buttons:

- **New match** — add a game by hand: home team, away team, kickoff date/time,
  round (e.g. "Group Stage"), venue. This is the most **reliable** way to add the
  exact games you want.
- **Sync now** — pull fixtures and results from the internet automatically. To
  keep a league that starts mid-tournament clean, **only games in the future are
  added** — already-finished games are ignored.
- **Clear all** — wipe **every** fixture, prediction and awarded point and reset
  all totals to zero (teams are kept). Use this to start from a clean slate.

For each game in the list you can:

- **Enter result** (the scoreboard icon) — type the final score and save. The game
  is marked finished and **everyone's points are calculated instantly** — staff see
  their points immediately on their Completed tab and the Leaderboard updates.
- **Lock / unlock** predictions manually.
- **Reveal predictions** (after a game is finished) if you want staff to see each
  other's picks for that game.

Other admin areas: verify staff payments, upload the payment QR and company logo,
run the **Champion Prize** for the World Cup winner prediction (below), and publish
the top-3 **winners** at the end.

---

### 3b. Running the ADMIN side — Champion Prize

**Admin → Champion Prize** controls the World Cup winner prediction:

- **Open / close picking** and set an optional **deadline** after which players
  can no longer pick.
- Set the **bonus points** a correct pick earns (default 500) and the **prize**
  (name + Rs. amount) that players see.
- Watch the live **pick distribution** — a bar chart of how many people backed
  each country.
- **Declare the champion** when the final is over: choose the winning country and
  confirm. Everyone who picked it is instantly awarded the bonus, and the
  Leaderboard updates. Made a mistake? **Undo declaration** clears the bonuses and
  re-opens picking so you can redeclare.

---

### 4. Why "Upcoming" was empty (and how to fix it going forward)

The automatic sync uses TheSportsDB's **free** data. For the 2026 World Cup that
free data is patchy — it may return a few finished warm-up games but not a clean
list of upcoming fixtures. The app previously also used an out-of-date key/season
and never asked for upcoming fixtures specifically; that has been corrected, and
the sync now (a) asks for upcoming fixtures directly and (b) never re-adds
already-finished games.

**The dependable way to run an office league is to add the games yourself:**

1. **Admin → Manage Games → Clear all** (remove the old finished games).
2. Add the upcoming games with **New match** (or try **Sync now** first — if it
   brings in the right upcoming games, great; if not, add them by hand).
3. Staff predict them on their **Upcoming** tab.
4. After each game, **enter the result** — points update instantly and privately.
5. At the end, publish the winners.

---

### 5. How points are scored (summary)

Each game is worth up to ~100 points:

- **Result (up to 40)** — correct win/draw/loss.
- **Closeness (up to 40)** — how near your scoreline was to the real one.
- **Penalty (up to 20)** — only for shootout games.
- **Underdog bonus (×, up to +50%)** — if few people got the result right, those
  who did earn more.

Full detail is in `docs/SCORING.md`.
