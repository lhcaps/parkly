import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { syncIncidentFromSpotProjection, type IncidentHistoryEntry, type IncidentSummary } from '../modules/incidents/application/incident-service'
import {
  buildProjectionIncidentSignal,
  resolveSeverityForSignal,
  type IncidentNoiseControlConfig,
} from '../modules/incidents/application/incident-noise-policy'
import type { SpotProjectionRow } from '../modules/reconciliation/application/run-reconciliation'

function makeProjection(overrides: Partial<SpotProjectionRow> = {}): SpotProjectionRow {
  return {
    projectionId: '1',
    siteId: '1',
    zoneId: '10',
    spotId: '100',
    zoneCode: 'VIP',
    spotCode: 'A-01',
    occupancyStatus: 'OCCUPIED_VIOLATION',
    observedPlateCompact: '51A12345',
    expectedPlateCompact: '51A99999',
    matchedSubscriptionId: '200',
    matchedSubscriptionSpotId: '300',
    matchedGatePresenceId: '400',
    sourcePresenceEventId: '500',
    reasonCode: 'VIP_WRONG_SPOT',
    reasonDetail: 'Xe VIP đang đỗ sai spot.',
    staleAt: null,
    snapshot: { source: 'test' },
    updatedAt: '2026-03-12T08:00:00.000Z',
    ...overrides,
  }
}

function resolveApiSrcRoot() {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'src'),
    path.resolve(cwd, 'apps/api/src'),
    path.resolve(__dirname, '..'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Không resolve được apps/api/src cho PR24 test')
  return found
}

const srcRoot = resolveApiSrcRoot()

function readSource(relPath: string) {
  return fs.readFileSync(path.join(srcRoot, relPath), 'utf8')
}

function createMemoryDeps(options: {
  times?: string[]
  noiseControl?: Partial<IncidentNoiseControlConfig>
} = {}) {
  const incidents: IncidentSummary[] = []
  const history: IncidentHistoryEntry[] = []
  const events: Array<{ eventType: string; payload: IncidentSummary }> = []
  const queue = [...(options.times ?? ['2026-03-12T08:00:00.000Z'])]
  let incidentSeq = 1
  let historySeq = 1

  const store = {
    async findActiveBySourceKey(sourceKey: string) {
      return incidents.find((row) => row.sourceKey === sourceKey && (row.status === 'OPEN' || row.status === 'ACKED')) ?? null
    },
    async findLatestBySourceKey(sourceKey: string) {
      return incidents.filter((row) => row.sourceKey === sourceKey).at(-1) ?? null
    },
    async findById(incidentId: string) {
      return incidents.find((row) => row.incidentId === incidentId) ?? null
    },
    async createIncident(input: any) {
      const row: IncidentSummary = {
        incidentId: String(incidentSeq++),
        siteId: input.siteId,
        siteCode: 'SITE_HCM_01',
        laneId: input.laneId ?? null,
        laneCode: null,
        deviceId: input.deviceId ?? null,
        deviceCode: null,
        sessionId: input.sessionId ?? null,
        severity: input.severity,
        status: input.status,
        incidentType: input.incidentType,
        title: input.title,
        detail: input.detail ?? null,
        sourceKey: input.sourceKey ?? null,
        resolutionAction: null,
        resolvedByUserId: null,
        resolvedByRole: null,
        evidenceMediaId: null,
        lastSignalAt: input.lastSignalAt ?? null,
        snapshot: input.snapshot ?? {},
        createdAt: queue[0] ?? '2026-03-12T08:00:00.000Z',
        updatedAt: queue[0] ?? '2026-03-12T08:00:00.000Z',
        resolvedAt: null,
      }
      incidents.push(row)
      return row
    },
    async updateIncident(incidentId: string, patch: any) {
      const row = incidents.find((item) => item.incidentId === incidentId)
      if (!row) throw new Error('incident not found')
      Object.assign(row, {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
        ...(patch.incidentType !== undefined ? { incidentType: patch.incidentType } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
        ...(patch.sourceKey !== undefined ? { sourceKey: patch.sourceKey } : {}),
        ...(patch.snapshot !== undefined ? { snapshot: patch.snapshot } : {}),
        ...(patch.resolutionAction !== undefined ? { resolutionAction: patch.resolutionAction } : {}),
        ...(patch.resolvedByUserId !== undefined ? { resolvedByUserId: patch.resolvedByUserId } : {}),
        ...(patch.resolvedByRole !== undefined ? { resolvedByRole: patch.resolvedByRole } : {}),
        ...(patch.evidenceMediaId !== undefined ? { evidenceMediaId: patch.evidenceMediaId } : {}),
        ...(patch.lastSignalAt !== undefined ? { lastSignalAt: patch.lastSignalAt } : {}),
        ...(patch.resolvedAt !== undefined ? { resolvedAt: patch.resolvedAt } : {}),
        updatedAt: patch.lastSignalAt ?? row.updatedAt,
      })
      return row
    },
    async listIncidents() { return { rows: incidents.slice(), nextCursor: null, hasMore: false } },
    async listIncidentHistory(incidentId: string) { return history.filter((row) => row.incidentId === incidentId) },
    async appendHistory(args: any) {
      const row: IncidentHistoryEntry = {
        historyId: String(historySeq++),
        incidentId: args.incidentId,
        actionCode: args.actionCode,
        previousStatus: args.previousStatus ?? null,
        nextStatus: args.nextStatus ?? null,
        actorRole: args.actorRole ?? null,
        actorUserId: args.actorUserId ?? null,
        note: args.note ?? null,
        evidenceMediaId: args.evidenceMediaId ?? null,
        snapshotBefore: args.snapshotBefore ?? {},
        snapshotAfter: args.snapshotAfter ?? {},
        createdAt: queue[0] ?? '2026-03-12T08:00:00.000Z',
      }
      history.push(row)
      return row
    },
  }

  return {
    incidents,
    history,
    events,
    deps: {
      store,
      publish: async ({ eventType, payload }: any) => {
        events.push({ eventType, payload })
        return { eventType, payload }
      },
      noiseControl: options.noiseControl ?? {},
      now: () => new Date(queue.shift() ?? queue.at(-1) ?? '2026-03-12T08:00:00.000Z'),
    } as any,
  }
}

test('repeated stale/ghost signal bị grace-threshold và cooldown suppress', async () => {
  const { deps, incidents, events, history } = createMemoryDeps({
    times: [
      '2026-03-12T08:00:00.000Z',
      '2026-03-12T08:00:20.000Z',
      '2026-03-12T08:00:40.000Z',
    ],
    noiseControl: {
      staleSensorGraceHits: 2,
      dedupeCooldownSeconds: 120,
    },
  })

  const projection = makeProjection({
    occupancyStatus: 'SENSOR_STALE',
    reasonCode: 'SENSOR_STALE',
    reasonDetail: 'Camera stale liên tục.',
    observedPlateCompact: null,
    matchedGatePresenceId: null,
  })

  const first = await syncIncidentFromSpotProjection(projection, deps)
  assert.equal(first, null)
  assert.equal(incidents.length, 0)
  assert.equal(events.length, 0)

  const second = await syncIncidentFromSpotProjection(projection, deps)
  assert.ok(second)
  assert.equal(incidents.length, 1)
  assert.equal(incidents[0].severity, 'WARN')
  assert.equal(events.length, 1)
  assert.equal(events[0].eventType, 'incident.opened')
  assert.equal(history.length, 1)

  const third = await syncIncidentFromSpotProjection(projection, deps)
  assert.ok(third)
  assert.equal(incidents.length, 1)
  assert.equal(events.length, 1)
  assert.equal(history.length, 1)
  assert.equal(String((incidents[0].snapshot as any).__noiseControl.hitCount), '3')
})

test('incident cùng source/fingerprint sẽ AUTO_REOPENED trong reopen window', async () => {
  const { deps, incidents, events, history } = createMemoryDeps({
    times: [
      '2026-03-12T08:00:00.000Z',
      '2026-03-12T08:02:00.000Z',
      '2026-03-12T08:04:00.000Z',
    ],
    noiseControl: {
      reopenWindowSeconds: 600,
    },
  })

  const wrongSpot = makeProjection({ reasonCode: 'VIP_WRONG_SPOT' })
  const healthy = makeProjection({
    occupancyStatus: 'OCCUPIED_MATCHED',
    reasonCode: 'GATE_PRESENCE_MATCHED',
    reasonDetail: 'Xe đã matched đúng occupancy.',
  })

  const opened = await syncIncidentFromSpotProjection(wrongSpot, deps)
  assert.ok(opened)
  assert.equal(incidents[0].status, 'OPEN')

  const resolved = await syncIncidentFromSpotProjection(healthy, deps)
  assert.ok(resolved)
  assert.equal(incidents[0].status, 'RESOLVED')

  const reopened = await syncIncidentFromSpotProjection(wrongSpot, deps)
  assert.ok(reopened)
  assert.equal(reopened?.incidentId, opened?.incidentId)
  assert.equal(incidents[0].status, 'OPEN')
  assert.equal(history.at(-1)?.actionCode, 'AUTO_REOPENED')
  assert.equal(events.at(-1)?.eventType, 'incident.reopened')
})

test('severity policy matrix giữ được phân tầng INFO/WARN/CRITICAL rõ ràng', () => {
  assert.equal(resolveSeverityForSignal('STALE_SENSOR', 1, {
    dedupeCooldownSeconds: 90,
    reopenWindowSeconds: 600,
    staleSensorGraceHits: 2,
    ghostPresenceGraceHits: 2,
    mismatchCooldownSeconds: 180,
    staleSensorCriticalHits: 4,
    ghostPresenceCriticalHits: 4,
    repeatedMismatchCriticalHits: 3,
  }), 'INFO')
  assert.equal(resolveSeverityForSignal('STALE_SENSOR', 2, {
    dedupeCooldownSeconds: 90,
    reopenWindowSeconds: 600,
    staleSensorGraceHits: 2,
    ghostPresenceGraceHits: 2,
    mismatchCooldownSeconds: 180,
    staleSensorCriticalHits: 4,
    ghostPresenceCriticalHits: 4,
    repeatedMismatchCriticalHits: 3,
  }), 'WARN')
  assert.equal(resolveSeverityForSignal('STALE_SENSOR', 4, {
    dedupeCooldownSeconds: 90,
    reopenWindowSeconds: 600,
    staleSensorGraceHits: 2,
    ghostPresenceGraceHits: 2,
    mismatchCooldownSeconds: 180,
    staleSensorCriticalHits: 4,
    ghostPresenceCriticalHits: 4,
    repeatedMismatchCriticalHits: 3,
  }), 'CRITICAL')
  assert.equal(resolveSeverityForSignal('GHOST_PRESENCE', 1, {
    dedupeCooldownSeconds: 90,
    reopenWindowSeconds: 600,
    staleSensorGraceHits: 2,
    ghostPresenceGraceHits: 2,
    mismatchCooldownSeconds: 180,
    staleSensorCriticalHits: 4,
    ghostPresenceCriticalHits: 4,
    repeatedMismatchCriticalHits: 3,
  }), 'INFO')
  assert.equal(resolveSeverityForSignal('GHOST_PRESENCE', 2, {
    dedupeCooldownSeconds: 90,
    reopenWindowSeconds: 600,
    staleSensorGraceHits: 2,
    ghostPresenceGraceHits: 2,
    mismatchCooldownSeconds: 180,
    staleSensorCriticalHits: 4,
    ghostPresenceCriticalHits: 4,
    repeatedMismatchCriticalHits: 3,
  }), 'WARN')
  assert.equal(resolveSeverityForSignal('REPEATED_MISMATCH', 3, {
    dedupeCooldownSeconds: 90,
    reopenWindowSeconds: 600,
    staleSensorGraceHits: 2,
    ghostPresenceGraceHits: 2,
    mismatchCooldownSeconds: 180,
    staleSensorCriticalHits: 4,
    ghostPresenceCriticalHits: 4,
    repeatedMismatchCriticalHits: 3,
  }), 'CRITICAL')

  const ghost = buildProjectionIncidentSignal(makeProjection({
    occupancyStatus: 'OCCUPIED_UNKNOWN',
    reasonCode: 'MISSING_GATE_PRESENCE',
    matchedGatePresenceId: null,
  }), { hitCount: 2 })
  assert.equal(ghost.noiseClass, 'GHOST_PRESENCE')
  assert.equal(ghost.severity, 'WARN')
})

test('SSE stream volume vẫn readable dưới repeated reconcile cycles', async () => {
  const { deps, incidents, events, history } = createMemoryDeps({
    times: [
      '2026-03-12T08:00:00.000Z',
      '2026-03-12T08:00:30.000Z',
      '2026-03-12T08:01:00.000Z',
      '2026-03-12T08:01:30.000Z',
      '2026-03-12T08:02:00.000Z',
    ],
    noiseControl: {
      mismatchCooldownSeconds: 180,
      repeatedMismatchCriticalHits: 3,
    },
  })

  for (let i = 0; i < 5; i += 1) {
    await syncIncidentFromSpotProjection(makeProjection({ reasonCode: 'VIP_WRONG_SPOT' }), deps)
  }

  assert.equal(incidents.length, 1)
  assert.equal(events.length <= 2, true)
  assert.equal(history.length <= 2, true)
  assert.equal(events[0]?.eventType, 'incident.opened')
  assert.equal(incidents[0].status, 'OPEN')
})

test('source regression: incident noise control được tách policy rõ, có reopen + cooldown + severity matrix', () => {
  const incidentSource = readSource('modules/incidents/application/incident-service.ts')
  const policySource = readSource('modules/incidents/application/incident-noise-policy.ts')
  const reconciliationSource = readSource('modules/reconciliation/domain/reconciliation.ts')
  const busSource = readSource('modules/incidents/application/incident-bus.ts')
  const packageSource = fs.readFileSync(path.resolve(srcRoot, '../package.json'), 'utf8')
  const docsSource = fs.readFileSync(path.resolve(srcRoot, '../../../docs/API.md'), 'utf8')

  assert.match(incidentSource, /shouldSuppressRecurringSignal\(/)
  assert.match(incidentSource, /shouldReopenResolvedIncident\(/)
  assert.match(incidentSource, /AUTO_REOPENED/)
  assert.match(incidentSource, /eventType: 'incident\.reopened'/)
  assert.match(policySource, /getIncidentNoiseControlConfig/)
  assert.match(policySource, /staleSensorGraceHits/)
  assert.match(policySource, /ghostPresenceGraceHits/)
  assert.match(policySource, /repeatedMismatchCriticalHits/)
  assert.match(policySource, /resolveSeverityForSignal/)
  assert.match(reconciliationSource, /classifyReconciliationIncidentSignal/)
  assert.match(reconciliationSource, /VIP_WRONG_SPOT/)
  assert.match(reconciliationSource, /MISSING_GATE_PRESENCE/)
  assert.match(busSource, /incident\.reopened/)
  assert.match(packageSource, /test:pr24/)
  assert.match(docsSource, /AUTO_REOPENED/)
  assert.match(docsSource, /incident\.reopened/)
  assert.match(docsSource, /cooldown/i)
})
