#!/usr/bin/env bash
#
# deploy_ec2.sh — one-shot production deploy for the Prabhu Capital World Cup
# Prediction League on a fresh Ubuntu EC2 instance.
#
# What it sets up:
#   * Python venv + FastAPI backend, run by uvicorn under systemd (auto-restart,
#     starts on boot), bound to 127.0.0.1:8000 (never exposed directly).
#   * The React frontend built as static files and served by nginx on port 80.
#   * nginx reverse-proxies /api and /uploads to the backend, so the WHOLE app
#     is reachable on http://<PUBLIC_IP>/ — one clean address, one open port.
#
# Re-runnable: safe to run again after a `git pull` / new upload to redeploy.
#
# Usage (from the project root on the EC2 box):
#   sudo bash scripts/deploy_ec2.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve paths (project root = parent of this script's dir)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
WEB_ROOT="/var/www/worldcup"
SERVICE_NAME="worldcup-api"
RUN_USER="${SUDO_USER:-$USER}"

echo "=============================================================="
echo " Prabhu Capital World Cup League — EC2 deploy"
echo "   App dir : $APP_DIR"
echo "   Run user: $RUN_USER"
echo "=============================================================="

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo:  sudo bash scripts/deploy_ec2.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
echo "--> [1/7] Installing system packages (python, nginx, node)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx curl ca-certificates

# Node.js 20 LTS via NodeSource (only if node is missing or too old)
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  [[ "$NODE_MAJOR" -ge 18 ]] && NEED_NODE=0
fi
if [[ "$NEED_NODE" -eq 1 ]]; then
  echo "    Installing Node.js 20 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    node $(node -v) / npm $(npm -v)"

# ---------------------------------------------------------------------------
# 2. Backend: virtualenv + dependencies
# ---------------------------------------------------------------------------
echo "--> [2/7] Setting up Python backend…"
cd "$BACKEND_DIR"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -r requirements.txt

# ---------------------------------------------------------------------------
# 3. Backend .env (create once, with a strong random secret)
# ---------------------------------------------------------------------------
echo "--> [3/7] Ensuring backend/.env…"
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
  cat > "$BACKEND_DIR/.env" <<EOF
ENVIRONMENT=production
SECRET_KEY=$SECRET
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Default administrator (CHANGE THE PASSWORD after first login!)
ADMIN_EMAIL=admin@prabhucapital.com
ADMIN_PASSWORD=Admin@123
ADMIN_NAME=League Administrator

# Same-origin behind nginx, so CORS can stay open.
BACKEND_CORS_ORIGINS=*

# Scheduler / scraper
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=15
SCRAPER_ENABLED=true
SPORTSDB_API_KEY=123
SPORTSDB_LEAGUE_ID=4429
SPORTSDB_SEASON=2025-2026
SPORTSDB_INGEST_FUTURE_ONLY=true

# Payment / champion prize
ENTRY_FEE=1000
CHAMPION_BONUS_POINTS=500
CHAMPION_PRIZE_AMOUNT=2000
EOF
  echo "    Created backend/.env with a generated SECRET_KEY."
  echo "    >>> Remember to change ADMIN_PASSWORD after first login."
else
  echo "    backend/.env already exists — left unchanged."
fi

# Make sure runtime dirs exist and are owned by the run user.
mkdir -p "$BACKEND_DIR/database" "$BACKEND_DIR/uploads" "$BACKEND_DIR/logs"
chown -R "$RUN_USER":"$RUN_USER" "$BACKEND_DIR/database" "$BACKEND_DIR/uploads" "$BACKEND_DIR/logs"

# ---------------------------------------------------------------------------
# 4. Frontend: build with a same-origin API base, publish to nginx web root
# ---------------------------------------------------------------------------
echo "--> [4/7] Building frontend…"
cd "$FRONTEND_DIR"
# Empty API base => axios baseURL becomes "/api" (relative) => same origin =>
# nginx routes it to the backend. No IP is baked in, so it works on any host.
echo "VITE_API_URL=" > .env.production
sudo -u "$RUN_USER" npm install --no-audit --no-fund
sudo -u "$RUN_USER" npm run build

mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r "$FRONTEND_DIR/dist/"* "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
echo "    Published static site to $WEB_ROOT"

# ---------------------------------------------------------------------------
# 5. systemd service for the API
# ---------------------------------------------------------------------------
echo "--> [5/7] Installing systemd service ($SERVICE_NAME)…"
cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=Prabhu Capital World Cup League API (FastAPI/uvicorn)
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$BACKEND_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$BACKEND_DIR/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
systemctl restart "$SERVICE_NAME"

# ---------------------------------------------------------------------------
# 6. nginx site
# ---------------------------------------------------------------------------
echo "--> [6/7] Configuring nginx…"
cat > "/etc/nginx/sites-available/worldcup" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Allow payment-screenshot / logo / QR uploads (backend caps at 5 MB).
    client_max_body_size 10M;

    root $WEB_ROOT;
    index index.html;

    # API + docs -> FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /uploads/ { proxy_pass http://127.0.0.1:8000; }
    location = /docs   { proxy_pass http://127.0.0.1:8000; }
    location = /redoc  { proxy_pass http://127.0.0.1:8000; }
    location = /openapi.json { proxy_pass http://127.0.0.1:8000; }

    # Everything else -> the React single-page app (client-side routing).
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/worldcup /etc/nginx/sites-enabled/worldcup
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# ---------------------------------------------------------------------------
# 7. Done
# ---------------------------------------------------------------------------
PUBLIC_IP="$(curl -s --max-time 4 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
[[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="$(curl -s --max-time 4 ifconfig.me || echo YOUR_PUBLIC_IP)"

echo "--> [7/7] Verifying…"
sleep 2
API_OK="$(curl -s http://127.0.0.1/api/health || true)"

echo "=============================================================="
echo " ✅ Deploy complete."
echo ""
echo "   Backend health (via nginx): $API_OK"
echo "   Service status:  systemctl status $SERVICE_NAME"
echo "   API logs:        journalctl -u $SERVICE_NAME -f"
echo ""
echo "   OPEN IN YOUR BROWSER:   http://$PUBLIC_IP/"
echo ""
echo "   Make sure the EC2 Security Group allows inbound TCP 80 (HTTP)."
echo "   Default admin login:  admin@prabhucapital.com  /  Admin@123"
echo "   >>> Change the admin password after first login."
echo "=============================================================="
