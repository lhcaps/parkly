import { expect, test } from '@playwright/test'

function siteAdminPrincipal() {
  return {
    principalType: 'USER',
    role: 'SITE_ADMIN',
    actorLabel: 'site admin actor',
    userId: 'user-site-admin',
    username: 'site_admin',
    sessionId: 'sess-site-admin',
    siteScopes: [{ siteId: '1', siteCode: 'SITE01', scopeLevel: 'SITE_ADMIN' }],
  }
}

test('topology create lane sends siteCode instead of a numeric siteId placeholder', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('parkly_token', 'atk-ops')
    window.localStorage.setItem('parkly_refresh_token', 'rtk-ops')
    window.localStorage.setItem('parkly-locale', 'en')
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(siteAdminPrincipal()),
    })
  })

  await page.route('**/api/sites**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [{ siteId: '1', siteCode: 'SITE01', name: 'Site 01', timezone: 'Asia/Ho_Chi_Minh', isActive: true }] }),
    })
  })

  await page.route('**/api/topology?siteCode=SITE01', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        site: {
          siteCode: 'SITE01',
          name: 'Site 01',
          timezone: 'Asia/Ho_Chi_Minh',
          isActive: true,
        },
        gates: [{
          gateCode: 'GATE01',
          siteCode: 'SITE01',
          label: 'Gate 01',
          laneCount: 1,
          directions: ['ENTRY'],
          lanes: [{
            laneCode: 'LANE01',
            label: 'Lane 01',
            direction: 'ENTRY',
            status: 'ACTIVE',
            sortOrder: 0,
            primaryDeviceCode: null,
            devices: [],
          }],
        }],
      }),
    })
  })

  await page.route('**/api/admin/topology/devices/unassigned?siteCode=SITE01', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [] }),
    })
  })

  let requestBody = null
  await page.route('**/api/admin/topology/lanes', async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.goto('/topology')
  await page.getByRole('button', { name: /add lane/i }).click()
  await expect(page.getByRole('heading', { name: /add new lane/i })).toBeVisible()
  await page.getByPlaceholder('e.g. L01').fill('LANE02')
  await page.getByPlaceholder('e.g. Main Entry 1').fill('Lane 02')
  await page.getByRole('button', { name: 'Create Lane', exact: true }).click()

  await expect.poll(() => requestBody).not.toBeNull()
  expect(requestBody).toMatchObject({
    siteCode: 'SITE01',
    gateCode: 'GATE01',
    laneCode: 'LANE02',
    name: 'Lane 02',
    direction: 'ENTRY',
  })
  expect(requestBody).not.toHaveProperty('siteId')
})
