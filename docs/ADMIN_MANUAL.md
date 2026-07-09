# 👔 Admin Manual — Running the League

Everything an administrator needs to run the office World Cup game, start to finish.

Log in with the admin account (`admin@prabhucapital.com` / `Admin@123` by default). Admins
see an extra **Administration** section in the sidebar.

---

## Before the tournament

### 1. Set up payments & branding
Go to **Winners & Prizes → Payment & branding**:
- **Upload the payment QR** colleagues will scan (eSewa / Khalti / bank QR, etc.).
- **Edit the payment instructions** — e.g. *"Pay Rs. 1000 and write your full name in the
  remarks."* This text appears on the registration screen.
- Optionally replace the **company logo**.

> New members can't complete registration usefully until the QR is uploaded, so do this first.

### 2. Add the fixtures
Go to **Manage Games**. The database starts empty, so you populate it one of two ways:
- Let the **automatic sync** pull in real World Cup fixtures once the app is online (it
  runs every 15 minutes), **or**
- Add them yourself with **New match** (enter team names, kickoff time, round, venue).
  Well-known national teams get their flag automatically.

---

## Onboarding colleagues

1. Share the **web address** with everyone on the office network — run
   `scripts/show_ip.bat` (Windows) or `scripts/show_ip.sh` to get it, e.g.
   `http://192.168.1.25:3000`.
2. Each person **registers**, pays, and uploads their payment screenshot.
3. You **verify** them: **Payments → Pending**. Each card shows the person, amount, remarks,
   and their screenshot (click to enlarge). Hit **Verify** to activate their account, or
   **Reject**. Verifying flips their account to *active* and lets them log in.

You can also manage accounts directly under **Users** — search, see payment status and
points, and set any account to active / disabled / pending.

---

## During the tournament

### Entering results
When a match ends, go to **Manage Games → (scoreboard icon)** on that fixture:
- Enter the **final score**.
- If it went to a **penalty shootout**, toggle it on and enter the shootout score.
- Set status to **finished** and save.

Saving a finished result **automatically scores every prediction** for that match and
updates the leaderboard. (If the automatic sync is on, real results may already be filled
in for you.)

### Locking predictions
Predictions lock automatically at kickoff. To lock earlier (or reopen), use the **lock icon**
on the fixture row.

### Revealing predictions
By default players only see their own picks. After a match finishes you can **reveal
everyone's predictions** for it (the eye icon) so people can compare.

### Data controls (Admin → Overview)
- **Sync now** — pull the latest fixtures/results immediately instead of waiting for the
  timer.
- **Recalculate** — re-score every finished match and rebuild all totals. Safe to run any
  time; use it after correcting a scoreline.
- The **Scheduler activity** panel shows recent automatic sync runs and any errors.

---

## Analytics

**Admin → Overview** gives you the league at a glance: total/verified users, pending
payments, prize pool, games played/upcoming, plus charts of the most-predicted teams and
scorelines.

---

## Ending the league — crowning winners

Winners are **calculated automatically** from the leaderboard — you don't pick them by hand.

1. Go to **Winners & Prizes → Final podium**. It shows the current top three by total points.
2. When the tournament is over and all results are in, click **Reveal winners**. The app
   captures the current top three, publishes the podium, and takes you straight to the
   **Winners** page where it appears with a rising-podium animation and confetti 🎉 for
   everyone.
3. Need to correct a late result? Enter it in **Manage Games**, then click **Re-reveal
   winners** to refresh the podium. Use **Hide** to take it back down at any time.

Edit the celebratory banner text under *Winners & Prizes → Payment & branding → Winner
banner text*.

---

## Good practice

- **Change the admin password** and set a unique `SECRET_KEY` in `backend/.env` for real use.
- **Back up** `backend/database/worldcup.db` regularly (see `docs/DEPLOYMENT.md`). It holds
  everything — users, predictions, results, payments.
- Enter results promptly so the leaderboard stays live and people stay engaged.
