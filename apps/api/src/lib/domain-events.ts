/**
 * Domain Events Bus — typed in-process event emitter.
 *
 * Decouples service-to-service communication within the API process.
 * Each event is validated against its Zod schema before emission.
 *
 * Usage:
 * ```ts
 * import { domainEvents, DomainEventName } from '../lib/domain-events'
 *
 * // Emit
 * domainEvents.emit('SessionOpened', { sessionId: '...', siteCode: '...', ... })
 *
 * // Subscribe
 * domainEvents.on('SessionOpened', (event) => { ... })
 * ```
 */

import { z } from 'zod/v4'

// ─── Event Schemas ───────────────────────────────────────────────────────────

export const SessionOpenedSchema = z.object({
  sessionId: z.string(),
  siteCode: z.string(),
  gateCode: z.string(),
  laneCode: z.string(),
  direction: z.enum(['ENTRY', 'EXIT']),
  plateCompact: z.string().nullable(),
  rfidUid: z.string().nullable(),
  openedAt: z.string(),
})

export const SessionResolvedSchema = z.object({
  sessionId: z.string(),
  siteCode: z.string(),
  resolution: z.enum(['COMPLETED', 'CANCELLED', 'REJECTED', 'TIMEOUT']),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.string(),
  durationMinutes: z.number().nullable(),
  amountPaid: z.number().nullable(),
})

export const DecisionMadeSchema = z.object({
  sessionId: z.string(),
  siteCode: z.string(),
  laneCode: z.string(),
  direction: z.enum(['ENTRY', 'EXIT']),
  decisionCode: z.string(),
  reasonCode: z.string(),
  recommendedAction: z.string(),
  reviewRequired: z.boolean(),
  decidedAt: z.string(),
})

export const BarrierCommandSchema = z.object({
  siteCode: z.string(),
  laneCode: z.string(),
  command: z.enum(['OPEN', 'CLOSE', 'HOLD']),
  triggeredBy: z.enum(['AUTO', 'MANUAL', 'REVIEW']),
  sessionId: z.string().nullable(),
  commandedAt: z.string(),
})

export const IncidentCreatedSchema = z.object({
  incidentId: z.string(),
  siteCode: z.string(),
  incidentType: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  sourceEntity: z.string().nullable(),
  createdAt: z.string(),
})

export const IncidentResolvedSchema = z.object({
  incidentId: z.string(),
  siteCode: z.string(),
  resolvedBy: z.string(),
  resolution: z.string(),
  resolvedAt: z.string(),
})

export const WebhookDeliverySchema = z.object({
  deliveryId: z.string(),
  endpointId: z.string(),
  eventType: z.string(),
  attempt: z.number(),
  status: z.enum(['PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED']),
  httpStatus: z.number().nullable(),
  deliveredAt: z.string().nullable(),
})

export const PresenceDetectedSchema = z.object({
  presenceId: z.string(),
  siteCode: z.string(),
  laneCode: z.string(),
  plateCompact: z.string().nullable(),
  rfidUid: z.string().nullable(),
  detectedAt: z.string(),
})

// ─── Event Registry ──────────────────────────────────────────────────────────

export const DOMAIN_EVENT_SCHEMAS = {
  SessionOpened: SessionOpenedSchema,
  SessionResolved: SessionResolvedSchema,
  DecisionMade: DecisionMadeSchema,
  BarrierCommand: BarrierCommandSchema,
  IncidentCreated: IncidentCreatedSchema,
  IncidentResolved: IncidentResolvedSchema,
  WebhookDelivery: WebhookDeliverySchema,
  PresenceDetected: PresenceDetectedSchema,
} as const

export type DomainEventName = keyof typeof DOMAIN_EVENT_SCHEMAS
export type DomainEventPayload<N extends DomainEventName> = z.infer<(typeof DOMAIN_EVENT_SCHEMAS)[N]>

// ─── Event Envelope ──────────────────────────────────────────────────────────

export type DomainEventEnvelope<N extends DomainEventName = DomainEventName> = {
  eventName: N
  payload: DomainEventPayload<N>
  emittedAt: string
  correlationId?: string
}

// ─── Bus Implementation ──────────────────────────────────────────────────────

type Listener<N extends DomainEventName> = (event: DomainEventEnvelope<N>) => void | Promise<void>

class DomainEventBus {
  private listeners = new Map<DomainEventName, Set<Listener<any>>>()
  private globalListeners = new Set<Listener<any>>()

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  on<N extends DomainEventName>(eventName: N, listener: Listener<N>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(listener)
    return () => {
      this.listeners.get(eventName)?.delete(listener)
    }
  }

  /**
   * Subscribe to ALL events (useful for logging, webhook dispatch, etc.).
   */
  onAll(listener: Listener<any>): () => void {
    this.globalListeners.add(listener)
    return () => {
      this.globalListeners.delete(listener)
    }
  }

  /**
   * Emit a domain event. Validates the payload against the Zod schema.
   * Listeners execute asynchronously — errors are caught and logged, never propagated.
   */
  emit<N extends DomainEventName>(
    eventName: N,
    payload: DomainEventPayload<N>,
    opts?: { correlationId?: string },
  ): void {
    const schema = DOMAIN_EVENT_SCHEMAS[eventName]
    const parsed = schema.parse(payload)

    const envelope: DomainEventEnvelope<N> = {
      eventName,
      payload: parsed as DomainEventPayload<N>,
      emittedAt: new Date().toISOString(),
      correlationId: opts?.correlationId,
    }

    // Fire-and-forget: listeners must not block the caller
    const specificListeners = this.listeners.get(eventName) ?? new Set()
    for (const listener of specificListeners) {
      try {
        const result = listener(envelope)
        if (result && typeof (result as any).catch === 'function') {
          ;(result as Promise<void>).catch((err) => {
            console.error(`[DomainEvents] Listener error for ${eventName}:`, err)
          })
        }
      } catch (err) {
        console.error(`[DomainEvents] Sync listener error for ${eventName}:`, err)
      }
    }
    for (const listener of this.globalListeners) {
      try {
        const result = listener(envelope)
        if (result && typeof (result as any).catch === 'function') {
          ;(result as Promise<void>).catch((err) => {
            console.error(`[DomainEvents] Global listener error for ${eventName}:`, err)
          })
        }
      } catch (err) {
        console.error(`[DomainEvents] Global sync listener error for ${eventName}:`, err)
      }
    }
  }

  /** Remove all listeners (useful for testing). */
  removeAll(): void {
    this.listeners.clear()
    this.globalListeners.clear()
  }

  /** Get the list of registered event names (for introspection). */
  get eventNames(): DomainEventName[] {
    return Object.keys(DOMAIN_EVENT_SCHEMAS) as DomainEventName[]
  }
}

/** Singleton domain events bus. */
export const domainEvents = new DomainEventBus()
