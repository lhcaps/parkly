import { expect, test, type Page } from '@playwright/test'
import { saveSignoffScreenshot } from './helpers/signoff'

test.describe.configure({ mode: 'serial' })

type Role = 'ADMIN' | 'OPS' | 'GUARD' | 'CASHIER' | 'WORKER'

type LandingCase = {
  role: Role
  path: '/overview' | '/run-lane' | '/reports' | '/lane-monitor'
  screenshot: string
}

function userPrincipal(role: Role) {
  return {
    principalType: 'USER',
    role,
    actorLabel: `${role.toLowerCase()} actor`,
    userId: `user-${role.toLowerCase()}`,
    username: role.toLowerCase(),
    sessionId: `sess-${role.toLowerCase()}`,
    siteScopes: [{ siteId: 'site-1', siteCode: 'SITE01', scopeLevel: 'SITE' }],
  }
}

function installRuntimeDiagnostics(page: Page) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  return { pageErrors, consoleErrors }
}

async function mockCommon(page: Page) {
  await page.route('**/api/auth/password-policy', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        bootstrapProfile: 'DEMO',
        demoSeedCredentialsEnabled: true,
        description: 'Demo policy',
        policy: {
          minLength: 8,
          requireUppercase: false,
          requireLowercase: false,
          requireDigit: false,
          requireSpecial: false,
        },
      }),
    })
  })

  await page.route('**/api/sites**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [
          {
            siteId: 'site-1',
            siteCode: 'SITE01',
            name: 'Site 01',
            timezone: 'Asia/Ho_Chi_Minh',
            isActive: true,
          },
        ],
      }),
    })
  })

  await page.route('**/api/reports/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        siteCode: 'SITE01',
        days: 7,
        entry: 12,
        exit: 9,
        total: 21,
      }),
    })
  })

  await page.route('**/api/ops/dashboard/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-03-18T07:00:00.000Z',
        scope: { siteCode: 'SITE01', siteName: 'Site 01' },
        filters: { sinceHours: 24, expiringInDays: 7 },
        overview: {
          incidentsOpenCount: 0,
          criticalIncidentsOpenCount: 0,
          laneAttentionCount: 0,
          offlineLaneCount: 0,
          occupancyRate: 0,
        },
        incidents: {
          openCount: 0,
          criticalOpenCount: 0,
          avgAgeMinutes: 0,
        },
        occupancy: {
          occupiedTotal: 0,
          totalSpots: 0,
          occupancyRate: 0,
        },
        lanes: {
          total: 0,
          attention: 0,
          offline: 0,
          barrierFault: 0,
          openSessions: 0,
        },
        subscriptions: {
          total: 0,
          active: 0,
          expiringSoon: 0,
          suspended: 0,
        },
        sites: [],
      }),
    })
  })

  await page.route('**/api/gate-sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [] }),
    })
  })

  await page.route('**/api/gate-review-queue', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [] }),
    })
  })

  await page.route('**/api/outbox', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [], nextCursor: null }),
    })
  })

  await page.route('**/api/ops/lane-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rows: [],
        nextCursor: null,
        pageInfo: null,
      }),
    })
  })

  await page.route('**/api/gates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ siteCode: 'SITE01', rows: [] }),
    })
  })

  await page.route('**/api/lanes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ siteCode: 'SITE01', rows: [] }),
    })
  })

  await page.route('**/api/stream/lane-status', async (route) => {
    await route.fulfill({
      status: 204,
      body: '',
    })
  })

  await page.route('**/api/stream/device-health', async (route) => {
    await route.fulfill({
      status: 204,
      body: '',
    })
  })
}

async function assertStableLanding(page: Page, item: LandingCase) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(item.path)

  const loginButton = page.getByRole('button', { name: /sign in/i })
  await expect(loginButton).toHaveCount(0)

  await expect(
    page.getByText(/forbidden|access denied|not authorized|khong co quyen/i).first(),
  ).toHaveCount(0)

  await expect(
    page.getByText(/unexpected application error|something went wrong|route error/i).first(),
  ).toHaveCount(0)

  await expect(page.locator('#root')).toBeVisible({ timeout: 20000 })

  await page.waitForLoadState('networkidle').catch(() => void 0)
}

const cases: LandingCase[] = [
  { role: 'ADMIN', path: '/overview', screenshot: 'landing-admin.png' },
  { role: 'OPS', path: '/overview', screenshot: 'landing-ops.png' },
  { role: 'GUARD', path: '/run-lane', screenshot: 'landing-guard.png' },
  { role: 'CASHIER', path: '/reports', screenshot: 'landing-cashier.png' },
  { role: 'WORKER', path: '/lane-monitor', screenshot: 'landing-worker.png' },
]

for (const item of cases) {
  test(`${item.role} login lands on the correct canonical home`, async ({ page }) => {
    const diagnostics = installRuntimeDiagnostics(page)
    await mockCommon(page)

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: `atk-${item.role.toLowerCase()}`,
          refreshToken: `rtk-${item.role.toLowerCase()}`,
          accessExpiresAt: '2026-03-18T01:00:00.000Z',
          refreshExpiresAt: '2026-03-19T01:00:00.000Z',
          principal: userPrincipal(item.role),
        }),
      })
    })

    await page.goto('/login')
    await page.getByLabel('Username').fill(item.role.toLowerCase())
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await assertStableLanding(page, item)
    await saveSignoffScreenshot(page, item.screenshot)

    expect(
      diagnostics.pageErrors,
      `Unexpected runtime errors on ${item.role}: ${diagnostics.pageErrors.join(' | ')}`,
    ).toEqual([])

    expect(
      diagnostics.consoleErrors.filter((line) => !/404|favicon/i.test(line)),
      `Unexpected console errors on ${item.role}: ${diagnostics.consoleErrors.join(' | ')}`,
    ).toEqual([])
  })
}
