import { expect, test, type Page } from '@playwright/test'
import { saveSignoffScreenshot } from './helpers/signoff'

function userPrincipal(role: 'GUARD' | 'CASHIER') {
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

  await page.route('**/api/sites', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [{ siteCode: 'SITE01', name: 'Site 01', isActive: true }] }),
    })
  })

  await page.route('**/api/reports/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ siteCode: 'SITE01', days: 7, entry: 12, exit: 9, total: 21 }),
    })
  })

  await page.route('**/api/gates**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ siteCode: 'SITE01', rows: [] }) })
  })

  await page.route('**/api/lanes**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ siteCode: 'SITE01', rows: [] }) })
  })
}

test('cashier login lands on /reports instead of a generic overview', async ({ page }) => {
  await mockCommon(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('parkly-locale', 'en')
  })

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'atk-cashier',
        refreshToken: 'rtk-cashier',
        accessExpiresAt: '2026-03-18T01:00:00.000Z',
        refreshExpiresAt: '2026-03-19T01:00:00.000Z',
        principal: userPrincipal('CASHIER'),
      }),
    })
  })

  await page.goto('/login')
  await page.getByLabel(/Tên đăng nhập|Username/i).fill('cashier')
  await page.getByLabel(/Mật khẩu|Password/i).fill('password123')
  await page.getByRole('button', { name: /Đăng nhập|Sign in/i }).click()

  await expect(page).toHaveURL(/\/reports/)
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
})

test('forbidden direct URL keeps the user out of subscriptions and shows a guarded fallback', async ({ page }) => {
  await mockCommon(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('parkly_token', 'atk-guard')
    window.localStorage.setItem('parkly_refresh_token', 'rtk-guard')
    window.localStorage.setItem('parkly-locale', 'en')
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userPrincipal('GUARD')),
    })
  })

  await page.goto('/subscriptions?siteCode=SITE01')

  await expect(page).toHaveURL(/\/forbidden/)
  await expect(page.getByText(/Khu vực hạn chế|Route blocked/i)).toBeVisible()
  await expect(page.locator('a[href="/run-lane"]').first()).toBeVisible()
  await saveSignoffScreenshot(page, 'forbidden-fallback.png')
})
