import type { EffectiveDeviceContext, MobileCaptureSeedContext } from '@/lib/api/mobile'

export type MobileCaptureJournalEntry = {
  id: string
  ts: string
  type: 'preview' | 'heartbeat' | 'capture' | 'error' | 'note'
  summary: string
  detail?: string
}

export type MobileCaptureContextSnapshot = {
  seed: {
    source: MobileCaptureSeedContext['source']
    siteCode: string
    laneCode: string
    direction: MobileCaptureSeedContext['direction']
    deviceCode: string
    deviceSecretLength: number
    tokenPresent: boolean
  }
  effective: {
    siteCode: string
    laneCode: string
    direction: EffectiveDeviceContext['direction']
    deviceCode: string
    deviceSecretLength: number
  }
  hasManualOverrides: boolean
  seedKey: string
  effectiveKey: string
}

const STORAGE_PREFIX = 'parkly.mobileCaptureJournal.v1'

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeDirection(value: unknown) {
  return value === 'EXIT' ? 'EXIT' : 'ENTRY'
}

function secretLength(value: unknown) {
  return normalizeText(value).length
}

function makeKey(scopeKey: string) {
  return `${STORAGE_PREFIX}:${scopeKey || 'default'}`
}

export function buildJournalScopeKey(args: {
  pairToken?: string | null
  siteCode?: string | null
  laneCode?: string | null
  deviceCode?: string | null
}) {
  return [args.pairToken || 'no-pair', args.siteCode || 'no-site', args.laneCode || 'no-lane', args.deviceCode || 'no-device'].join(':')
}

export function buildEffectiveDeviceContextKey(ctx: Partial<EffectiveDeviceContext>) {
  return [
    normalizeText(ctx.siteCode) || 'no-site',
    normalizeText(ctx.laneCode) || 'no-lane',
    normalizeDirection(ctx.direction),
    normalizeText(ctx.deviceCode) || 'no-device',
    `secret:${secretLength(ctx.deviceSecret)}`,
  ].join(':')
}

export function buildMobileCaptureContextSnapshot(args: {
  seed: MobileCaptureSeedContext
  effective: EffectiveDeviceContext
  hasManualOverrides: boolean
}): MobileCaptureContextSnapshot {
  const seedKey = buildJournalScopeKey({
    pairToken: args.seed.token,
    siteCode: args.seed.siteCode,
    laneCode: args.seed.laneCode,
    deviceCode: args.seed.deviceCode,
  })

  return {
    seed: {
      source: args.seed.source,
      siteCode: normalizeText(args.seed.siteCode),
      laneCode: normalizeText(args.seed.laneCode),
      direction: normalizeDirection(args.seed.direction),
      deviceCode: normalizeText(args.seed.deviceCode),
      deviceSecretLength: secretLength(args.seed.deviceSecret),
      tokenPresent: Boolean(normalizeText(args.seed.token)),
    },
    effective: {
      siteCode: normalizeText(args.effective.siteCode),
      laneCode: normalizeText(args.effective.laneCode),
      direction: normalizeDirection(args.effective.direction),
      deviceCode: normalizeText(args.effective.deviceCode),
      deviceSecretLength: secretLength(args.effective.deviceSecret),
    },
    hasManualOverrides: args.hasManualOverrides,
    seedKey,
    effectiveKey: buildEffectiveDeviceContextKey(args.effective),
  }
}

export function formatMobileCaptureContextSnapshot(snapshot: MobileCaptureContextSnapshot) {
  return [
    `seed(${snapshot.seed.source})=${snapshot.seed.siteCode || '—'}/${snapshot.seed.laneCode || '—'}/${snapshot.seed.direction}/${snapshot.seed.deviceCode || '—'}/secret:${snapshot.seed.deviceSecretLength}`,
    `effective=${snapshot.effective.siteCode || '—'}/${snapshot.effective.laneCode || '—'}/${snapshot.effective.direction}/${snapshot.effective.deviceCode || '—'}/secret:${snapshot.effective.deviceSecretLength}`,
    `override=${snapshot.hasManualOverrides ? 'yes' : 'no'}`,
    `seedKey=${snapshot.seedKey}`,
    `effectiveKey=${snapshot.effectiveKey}`,
  ].join(' | ')
}

export function readMobileCaptureJournal(scopeKey: string) {
  if (typeof window === 'undefined') return [] as MobileCaptureJournalEntry[]
  try {
    const raw = window.localStorage.getItem(makeKey(scopeKey))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as MobileCaptureJournalEntry[] : []
  } catch {
    return []
  }
}

export function writeMobileCaptureJournal(scopeKey: string, rows: MobileCaptureJournalEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(makeKey(scopeKey), JSON.stringify(rows.slice(0, 40)))
}

export function appendMobileCaptureJournal(scopeKey: string, entry: Omit<MobileCaptureJournalEntry, 'id' | 'ts'> & { ts?: string }) {
  const next: MobileCaptureJournalEntry = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    ts: entry.ts || new Date().toISOString(),
    type: entry.type,
    summary: entry.summary,
    detail: entry.detail,
  }
  const rows = [next, ...readMobileCaptureJournal(scopeKey)]
  writeMobileCaptureJournal(scopeKey, rows)
  return rows
}

export function clearMobileCaptureJournal(scopeKey: string) {
  writeMobileCaptureJournal(scopeKey, [])
}
