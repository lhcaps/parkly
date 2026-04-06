import { apiFetch, buildUrl, postJson } from '@/lib/http/client'
import { isRecord } from '@/lib/http/errors'
import { makeSseUrl } from '@/lib/http/sse'
import type { CaptureReadRes, CaptureSignatureArgs, DeviceHeartbeatRes, GateEventWriteRes } from '@/lib/contracts/mobile'
import type { Direction } from '@/lib/contracts/common'
import type { AlprPreviewCandidate, AlprPreviewWinner, AlprPreviewStatus } from '@/lib/contracts/alpr'

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

export function normalizeEffectiveDeviceContext(ctx: Partial<EffectiveDeviceContext>): EffectiveDeviceContext {
  return {
    siteCode: String(ctx.siteCode ?? '').trim(),
    laneCode: String(ctx.laneCode ?? '').trim(),
    direction: ctx.direction === 'EXIT' ? 'EXIT' : 'ENTRY',
    deviceCode: String(ctx.deviceCode ?? '').trim(),
    deviceSecret: String(ctx.deviceSecret ?? '').trim(),
  }
}

/**
 * Validate and return the effective device context.
 * Returns null + a list of missing fields if context is incomplete.
 */
export function validateEffectiveDeviceContext(
  ctx: EffectiveDeviceContext,
): { valid: true } | { valid: false; missing: string[] } {
  const effective = normalizeEffectiveDeviceContext(ctx)
  const missing: string[] = []
  if (!effective.siteCode) missing.push('siteCode')
  if (!effective.laneCode) missing.push('laneCode')
  if (!effective.deviceCode) missing.push('deviceCode')
  if (!effective.deviceSecret) missing.push('deviceSecret')
  return missing.length === 0 ? { valid: true } : { valid: false, missing }
}

/**
 * Validation for mobile capture when using pair token: deviceSecret is optional.
 * Use this for canSend / readiness when pairToken is present.
 */
export function validateForMobileCapture(
  ctx: EffectiveDeviceContext,
  options: { pairToken?: string | null },
): { valid: true } | { valid: false; missing: string[] } {
  const effective = normalizeEffectiveDeviceContext(ctx)
  const missing: string[] = []
  if (!effective.siteCode) missing.push('siteCode')
  if (!effective.laneCode) missing.push('laneCode')
  if (!effective.deviceCode) missing.push('deviceCode')
  if (!options.pairToken && !effective.deviceSecret) missing.push('deviceSecret')
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

export type MobileCaptureSeedContext = MobilePairContext & {
  prefilledAt: string
  source: 'query' | 'empty'
}

export function maskDeviceSecret(secret: string) {
  const raw = String(secret ?? '').trim()
  if (!raw) return 'missing'
  if (raw.length <= 4) return `••••[${raw.length}]`
  return `${raw.slice(0, 2)}••••${raw.slice(-2)} [${raw.length}]`
}

export function hasEffectiveDeviceContextOverride(seed: Partial<MobilePairContext>, effective: EffectiveDeviceContext) {
  const normalizedEffective = normalizeEffectiveDeviceContext(effective)
  return normalizedEffective.siteCode !== String(seed.siteCode ?? '').trim()
    || normalizedEffective.laneCode !== String(seed.laneCode ?? '').trim()
    || normalizedEffective.direction !== (seed.direction === 'EXIT' ? 'EXIT' : 'ENTRY')
    || normalizedEffective.deviceCode !== String(seed.deviceCode ?? '').trim()
    || normalizedEffective.deviceSecret !== String(seed.deviceSecret ?? '').trim()
}

export type MobilePairOriginSource = 'override' | 'env' | 'window' | 'unavailable'

export type MobilePairOriginInfo = {
  requestedOrigin: string | null
  effectiveOrigin: string
  source: MobilePairOriginSource
  invalidRequestedOrigin: string | null
  invalidReason: string | null
  expectedWindowOrigin: string
  isLoopback: boolean
  hasSubnetMismatch: boolean
}

export type ActiveMobilePair = MobilePairContext & {
  pairId: string
  pairUrl: string
  createdAt: string
  lastOpenedAt: string
  pairOrigin: string
  pairOriginSource: MobilePairOriginSource
  registryVersion: number
  migratedAt: string | null
}

export type ActiveMobilePairOriginState = {
  code: 'current' | 'loopback' | 'legacy-origin' | 'legacy-schema' | 'missing-origin'
  label: string
  detail: string
  variant: 'secondary' | 'destructive' | 'amber'
  requiresMigration: boolean
}

const ACTIVE_PAIR_STORAGE_KEY = 'parkly.mobilePairs.v1'
const ACTIVE_PAIR_REGISTRY_VERSION = 2

export function stripTrailingSlash(value: string) {
  return String(value ?? '').trim().replace(/\/+$/, '')
}

function isIpv4Host(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
}

function getIpv4Subnet(hostname: string) {
  if (!isIpv4Host(hostname)) return null
  const octets = hostname.split('.')
  if (octets.some((item) => Number(item) < 0 || Number(item) > 255)) return null
  return octets.slice(0, 3).join('.')
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('127.')
    || hostname === '::1'
    || hostname === '[::1]'
}

function safeParseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function validateMobilePairOrigin(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return { valid: false as const, reason: 'Origin is empty.' }
  }

  const url = safeParseUrl(raw)
  if (!url) {
    return { valid: false as const, reason: 'Origin must be a valid absolute URL.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false as const, reason: 'Origin must use http:// or https://.' }
  }

  if (url.username || url.password) {
    return { valid: false as const, reason: 'Origin must not include credentials.' }
  }

  if ((url.pathname && url.pathname !== '/')) {
    return { valid: false as const, reason: 'Origin must not include a path.' }
  }

  if (url.search) {
    return { valid: false as const, reason: 'Origin must not include a query string.' }
  }

  if (url.hash) {
    return { valid: false as const, reason: 'Origin must not include a hash fragment.' }
  }

  return { valid: true as const, origin: stripTrailingSlash(url.origin) }
}

function getWindowOrigin() {
  if (typeof window === 'undefined') return ''
  const result = validateMobilePairOrigin(window.location.origin)
  return result.valid ? result.origin : ''
}

function resolveRequestedOrigin(override?: string | null) {
  const overrideValue = String(override ?? '').trim()
  if (overrideValue) {
    const result = validateMobilePairOrigin(overrideValue)
    return result.valid
      ? { requestedOrigin: overrideValue, effectiveOrigin: result.origin, source: 'override' as const, invalidRequestedOrigin: null, invalidReason: null }
      : { requestedOrigin: overrideValue, effectiveOrigin: '', source: 'override' as const, invalidRequestedOrigin: overrideValue, invalidReason: result.reason }
  }

  const envValue = String(import.meta.env.VITE_PUBLIC_WEB_ORIGIN ?? '').trim()
  if (envValue) {
    const result = validateMobilePairOrigin(envValue)
    return result.valid
      ? { requestedOrigin: envValue, effectiveOrigin: result.origin, source: 'env' as const, invalidRequestedOrigin: null, invalidReason: null }
      : { requestedOrigin: envValue, effectiveOrigin: '', source: 'env' as const, invalidRequestedOrigin: envValue, invalidReason: result.reason }
  }

  return { requestedOrigin: null, effectiveOrigin: '', source: 'window' as const, invalidRequestedOrigin: null, invalidReason: null }
}

export function getMobilePairOriginInfo(override?: string): MobilePairOriginInfo {
  const resolved = resolveRequestedOrigin(override)
  const expectedWindowOrigin = getWindowOrigin()
  const fallbackOrigin = expectedWindowOrigin
  const effectiveOrigin = resolved.effectiveOrigin || fallbackOrigin
  const effectiveSource: MobilePairOriginSource = effectiveOrigin
    ? (resolved.effectiveOrigin ? resolved.source : (fallbackOrigin ? 'window' : 'unavailable'))
    : 'unavailable'

  const effectiveUrl = safeParseUrl(effectiveOrigin)
  const windowUrl = safeParseUrl(expectedWindowOrigin)
  const effectiveHost = effectiveUrl?.hostname ?? ''
  const windowHost = windowUrl?.hostname ?? ''
  const effectiveSubnet = getIpv4Subnet(effectiveHost)
  const windowSubnet = getIpv4Subnet(windowHost)

  return {
    requestedOrigin: resolved.requestedOrigin,
    effectiveOrigin,
    source: effectiveSource,
    invalidRequestedOrigin: resolved.invalidRequestedOrigin,
    invalidReason: resolved.invalidReason,
    expectedWindowOrigin,
    isLoopback: isLoopbackHost(effectiveHost),
    hasSubnetMismatch: Boolean(effectiveSubnet && windowSubnet && effectiveSubnet !== windowSubnet),
  }
}

function parsePairOriginFromUrl(pairUrl: string) {
  const url = safeParseUrl(pairUrl)
  return url ? stripTrailingSlash(url.origin) : ''
}

function normalizeStoredMobilePair(value: unknown) {
  if (!isRecord(value)) return null

  const now = new Date().toISOString()
  const pairId = typeof value.pairId === 'string' && value.pairId.trim() ? value.pairId : randomToken()
  const siteCode = typeof value.siteCode === 'string' ? value.siteCode : ''
  const laneCode = typeof value.laneCode === 'string' ? value.laneCode : ''
  const direction = value.direction === 'EXIT' ? 'EXIT' : 'ENTRY'
  const deviceCode = typeof value.deviceCode === 'string' ? value.deviceCode : ''
  const deviceSecret = typeof value.deviceSecret === 'string' ? value.deviceSecret : ''
  const token = typeof value.token === 'string' ? value.token : ''
  const createdAt = typeof value.createdAt === 'string' && value.createdAt ? value.createdAt : now
  const lastOpenedAt = typeof value.lastOpenedAt === 'string' && value.lastOpenedAt ? value.lastOpenedAt : createdAt
  const pairUrl = typeof value.pairUrl === 'string' ? value.pairUrl : ''
  const originCandidate = typeof value.pairOrigin === 'string' && value.pairOrigin.trim()
    ? value.pairOrigin
    : parsePairOriginFromUrl(pairUrl)
  const originResult = validateMobilePairOrigin(originCandidate)
  const pairOrigin = originResult.valid ? originResult.origin : parsePairOriginFromUrl(pairUrl)
  const registryVersion = typeof value.registryVersion === 'number' && Number.isFinite(value.registryVersion)
    ? value.registryVersion
    : ACTIVE_PAIR_REGISTRY_VERSION
  const pairOriginSource = value.pairOriginSource === 'override' || value.pairOriginSource === 'env' || value.pairOriginSource === 'window' || value.pairOriginSource === 'unavailable'
    ? value.pairOriginSource
    : 'window'

  const migratedAt = typeof value.migratedAt === 'string'
    ? value.migratedAt
    : (
      typeof value.pairOrigin === 'string'
      && typeof value.registryVersion === 'number'
      && value.registryVersion >= ACTIVE_PAIR_REGISTRY_VERSION
        ? null
        : now
    )

  if (!siteCode || !laneCode || !deviceCode) return null

  return {
    pairId,
    siteCode,
    laneCode,
    direction,
    deviceCode,
    deviceSecret,
    token,
    pairUrl,
    createdAt,
    lastOpenedAt,
    pairOrigin,
    pairOriginSource,
    registryVersion: Math.max(ACTIVE_PAIR_REGISTRY_VERSION, registryVersion),
    migratedAt,
  } satisfies ActiveMobilePair
}

function readActivePairStorage() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ACTIVE_PAIR_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []

    const rows = data
      .map((item) => normalizeStoredMobilePair(item))
      .filter((item): item is ActiveMobilePair => Boolean(item))

    const shouldRewrite = rows.length !== data.length || rows.some((row, index) => {
      const original = data[index]
      return !isRecord(original)
        || original.pairOrigin !== row.pairOrigin
        || original.registryVersion !== row.registryVersion
        || original.migratedAt !== row.migratedAt
        || original.pairOriginSource !== row.pairOriginSource
    })

    if (shouldRewrite) writeActivePairStorage(rows)
    return rows
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

export function buildMobileCapturePairUrl(
  context: Partial<MobilePairContext>,
  options?: { originOverride?: string },
) {
  const originInfo = getMobilePairOriginInfo(options?.originOverride)
  if (!originInfo.effectiveOrigin) return ''
  const url = new URL('/mobile-capture', originInfo.effectiveOrigin)
  // pairToken is required for backend; when from "Create pair" it is the backend-created token
  if (context.token) url.searchParams.set('pairToken', context.token)
  // Include context in URL so QR updates when user changes lane/device (backend uses pairToken only)
  if (context.siteCode) url.searchParams.set('siteCode', context.siteCode)
  if (context.laneCode) url.searchParams.set('laneCode', context.laneCode)
  if (context.direction) url.searchParams.set('direction', context.direction === 'EXIT' ? 'EXIT' : 'ENTRY')
  if (context.deviceCode) url.searchParams.set('deviceCode', context.deviceCode)
  return url.toString()
}

export function listActiveMobilePairs() {
  return readActivePairStorage().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function registerActiveMobilePair(
  context: MobilePairContext,
  options?: { originOverride?: string },
) {
  const now = new Date().toISOString()
  const originInfo = getMobilePairOriginInfo(options?.originOverride)
  const pairUrl = buildMobileCapturePairUrl(context, { originOverride: originInfo.effectiveOrigin })
  const next: ActiveMobilePair = {
    ...context,
    pairId: randomToken(),
    pairUrl,
    createdAt: now,
    lastOpenedAt: now,
    pairOrigin: originInfo.effectiveOrigin,
    pairOriginSource: originInfo.source,
    registryVersion: ACTIVE_PAIR_REGISTRY_VERSION,
    migratedAt: null,
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

export function deriveActiveMobilePairOriginState(
  row: ActiveMobilePair,
  expectedOriginOverride?: string,
): ActiveMobilePairOriginState {
  const expectedOrigin = resolveMobilePairOrigin(expectedOriginOverride)

  if (!row.pairOrigin) {
    return {
      code: 'missing-origin',
      label: 'origin unknown',
      detail: 'Legacy pair registry entry has no stored origin. Recreate the pair before handing it to mobile.',
      variant: 'destructive',
      requiresMigration: true,
    }
  }

  if (isMobilePairOriginLoopback(row.pairOrigin)) {
    return {
      code: 'loopback',
      label: 'loopback origin',
      detail: `Pair was generated with ${row.pairOrigin}. iPhone or Android on LAN will not reach localhost.`,
      variant: 'destructive',
      requiresMigration: true,
    }
  }

  if (expectedOrigin && row.pairOrigin !== expectedOrigin) {
    return {
      code: 'legacy-origin',
      label: 'origin drift',
      detail: `Stored origin ${row.pairOrigin} no longer matches current effective origin ${expectedOrigin}.`,
      variant: 'amber',
      requiresMigration: true,
    }
  }

  if (row.registryVersion < ACTIVE_PAIR_REGISTRY_VERSION || row.migratedAt) {
    return {
      code: 'legacy-schema',
      label: 'migrated',
      detail: row.migratedAt
        ? `Legacy pair entry was normalized on ${new Date(row.migratedAt).toLocaleString('vi-VN')}.`
        : 'Pair entry was normalized from an older registry schema.',
      variant: 'amber',
      requiresMigration: false,
    }
  }

  return {
    code: 'current',
    label: 'current origin',
    detail: `Pair matches effective origin ${row.pairOrigin}.`,
    variant: 'secondary',
    requiresMigration: false,
  }
}

export function readMobileCaptureSeedFromLocation(
  search = typeof window !== 'undefined' ? window.location.search : '',
): MobileCaptureSeedContext {
  const params = new URLSearchParams(search)
  const seed: MobileCaptureSeedContext = {
    siteCode: params.get('siteCode') || '',
    laneCode: params.get('laneCode') || '',
    direction: params.get('direction') === 'EXIT' ? 'EXIT' : 'ENTRY',
    deviceCode: params.get('deviceCode') || '',
    deviceSecret: params.get('deviceSecret') || '',
    token: params.get('pairToken') || params.get('token') || '',  // Support both pairToken and token
    prefilledAt: new Date().toISOString(),
    source: 'empty',
  }

  seed.source = (seed.siteCode || seed.laneCode || seed.deviceCode || seed.deviceSecret || seed.token) ? 'query' : 'empty'
  return seed
}

export function readMobileCaptureContextFromLocation(search = typeof window !== 'undefined' ? window.location.search : ''): MobilePairContext {
  const seed = readMobileCaptureSeedFromLocation(search)
  return {
    siteCode: seed.siteCode,
    laneCode: seed.laneCode,
    direction: seed.direction,
    deviceCode: seed.deviceCode,
    deviceSecret: seed.deviceSecret,
    token: seed.token,
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
 * Mobile capture heartbeat - uses pairToken instead of user auth
 */
export type MobileCaptureHeartbeatRes = {
  pairing: unknown
  heartbeat: unknown
  refreshed: boolean
  heartbeatError?: { code: string; message: string } | null
}

export async function sendMobileCaptureHeartbeat(args: {
  pairToken: string
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  latencyMs?: number | null
  firmwareVersion?: string | null
  ipAddress?: string | null
  rawPayload?: unknown
}): Promise<MobileCaptureHeartbeatRes> {
  const path = `/api/mobile-capture/heartbeat?pairToken=${encodeURIComponent(args.pairToken)}`
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: args.status,
      latencyMs: args.latencyMs ?? undefined,
      firmwareVersion: args.firmwareVersion ?? undefined,
      ipAddress: args.ipAddress ?? undefined,
      rawPayload: args.rawPayload,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    // Try to extract structured API error from response body so callers
    // (normalizeApiError) get code + details instead of a plain string.
    let code: string | undefined
    let message: string | undefined
    let details: unknown = undefined
    let requestId: string | undefined
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        code = parsed.code
        message = parsed.message
        details = parsed.details
        requestId = parsed.requestId
      }
    } catch { /* fall through to string message */ }
    const err = new Error(
      code
        ? `Heartbeat failed: ${res.status} — ${code}: ${message ?? text}`
        : `Heartbeat failed: ${res.status} ${res.statusText} - ${text}`,
    ) as Error & { code?: string; details?: unknown; requestId?: string }
    err.code = code
    err.details = details
    err.requestId = requestId
    throw err
  }
  const envelope = await res.json() as { requestId?: string; data?: MobileCaptureHeartbeatRes }
  return (envelope?.data ?? envelope) as MobileCaptureHeartbeatRes
}

/**
 * Mobile capture ALPR - uses pairToken instead of user auth
 */
/** Response shape from POST /api/mobile-capture/upload */
export type MobileCaptureUploadRes = {
  mediaId?: string
  imageUrl?: string
  viewUrl?: string
  filePath?: string
  filename?: string
}

export type LocalAlprCandidate = AlprPreviewCandidate

export type LocalAlprWinner = AlprPreviewWinner

/** Subset of LocalAlprRecognition from backend — used to transform to AlprRecognizeRes */
export type MobileCaptureRecognition = {
  recognizedPlate: string
  confidence: number
  source: 'PLATE_HINT' | 'LOCAL_OCR' | 'HTTP_PROVIDER'
  previewStatus: AlprPreviewStatus
  needsConfirm: boolean
  /** Alias for recognizedPlate — mirrors AlprRecognizeRes['plate'] */
  plate?: string
  plateFamily?: string
  ocrSubstitutions?: string[]
  suspiciousFlags?: string[]
  validationNotes?: string[]
  rawText?: string | null
  imagePath?: string | null
  originalFilename?: string | null
  raw?: Record<string, unknown>
  candidates: LocalAlprCandidate[]
  winner: LocalAlprWinner | null
}

/** Subset of GateReadEvent persisted after ALPR ingest */
export type MobileCaptureCapture = {
  siteCode: string
  laneCode: string
  deviceCode: string
  direction: 'ENTRY' | 'EXIT'
  readType: 'ALPR'
  occurredAt: string
  sessionId: string
  sessionStatus: string
  readEventId: string | number
  plateRaw: string | null
  plateCompact: string | null
  plateDisplay: string | null
  plateFamily: string
  plateValidity: string
  plate: {
    plateRaw: string | null
    plateCompact: string | null
    plateDisplay: string | null
    plateFamily: string
    plateValidity: string
    ocrSubstitutions: string[]
    suspiciousFlags: string[]
    validationNotes: string[]
    reviewRequired: boolean
  }
  imageUrl: string | null
  ocrConfidence: number | null
  rfidUid: string | null
  sensorState: string | null
  changed: boolean
  alreadyExists: boolean
}

/** Response shape from POST /api/mobile-capture/alpr */
export type MobileCaptureAlprRes = {
  pairing: Record<string, unknown>
  mediaId: string | null
  viewUrl: string | null
  recognition: MobileCaptureRecognition
  capture: MobileCaptureCapture
  refreshed: boolean
}

export async function sendMobileCaptureAlpr(args: {
  pairToken: string
  mediaId?: string | null
  imageUrl?: string | null
  plateHint?: string | null
}): Promise<MobileCaptureAlprRes> {
  const path = `/api/mobile-capture/alpr?pairToken=${encodeURIComponent(args.pairToken)}`
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaId: args.mediaId ?? undefined,
      imageUrl: args.imageUrl ?? undefined,
      plateHint: args.plateHint ?? undefined,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    let code: string | undefined
    let message: string | undefined
    let details: unknown = undefined
    let requestId: string | undefined
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        code = parsed.code
        message = parsed.message
        details = parsed.details
        requestId = parsed.requestId
      }
    } catch { /* fall through */ }
    const err = new Error(
      code
        ? `ALPR capture failed: ${res.status} — ${code}: ${message ?? text}`
        : `ALPR capture failed: ${res.status} ${res.statusText} - ${text}`,
    ) as Error & { code?: string; details?: unknown; requestId?: string; status?: number }
    err.code = code
    err.details = details
    err.requestId = requestId
    err.status = res.status
    throw err
  }
  const envelope = await res.json() as { requestId?: string; data?: MobileCaptureAlprRes }
  return (envelope?.data ?? envelope) as MobileCaptureAlprRes
}

/**
 * Mobile capture upload - uses pairToken instead of user auth
 */
export async function sendMobileCaptureUpload(args: {
  pairToken: string
  file: File
}): Promise<MobileCaptureUploadRes> {
  const fd = new FormData()
  fd.append('file', args.file)
  const path = `/api/mobile-capture/upload?pairToken=${encodeURIComponent(args.pairToken)}`
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    const text = await res.text()
    let code: string | undefined
    let message: string | undefined
    let details: unknown = undefined
    let requestId: string | undefined
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        code = parsed.code
        message = parsed.message
        details = parsed.details
        requestId = parsed.requestId
      }
    } catch { /* fall through */ }
    const err = new Error(
      code
        ? `Upload failed: ${res.status} — ${code}: ${message ?? text}`
        : `Upload failed: ${res.status} ${res.statusText} - ${text}`,
    ) as Error & { code?: string; details?: unknown; requestId?: string }
    err.code = code
    err.details = details
    err.requestId = requestId
    throw err
  }
  const envelope = await res.json() as { requestId?: string; data?: MobileCaptureUploadRes }
  return (envelope?.data ?? envelope) as MobileCaptureUploadRes
}

/**
 * Returns true when the mobile pair origin is a loopback address (localhost / 127.x / ::1).
 * Used to gate QR scanning warnings in the pair UI.
 */
export function isMobilePairOriginLoopback(origin?: string): boolean {
  const candidate = origin ?? getMobilePairOriginInfo().effectiveOrigin
  const url = safeParseUrl(candidate)
  const hostname = url?.hostname ?? ''
  return isLoopbackHost(hostname)
}

/**
 * Resolves the effective origin to use for mobile pair links.
 * Precedence: explicit override -> VITE_PUBLIC_WEB_ORIGIN -> window.location.origin.
 */
export function resolveMobilePairOrigin(override?: string): string {
  return getMobilePairOriginInfo(override).effectiveOrigin
}
