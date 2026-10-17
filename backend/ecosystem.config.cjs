/**
 * PM2 Ecosystem Configuration — Hostinger KVM 4 VPS
 *
 * KVM 4 specs: 4 vCPUs, 8GB RAM, 100GB NVMe SSD
 *
 * Strategy:
 *  - API cluster: 3 workers (leaving 1 CPU for Nginx/OS)
 *  - Each worker limited to 512MB RSS — restarts on OOM before it cascades
 *  - Graceful shutdown: 10s timeout to drain in-flight requests
 *  - Logs rotated daily via pm2-logrotate (install separately)
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup
 */

module.exports = {
  apps: [
    {
      // ── Main API Server ──────────────────────────────────────────────────
      name: "anushkakart-api",
      script: "./index.js",
      cwd: "/var/www/anushkakart/backend",

      // Cluster mode: fork 3 workers across 4 vCPUs
      instances: 3,
      exec_mode: "cluster",

      // Node.js memory: allow 512MB per worker before PM2 restarts
      node_args: "--max-old-space-size=512",
      max_memory_restart: "512M",

      // Environment (production overrides; secrets come from .env file)
      env: {
        NODE_ENV: "development",
        PORT: 7000,
        PROCESS_ROLE: "api",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 7000,
        PROCESS_ROLE: "api",
        // TRUST_PROXY=1 because Nginx sits in front
        TRUST_PROXY: "1",
      },

      // Restart policy
      autorestart: true,
      watch: false,               // Never watch in production
      max_restarts: 10,
      min_uptime: "5s",           // A process must live at least 5s to be "stable"
      restart_delay: 3000,        // Wait 3s between restart attempts

      // Graceful shutdown: give in-flight requests 10s to complete
      kill_timeout: 10000,
      listen_timeout: 8000,

      // Log configuration
      out_file: "/var/log/pm2/anushkakart-out.log",
      error_file: "/var/log/pm2/anushkakart-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Expose PM2 metrics on /api/metrics (internal only)
      pmx: true,
    },

    {
      // ── Background Worker (Bull queues, email, notifications) ────────────
      name: "anushkakart-worker",
      script: "./worker.js",
      cwd: "/var/www/anushkakart/backend",

      instances: 1,
      exec_mode: "fork",          // Single worker process for queues

      node_args: "--max-old-space-size=256",
      max_memory_restart: "256M",

      env: {
        NODE_ENV: "development",
        PROCESS_ROLE: "worker",
      },
      env_production: {
        NODE_ENV: "production",
        PROCESS_ROLE: "worker",
        WORKER_MODE: "1",
        TRUST_PROXY: "1",
      },

      autorestart: true,
      watch: false,
      max_restarts: 5,
      min_uptime: "10s",
      kill_timeout: 30000,        // Workers may need longer to finish queue jobs

      out_file: "/var/log/pm2/worker-out.log",
      error_file: "/var/log/pm2/worker-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },

    {
      // ── Scheduler (Recurring cron jobs, auto-cancel, payouts) ───────────
      name: "anushkakart-scheduler",
      script: "./scheduler.js",
      cwd: "/var/www/anushkakart/backend",

      instances: 1,
      exec_mode: "fork",

      node_args: "--max-old-space-size=256",
      max_memory_restart: "256M",

      env: {
        NODE_ENV: "development",
        PROCESS_ROLE: "scheduler",
      },
      env_production: {
        NODE_ENV: "production",
        PROCESS_ROLE: "scheduler",
        TRUST_PROXY: "1",
      },

      autorestart: true,
      watch: false,
      max_restarts: 5,
      min_uptime: "10s",
      kill_timeout: 10000,

      out_file: "/var/log/pm2/scheduler-out.log",
      error_file: "/var/log/pm2/scheduler-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],

  // ── PM2 Deploy Configuration (optional, for zero-downtime deploys) ────────
  deploy: {
    production: {
      user: "deploy",
      host: ["your-hostinger-vps-ip"],
      ref: "origin/main",
      repo: "git@github.com:your-org/anushkakart.git",
      path: "/var/www/anushkakart",
      "post-deploy":
        "cd backend && npm ci --omit=dev && pm2 reload ecosystem.config.cjs --env production",
      "pre-setup": "apt-get install -y git",
    },
  },
};
