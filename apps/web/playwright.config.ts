import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PLAYWRIGHT_WEB_PORT || '4174')
const HOST = process.env.PLAYWRIGHT_WEB_HOST || '127.0.0.1'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm dev --host ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
