#!/usr/bin/env bash
# Prabhu Capital World Cup League - Frontend launcher (macOS / Linux)
set -e
cd "$(dirname "$0")/../frontend"

echo "========================================================"
echo "  Prabhu Capital - Prediction League  |  FRONTEND"
echo "========================================================"

if [ ! -d "node_modules" ]; then
  echo "[setup] Installing Node dependencies (first run)..."
  npm install
fi
[ -f .env ] || { echo "[setup] Creating .env from template..."; cp .env.example .env; }

echo ""
echo "[run] Starting web app on http://0.0.0.0:3000"
exec npm run dev
