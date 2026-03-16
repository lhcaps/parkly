export type MobileCaptureJournalEntry = {
  id: string
  ts: string
  type: 'preview' | 'heartbeat' | 'capture' | 'error' | 'note'
  summary: string
  detail?: string
}

const STORAGE_PREFIX = 'parkly.mobileCaptureJournal.v1'

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
