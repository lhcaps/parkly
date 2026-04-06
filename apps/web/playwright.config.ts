import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PLAYWRIGHT_WEB_PORT || '4174')
const HOST = process.env.PLAYWRIGHT_WEB_HOST || '127.0.0.1'
const MANAGED_BASE_URL = `http://${HOST}:${PORT}`
const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim() || ''
const BASE_URL = EXTERNAL_BASE_URL || MANAGED_BASE_URL
const WEB_SERVER_MODE = process.env.PLAYWRIGHT_WEB_SERVER_MODE === 'dev' ? 'dev' : 'dist'
const SCREENSHOTS_DIR = process.env.SIGNOFF_SCREENSHOTS_DIR || 'screenshots'
const WEB_SERVER_COMMAND = WEB_SERVER_MODE === 'dev'
  ? `pnpm run dev -- --host ${HOST} --port ${PORT}`
  : `pnpm run serve:dist -- --host ${HOST} --port ${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/playwright',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never', outputFolder: 'playwright-report' }], ['junit', { outputFile: 'test-results/junit.xml' }], ['list']]
    : 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : {
        command: WEB_SERVER_COMMAND,
        url: MANAGED_BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
