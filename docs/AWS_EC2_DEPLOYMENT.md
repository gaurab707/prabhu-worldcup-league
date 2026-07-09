# 🚀 Deploying to AWS EC2 (browse via Public IP)

This guide takes you from **nothing** to a **fully working** World Cup Prediction
League running on an AWS EC2 server that anyone can open in a browser at
`http://<YOUR-PUBLIC-IP>/`.

**How it runs in production**

```
            ┌──────────────────────── EC2 instance ────────────────────────┐
Browser ───▶│  nginx  (port 80, public)                                     │
            │    ├─ /            → React app (static files in /var/www)      │
            │    ├─ /api/...     → uvicorn  (FastAPI, 127.0.0.1:8000)        │
            │    └─ /uploads/... → uvicorn  (QR / logo / screenshots)        │
            │  uvicorn is managed by systemd (auto-restart, starts on boot) │
            │  SQLite database file lives in backend/database/worldcup.db    │
            └───────────────────────────────────────────────────────────────┘
```

Everything is reachable on **one address and one open port (80)**. The API is
**not** exposed directly — nginx is the only thing the public can reach, and the
frontend talks to the API on the *same origin*, so there are no CORS or
hard-coded-IP problems.

---

## Part A — Create the EC2 server

### 1. Launch an instance
In the AWS Console → **EC2** → **Launch instance**:

| Setting            | Choose                                                        |
| ------------------ | ------------------------------------------------------------ |
| **Name**           | `worldcup-league`                                            |
| **AMI**            | **Ubuntu Server 24.04 LTS** (or 22.04 LTS)                   |
| **Instance type**  | `t3.small` recommended (`t2.micro`/free-tier works for a small office) |
| **Key pair**       | Create/choose one and **download the `.pem`** — you need it to SSH |
| **Storage**        | 8–16 GB gp3 is plenty                                        |

### 2. Security Group (this is what makes it reachable) ⚠️
Add these **inbound** rules:

| Type       | Protocol | Port | Source              | Why                         |
| ---------- | -------- | ---- | ------------------- | --------------------------- |
| SSH        | TCP      | 22   | **My IP**           | so *you* can log in         |
| HTTP       | TCP      | 80   | **Anywhere (0.0.0.0/0)** | so everyone can open the app |

> You do **not** need to open port 8000 or 3000 — nginx serves everything on 80.

Launch the instance and wait until it shows **Running**. Note its
**Public IPv4 address** (e.g. `54.12.34.56`).

> **Tip:** a public IP changes if you stop/start the instance. For a permanent
> address, allocate an **Elastic IP** and associate it with the instance.

---

## Part B — Connect and get the code onto the server

### 3. SSH in
From your laptop (Mac/Linux, or Windows PowerShell):

```bash
chmod 400 worldcup-league.pem            # once (Mac/Linux)
ssh -i worldcup-league.pem ubuntu@<YOUR-PUBLIC-IP>
```

### 4. Copy the project to the server
Pick **one** option.

**Option 1 — upload the zip from your laptop** (run on your *laptop*, not the server):
```bash
scp -i worldcup-league.pem prabhu-worldcup-league.zip ubuntu@<YOUR-PUBLIC-IP>:~/
```
Then back **on the server**:
```bash
sudo apt-get update && sudo apt-get install -y unzip
unzip prabhu-worldcup-league.zip
cd prabhu-worldcup-league
```

**Option 2 — clone from Git** (if you pushed the project to a repo):
```bash
git clone <your-repo-url> prabhu-worldcup-league
cd prabhu-worldcup-league
```

---

## Part C — Deploy (the easy way)

### 5. Run the deploy script
From inside the project folder on the server:

```bash
sudo bash scripts/deploy_ec2.sh
```

This single command:
1. installs Python, Node.js 20, and nginx,
2. creates the Python virtualenv and installs backend dependencies,
3. writes `backend/.env` with a **strong random `SECRET_KEY`**,
4. builds the React frontend (same-origin API) and publishes it to nginx,
5. installs a **systemd** service so the API auto-restarts and starts on boot,
6. configures **nginx** on port 80,
7. prints your public URL and checks the API is healthy.

When it finishes you'll see:

```
✅ Deploy complete.
   OPEN IN YOUR BROWSER:   http://<YOUR-PUBLIC-IP>/
   Default admin login:  admin@prabhucapital.com  /  Admin@123
```

### 6. Open it 🎉
Visit **`http://<YOUR-PUBLIC-IP>/`** in any browser. Log in as the admin,
then hand the same URL to your colleagues — they register and play there.

---

## Part D — First-run setup (do this once, in the app)

1. **Log in** as admin (`admin@prabhucapital.com` / `Admin@123`).
2. **Change the admin password** — edit `backend/.env` on the server
   (`ADMIN_PASSWORD`) *before first run*, or create a new admin and disable this
   one. At minimum, treat the default as temporary.
3. **Upload the payment QR** (Admin → *Payments*/*Winners & Prizes* has the
   upload) and set the payment message.
4. **Set up the World Cup Winner prize** (the new feature): Admin →
   **Champion Prize**:
   - Toggle **Picking is OPEN**, optionally set a **deadline**,
   - Set the **bonus points** (default 500) and **prize** (name + Rs. amount),
   - Save. Players will now see **World Cup Winner** in their menu and can lock
     in one permanent pick.
   - When the tournament ends, come back here and **Declare the champion** — every
     correct picker is instantly awarded the bonus on the leaderboard.
5. **Add fixtures** (Admin → *Manage Games*), or use **Sync now** to pull them.

---

## Part E — Day-2 operations

### Redeploy after a code change / new upload
Upload the new files (or `git pull`), then just run the script again:
```bash
cd ~/prabhu-worldcup-league
sudo bash scripts/deploy_ec2.sh
```
It rebuilds the frontend and restarts the API. Your database and uploads are
untouched.

### Useful commands
```bash
# API status / logs
sudo systemctl status worldcup-api
sudo journalctl -u worldcup-api -f

# Restart just the API (e.g. after editing backend/.env)
sudo systemctl restart worldcup-api

# nginx
sudo nginx -t && sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log
```

### Back up (everything is one file + the uploads)
```bash
cp backend/database/worldcup.db ~/worldcup-$(date +%F).db
tar czf ~/uploads-$(date +%F).tgz backend/uploads
```
Download them with `scp` from your laptop, or schedule a daily `cron` copy.

---

## Part F — Troubleshooting

| Symptom                              | Fix                                                                 |
| ------------------------------------ | ------------------------------------------------------------------- |
| Browser can't reach the site at all  | Security Group is missing the **port 80** inbound rule. Add it.     |
| Page loads but login/actions fail    | `sudo systemctl status worldcup-api` — if it's not running, check `sudo journalctl -u worldcup-api -e`. |
| "502 Bad Gateway"                    | The API isn't up. Restart it: `sudo systemctl restart worldcup-api`.|
| QR / logo / screenshots don't load   | Confirm the `/uploads/` block is in the nginx site and reload nginx.|
| Changed `backend/.env` did nothing   | Restart the API: `sudo systemctl restart worldcup-api`.             |
| Public IP changed after stop/start   | Use an **Elastic IP** (Part A tip) so it stays fixed.               |

---

## Part G — (Optional) Custom domain + free HTTPS

If you point a domain (e.g. `league.yourco.com`) at the instance's IP:

```bash
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
# put your domain in the nginx server_name, reload nginx, then:
sudo certbot --nginx -d league.yourco.com
```
Certbot installs a certificate and switches the site to HTTPS (and auto-renews).
Remember to also open **port 443** in the Security Group.

---

## Appendix — Manual steps (what the script automates)

Prefer to do it by hand, or debugging the script? These are the exact steps.

```bash
# 1) Packages
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip nginx curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# 2) Backend
cd ~/prabhu-worldcup-league/backend
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
#   then edit .env: set a long random SECRET_KEY and change ADMIN_PASSWORD

# 3) Frontend (same-origin API base, then build)
cd ~/prabhu-worldcup-league/frontend
echo "VITE_API_URL=" > .env.production
npm install
npm run build
sudo mkdir -p /var/www/worldcup
sudo cp -r dist/* /var/www/worldcup/
sudo chown -R www-data:www-data /var/www/worldcup

# 4) API as a systemd service  (see scripts/deploy_ec2.sh for the unit file)
sudo nano /etc/systemd/system/worldcup-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now worldcup-api

# 5) nginx site  (see scripts/deploy_ec2.sh for the server block)
sudo nano /etc/nginx/sites-available/worldcup
sudo ln -sf /etc/nginx/sites-available/worldcup /etc/nginx/sites-enabled/worldcup
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

The systemd unit and nginx server block used by the script are the reference
implementations — copy them from `scripts/deploy_ec2.sh` if you're configuring by
hand.

---

## Appendix 2 — Quick two-port method (testing only, not recommended)

If you just want a fast look without nginx, you can expose both dev servers and
open **ports 8000 and 3000** in the Security Group:

```bash
# backend
cd backend && ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
# frontend (new shell) — bake the public IP into the API URL
cd frontend
echo "VITE_API_URL=http://<YOUR-PUBLIC-IP>:8000" > .env
npm install && npm run build && npm run preview   # serves on :3000
```
Browse `http://<YOUR-PUBLIC-IP>:3000`. This ties the build to one IP and exposes
the API directly — fine for a quick demo, but use **Part C** for anything real.
