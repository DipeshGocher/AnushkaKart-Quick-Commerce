#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  AnushkaKart — Hostinger KVM 4 VPS Deploy Script                        ║
# ║                                                                          ║
# ║  Run once to set up, then re-run for zero-downtime updates:              ║
# ║    bash deploy.sh                                                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────
APP_DIR="/var/www/anushkakart"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_CONF="/etc/nginx/sites-available/anushkakart"
PM2_ECOSYSTEM="$BACKEND_DIR/ecosystem.config.cjs"
LOG_DIR="/var/log/pm2"
NODE_ENV="production"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  AnushkaKart — Production Deploy"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────
echo "[1/8] Checking system packages..."
if ! command -v node &>/dev/null; then
    echo "  → Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &>/dev/null; then
    echo "  → Installing PM2 globally..."
    sudo npm install -g pm2@latest pm2-logrotate
fi

if ! command -v nginx &>/dev/null; then
    echo "  → Installing Nginx..."
    sudo apt-get install -y nginx
fi

echo "  ✓ Node $(node -v) | npm $(npm -v) | PM2 $(pm2 -v)"

# ── 2. Directory structure ────────────────────────────────────────────────
echo "[2/8] Preparing directories..."
sudo mkdir -p "$APP_DIR" "$LOG_DIR"
sudo chown -R "$(whoami):$(whoami)" "$APP_DIR" "$LOG_DIR"
echo "  ✓ Directories ready"

# ── 3. Backend dependencies ────────────────────────────────────────────────
echo "[3/8] Installing backend dependencies (production only)..."
cd "$BACKEND_DIR"
npm ci --omit=dev --prefer-offline
echo "  ✓ Backend dependencies installed"

# ── 4. Frontend build ─────────────────────────────────────────────────────
echo "[4/8] Building React frontend..."
cd "$FRONTEND_DIR"
npm ci --prefer-offline
NODE_ENV=production npm run build
echo "  ✓ Frontend built → $FRONTEND_DIR/dist"

# ── 5. Nginx configuration ────────────────────────────────────────────────
echo "[5/8] Configuring Nginx..."
if [ ! -f "$NGINX_CONF" ]; then
    sudo cp "$APP_DIR/nginx.conf" "$NGINX_CONF"
    sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/anushkakart
    # Disable default site if it exists
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Validate config before reloading
sudo nginx -t
sudo systemctl reload nginx || sudo systemctl start nginx
echo "  ✓ Nginx configured and running"

# ── 6. PM2 process management ─────────────────────────────────────────────
echo "[6/8] Starting/reloading PM2 processes..."
cd "$BACKEND_DIR"

if pm2 list | grep -q "anushkakart-api"; then
    # Zero-downtime reload (PM2 cluster mode)
    pm2 reload "$PM2_ECOSYSTEM" --env production
    echo "  ✓ Hot-reloaded PM2 cluster"
else
    pm2 start "$PM2_ECOSYSTEM" --env production
    echo "  ✓ PM2 processes started"
fi

# Save process list (survives reboots)
pm2 save
echo "  ✓ PM2 state saved"

# ── 7. PM2 startup (run once, survives reboots) ────────────────────────────
echo "[7/8] Configuring PM2 startup on boot..."
pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null | tail -1 | sudo bash || true
echo "  ✓ PM2 startup configured"

# ── 8. PM2 Log rotate ─────────────────────────────────────────────────────
echo "[8/8] Configuring log rotation..."
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
echo "  ✓ Log rotation configured (50MB / 7-day retention)"

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Deploy complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  PM2 status:"
pm2 list
echo ""
echo "  Nginx status:"
sudo systemctl status nginx --no-pager | head -4
echo ""
echo "  Next steps:"
echo "    1. Ensure .env is populated at $BACKEND_DIR/.env"
echo "    2. Run: sudo certbot --nginx -d anushkakart.in -d www.anushkakart.in"
echo "    3. Monitor: pm2 monit"
echo "    4. Logs:    pm2 logs anushkakart-api --lines 50"
echo ""
