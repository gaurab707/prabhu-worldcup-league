#!/usr/bin/env bash
#
# update.sh — safely apply a code update to an ALREADY-DEPLOYED instance.
#
# What it does:
#   * sets the timezone to Nepal (Asia/Kathmandu) for the system and the API service,
#   * rebuilds the frontend (same-origin) and republishes it to nginx,
#   * restarts the API and reloads nginx.
#
# What it will NOT touch (your data is safe):
#   * the database  (backend/database/*.db)
#   * uploads       (backend/uploads/*)
#   * secrets       (backend/.env)
# None of those are modified, moved, or overwritten by this script.
#
# Usage (from the project root on the server, after replacing the source files):
#   sudo bash scripts/update.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
WEB_ROOT="/var/www/worldcup"
SERVICE_NAME="worldcup-api"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
RUN_USER="${SUDO_USER:-$USER}"
TZONE="Asia/Kathmandu"

echo "=============================================================="
echo " Updating World Cup League  (data-safe)"
echo "   App dir : $APP_DIR"
echo "=============================================================="

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo:  sudo bash scripts/update.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Timezone -> Nepal
# ---------------------------------------------------------------------------
echo "--> [1/4] Setting timezone to $TZONE…"
timedatectl set-timezone "$TZONE" 2>/dev/null || echo "    (timedatectl unavailable — skipping system clock change)"

# Make sure the API service also runs in Nepal time (idempotent).
if [[ -f "$SERVICE_FILE" ]]; then
  if ! grep -q "Environment=TZ=$TZONE" "$SERVICE_FILE"; then
    # Insert the TZ env right after the [Service] line.
    sed -i "/^\[Service\]/a Environment=TZ=$TZONE" "$SERVICE_FILE"
    echo "    Added TZ to $SERVICE_NAME service."
  else
    echo "    Service already has TZ set."
  fi
  systemctl daemon-reload
else
  echo "    NOTE: $SERVICE_FILE not found — if you deployed differently, set TZ=$TZONE on your API process."
fi

# ---------------------------------------------------------------------------
# 2. Backend deps (idempotent; does NOT touch the DB)
# ---------------------------------------------------------------------------
echo "--> [2/4] Ensuring backend dependencies…"
if [[ -x "$BACKEND_DIR/.venv/bin/pip" ]]; then
  "$BACKEND_DIR/.venv/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
else
  echo "    No venv found — creating one…"
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/pip" install --quiet --upgrade pip
  "$BACKEND_DIR/.venv/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
fi

# ---------------------------------------------------------------------------
# 3. Rebuild the frontend (same-origin) and republish
# ---------------------------------------------------------------------------
echo "--> [3/4] Rebuilding frontend…"
if ! command -v npm >/dev/null 2>&1; then
  echo "    ERROR: npm is not installed. Run scripts/deploy_ec2.sh first."
  exit 1
fi
cd "$FRONTEND_DIR"
echo "VITE_API_URL=" > .env.production   # empty => same-origin (nginx proxies /api)
sudo -u "$RUN_USER" npm install --no-audit --no-fund
sudo -u "$RUN_USER" npm run build

mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r "$FRONTEND_DIR/dist/"* "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
echo "    Published updated site to $WEB_ROOT"

# ---------------------------------------------------------------------------
# 4. Restart services
# ---------------------------------------------------------------------------
echo "--> [4/4] Restarting services…"
systemctl restart "$SERVICE_NAME"
nginx -t && systemctl reload nginx

sleep 2
API_OK="$(curl -s http://127.0.0.1/api/health || true)"
PUBLIC_IP="$(curl -s --max-time 4 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
[[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="$(curl -s --max-time 4 ifconfig.me || echo YOUR_PUBLIC_IP)"

echo "=============================================================="
echo " ✅ Update complete.   API health: $API_OK"
echo "    Timezone: $(date '+%Z %z')  —  all times now show in Nepal time."
echo "    Open:  http://$PUBLIC_IP/    (hard-refresh: Ctrl/Cmd+Shift+R)"
echo "    Your database, uploads and .env were left untouched."
echo "=============================================================="
