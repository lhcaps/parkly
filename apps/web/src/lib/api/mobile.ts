import { apiFetch, postJson } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { makeSseUrl } from '@/lib/http/sse'
import type { CaptureReadRes, CaptureSignatureArgs, DeviceHeartbeatRes, GateEventWriteRes } from '@/lib/contracts/mobile'
import type { Direction } from '@/lib/contracts/common'

/**
 * Canonical type for the effective device context used to sign requests.
 * Always construct this from live form state, never from stale URL/pair context.
 */
export type EffectiveDeviceContext = {
  siteCode: string
  laneCode: string
  direction: Direction
  deviceCode: string
  deviceSecret: string
}

/**
 * Validate and return the effective device context.
 * Returns null + a list of missing fields if context is incomplete.
 */
export function validateEffectiveDeviceContext(
  ctx: EffectiveDeviceContext,
): { valid: true } | { valid: false; missing: string[] } {
  const missing: string[] = []
  if (!ctx.siteCode.trim()) missing.push('siteCode')
  if (!ctx.laneCode.trim()) missing.push('laneCode')
  if (!ctx.deviceCode.trim()) missing.push('deviceCode')
  if (!ctx.deviceSecret.trim()) missing.push('deviceSecret')
  return missing.length === 0 ? { valid: true } : { valid: false, missing }
}

/**
 * Create a local object URL for browser-side image preview.
 * Does NOT call /api/media/upload — safe for device-authenticated surfaces.
 * Caller is responsible for calling URL.revokeObjectURL(url) when done.
 */
export function createLocalImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}


function normalizeText(value: unknown) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text ? text : null
}

function toIso(value: string | Date) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid capture timestamp: ${value}`)
  return date.toISOString()
}

function buildCaptureSignaturePayload(args: CaptureSignatureArgs) {
  return JSON.stringify({
    v: 'capture-v1',
    surface: normalizeText(args.surface),
    readType: normalizeText(args.readType),
    siteCode: normalizeText(args.siteCode)?.toUpperCase(),
    deviceCode: normalizeText(args.deviceCode)?.toUpperCase(),
    laneCode: normalizeText(args.laneCode)?.toUpperCase(),
    direction: normalizeText(args.direction)?.toUpperCase(),
    requestId: normalizeText(args.requestId),
    idempotencyKey: normalizeText(args.idempotencyKey),
    timestamp: toIso(args.timestamp),
    eventTime: args.eventTime ? toIso(args.eventTime) : null,
    reportedAt: args.reportedAt ? toIso(args.reportedAt) : null,
    plateRaw: normalizeText(args.plateRaw)?.toUpperCase(),
    rfidUid: normalizeText(args.rfidUid)?.toUpperCase(),
    sensorState: normalizeText(args.sensorState)?.toUpperCase(),
    heartbeatStatus: normalizeText(args.heartbeatStatus)?.toUpperCase(),
  })
}

async function signHmacSha256(secret: string, payload: string) {
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await window.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildCaptureSignature(args: CaptureSignatureArgs & { secret: string }) {
  const secret = String(args.secret ?? '').trim()
  if (!secret) throw new Error('Device secret is required to sign capture requests')
  return signHmacSha256(secret, buildCaptureSignaturePayload(args))
}

export function getGateEventStreamUrl() {
  return makeSseUrl('/api/stream/gate-events')
}

export type MobilePairContext = {
  siteCode: string
  laneCode: string
  direction: Direction
  deviceCode: string
  deviceSecret: string
  token: string
}

export type ActiveMobilePair = MobilePairContext & {
  pairId: string
  pairUrl: string
  createdAt: string
  lastOpenedAt: string
}

const ACTIVE_PAIR_STORAGE_KEY = 'parkly.mobilePairs.v1'

function readActivePairStorage() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ACTIVE_PAIR_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data.filter((item): item is ActiveMobilePair => isRecord(item)) : []
  } catch {
    return []
  }
}

function writeActivePairStorage(rows: ActiveMobilePair[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_PAIR_STORAGE_KEY, JSON.stringify(rows.slice(0, 40)))
}

function randomToken() {
  return `pair_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createMobilePairToken() {
  return randomToken()
}

export function buildMobileCapturePairUrl(context: Partial<MobilePairContext>) {
  if (typeof window === 'undefined') return ''
  const url = new URL('/mobile-capture', window.location.origin)
  if (context.siteCode) url.searchParams.set('siteCode', context.siteCode)
  if (context.laneCode) url.searchParams.set('laneCode', context.laneCode)
  if (context.direction) url.searchParams.set('direction', context.direction === 'EXIT' ? 'EXIT' : 'ENTRY')
  if (context.deviceCode) url.searchParams.set('deviceCode', context.deviceCode)
  if (context.deviceSecret) url.searchParams.set('deviceSecret', context.deviceSecret)
  if (context.token) url.searchParams.set('token', context.token)
  return url.toString()
}

export function listActiveMobilePairs() {
  return readActivePairStorage().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function registerActiveMobilePair(context: MobilePairContext) {
  const now = new Date().toISOString()
  const pairUrl = buildMobileCapturePairUrl(context)
  const next: ActiveMobilePair = {
    ...context,
    pairId: randomToken(),
    pairUrl,
    createdAt: now,
    lastOpenedAt: now,
  }

  const rows = [next, ...readActivePairStorage()].filter((item, index, source) => {
    return source.findIndex((row) => row.pairUrl === item.pairUrl) === index
  })

  writeActivePairStorage(rows)
  return next
}

export function touchActiveMobilePair(pairId: string) {
  const rows = readActivePairStorage().map((row) => row.pairId === pairId ? { ...row, lastOpenedAt: new Date().toISOString() } : row)
  writeActivePairStorage(rows)
}

export function removeActiveMobilePair(pairId: string) {
  writeActivePairStorage(readActivePairStorage().filter((row) => row.pairId !== pairId))
}

export function readMobileCaptureContextFromLocation(search = typeof window !== 'undefined' ? window.location.search : ''): MobilePairContext {
  const params = new URLSearchParams(search)
  return {
    siteCode: params.get('siteCode') || '',
    laneCode: params.get('laneCode') || '',
    direction: params.get('direction') === 'EXIT' ? 'EXIT' : 'ENTRY',
    deviceCode: params.get('deviceCode') || '',
    deviceSecret: params.get('deviceSecret') || '',
    token: params.get('token') || '',
  }
}

function normalizeCaptureReadRes(value: unknown): CaptureReadRes {
  const row = isRecord(value) ? value : {}
  return {
    ...(row as CaptureReadRes),
    plate: isRecord(row.plate) ? row.plate as CaptureReadRes['plate'] : null,
    siteCode: typeof row.siteCode === 'string' ? row.siteCode : '',
    laneCode: typeof row.laneCode === 'string' ? row.laneCode : '',
    deviceCode: typeof row.deviceCode === 'string' ? row.deviceCode : '',
    direction: row.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
    readType: row.readType === 'RFID' || row.readType === 'SENSOR' ? row.readType : 'ALPR',
    occurredAt: typeof row.occurredAt === 'string' ? row.occurredAt : '',
    sessionId: typeof row.sessionId === 'string' ? row.sessionId : '',
    sessionStatus: typeof row.sessionStatus === 'string' ? row.sessionStatus : '',
    readEventId: typeof row.readEventId === 'string' || typeof row.readEventId === 'number' ? row.readEventId : '',
    changed: typeof row.changed === 'boolean' ? row.changed : false,
    alreadyExists: typeof row.alreadyExists === 'boolean' ? row.alreadyExists : false,
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
    ocrConfidence: typeof row.ocrConfidence === 'number' && Number.isFinite(row.ocrConfidence) ? row.ocrConfidence : null,
    rfidUid: typeof row.rfidUid === 'string' ? row.rfidUid : null,
    sensorState: row.sensorState === 'CLEARED' || row.sensorState === 'TRIGGERED' || row.sensorState === 'PRESENT' ? row.sensorState : null,
  }
}

export function postGateEvent(body: unknown) {
  return postJson<GateEventWriteRes>('/api/gate-events', body)
}

export async function sendCaptureAlpr(body: Omit<CaptureSignatureArgs, 'surface' | 'readType' | 'reportedAt' | 'rfidUid' | 'sensorState' | 'heartbeatStatus'> & {
  secret: string
  imageUrl?: string | null
  ocrConfidence?: number | null
  rawPayload?: unknown
}) {
  const signature = await buildCaptureSignature({
    surface: 'POST /api/gate-reads/alpr',
    readType: 'ALPR',
    siteCode: body.siteCode,
    deviceCode: body.deviceCode,
    laneCode: body.laneCode,
    direction: body.direction,
    requestId: body.requestId,
    idempotencyKey: body.idempotencyKey,
    timestamp: body.timestamp,
    eventTime: body.eventTime,
    plateRaw: body.plateRaw,
    secret: body.secret,
  })

  return apiFetch<CaptureReadRes>('/api/gate-reads/alpr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: body.requestId,
      idempotencyKey: body.idempotencyKey,
      siteCode: body.siteCode,
      deviceCode: body.deviceCode,
      laneCode: body.laneCode,
      direction: body.direction,
      timestamp: toIso(body.timestamp),
      eventTime: body.eventTime ? toIso(body.eventTime) : undefined,
      plateRaw: body.plateRaw ?? undefined,
      imageUrl: body.imageUrl ?? undefined,
      ocrConfidence: body.ocrConfidence ?? undefined,
      rawPayload: body.rawPayload,
      signature,
      signatureVersion: 'capture-v1',
    }),
  }, normalizeCaptureReadRes)
}

export async function sendCaptureRfid(body: Omit<CaptureSignatureArgs, 'surface' | 'readType' | 'reportedAt' | 'plateRaw' | 'sensorState' | 'heartbeatStatus'> & {
  secret: string
  rawPayload?: unknown
}) {
  const signature = await buildCaptureSignature({
    surface: 'POST /api/gate-reads/rfid',
    readType: 'RFID',
    siteCode: body.siteCode,
    deviceCode: body.deviceCode,
    laneCode: body.laneCode,
    direction: body.direction,
    requestId: body.requestId,
    idempotencyKey: body.idempotencyKey,
    timestamp: body.timestamp,
    eventTime: body.eventTime,
    rfidUid: body.rfidUid,
    secret: body.secret,
  })

  return apiFetch<CaptureReadRes>('/api/gate-reads/rfid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: body.requestId,
      idempotencyKey: body.idempotencyKey,
      siteCode: body.siteCode,
      deviceCode: body.deviceCode,
      laneCode: body.laneCode,
      direction: body.direction,
      timestamp: toIso(body.timestamp),
      eventTime: body.eventTime ? toIso(body.eventTime) : undefined,
      rfidUid: body.rfidUid,
      rawPayload: body.rawPayload,
      signature,
      signatureVersion: 'capture-v1',
    }),
  }, normalizeCaptureReadRes)
}

export async function sendCaptureSensor(body: Omit<CaptureSignatureArgs, 'surface' | 'readType' | 'reportedAt' | 'plateRaw' | 'rfidUid' | 'heartbeatStatus'> & {
  secret: string
  rawPayload?: unknown
}) {
  const signature = await buildCaptureSignature({
    surface: 'POST /api/gate-reads/sensor',
    readType: 'SENSOR',
    siteCode: body.siteCode,
    deviceCode: body.deviceCode,
    laneCode: body.laneCode,
    direction: body.direction,
    requestId: body.requestId,
    idempotencyKey: body.idempotencyKey,
    timestamp: body.timestamp,
    eventTime: body.eventTime,
    sensorState: body.sensorState,
    secret: body.secret,
  })

  return apiFetch<CaptureReadRes>('/api/gate-reads/sensor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: body.requestId,
      idempotencyKey: body.idempotencyKey,
      siteCode: body.siteCode,
      deviceCode: body.deviceCode,
      laneCode: body.laneCode,
      direction: body.direction,
      timestamp: toIso(body.timestamp),
      eventTime: body.eventTime ? toIso(body.eventTime) : undefined,
      sensorState: body.sensorState,
      rawPayload: body.rawPayload,
      signature,
      signatureVersion: 'capture-v1',
    }),
  }, normalizeCaptureReadRes)
}

export async function sendDeviceHeartbeat(body: Omit<CaptureSignatureArgs, 'surface' | 'readType' | 'eventTime' | 'plateRaw' | 'rfidUid' | 'sensorState'> & {
  secret: string
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  latencyMs?: number | null
  firmwareVersion?: string | null
  ipAddress?: string | null
  rawPayload?: unknown
}) {
  const signature = await buildCaptureSignature({
    surface: 'POST /api/devices/heartbeat',
    readType: 'HEARTBEAT',
    siteCode: body.siteCode,
    deviceCode: body.deviceCode,
    requestId: body.requestId,
    idempotencyKey: body.idempotencyKey,
    timestamp: body.timestamp,
    laneCode: body.laneCode,
    direction: body.direction,
    reportedAt: body.reportedAt,
    heartbeatStatus: body.status,
    secret: body.secret,
  })

  return apiFetch<DeviceHeartbeatRes>('/api/devices/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: body.requestId,
      idempotencyKey: body.idempotencyKey,
      siteCode: body.siteCode,
      deviceCode: body.deviceCode,
      laneCode: body.laneCode ?? undefined,
      direction: body.direction ?? undefined,
      timestamp: toIso(body.timestamp),
      reportedAt: body.reportedAt ? toIso(body.reportedAt) : undefined,
      status: body.status,
      latencyMs: body.latencyMs ?? undefined,
      firmwareVersion: body.firmwareVersion ?? undefined,
      ipAddress: body.ipAddress ?? undefined,
      rawPayload: body.rawPayload,
      signature,
      signatureVersion: 'capture-v1',
    }),
  }, (value) => {
    const row = isRecord(value) ? value : {}
    return {
      siteCode: typeof row.siteCode === 'string' ? row.siteCode : '',
      deviceCode: typeof row.deviceCode === 'string' ? row.deviceCode : '',
      deviceType: typeof row.deviceType === 'string' ? row.deviceType : '',
      direction: row.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
      laneCode: typeof row.laneCode === 'string' ? row.laneCode : null,
      heartbeatId: typeof row.heartbeatId === 'string' || typeof row.heartbeatId === 'number' ? row.heartbeatId : '',
      status: row.status === 'DEGRADED' || row.status === 'OFFLINE' ? row.status : 'ONLINE',
      reportedAt: typeof row.reportedAt === 'string' ? row.reportedAt : '',
      receivedAt: typeof row.receivedAt === 'string' ? row.receivedAt : '',
      latencyMs: typeof row.latencyMs === 'number' && Number.isFinite(row.latencyMs) ? row.latencyMs : null,
      firmwareVersion: typeof row.firmwareVersion === 'string' ? row.firmwareVersion : null,
      ipAddress: typeof row.ipAddress === 'string' ? row.ipAddress : null,
      changed: typeof row.changed === 'boolean' ? row.changed : false,
      alreadyExists: typeof row.alreadyExists === 'boolean' ? row.alreadyExists : false,
    }
  })
}

/**
 * Returns true when the mobile pair origin is a loopback address (localhost / 127.x).
 * Used to gate QR scanning warnings in the pair UI.
 */
export function isMobilePairOriginLoopback(origin?: string): boolean {
  const o = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+)(:\d+)?$/.test(o)
}

/**
 * Resolves the effective origin to use for mobile pair links.
 * Falls back to window.location.origin if no override is provided.
 */
export function resolveMobilePairOrigin(override?: string): string {
  if (override?.trim()) return override.trim().replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
