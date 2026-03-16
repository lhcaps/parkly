import type { AuditActorInput, AuditWriteInput } from '../../server/services/audit-service'
import { evaluateSecretRotation, type SecretRotationFieldReport } from './secret-rotation'

export type SecretRotationAuditAction = 'STARTED' | 'COMPLETED' | 'ROLLBACK'
export type SecretRotationAuditField = 'API_INTERNAL_SERVICE_TOKEN' | 'DEVICE_CAPTURE_DEFAULT_SECRET' | 'ALL'

export function parseSecretRotationAuditAction(value: string | null | undefined): SecretRotationAuditAction {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'STARTED' || normalized === 'COMPLETED' || normalized === 'ROLLBACK') return normalized
  throw new Error(`Unsupported secret rotation audit action: ${String(value ?? '')}`)
}

export function parseSecretRotationAuditField(value: string | null | undefined): SecretRotationAuditField {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/-/g, '_')
  if (normalized === 'API_INTERNAL_SERVICE_TOKEN' || normalized === 'DEVICE_CAPTURE_DEFAULT_SECRET' || normalized === 'ALL') return normalized
  if (normalized === 'INTERNAL_SERVICE') return 'API_INTERNAL_SERVICE_TOKEN'
  if (normalized === 'DEVICE_CAPTURE') return 'DEVICE_CAPTURE_DEFAULT_SECRET'
  throw new Error(`Unsupported secret rotation audit field: ${String(value ?? '')}`)
}

function toAuditSnapshot(field: SecretRotationFieldReport) {
  return {
    field: field.field,
    mode: field.mode,
    rotationEnabled: field.rotationEnabled,
    accepted: field.accepted.map((item) => ({
      slot: item.slot,
      sourceEnv: item.sourceEnv,
      masked: item.masked,
      fingerprint: item.fingerprint,
    })),
    findings: field.findings,
  }
}

export function buildSecretRotationAuditEntries(args: {
  action: SecretRotationAuditAction
  field: SecretRotationAuditField
  actor?: AuditActorInput | null
  requestId?: string | null
  correlationId?: string | null
  occurredAt?: string | Date | null
  env?: NodeJS.ProcessEnv
}): AuditWriteInput[] {
  const rotation = evaluateSecretRotation(args.env)
  const fields = args.field === 'ALL'
    ? [rotation.fields.API_INTERNAL_SERVICE_TOKEN, rotation.fields.DEVICE_CAPTURE_DEFAULT_SECRET]
    : [rotation.fields[args.field]]

  return fields.map((field) => ({
    action: `SECRET_ROTATION_${args.action}`,
    entityTable: 'runtime_secret_rotation',
    entityId: field.field,
    actor: args.actor ?? {
      principalType: 'SERVICE',
      role: 'WORKER',
      actorLabel: 'SECRET_ROTATION',
      serviceCode: 'SECRET_ROTATION',
    },
    beforeSnapshot: null,
    afterSnapshot: {
      profile: String((args.env ?? process.env).PARKLY_DEPLOYMENT_PROFILE ?? 'DEMO').trim().toUpperCase() || 'DEMO',
      ...toAuditSnapshot(field),
    },
    requestId: args.requestId ?? null,
    correlationId: args.correlationId ?? null,
    occurredAt: args.occurredAt ?? new Date().toISOString(),
  }))
}
