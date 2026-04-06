import { Buffer } from 'node:buffer'
import { expect, test, type Page, type Route } from '@playwright/test'
import { saveSignoffScreenshot } from './helpers/signoff'

const SITE = {
  siteId: 'site-1',
  siteCode: 'SITE01',
  name: 'Site 01',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
}

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s0pKfQAAAAASUVORK5CYII=',
  'base64',
)

function principal(role: 'SUPER_ADMIN' | 'SITE_ADMIN' | 'MANAGER' | 'OPERATOR' | 'GUARD' | 'CASHIER' | 'VIEWER') {
  return {
    principalType: 'USER',
    role,
    actorLabel: `${role.toLowerCase()} actor`,
    userId: `user-${role.toLowerCase()}`,
    username: role.toLowerCase(),
    sessionId: `sess-${role.toLowerCase()}`,
    siteScopes: [{ siteId: SITE.siteId, siteCode: SITE.siteCode, scopeLevel: 'SITE' }],
  }
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function installAuthenticatedShell(
  page: Page,
  role: 'SUPER_ADMIN' | 'SITE_ADMIN' | 'MANAGER' | 'OPERATOR' | 'GUARD' | 'CASHIER' | 'VIEWER',
  options?: { theme?: 'light' | 'dark' | 'system' },
) {
  const accessToken = `atk-${role.toLowerCase()}`
  const refreshToken = `rtk-${role.toLowerCase()}`

  await page.addInitScript(
    ({ accessToken, refreshToken, theme }) => {
      window.localStorage.setItem('parkly_token', accessToken)
      window.localStorage.setItem('parkly_refresh_token', refreshToken)
      window.localStorage.setItem('parkly-locale', 'en')
      if (theme && !window.localStorage.getItem('parkly-theme')) {
        window.localStorage.setItem('parkly-theme', theme)
      }
    },
    { accessToken, refreshToken, theme: options?.theme },
  )

  await page.route('**/api/auth/me', async (route) => {
    await fulfillJson(route, principal(role))
  })

  await page.route('**/api/me', async (route) => {
    await fulfillJson(route, { role })
  })

  await page.route('**/api/auth/password-policy', async (route) => {
    await fulfillJson(route, {
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
    })
  })

  await page.route('**/api/sites**', async (route) => {
    await fulfillJson(route, { rows: [SITE] })
  })
}

function reviewQueueRow(status: 'OPEN' | 'CLAIMED') {
  return {
    reviewId: 'review_1001',
    status,
    queueReasonCode: 'PLATE_MISMATCH',
    createdAt: '2026-03-18T00:00:00.000Z',
    claimedByUserId: status === 'CLAIMED' ? 'user-operator' : null,
    claimedAt: status === 'CLAIMED' ? '2026-03-18T00:01:00.000Z' : null,
    resolvedByUserId: null,
    resolvedAt: null,
    note: null,
    snapshot: null,
    session: {
      sessionId: 'GS-1001',
      siteCode: 'SITE01',
      gateCode: 'GATE01',
      laneCode: 'LANE01',
      direction: 'ENTRY',
      status: 'OPEN',
      allowedActions: ['MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER'],
      ticketId: null,
      correlationId: 'corr-review-1',
      openedAt: '2026-03-18T00:00:00.000Z',
      lastReadAt: '2026-03-18T00:00:10.000Z',
      resolvedAt: null,
      closedAt: null,
      plateCompact: '43A12345',
      rfidUid: 'RFID-1001',
      presenceActive: true,
      reviewRequired: true,
      readCount: 1,
      decisionCount: 1,
      barrierCommandCount: 0,
    },
    latestDecision: null,
    actions:
      status === 'OPEN'
        ? ['CLAIM', 'MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER']
        : ['MANUAL_APPROVE', 'MANUAL_REJECT', 'MANUAL_OPEN_BARRIER'],
  }
}

function sessionDetailFixture() {
  return {
    session: {
      sessionId: 'GS-1001',
      siteCode: 'SITE01',
      gateCode: 'GATE01',
      laneCode: 'LANE01',
      direction: 'ENTRY',
      status: 'OPEN',
      allowedActions: ['APPROVE', 'REQUIRE_PAYMENT', 'DENY', 'CONFIRM_PASS', 'CANCEL'],
      ticketId: null,
      correlationId: 'corr-review-1',
      openedAt: '2026-03-18T00:00:00.000Z',
      lastReadAt: '2026-03-18T00:00:10.000Z',
      resolvedAt: null,
      closedAt: null,
      plateCompact: '43A12345',
      rfidUid: 'RFID-1001',
      presenceActive: true,
      reviewRequired: true,
      readCount: 1,
      decisionCount: 1,
      barrierCommandCount: 0,
    },
    reads: [
      {
        readEventId: 'read-1',
        occurredAt: '2026-03-18T00:00:10.000Z',
        readType: 'ALPR',
        plateCompact: '43A12345',
        plateRaw: '43A-12345',
        rfidUid: 'RFID-1001',
        sensorState: 'PRESENT',
        ocrConfidence: 0.94,
        evidence: {
          sourceDeviceCode: 'CAM01',
          media: { mediaId: 'media-1', url: null },
        },
      },
    ],
    decisions: [
      {
        decisionId: 'decision-1',
        decisionCode: 'REVIEW_REQUIRED',
        recommendedAction: 'MANUAL_REVIEW',
        finalAction: 'MANUAL_REVIEW',
        reasonCode: 'PLATE_MISMATCH',
        reasonDetail: 'Manual review required',
        reviewRequired: true,
        explanation: 'Plate capture and lane state do not match.',
        inputSnapshot: {},
        thresholdSnapshot: {},
      },
    ],
    barrierCommands: [],
    manualReviews: [
      {
        reviewId: 'review_1001',
        status: 'OPEN',
        queueReasonCode: 'PLATE_MISMATCH',
        claimedByUserId: null,
        claimedAt: null,
        resolvedByUserId: null,
        resolvedAt: null,
        note: null,
      },
    ],
    incidents: [],
    timeline: [],
  }
}

function outboxRestRow() {
  return {
    outboxId: 'outbox_1001',
    eventId: 'evt_1001',
    siteId: SITE.siteId,
    eventTime: '2026-03-18T00:05:00.000Z',
    status: 'FAILED',
    attempts: 3,
    sentAt: null,
    nextRetryAt: '2026-03-18T00:15:00.000Z',
    lastError: 'Downstream timeout after 15s.',
    mongoDocId: 'mongo-1001',
    createdAt: '2026-03-18T00:05:00.000Z',
    updatedAt: '2026-03-18T00:06:00.000Z',
    payload: {
      siteCode: 'SITE01',
      laneCode: 'LANE01',
      deviceCode: 'CAM01',
      direction: 'ENTRY',
      readType: 'ALPR',
      plateDisplay: '43A-12345',
      plateCompact: '43A12345',
      reviewRequired: true,
      correlationId: 'corr-outbox-1',
      requestId: 'req-outbox-1',
      action: 'BARRIER_OPEN',
      entityTable: 'gate_sessions',
      entityId: 'GS-1001',
      sessionId: 'GS-1001',
    },
  }
}

function outboxStreamSnapshot() {
  return [
    'event: outbox_snapshot',
    `data: ${JSON.stringify({
      rows: [
        {
          outboxId: 'outbox_1001',
          eventId: 'evt_1001',
          siteCode: 'SITE01',
          laneCode: 'LANE01',
          deviceCode: 'CAM01',
          eventTime: '2026-03-18T00:05:00.000Z',
          status: 'FAILED',
          attempts: 3,
          nextRetryAt: '2026-03-18T00:15:00.000Z',
          lastError: 'Downstream timeout after 15s.',
          mongoDocId: 'mongo-1001',
          createdAt: '2026-03-18T00:05:00.000Z',
          updatedAt: '2026-03-18T00:06:00.000Z',
          payloadSummary: {
            direction: 'ENTRY',
            readType: 'ALPR',
            plateDisplay: '43A-12345',
            plateCompact: '43A12345',
            reviewRequired: true,
          },
        },
      ],
      barrierLifecycle: {
        promotedToSent: 0,
        timedOut: 1,
      },
    })}`,
    '',
    '',
  ].join('\n')
}

test('review queue claims a case and saves action-desk evidence', async ({ page }) => {
  let reviewStatus: 'OPEN' | 'CLAIMED' = 'OPEN'

  await installAuthenticatedShell(page, 'OPERATOR')

  await page.route('**/api/gate-review-queue/review_1001/claim', async (route) => {
    reviewStatus = 'CLAIMED'
    await fulfillJson(route, { reviewId: 'review_1001', changed: true })
  })

  await page.route('**/api/gate-review-queue?**', async (route) => {
    await fulfillJson(route, { rows: [reviewQueueRow(reviewStatus)] })
  })

  await page.route('**/api/gate-sessions/GS-1001', async (route) => {
    await fulfillJson(route, sessionDetailFixture())
  })

  await page.goto('/review-queue?siteCode=SITE01')

  await expect(page.getByRole('heading', { name: /review queue/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('PLATE_MISMATCH').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Claim/i })).toBeEnabled()

  await page.getByLabel('Reason code').fill('CLAIMED_ON_DESK')
  await page.getByLabel('Note').fill('Operator confirmed the lane context before taking ownership.')
  await page.getByRole('button', { name: /^Claim/i }).click()

  await expect(page.getByText('CLAIMED').first()).toBeVisible()
  await saveSignoffScreenshot(page, 'review-queue-action-desk.png')
})

test('session history shows degraded detail state and saves signoff evidence', async ({ page }) => {
  await installAuthenticatedShell(page, 'VIEWER')

  await page.route('**/api/lanes**', async (route) => {
    await fulfillJson(route, {
      siteCode: 'SITE01',
      rows: [
        { laneCode: 'LANE01', gateCode: 'GATE01', label: 'Lane 01', siteCode: 'SITE01', direction: 'ENTRY', isActive: true },
      ],
    })
  })

  await page.route('**/api/gate-sessions?**', async (route) => {
    await fulfillJson(route, {
      rows: [
        {
          sessionId: 'GS-1001',
          siteCode: 'SITE01',
          gateCode: 'GATE01',
          laneCode: 'LANE01',
          direction: 'ENTRY',
          status: 'WAITING_DECISION',
          allowedActions: ['APPROVE'],
          ticketId: null,
          correlationId: 'corr-session-1',
          openedAt: '2026-03-18T00:00:00.000Z',
          lastReadAt: '2026-03-18T00:00:10.000Z',
          resolvedAt: null,
          closedAt: null,
          plateCompact: '43A12345',
          rfidUid: 'RFID-1001',
          presenceActive: true,
          reviewRequired: true,
          readCount: 1,
          decisionCount: 0,
          barrierCommandCount: 0,
        },
      ],
    })
  })

  await page.route('**/api/gate-sessions/GS-1001', async (route) => {
    await fulfillJson(
      route,
      {
        code: 'DEP_UNAVAILABLE',
        message: 'Session detail temporarily unavailable.',
        details: {
          dependency: 'session detail',
          hint: 'signoff detail failure',
        },
      },
      503,
    )
  })

  await page.goto('/session-history?siteCode=SITE01')

  await expect(page.getByRole('heading', { name: /session history/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('GS-1001')).toBeVisible()
  await expect(page.getByText(/signoff detail failure/i)).toBeVisible()
  await saveSignoffScreenshot(page, 'session-history-detail-error.png')
})

test('outbox triage shows failed backlog and saves signoff evidence', async ({ page }) => {
  await installAuthenticatedShell(page, 'SUPER_ADMIN')

  await page.route('**/api/outbox?**', async (route) => {
    await fulfillJson(route, {
      rows: [outboxRestRow()],
      nextCursor: null,
    })
  })

  await page.route('**/api/stream/outbox?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: outboxStreamSnapshot(),
      headers: {
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  })

  await page.goto('/sync-outbox?siteCode=SITE01&quick=failed')

  await expect(page.getByRole('heading', { name: /sync outbox/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('outbox_1001').first()).toBeVisible()

  await page.getByRole('button', { name: /preview drain/i }).click()
  await expect(page.getByText(/Preview batch drain/i)).toBeVisible()
  await saveSignoffScreenshot(page, 'outbox-triage.png')
})

test('mobile pair creates a QR link and saves signoff evidence', async ({ page }) => {
  await installAuthenticatedShell(page, 'OPERATOR')

  await page.route('https://api.qrserver.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="white"/><rect x="32" y="32" width="80" height="80" fill="black"/><rect x="208" y="32" width="80" height="80" fill="black"/><rect x="32" y="208" width="80" height="80" fill="black"/><rect x="144" y="144" width="32" height="32" fill="black"/></svg>',
    })
  })

  await page.route('**/api/lanes**', async (route) => {
    await fulfillJson(route, {
      siteCode: 'SITE01',
      rows: [
        {
          laneCode: 'LANE01',
          gateCode: 'GATE01',
          label: 'Main entry',
          siteCode: 'SITE01',
          direction: 'ENTRY',
          isActive: true,
        },
      ],
    })
  })

  await page.route('**/api/devices**', async (route) => {
    await fulfillJson(route, {
      siteCode: 'SITE01',
      rows: [
        {
          deviceCode: 'CAM01',
          deviceType: 'ALPR_CAMERA',
          deviceRole: 'PRIMARY_CAMERA',
          laneCode: 'LANE01',
          laneLabel: 'Main entry',
          gateCode: 'GATE01',
          isPrimary: true,
          isRequired: true,
        },
      ],
    })
  })

  await page.route('**/api/mobile-capture/pair', async (route) => {
    await fulfillJson(route, {
      pairToken: 'pair_demo',
      siteCode: 'SITE01',
      laneCode: 'LANE01',
      direction: 'ENTRY',
      deviceCode: 'CAM01',
      mobileUrl: 'http://127.0.0.1:4174/mobile-capture?siteCode=SITE01&laneCode=LANE01&direction=ENTRY&deviceCode=CAM01&token=pair_demo',
    })
  })

  await page.goto('/mobile-camera-pair')

  await expect(page.getByRole('heading', { name: /mobile camera pair/i })).toBeVisible({ timeout: 15000 })
  await page.locator('button').filter({ hasText: /select lane/i }).first().click()
  await page.locator('button').filter({ hasText: /LANE01/i }).last().click()
  await page.locator('button').filter({ hasText: /select device/i }).first().click()
  await page.locator('button').filter({ hasText: /CAM01/i }).last().click()
  await page.getByRole('button', { name: /create pair/i }).click()

  await expect(page.getByText(/Created pair/i)).toBeVisible()
  await expect(page.getByAltText('Mobile pair QR')).toBeVisible()
  await saveSignoffScreenshot(page, 'mobile-pair-qr.png')
})

test('mobile capture accepts a pair-token flow and saves receipt evidence', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('parkly-locale', 'vi')
  })

  await page.route('**/api/mobile-capture/upload?pairToken=pair_demo', async (route) => {
    await fulfillJson(route, {
      mediaId: 'media_1001',
      imageUrl: 'https://cdn.example.com/capture-1001.jpg',
      viewUrl: 'https://cdn.example.com/capture-1001.jpg',
      filename: 'capture-1001.png',
    })
  })

  await page.route('**/api/mobile-capture/alpr?pairToken=pair_demo', async (route) => {
    await fulfillJson(route, {
      pairing: { pairToken: 'pair_demo' },
      mediaId: 'media_1001',
      viewUrl: 'https://cdn.example.com/capture-1001.jpg',
      recognition: {
        recognizedPlate: '43A12345',
        plate: '43A-12345',
        confidence: 0.96,
        previewStatus: 'STRICT_VALID',
        needsConfirm: false,
        candidates: [],
        winner: null,
        plateFamily: 'VN',
        ocrSubstitutions: [],
        suspiciousFlags: [],
        validationNotes: [],
        raw: {},
      },
      capture: {
        siteCode: 'SITE01',
        laneCode: 'LANE01',
        deviceCode: 'CAM01',
        direction: 'ENTRY',
        plateRaw: '43A12345',
        plateCompact: '43A12345',
        plate: {
          plateRaw: '43A12345',
          plateCompact: '43A12345',
          plateDisplay: '43A-12345',
          plateFamily: 'VN',
          plateValidity: 'STRICT_VALID',
          ocrSubstitutions: [],
          suspiciousFlags: [],
          validationNotes: [],
          reviewRequired: false,
        },
        readEventId: 1001,
        occurredAt: '2026-03-18T00:09:00.000Z',
        sessionId: 'GS-2001',
        sessionStatus: 'APPROVED',
        changed: true,
        alreadyExists: false,
        ocrConfidence: 0.96,
        rfidUid: null,
        sensorState: null,
      },
    })
  })

  await page.goto('/mobile-capture?siteCode=SITE01&laneCode=LANE01&direction=ENTRY&deviceCode=CAM01&token=pair_demo')

  await expect(page.getByRole('heading', { name: /Ghi nhận qua mobile/i })).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'capture.png',
    mimeType: 'image/png',
    buffer: TEST_PNG,
  })
  await page.getByRole('button', { name: 'Gửi ghi nhận' }).click()

  await expect(page.getByRole('heading', { name: /Đã nhận ghi nhận/i })).toBeVisible()
  await expect(page.getByText('GS-2001', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Â')
  await saveSignoffScreenshot(page, 'mobile-capture-receipt.png')
})

test('settings persists dark theme and saves signoff evidence', async ({ page }) => {
  await installAuthenticatedShell(page, 'GUARD', { theme: 'light' })

  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 15000 })
  await page.getByRole('tab', { name: /appearance/i }).click()
  await page.getByRole('button', { name: /^Dark/i }).click()

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('parkly-theme'))).toBe('dark')
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)

  await page.reload()
  await page.getByRole('tab', { name: /appearance/i }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  await saveSignoffScreenshot(page, 'settings-theme-dark.png')
})

test('topology admin opens creation dialogs and saves signoff evidence', async ({ page }) => {
  await installAuthenticatedShell(page, 'SITE_ADMIN')

  await page.route('**/api/topology?**', async (route) => {
    await fulfillJson(route, {
      site: SITE,
      gates: [
        {
          gateCode: 'GATE01',
          siteCode: 'SITE01',
          label: 'Main Gate',
          laneCount: 1,
          directions: ['ENTRY'],
          lanes: [
            {
              laneCode: 'LANE01',
              label: 'Lane 01',
              direction: 'ENTRY',
              status: 'ACTIVE',
              sortOrder: 0,
              primaryDeviceCode: 'CAM01',
              devices: [
                {
                  siteCode: 'SITE01',
                  gateCode: 'GATE01',
                  laneCode: 'LANE01',
                  laneLabel: 'Lane 01',
                  laneStatus: 'ACTIVE',
                  deviceCode: 'CAM01',
                  deviceType: 'ALPR_CAMERA',
                  direction: 'ENTRY',
                  locationHint: 'Pole A',
                  deviceRole: 'PRIMARY_CAMERA',
                  isPrimary: true,
                  isRequired: true,
                  heartbeatStatus: 'ONLINE',
                  heartbeatReportedAt: '2026-03-18T00:00:00.000Z',
                  heartbeatReceivedAt: '2026-03-18T00:00:00.000Z',
                  heartbeatAgeSeconds: 5,
                  latencyMs: 35,
                  firmwareVersion: '1.0.0',
                  ipAddress: '192.168.1.10',
                },
              ],
            },
          ],
        },
      ],
    })
  })

  await page.route('**/api/admin/topology/devices/unassigned?**', async (route) => {
    await fulfillJson(route, { rows: [] })
  })

  await page.goto('/topology')

  await expect(page.getByRole('heading', { name: /device pool/i })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /add gate/i }).click()
  await expect(page.getByText(/add new gate/i)).toBeVisible()
  await page.getByRole('button', { name: /cancel/i }).click()
  await page.getByRole('button', { name: /add lane/i }).click()
  await expect(page.getByText(/add new lane/i)).toBeVisible()
  await saveSignoffScreenshot(page, 'topology-dialogs.png')
})
