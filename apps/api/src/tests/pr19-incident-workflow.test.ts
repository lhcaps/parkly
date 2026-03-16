import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveGateIncident,
  syncIncidentFromSpotProjection,
  type IncidentHistoryEntry,
  type IncidentSummary,
} from '../modules/incidents/application/incident-service'
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
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMemoryDeps() {
  const incidents: IncidentSummary[] = []
  const history: IncidentHistoryEntry[] = []
  const events: Array<{ eventType: string; payload: IncidentSummary }> = []
  let incidentSeq = 1
  let historySeq = 1

  const store = {
    async findActiveBySourceKey(sourceKey: string) {
      return incidents.find((row) => row.sourceKey === sourceKey && (row.status === 'OPEN' || row.status === 'ACKED')) ?? null
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        updatedAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
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
      now: () => new Date('2026-03-12T08:00:00.000Z'),
    } as any,
  }
}

test('signal từ reconciliation tự mở incident rồi guard ack được', async () => {
  const { deps, incidents, history, events } = createMemoryDeps()
  const created = await syncIncidentFromSpotProjection(makeProjection(), deps)
  assert.ok(created)
  assert.equal(incidents[0].status, 'OPEN')
  assert.equal(history[0].actionCode, 'AUTO_OPENED')
  assert.equal(events[0].eventType, 'incident.opened')

  const updated = await resolveGateIncident({
    incidentId: incidents[0].incidentId,
    action: 'WARNING_ACKNOWLEDGED',
    note: 'Guard đã xác nhận',
    actor: { role: 'GUARD', actorUserId: 3n, actorLabel: 'GUARD:3' },
  }, deps)

  assert.equal(updated.status, 'ACKED')
  assert.equal(updated.resolutionAction, 'WARNING_ACKNOWLEDGED')
  assert.equal(updated.resolvedByRole, 'GUARD')
  assert.equal(history.at(-1)?.actionCode, 'WARNING_ACKNOWLEDGED')
  assert.equal(events.at(-1)?.eventType, 'incident.updated')
})

test('guard không được ignored incident', async () => {
  const { deps, incidents } = createMemoryDeps()
  await syncIncidentFromSpotProjection(makeProjection(), deps)
  await assert.rejects(
    () => resolveGateIncident({
      incidentId: incidents[0].incidentId,
      action: 'IGNORED',
      actor: { role: 'GUARD', actorUserId: 3n, actorLabel: 'GUARD:3' },
    }, deps),
    /không được phép action/i,
  )
})

test('projection healthy sẽ auto-resolve incident đang mở', async () => {
  const { deps, incidents, history, events } = createMemoryDeps()
  await syncIncidentFromSpotProjection(makeProjection(), deps)
  await syncIncidentFromSpotProjection(makeProjection({ occupancyStatus: 'OCCUPIED_MATCHED', reasonCode: 'GATE_PRESENCE_MATCHED', reasonDetail: 'Xe đã matched đúng occupancy.' }), deps)

  assert.equal(incidents[0].status, 'RESOLVED')
  assert.equal(incidents[0].resolutionAction, 'AUTO_RESOLVED')
  assert.equal(history.at(-1)?.actionCode, 'AUTO_RESOLVED')
  assert.equal(events.at(-1)?.eventType, 'incident.resolved')
})
