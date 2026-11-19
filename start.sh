#!/usr/bin/env bash
set -e

# Directory del progetto
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configurazione PATH per Node se installato via nvm
if [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NODE=$(ls -d "$HOME/.nvm/versions/node/"* 2>/dev/null | sort -V | tail -n 1)
  if [ -n "$LATEST_NODE" ]; then
    export PATH="$LATEST_NODE/bin:$PATH"
  fi
fi

echo "=== Avvio Antarctic Weather Observatory ==="

# 1. Backend
echo "[1/2] Avvio Backend FastAPI (porta 8000)..."
cd "$ROOT_DIR/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Frontend
echo "[2/2] Avvio Frontend Vite (porta 5173)..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
  echo "Installazione dipendenze frontend (npm install)..."
  npm install
fi
chmod +x node_modules/.bin/* 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!

trap "echo 'Arresto dei servizi...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT INT TERM

echo ""
echo "Applicazione avviata con successo:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "  - Swagger Docs: http://localhost:8000/docs"
echo ""
echo "Premi CTRL+C per arrestare entrambi i server."

wait

