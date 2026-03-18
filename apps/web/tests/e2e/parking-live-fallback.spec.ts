import { expect, test, type Page } from '@playwright/test'

function guardPrincipal() {
  return {
    principalType: 'USER',
    role: 'GUARD',
    actorLabel: 'guard actor',
    userId: 'user-guard',
    username: 'guard',
    sessionId: 'sess-guard',
    siteScopes: [{ siteId: 'site-1', siteCode: 'SITE01', scopeLevel: 'SITE' }],
  }
}

async function mockParkingLive(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('parkly_token', 'atk-guard')
    window.localStorage.setItem('parkly_refresh_token', 'rtk-guard')
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(guardPrincipal()) })
  })

  await page.route('**/api/sites', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [{ siteCode: 'SITE01', name: 'Site 01', isActive: true }] }),
    })
  })

  let boardFetchCount = 0
  await page.route('**/api/ops/parking-live?**', async (route) => {
    boardFetchCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        site: { siteCode: 'SITE01', name: 'Site 01' },
        filters: { floorKey: null, zoneCode: null, status: null, q: null, refresh: false },
        connection: { source: 'projection', reconciledAt: '2026-03-18T00:00:00.000Z', streamSupported: true },
        floors: [{
          floorKey: 'F1',
          label: 'Floor 1',
          summary: {
            total: 2,
            empty: 1,
            occupiedMatched: 1,
            occupiedUnknown: 0,
            occupiedViolation: 0,
            sensorStale: 0,
            blocked: 0,
            reserved: 0,
            occupiedTotal: 1,
          },
          slots: [{
            spotId: 'spot_1',
            spotCode: 'A-01',
            siteCode: 'SITE01',
            zoneCode: 'A',
            floorKey: 'F1',
            layoutRow: 1,
            layoutCol: 1,
            layoutOrder: 1,
            slotKind: 'STANDARD',
            occupancyStatus: 'EMPTY',
            plateNumber: null,
            subscriptionId: null,
            subscriptionCode: null,
            sessionId: null,
            incidentCode: null,
            updatedAt: '2026-03-18T00:00:00.000Z',
            stale: false,
          }],
        }],
      }),
    })
  })

  await page.route('**/api/ops/parking-live/summary?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        site: { siteCode: 'SITE01', name: 'Site 01' },
        summary: {
          total: 2,
          empty: 1,
          occupiedMatched: 1,
          occupiedUnknown: 0,
          occupiedViolation: 0,
          sensorStale: 0,
          blocked: 0,
          reserved: 0,
          occupiedTotal: 1,
        },
        floors: [{ floorKey: 'F1', label: 'Floor 1', total: 2, empty: 1, occupiedTotal: 1, sensorStale: 0, blocked: 0, reserved: 0 }],
        updatedAt: '2026-03-18T00:00:00.000Z',
      }),
    })
  })

  await page.route('**/api/stream/parking-live?**', async (route) => {
    await route.abort('failed')
  })

  return {
    getBoardFetchCount: () => boardFetchCount,
  }
}

test('parking live keeps the last snapshot visible when realtime falls back to stale mode', async ({ page }) => {
  const telemetry = await mockParkingLive(page)

  await page.goto('/parking-live?siteCode=SITE01')

  await expect(page.getByRole('heading', { name: 'Parking Live' })).toBeVisible()
  await expect(page.getByText('A-01')).toBeVisible()
  await expect(page.getByText('Realtime is stale. The board is showing the last good snapshot and periodic fallback refresh.')).toBeVisible()

  const before = telemetry.getBoardFetchCount()
  await page.getByRole('button', { name: 'Reconcile' }).click()

  await expect.poll(() => telemetry.getBoardFetchCount()).toBeGreaterThan(before)
  await expect(page.getByText('A-01')).toBeVisible()
})
