import type { Express } from 'express'
import client from 'prom-client'

const register = new client.Registry()
client.collectDefaultMetrics({ register })

const httpDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'path', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
register.registerMetric(httpDuration)

const gateSessionOpenDuration = new client.Histogram({
  name: 'gate_session_open_duration_ms',
  help: 'Business latency for opening or reusing a gate session',
  labelNames: ['site_code', 'lane_code', 'direction', 'result'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
register.registerMetric(gateSessionOpenDuration)

const gateSessionResolveDuration = new client.Histogram({
  name: 'gate_session_resolve_duration_ms',
  help: 'Business latency for resolving a gate session',
  labelNames: ['site_code', 'lane_code', 'direction', 'result'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
})
register.registerMetric(gateSessionResolveDuration)

const gateBarrierAckTimeoutTotal = new client.Counter({
  name: 'gate_barrier_ack_timeout_total',
  help: 'Count of barrier commands that timed out without ACK',
  labelNames: ['site_code', 'lane_code'],
})
register.registerMetric(gateBarrierAckTimeoutTotal)

const gateReviewQueueSize = new client.Gauge({
  name: 'gate_review_queue_size',
  help: 'Open + claimed review queue size by site',
  labelNames: ['site_code'],
})
register.registerMetric(gateReviewQueueSize)

const gateDeviceOfflineCount = new client.Gauge({
  name: 'gate_device_offline_count',
  help: 'Derived offline devices by site from heartbeat aging',
  labelNames: ['site_code'],
})
register.registerMetric(gateDeviceOfflineCount)

const gateOutboxBacklogSize = new client.Gauge({
  name: 'gate_outbox_backlog_size',
  help: 'Current outbox backlog size by site and status',
  labelNames: ['site_code', 'status'],
})
register.registerMetric(gateOutboxBacklogSize)

const redisUp = new client.Gauge({
  name: 'redis_up',
  help: 'Redis dependency availability gauge (1=up, 0=down)',
})
register.registerMetric(redisUp)

const redisCommandFailuresTotal = new client.Counter({
  name: 'redis_command_failures_total',
  help: 'Count of Redis command failures',
  labelNames: ['command'],
})
register.registerMetric(redisCommandFailuresTotal)

const redisLatencyMs = new client.Histogram({
  name: 'redis_latency_ms',
  help: 'Redis command latency in ms',
  labelNames: ['command'],
  buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
})
register.registerMetric(redisLatencyMs)

const alprPreviewCacheEventsTotal = new client.Counter({
  name: 'alpr_preview_cache_events_total',
  help: 'ALPR preview cache outcome by surface',
  labelNames: ['surface', 'result'],
})
register.registerMetric(alprPreviewCacheEventsTotal)

const alprPreviewDedupeSuppressedTotal = new client.Counter({
  name: 'alpr_preview_dedupe_suppressed_total',
  help: 'ALPR preview duplicate requests suppressed by Redis dedupe',
  labelNames: ['surface'],
})
register.registerMetric(alprPreviewDedupeSuppressedTotal)

function safeLabel(value: string | null | undefined, fallback = 'UNKNOWN') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

export function observeSessionOpen(args: { siteCode?: string | null; laneCode?: string | null; direction?: string | null; result?: string | null; durationMs: number }) {
  gateSessionOpenDuration
    .labels(safeLabel(args.siteCode), safeLabel(args.laneCode), safeLabel(args.direction), safeLabel(args.result, 'OK'))
    .observe(Math.max(0, args.durationMs))
}

export function observeSessionResolve(args: { siteCode?: string | null; laneCode?: string | null; direction?: string | null; result?: string | null; durationMs: number }) {
  gateSessionResolveDuration
    .labels(safeLabel(args.siteCode), safeLabel(args.laneCode), safeLabel(args.direction), safeLabel(args.result, 'OK'))
    .observe(Math.max(0, args.durationMs))
}

export function incrementBarrierAckTimeout(args: { siteCode?: string | null; laneCode?: string | null; count?: number }) {
  const count = Math.max(0, Number(args.count ?? 1) || 0)
  if (count <= 0) return
  gateBarrierAckTimeoutTotal.labels(safeLabel(args.siteCode), safeLabel(args.laneCode)).inc(count)
}

export function setReviewQueueSize(args: { siteCode?: string | null; count: number }) {
  gateReviewQueueSize.labels(safeLabel(args.siteCode)).set(Math.max(0, args.count))
}

export function setDeviceOfflineCount(args: { siteCode?: string | null; count: number }) {
  gateDeviceOfflineCount.labels(safeLabel(args.siteCode)).set(Math.max(0, args.count))
}

export function setOutboxBacklogSize(args: { siteCode?: string | null; status?: string | null; count: number }) {
  gateOutboxBacklogSize.labels(safeLabel(args.siteCode), safeLabel(args.status)).set(Math.max(0, args.count))
}

export function registerMetrics(app: Express) {
  app.use((req, res, next) => {
    const t0 = Date.now()
    res.on('finish', () => {
      const dt = Date.now() - t0
      const path = req.route?.path ? String(req.route.path) : req.path
      httpDuration.labels(req.method, path, String(res.statusCode)).observe(dt)
    })
    next()
  })
}

export async function getMetricsText(): Promise<string> {
  return await register.metrics()
}

export function setRedisUp(value: number) {
  redisUp.set(value > 0 ? 1 : 0)
}

export function incrementRedisCommandFailures(command: string, count = 1) {
  const safeCount = Math.max(0, Number(count) || 0)
  if (safeCount <= 0) return
  redisCommandFailuresTotal.labels(safeLabel(command, 'unknown')).inc(safeCount)
}

export function observeRedisLatency(command: string, durationMs: number) {
  redisLatencyMs.labels(safeLabel(command, 'unknown')).observe(Math.max(0, durationMs))
}

export function incrementAlprPreviewCacheEvent(args: { surface?: string | null; result: 'MISS' | 'HIT' | 'DEDUPED' | 'DISABLED' }) {
  alprPreviewCacheEventsTotal.labels(safeLabel(args.surface), safeLabel(args.result)).inc(1)
}

export function incrementAlprPreviewDedupeSuppressed(surface?: string | null, count = 1) {
  const safeCount = Math.max(0, Number(count) || 0)
  if (safeCount <= 0) return
  alprPreviewDedupeSuppressedTotal.labels(safeLabel(surface)).inc(safeCount)
}