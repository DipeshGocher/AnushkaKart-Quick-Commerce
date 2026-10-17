#!/bin/bash
# ==============================================================================
#  AnushkaKart — Production Deploy & Fast Update Script
#
#  Usage:
#    bash deploy.sh            # Pulls git, restarts backend, builds frontend
#    bash deploy.sh --backend  # Fast: Pulls git & restarts backend PM2 directly
#    bash deploy.sh --frontend # Pulls git & builds frontend only
# ==============================================================================

set -e

# Resolve repository root dynamically (works from any working directory)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
WEB_ROOT="/var/www/anushka-store"
ECOSYSTEM_CONFIG="$BACKEND_DIR/ecosystem.config.cjs"

MODE="all"
if [[ "${1:-}" == "--backend" || "${1:-}" == "-b" ]]; then
  MODE="backend"
elif [[ "${1:-}" == "--frontend" || "${1:-}" == "-f" ]]; then
  MODE="frontend"
fi

echo "========================================================"
echo " 🚀 AnushkaKart Deploy Script (Mode: $MODE)"
echo " Repository: $ROOT_DIR"
echo "========================================================"

# ── 1. Pull Latest Changes ────────────────────────────────────────────────────
echo ""
echo "📥 [1/4] Pulling latest code from GitHub..."
cd "$ROOT_DIR"
git pull origin main

# ── 2. Backend & PM2 Reload ───────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "backend" ]]; then
  echo ""
  echo "⚙️ [2/4] Updating backend..."
  cd "$BACKEND_DIR"

  # Install any new dependencies if needed
  if [ -f "package.json" ]; then
    npm install --omit=dev --prefer-offline 2>/dev/null || npm install --omit=dev
  fi

  echo "🔄 Reloading PM2 backend services..."
  if [ -f "$ECOSYSTEM_CONFIG" ]; then
    pm2 reload "$ECOSYSTEM_CONFIG" --env production || pm2 restart "$ECOSYSTEM_CONFIG" --env production
  else
    pm2 restart all
  fi
  pm2 save
  echo "✅ Backend successfully reloaded!"
fi

# ── 3. Frontend Build & Deploy ────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "frontend" ]]; then
  echo ""
  echo "🎨 [3/4] Building frontend..."
  cd "$FRONTEND_DIR"

  if [ -d "node_modules" ]; then
    npm run build
  else
    npm install && npm run build
  fi

  if [ -d "$FRONTEND_DIR/dist" ]; then
    echo "📂 Copying build to $WEB_ROOT..."
    mkdir -p "$WEB_ROOT"
    cp -r "$FRONTEND_DIR/dist/"* "$WEB_ROOT/"
    echo "✅ Frontend build published to $WEB_ROOT!"
  fi
fi

# ── 4. Nginx Reload & Status ──────────────────────────────────────────────────
echo ""
echo "🔍 [4/4] Verifying services..."
if command -v nginx >/dev/null 2>&1; then
  nginx -t >/dev/null 2>&1 && systemctl reload nginx 2>/dev/null || true
fi

echo ""
echo "========================================================"
echo " 🎉 Deployment Finished Successfully!"
echo "========================================================"
pm2 status
