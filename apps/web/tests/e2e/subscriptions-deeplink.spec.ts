import { expect, test, type Page } from '@playwright/test'
import { saveSignoffScreenshot } from './helpers/signoff'

function opsPrincipal() {
  return {
    principalType: 'USER',
    role: 'OPS',
    actorLabel: 'ops actor',
    userId: 'user-ops',
    username: 'ops',
    sessionId: 'sess-ops',
    siteScopes: [{ siteId: 'site-1', siteCode: 'SITE01', scopeLevel: 'SITE' }],
  }
}

async function mockAuthenticatedOps(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('parkly_token', 'atk-ops')
    window.localStorage.setItem('parkly_refresh_token', 'rtk-ops')
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opsPrincipal()) })
  })

  await page.route('**/api/sites', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [{ siteCode: 'SITE01', name: 'Site 01', isActive: true }] }),
    })
  })

  await page.route('**/api/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'OPS' }) })
  })

  await page.route('**/api/admin/subscriptions?**', async (route) => {
    const url = new URL(route.request().url())
    const status = url.searchParams.get('status')
    const rows = status === 'CANCELLED'
      ? []
      : [{
          subscriptionId: 'sub_123',
          siteCode: 'SITE01',
          siteName: 'Site 01',
          customerId: 'cust_1',
          customerName: 'Nguyen Van A',
          customerPhone: '0900000000',
          planType: 'MONTHLY',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          status: 'ACTIVE',
          effectiveStatus: 'ACTIVE',
        }]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows, nextCursor: null }),
    })
  })

  await page.route('**/api/admin/subscriptions/sub_123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        subscriptionId: 'sub_123',
        siteCode: 'SITE01',
        siteName: 'Site 01',
        customerId: 'cust_1',
        customerName: 'Nguyen Van A',
        customerPhone: '0900000000',
        planType: 'MONTHLY',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        status: 'ACTIVE',
        effectiveStatus: 'ACTIVE',
        spots: [{
          subscriptionSpotId: 'ss_1',
          subscriptionId: 'sub_123',
          siteCode: 'SITE01',
          spotId: 'spot_1',
          spotCode: 'A-01',
          zoneCode: 'A',
          assignedMode: 'ASSIGNED',
          status: 'ACTIVE',
          isPrimary: true,
          assignedFrom: '2026-03-01',
          assignedUntil: '2026-03-31',
          note: null,
        }],
        vehicles: [{
          subscriptionVehicleId: 'sv_1',
          subscriptionId: 'sub_123',
          siteCode: 'SITE01',
          vehicleId: 'veh_1',
          licensePlate: '43A-12345',
          plateCompact: '43A12345',
          vehicleType: 'CAR',
          status: 'ACTIVE',
          isPrimary: true,
          validFrom: '2026-03-01',
          validTo: '2026-03-31',
          note: null,
        }],
      }),
    })
  })
}

test('subscriptions deep link survives reload and keeps the selected tab', async ({ page }) => {
  await mockAuthenticatedOps(page)

  const deepLink = '/subscriptions?siteCode=SITE01&id=sub_123&tab=vehicles'
  await page.goto(deepLink)

  await expect(page).toHaveURL(new RegExp(deepLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  await expect(page.getByRole('heading', { name: 'Subscriptions' })).toBeVisible()
  await expect(page.getByText('43A12345')).toBeVisible()

  await page.reload()

  await expect(page).toHaveURL(new RegExp(deepLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  await expect(page.getByText('43A12345')).toBeVisible()
  await saveSignoffScreenshot(page, 'subscriptions-deeplink.png')
})
