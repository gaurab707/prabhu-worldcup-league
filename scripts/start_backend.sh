#!/usr/bin/env bash
# Prabhu Capital World Cup League - Backend launcher (macOS / Linux)
set -e
cd "$(dirname "$0")/../backend"

echo "========================================================"
echo "  Prabhu Capital - Prediction League  |  BACKEND"
echo "========================================================"

if [ ! -d ".venv" ]; then
  echo "[setup] Creating Python virtual environment..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "[setup] Installing / updating dependencies..."
python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

[ -f .env ] || { echo "[setup] Creating .env from template..."; cp .env.example .env; }

if [ ! -f "database/worldcup.db" ]; then
  echo "[setup] Seeding database with sample data..."
  python seed.py
fi

echo ""
echo "[run] Starting API on http://0.0.0.0:8000  (docs at /docs)"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
