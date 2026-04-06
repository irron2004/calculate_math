import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const frontendPort = 5173
const backendPort = 8000

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'on-first-retry'
  },
  webServer: [
    {
      cwd: path.resolve(__dirname, '../backend'),
      command: [
        'bash -lc',
        `"rm -f /tmp/calculate-math-e2e.db && ` +
          `DATABASE_PATH=/tmp/calculate-math-e2e.db ` +
          `JWT_SECRET=e2e-jwt-secret-please-use-at-least-32-bytes ` +
          `ADMIN_USERNAME=admin ` +
          `ADMIN_PASSWORD=admin ` +
          `ADMIN_AUTH_EMAIL=admin@example.com ` +
          `../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port ${backendPort}"`
      ].join(' '),
      url: `http://127.0.0.1:${backendPort}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      cwd: path.resolve(__dirname),
      command: [
        'bash -lc',
        `"VITE_API_URL=http://127.0.0.1:${backendPort}/api npm run build && ` +
          `VITE_API_URL=http://127.0.0.1:${backendPort}/api npm run preview -- --host 127.0.0.1 --port ${frontendPort} --strictPort"`
      ].join(' '),
      url: `http://127.0.0.1:${frontendPort}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
})
