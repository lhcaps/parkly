import type {
  SessionBarrierCommand,
  SessionDecision,
  SessionDetail,
  SessionIncident,
  SessionManualReview,
  SessionRead,
  SessionState,
  SessionSummary,
  SessionTimelineItem,
} from '@/lib/contracts/sessions'
import { formatDateTimeValue, formatNumberValue } from '@/i18n/format'

export type SessionTone = 'secondary' | 'entry' | 'amber' | 'destructive' | 'muted'

export function sessionVariant(status: SessionState): SessionTone {
  if (status === 'APPROVED' || status === 'PASSED') return 'entry'
  if (status === 'WAITING_READ' || status === 'WAITING_DECISION' || status === 'WAITING_PAYMENT' || status === 'OPEN') return 'amber'
  if (status === 'DENIED' || status === 'ERROR') return 'destructive'
  return 'muted'
}

export function formatDateTime(value?: string | null, fallback = '—') {
  return formatDateTimeValue(value, undefined, fallback)
}

export function formatNumber(value?: number | null, digits = 0) {
  return formatNumberValue(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function readLatestDecision(detail: SessionDetail) {
  return [...detail.decisions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null
}

export function readLatestRead(detail: SessionDetail) {
  return [...detail.reads].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0] ?? null
}

export function readPrimaryDeviceCode(detail: SessionDetail) {
  const latestRead = readLatestRead(detail)
  return latestRead?.evidence.sourceDeviceCode || latestRead?.deviceId || '—'
}

export type SessionMediaItem = {
  key: string
  readEventId: string
  occurredAt: string
  sourceDeviceCode: string | null
  readType: string
  plateCompact: string | null
  ocrConfidence: number | null
  url: string | null
  mediaId: string | null
  mimeType: string | null
  widthPx: number | null
  heightPx: number | null
  capturedAt: string | null
  sourceLabel: string
}

function readMediaUrl(read: SessionRead) {
  return read.evidence.media?.mediaUrl || read.evidence.cameraFrameRef || read.evidence.cropRef || null
}

function inferMediaMime(url: string | null, explicit: string | null) {
  if (explicit) return explicit
  const value = String(url ?? '').toLowerCase()
  if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(value)) return 'image/*'
  return null
}

export function collectSessionMedia(detail: SessionDetail): SessionMediaItem[] {
  const seen = new Set<string>()
  const rows: SessionMediaItem[] = []

  for (const read of [...detail.reads].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    const url = readMediaUrl(read)
    const mediaId = read.evidence.media?.mediaId ?? null
    const key = mediaId || url || `${read.readEventId}:none`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      key,
      readEventId: read.readEventId,
      occurredAt: read.occurredAt,
      sourceDeviceCode: read.evidence.sourceDeviceCode,
      readType: read.readType,
      plateCompact: read.plateCompact,
      ocrConfidence: read.ocrConfidence,
      url,
      mediaId,
      mimeType: inferMediaMime(url, read.evidence.media?.mimeType ?? null),
      widthPx: read.evidence.media?.widthPx ?? null,
      heightPx: read.evidence.media?.heightPx ?? null,
      capturedAt: read.evidence.media?.capturedAt ?? read.evidence.sourceCaptureTs,
      sourceLabel: read.evidence.media?.storageKind || (url ? 'linked' : 'none'),
    })
  }

  return rows
}

function summarizeRead(read: SessionRead) {
  return [read.readType, read.plateCompact || read.plateRaw || '', read.rfidUid || '', read.sensorState || '']
    .filter(Boolean)
    .join(' · ')
}

function summarizeDecision(decision: SessionDecision) {
  return [decision.decisionCode, decision.finalAction || decision.recommendedAction, decision.reasonDetail || decision.reasonCode]
    .filter(Boolean)
    .join(' · ')
}

function summarizeBarrier(command: SessionBarrierCommand) {
  return [command.commandType, command.status, command.reasonCode || '']
    .filter(Boolean)
    .join(' · ')
}

function summarizeReview(review: SessionManualReview) {
  return [review.status, review.queueReasonCode, review.note || '']
    .filter(Boolean)
    .join(' · ')
}

function summarizeIncident(incident: SessionIncident) {
  return [incident.incidentType, incident.title, incident.severity]
    .filter(Boolean)
    .join(' · ')
}

export type SessionTimelineViewItem = {
  id: string
  kind: 'LIFECYCLE' | 'READ' | 'DECISION' | 'BARRIER_COMMAND' | 'REVIEW' | 'INCIDENT'
  at: string
  title: string
  summary: string
  description?: string
  badge?: string
  badgeTone?: SessionTone | 'outline'
}

function timelineTimestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTimelineItem(item: SessionTimelineItem, index: number): SessionTimelineViewItem {
  if (item.kind === 'READ') {
    const payload = item.payload as Partial<SessionRead>
    return {
      id: `timeline:read:${index}:${item.at}`,
      kind: 'READ',
      at: item.at,
      title: payload.readType || 'Read captured',
      summary: summarizeRead(payload as SessionRead) || 'Read event',
      description: payload.requestId || undefined,
      badge: payload.direction || 'READ',
      badgeTone: 'outline',
    }
  }

  if (item.kind === 'DECISION') {
    const payload = item.payload as Partial<SessionDecision>
    return {
      id: `timeline:decision:${index}:${item.at}`,
      kind: 'DECISION',
      at: item.at,
      title: payload.decisionCode || 'Decision emitted',
      summary: summarizeDecision(payload as SessionDecision) || 'Decision event',
      description: payload.explanation || undefined,
      badge: payload.finalAction || payload.recommendedAction || 'DECISION',
      badgeTone: 'amber',
    }
  }

  if (item.kind === 'BARRIER_COMMAND') {
    const payload = item.payload as Partial<SessionBarrierCommand>
    return {
      id: `timeline:barrier:${index}:${item.at}`,
      kind: 'BARRIER_COMMAND',
      at: item.at,
      title: payload.commandType || 'Barrier command',
      summary: summarizeBarrier(payload as SessionBarrierCommand) || 'Barrier event',
      description: payload.requestId || undefined,
      badge: payload.status || 'BARRIER',
      badgeTone: 'secondary',
    }
  }

  if (item.kind === 'REVIEW') {
    const payload = item.payload as Partial<SessionManualReview>
    return {
      id: `timeline:review:${index}:${item.at}`,
      kind: 'REVIEW',
      at: item.at,
      title: payload.queueReasonCode || 'Manual review',
      summary: summarizeReview(payload as SessionManualReview) || 'Review event',
      description: payload.claimedByUserId || payload.resolvedByUserId || undefined,
      badge: payload.status || 'REVIEW',
      badgeTone: 'muted',
    }
  }

  const payload = item.payload as Partial<SessionIncident>
  return {
    id: `timeline:incident:${index}:${item.at}`,
    kind: 'INCIDENT',
    at: item.at,
    title: payload.title || payload.incidentType || 'Incident created',
    summary: summarizeIncident(payload as SessionIncident) || 'Incident event',
    description: payload.detail || undefined,
    badge: payload.status || payload.severity || 'INCIDENT',
    badgeTone: 'destructive',
  }
}

function buildLifecycleItems(session: SessionSummary, latestDecision: SessionDecision | null): SessionTimelineViewItem[] {
  const rows: SessionTimelineViewItem[] = [
    {
      id: `lifecycle:opened:${session.sessionId}`,
      kind: 'LIFECYCLE',
      at: session.openedAt,
      title: 'Session opened',
      summary: `${session.siteCode} / ${session.gateCode} / ${session.laneCode}`,
      description: session.direction,
      badge: session.status,
      badgeTone: sessionVariant(session.status),
    },
  ]

  if (session.lastReadAt) {
    rows.push({
      id: `lifecycle:last-read:${session.sessionId}`,
      kind: 'LIFECYCLE',
      at: session.lastReadAt,
      title: 'Last read updated',
      summary: `reads=${session.readCount} · decisions=${session.decisionCount}`,
      description: session.plateCompact || session.rfidUid || undefined,
      badge: 'READ WINDOW',
      badgeTone: 'outline',
    })
  }

  if (session.resolvedAt) {
    rows.push({
      id: `lifecycle:resolved:${session.sessionId}`,
      kind: 'LIFECYCLE',
      at: session.resolvedAt,
      title: 'Session resolved',
      summary: latestDecision ? summarizeDecision(latestDecision) : `status=${session.status}`,
      description: session.reviewRequired ? 'review required' : undefined,
      badge: session.status,
      badgeTone: sessionVariant(session.status),
    })
  }

  if (session.closedAt) {
    rows.push({
      id: `lifecycle:closed:${session.sessionId}`,
      kind: 'LIFECYCLE',
      at: session.closedAt,
      title: 'Session closed',
      summary: session.presenceActive ? 'presence still active' : 'lane released',
      description: session.ticketId || undefined,
      badge: 'CLOSED',
      badgeTone: 'muted',
    })
  }

  return rows
}

export function buildSessionTimeline(detail: SessionDetail): SessionTimelineViewItem[] {
  const latestDecision = readLatestDecision(detail)
  const lifecycle = buildLifecycleItems(detail.session, latestDecision)
  const normalized = detail.timeline.map((item, index) => normalizeTimelineItem(item, index))
  return [...lifecycle, ...normalized].sort((a, b) => timelineTimestamp(a.at) - timelineTimestamp(b.at))
}

export function matchesSessionKeyword(row: SessionSummary, keyword: string) {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  const haystack = [
    row.sessionId,
    row.siteCode,
    row.gateCode,
    row.laneCode,
    row.plateCompact || '',
    row.ticketId || '',
    row.correlationId || '',
    row.status,
    row.direction,
    row.rfidUid || '',
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalized)
}
