import 'dotenv/config'

import { randomUUID } from 'node:crypto'

import { writeAuditLog } from '../server/services/audit-service'
import { observeSecretRotationEvent } from '../server/metrics'
import {
  buildSecretRotationAuditEntries,
  parseSecretRotationAuditAction,
  parseSecretRotationAuditField,
  type SecretRotationAuditAction,
  type SecretRotationAuditField,
} from '../lib/security/secret-rotation-audit'

const SECRET_ROTATION_AUDIT_EVENT_CODES = {
  STARTED: 'SECRET_ROTATION_STARTED',
  COMPLETED: 'SECRET_ROTATION_COMPLETED',
  ROLLBACK: 'SECRET_ROTATION_ROLLBACK',
} as const

export type SecretsRotationAuditArgs = {
  action: SecretRotationAuditAction
  field: SecretRotationAuditField
  correlationId: string
  requestId: string
}

export function parseSecretsRotationAuditArgs(argv: string[]): SecretsRotationAuditArgs {
  let action: SecretRotationAuditAction = 'STARTED'
  let field: SecretRotationAuditField = 'ALL'
  let correlationId = ''
  let requestId = ''

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--action') action = parseSecretRotationAuditAction(argv[++index])
    else if (token === '--field') field = parseSecretRotationAuditField(argv[++index])
    else if (token === '--correlation-id') correlationId = String(argv[++index] ?? '').trim()
    else if (token === '--request-id') requestId = String(argv[++index] ?? '').trim()
    else throw new Error(`Unknown argument: ${token}`)
  }

  return {
    action,
    field,
    correlationId: correlationId || `rotation-${action.toLowerCase()}-${randomUUID()}`,
    requestId: requestId || randomUUID(),
  }
}

export async function runSecretsRotationAudit(args: SecretsRotationAuditArgs) {
  const entries = buildSecretRotationAuditEntries({
    action: args.action,
    field: args.field,
    correlationId: args.correlationId,
    requestId: args.requestId,
  })

  for (const entry of entries) {
    await writeAuditLog(entry)
    observeSecretRotationEvent({ field: String(entry.entityId), action: args.action })
  }

  return {
    ok: true,
    action: args.action,
    eventCode: SECRET_ROTATION_AUDIT_EVENT_CODES[args.action],
    field: args.field,
    requestId: args.requestId,
    correlationId: args.correlationId,
    count: entries.length,
  }
}

if (require.main === module) {
  parseSecretsRotationAuditArgs(process.argv.slice(2))
  runSecretsRotationAudit(parseSecretsRotationAuditArgs(process.argv.slice(2)))
    .then((result) => {
      console.log('[secrets:rotation:audit]')
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((error) => {
      console.error(`[secrets:rotation:audit] ${String((error as Error).message ?? error)}`)
      process.exitCode = 1
    })
}
