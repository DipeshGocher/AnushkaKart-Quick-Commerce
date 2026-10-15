import fs from 'fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const firebaseSwTemplatePath = path.resolve(__dirname, './src/sw/firebase-messaging-sw.js')

function renderFirebaseMessagingSw(mode) {
  const env = loadEnv(mode, __dirname, '')
  const template = fs.readFileSync(firebaseSwTemplatePath, 'utf8')
  const replacements = {
    __VITE_FIREBASE_API_KEY__: env.VITE_FIREBASE_API_KEY || '',
    __VITE_FIREBASE_AUTH_DOMAIN__: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    __VITE_FIREBASE_DATABASE_URL__: env.VITE_FIREBASE_DATABASE_URL || '',
    __VITE_FIREBASE_PROJECT_ID__: env.VITE_FIREBASE_PROJECT_ID || '',
    __VITE_FIREBASE_STORAGE_BUCKET__: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    __VITE_FIREBASE_MESSAGING_SENDER_ID__: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    __VITE_FIREBASE_APP_ID__: env.VITE_FIREBASE_APP_ID || '',
    __VITE_FIREBASE_MEASUREMENT_ID__: env.VITE_FIREBASE_MEASUREMENT_ID || '',
  }

  return Object.entries(replacements).reduce(
    (output, [token, value]) => output.replaceAll(token, value),
    template,
  )
}

function firebaseMessagingSwPlugin() {
  let mode = 'development'

  return {
    name: 'firebase-messaging-sw',
    configResolved(config) {
      mode = config.mode
    },
    configureServer(server) {
      server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.end(renderFirebaseMessagingSw(mode))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'firebase-messaging-sw.js',
        source: renderFirebaseMessagingSw(mode),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), firebaseMessagingSwPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
    },
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },
  build: {
    minify: 'esbuild',
    sourcemap: false,
    // Warn when a chunk exceeds 600KB (before gzip) so we can act on it
    chunkSizeWarningLimit: 600,
    // Inline tiny assets (≤4KB) directly into JS/CSS to save round trips
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Deterministic chunk filenames for better CDN caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // ── MUI (large) ──────────────────────────────────────────────────
          if (
            id.includes('@mui/material') ||
            id.includes('@mui/icons-material') ||
            id.includes('@emotion/react') ||
            id.includes('@emotion/styled')
          ) return 'vendor-mui';

          // ── Animation ────────────────────────────────────────────────────
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lottie-react') || id.includes('lottie-web')) return 'vendor-lottie';

          // ── Firebase (heavy — defer until needed) ─────────────────────────
          if (id.includes('firebase')) return 'vendor-firebase';

          // ── Charts ───────────────────────────────────────────────────────
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';

          // ── React core + router (tiny, stays in main) ────────────────────
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';

          // ── Capacitor (mobile bridge) ─────────────────────────────────────
          if (id.includes('@capacitor')) return 'vendor-capacitor';

          // ── Icons & UI utilities ─────────────────────────────────────────
          if (id.includes('lucide-react')) return 'vendor-icons';
        },
      },
    },
  },
  // Dev server proxy to avoid CORS in local dev
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:7000',
        changeOrigin: true,
      },
    },
  },
}))

