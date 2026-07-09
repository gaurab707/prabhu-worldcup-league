# 🚀 Deployment, Backup & Restore

The app is designed to run on **one office machine** (a "server" PC) and be used by
everyone else through their browsers on the same local network. No cloud or internet
hosting is required.

---

## 1. Pick a host machine

Choose a PC that stays on during office hours. Everything runs there: the API (port 8000),
the web app (port 3000), and the SQLite database file.

---

## 2. Find the host's LAN IP

Run `scripts/show_ip.bat` (Windows) or `scripts/show_ip.sh` (mac/Linux). You'll get
something like:

```
Web app : http://192.168.1.25:3000
API     : http://192.168.1.25:8000
```

Use the `192.168.x.x` or `10.x.x.x` address (not `127.0.0.1`).

---

## 3. Point the frontend at the host API  ⚠️ important

So other machines' browsers can reach the backend, edit **`frontend/.env`**:

```
VITE_API_URL=http://192.168.1.25:8000
```

(Use *your* host IP.) Then restart the frontend. If you skip this, only the host machine
can log in — everyone else will get network errors, because their browsers would try to
reach the API at their *own* `localhost`.

---

## 4. Start both servers

Use `scripts/start_all.bat`, or start the backend and frontend individually. Both already
bind to `0.0.0.0`, so they accept connections from the whole LAN.

---

## 5. Share the web address

Give colleagues the **web app** URL (`http://192.168.1.25:3000`). That's all they need —
they register and play in the browser.

---

## Firewall

On the host, Windows may prompt to allow Python/Node through the firewall the first time —
click **Allow** (Private networks). If colleagues still can't connect, add inbound rules
for TCP **3000** and **8000** on the Private profile.

---

## Production hardening (recommended for real use)

- **Change `SECRET_KEY`** in `backend/.env` to a long random string (this signs login
  tokens).
- **Change the admin password** after first login.
- Optionally restrict `CORS_ORIGINS` in `backend/.env` to your host address instead of `*`.
- For a more permanent setup you can serve the built frontend (`npm run build` → `dist/`)
  behind the backend or a static server, and run uvicorn with `--workers` behind a process
  manager. For an office game, the dev servers are perfectly fine.

---

## Backup

**Everything** lives in one file: `backend/database/worldcup.db` (plus uploaded images in
`backend/uploads/`). To back up, simply copy them.

**Windows:**
```bat
copy backend\database\worldcup.db backups\worldcup-%date:~-4%%date:~4,2%%date:~7,2%.db
xcopy /e /i /y backend\uploads backups\uploads
```

**mac/Linux:**
```bash
cp backend/database/worldcup.db "backups/worldcup-$(date +%Y%m%d).db"
cp -r backend/uploads "backups/uploads-$(date +%Y%m%d)"
```

SQLite runs in WAL mode; for a guaranteed-consistent copy, stop the backend first (or copy
the `.db`, `.db-wal`, and `.db-shm` files together). For an office workload, a plain copy
while running is normally fine.

**Tip:** schedule a daily copy with Task Scheduler (Windows) or `cron` (mac/Linux).

---

## Restore

1. Stop the backend.
2. Replace `backend/database/worldcup.db` with your backup copy (and restore
   `backend/uploads/` if needed).
3. Start the backend again. Done — all users, predictions, results, and payments are back.

---

## Moving to a new machine

Copy the **entire project folder** (or just re-extract it) to the new host, then copy your
backed-up `worldcup.db` into `backend/database/` and `uploads/` into `backend/`. Update
`VITE_API_URL` to the new host's IP and start the servers.
