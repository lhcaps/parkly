import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildDashboardOverview,
  buildDashboardSiteOverviewRows,
  composeDashboardSummaryDocument,
} from '../modules/dashboard/application/dashboard-summary-composer'
import { pickDashboardAllowedSiteCodesFromPolicy } from '../modules/dashboard/application/dashboard-site-scope-policy'

function resolveApiSrcRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'src'),
    path.resolve(cwd, 'apps/api/src'),
    path.resolve(__dirname, '..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Không resolve được apps/api/src cho contract test')
  return found
}

const srcRoot = resolveApiSrcRoot()

function readSource(relPath: string) {
  return fs.readFileSync(path.join(srcRoot, relPath), 'utf8')
}

test('overview screen summary được compose ổn định từ read-model slices', () => {
  const doc = composeDashboardSummaryDocument({
    generatedAt: '2026-03-12T08:00:00.000Z',
    scope: {
      requestedSiteCode: null,
      siteCodes: ['SITE_HCM_01', 'SITE_DN_01'],
      siteCount: 2,
      isAllSites: false,
    },
    sinceHours: 24,
    expiringInDays: 7,
    incidents: [
      {
        siteCode: 'SITE_HCM_01',
        totalCount: 8,
        openCount: 2,
        ackedCount: 1,
        resolvedCount: 4,
        ignoredCount: 1,
        criticalOpenCount: 1,
        infoCount: 2,
        warnCount: 4,
        criticalCount: 2,
        resolvedWithinWindowCount: 3,
        oldestActiveCreatedAt: '2026-03-11T07:00:00.000Z',
        lastUpdatedAt: '2026-03-12T07:55:00.000Z',
      },
      {
        siteCode: 'SITE_DN_01',
        totalCount: 3,
        openCount: 1,
        ackedCount: 0,
        resolvedCount: 2,
        ignoredCount: 0,
        criticalOpenCount: 0,
        infoCount: 1,
        warnCount: 1,
        criticalCount: 1,
        resolvedWithinWindowCount: 1,
        oldestActiveCreatedAt: '2026-03-11T08:00:00.000Z',
        lastUpdatedAt: '2026-03-12T07:40:00.000Z',
      },
    ],
    occupancy: [
      {
        siteCode: 'SITE_HCM_01',
        totalSpots: 100,
        emptyCount: 40,
        occupiedMatchedCount: 45,
        occupiedUnknownCount: 5,
        occupiedViolationCount: 3,
        sensorStaleCount: 2,
        unreportedCount: 5,
        occupiedTotal: 55,
        occupancyRate: 55,
        lastProjectedAt: '2026-03-12T07:58:00.000Z',
      },
      {
        siteCode: 'SITE_DN_01',
        totalSpots: 20,
        emptyCount: 10,
        occupiedMatchedCount: 8,
        occupiedUnknownCount: 1,
        occupiedViolationCount: 0,
        sensorStaleCount: 1,
        unreportedCount: 0,
        occupiedTotal: 10,
        occupancyRate: 50,
        lastProjectedAt: '2026-03-12T07:57:00.000Z',
      },
    ],
    lanes: [
      {
        siteCode: 'SITE_HCM_01',
        totalLanes: 4,
        entryCount: 2,
        exitCount: 2,
        activeCount: 3,
        inactiveCount: 0,
        maintenanceCount: 1,
        healthyCount: 2,
        degradedCount: 1,
        barrierFaultCount: 1,
        offlineCount: 0,
        attentionCount: 2,
        activePresenceCount: 6,
        openSessionCount: 2,
      },
      {
        siteCode: 'SITE_DN_01',
        totalLanes: 2,
        entryCount: 1,
        exitCount: 1,
        activeCount: 2,
        inactiveCount: 0,
        maintenanceCount: 0,
        healthyCount: 1,
        degradedCount: 0,
        barrierFaultCount: 0,
        offlineCount: 1,
        attentionCount: 1,
        activePresenceCount: 1,
        openSessionCount: 1,
      },
    ],
    subscriptions: [
      {
        siteCode: 'SITE_HCM_01',
        totalSubscriptions: 40,
        activeCount: 25,
        expiredCount: 5,
        cancelledCount: 2,
        suspendedCount: 8,
        monthlyActiveCount: 20,
        vipActiveCount: 5,
        expiringSoonCount: 4,
        activeVehicleLinkCount: 28,
        activeSpotLinkCount: 7,
      },
      {
        siteCode: 'SITE_DN_01',
        totalSubscriptions: 12,
        activeCount: 6,
        expiredCount: 3,
        cancelledCount: 1,
        suspendedCount: 2,
        monthlyActiveCount: 4,
        vipActiveCount: 2,
        expiringSoonCount: 1,
        activeVehicleLinkCount: 6,
        activeSpotLinkCount: 2,
      },
    ],
    topology: [
      {
        siteCode: 'SITE_HCM_01',
        zoneCount: 2,
        gateCount: 4,
        laneCount: 8,
        deviceCount: 16,
        zoneCodes: ['Z1', 'Z2'],
        zoneNames: ['Zone 1', 'Zone 2'],
        vehicleTypes: ['CAR', 'MOTORBIKE'],
      },
      {
        siteCode: 'SITE_DN_01',
        zoneCount: 1,
        gateCount: 2,
        laneCount: 4,
        deviceCount: 8,
        zoneCodes: ['Z3'],
        zoneNames: ['Zone 3'],
        vehicleTypes: ['CAR'],
      },
    ],
  })

  assert.equal(doc.overview.incidentsOpenCount, 3)
  assert.equal(doc.overview.criticalIncidentsOpenCount, 1)
  assert.equal(doc.overview.laneAttentionCount, 3)
  assert.equal(doc.overview.offlineLaneCount, 1)
  assert.equal(doc.overview.activeSubscriptionCount, 31)
  assert.equal(doc.overview.expiringSubscriptionCount, 5)
  assert.equal(doc.overview.activePresenceCount, 7)
  assert.equal(doc.overview.openSessionCount, 3)
  assert.equal(doc.occupancy.totalSpots, 120)
  assert.equal(doc.occupancy.occupiedTotal, 65)
  assert.equal(doc.occupancy.occupancyRate, 54.17)
  assert.equal(doc.sites.length, 2)
  assert.deepEqual(doc.sites[0], {
    siteCode: 'SITE_DN_01',
    incidentsOpenCount: 1,
    criticalIncidentsOpenCount: 0,
    occupancyRate: 50,
    laneAttentionCount: 1,
    offlineLaneCount: 1,
    activeSubscriptionCount: 6,
    expiringSubscriptionCount: 1,
    activePresenceCount: 1,
    openSessionCount: 1,
    zoneCount: 1,
    gateCount: 2,
    laneCount: 4,
    deviceCount: 8,
    zoneCodes: ['Z3'],
    zoneNames: ['Zone 3'],
    vehicleTypes: ['CAR'],
  })
})

test('site scoping và role scoping được chốt rõ cho dashboard', () => {
  const activeSiteCodes = ['SITE_DN_01', 'SITE_HCM_01', 'SITE_HN_01']

  assert.deepEqual(
    pickDashboardAllowedSiteCodesFromPolicy({
      principalType: 'USER',
      role: 'SUPER_ADMIN',
      actorUserId: 1n,
      actorLabel: 'SUPER_ADMIN:1',
      userId: '1',
      username: 'superadmin',
      sessionId: 'session-super-admin',
      siteScopes: [],
    }, activeSiteCodes),
    activeSiteCodes,
  )

  assert.deepEqual(
    pickDashboardAllowedSiteCodesFromPolicy({
      principalType: 'USER',
      role: 'GUARD',
      actorUserId: 2n,
      actorLabel: 'GUARD:2',
      userId: '2',
      username: 'guard',
      sessionId: 'session-guard',
      siteScopes: [
        { siteId: '1', siteCode: 'SITE_DN_01', scopeLevel: 'GUARD' },
        { siteId: '2', siteCode: 'SITE_HCM_01', scopeLevel: 'GUARD' },
      ],
    }, activeSiteCodes),
    ['SITE_DN_01', 'SITE_HCM_01'],
  )

  assert.deepEqual(
    pickDashboardAllowedSiteCodesFromPolicy({
      principalType: 'USER',
      role: 'OPERATOR',
      actorUserId: 3n,
      actorLabel: 'OPERATOR:3',
      userId: '3',
      username: 'operator',
      sessionId: 'session-operator',
      siteScopes: [],
    }, activeSiteCodes),
    [],
  )
})

test('overview card fusion chạy nhanh với tập site summary cỡ local thực tế', () => {
  const sites = Array.from({ length: 250 }, (_, index) => `SITE_${String(index + 1).padStart(3, '0')}`)
  const startedAt = Date.now()
  const siteRows = buildDashboardSiteOverviewRows({
    siteCodes: sites,
    incidents: sites.map((siteCode, index) => ({
      siteCode,
      totalCount: 20,
      openCount: index % 3,
      ackedCount: 1,
      resolvedCount: 10,
      ignoredCount: 0,
      criticalOpenCount: index % 5 === 0 ? 1 : 0,
      infoCount: 5,
      warnCount: 10,
      criticalCount: 5,
      resolvedWithinWindowCount: 4,
      oldestActiveCreatedAt: null,
      lastUpdatedAt: null,
    })),
    occupancy: sites.map((siteCode) => ({
      siteCode,
      totalSpots: 100,
      emptyCount: 50,
      occupiedMatchedCount: 40,
      occupiedUnknownCount: 5,
      occupiedViolationCount: 2,
      sensorStaleCount: 1,
      unreportedCount: 2,
      occupiedTotal: 48,
      occupancyRate: 48,
      lastProjectedAt: null,
    })),
    lanes: sites.map((siteCode, index) => ({
      siteCode,
      totalLanes: 4,
      entryCount: 2,
      exitCount: 2,
      activeCount: 4,
      inactiveCount: 0,
      maintenanceCount: 0,
      healthyCount: 3,
      degradedCount: 1,
      barrierFaultCount: 0,
      offlineCount: index % 7 === 0 ? 1 : 0,
      attentionCount: 1,
      activePresenceCount: 2,
      openSessionCount: 1,
    })),
    subscriptions: sites.map((siteCode) => ({
      siteCode,
      totalSubscriptions: 50,
      activeCount: 25,
      expiredCount: 10,
      cancelledCount: 5,
      suspendedCount: 10,
      monthlyActiveCount: 20,
      vipActiveCount: 5,
      expiringSoonCount: 3,
      activeVehicleLinkCount: 25,
      activeSpotLinkCount: 10,
    })),
    topology: sites.map((siteCode) => ({
      siteCode,
      zoneCount: 1,
      gateCount: 2,
      laneCount: 4,
      deviceCount: 8,
      zoneCodes: ['Z1'],
      zoneNames: ['Zone 1'],
      vehicleTypes: ['CAR'],
    })),
  })
  const overview = buildDashboardOverview({
    incidents: {
      totalCount: 5000,
      openCount: 300,
      ackedCount: 250,
      resolvedCount: 4000,
      ignoredCount: 450,
      criticalOpenCount: 50,
      bySeverity: { INFO: 1200, WARN: 2500, CRITICAL: 1300 },
      resolvedWithinWindowCount: 200,
      oldestActiveCreatedAt: null,
      lastUpdatedAt: null,
    },
    occupancy: {
      totalSpots: 25000,
      emptyCount: 12500,
      occupiedMatchedCount: 10000,
      occupiedUnknownCount: 1250,
      occupiedViolationCount: 750,
      sensorStaleCount: 250,
      unreportedCount: 250,
      occupiedTotal: 12250,
      occupancyRate: 49,
      lastProjectedAt: null,
    },
    lanes: {
      totalLanes: 1000,
      entryCount: 500,
      exitCount: 500,
      activeCount: 950,
      inactiveCount: 20,
      maintenanceCount: 30,
      healthyCount: 700,
      degradedCount: 200,
      barrierFaultCount: 50,
      offlineCount: 50,
      attentionCount: 300,
      activePresenceCount: 500,
      openSessionCount: 250,
    },
    subscriptions: {
      totalSubscriptions: 12500,
      activeCount: 6250,
      expiredCount: 2500,
      cancelledCount: 1250,
      suspendedCount: 2500,
      monthlyActiveCount: 5000,
      vipActiveCount: 1250,
      expiringSoonCount: 750,
      activeVehicleLinkCount: 6250,
      activeSpotLinkCount: 2500,
    },
  })
  const durationMs = Date.now() - startedAt

  assert.equal(siteRows.length, 250)
  assert.equal(overview.activeSubscriptionCount, 6250)
  assert.ok(durationMs < 100, `overview composition quá chậm: ${durationMs}ms`)
})

test('source regression: dashboard routes được register, validate và load read models song song', () => {
  const appSource = readSource('server/app.ts')
  const routeSource = readSource('modules/dashboard/interfaces/http/register-dashboard-routes.ts')
  const serviceSource = readSource('modules/dashboard/application/dashboard-summary.ts')
  const readModelSource = readSource('server/services/read-models/dashboard-summary.read-model.ts')
  const docsSource = fs.readFileSync(path.resolve(srcRoot, '../../../docs/API.md'), 'utf8')

  assert.match(appSource, /registerDashboardRoutes\(api\)/)
  assert.match(appSource, /'\/ops\/dashboard\/summary': \{\}/)
  assert.match(routeSource, /api\.get\('\/ops\/dashboard\/summary'/)
  assert.match(routeSource, /api\.get\('\/ops\/dashboard\/sites\/:siteCode\/summary'/)
  assert.match(routeSource, /api\.get\('\/ops\/dashboard\/incidents\/summary'/)
  assert.match(routeSource, /api\.get\('\/ops\/dashboard\/occupancy\/summary'/)
  assert.match(routeSource, /api\.get\('\/ops\/dashboard\/lanes\/summary'/)
  assert.match(routeSource, /api\.get\('\/ops\/dashboard\/subscriptions\/summary'/)
  assert.match(routeSource, /const parsed = validateOrThrow\(DashboardSummaryQuery, req\.query \?\? \{\}\)/)
  assert.match(routeSource, /const parsed = validateOrThrow\(DashboardSliceQuery, req\.query \?\? \{\}\)/)
  assert.match(serviceSource, /const \[incidents, occupancy, lanes, subscriptions\] = await Promise\.all\(\[/)
  assert.match(serviceSource, /resolveDashboardSiteScope\(/)
  assert.match(readModelSource, /queryIncidentSummarySiteRows/)
  assert.match(readModelSource, /queryOccupancySummarySiteRows/)
  assert.match(readModelSource, /queryLaneSummarySiteRows/)
  assert.match(readModelSource, /querySubscriptionSummarySiteRows/)
  assert.match(docsSource, /GET \/api\/ops\/dashboard\/summary/)
  assert.match(docsSource, /GET \/api\/ops\/dashboard\/sites\/:siteCode\/summary/)
  assert.match(docsSource, /một hoặc hai call summary/i)
})
