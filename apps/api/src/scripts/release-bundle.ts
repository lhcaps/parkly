import { asCanonicalAuthRole, type AuthRole } from '@parkly/contracts'

export type ReleaseCommandStep = {
  id: string
  title: string
  command: string
  intent: string
  required: boolean
}

export type ReleaseSmokeFixture = {
  username: string
  password: string
  role: 'ADMIN' | 'OPS' | 'WORKER' | AuthRole
  siteCode: string
  zoneCode: string
  spotCode: string
  mismatchPlateCompact: string
  notes: string
}

export const RELEASE_GRANT_PROFILE = 'MVP' as const
export const BACKEND_RC_BASELINE_TAG = 'backend-rc1' as const

export const DEFAULT_RELEASE_FIXTURE: ReleaseSmokeFixture = {
  username: 'ops',
  password: 'Parkly@123',
  role: 'OPS',
  siteCode: 'SITE_HCM_01',
  zoneCode: 'VIP_A',
  spotCode: 'HCM-VIP-01',
  mismatchPlateCompact: '51B67890',
  notes: 'Fixture này dựa trên seed_min: VIP_A / HCM-VIP-01 có expected plate khác để cố ý tạo reconciliation violation.',
}

export function getReleaseFixtureFromEnv(env: NodeJS.ProcessEnv = process.env): ReleaseSmokeFixture {
  return {
    username: String(env.SMOKE_USERNAME ?? DEFAULT_RELEASE_FIXTURE.username).trim() || DEFAULT_RELEASE_FIXTURE.username,
    password: String(env.SMOKE_PASSWORD ?? DEFAULT_RELEASE_FIXTURE.password),
    role: normalizeRole(env.SMOKE_ROLE) ?? DEFAULT_RELEASE_FIXTURE.role,
    siteCode: String(env.SMOKE_SITE_CODE ?? env.DEMO_SITE_CODE ?? DEFAULT_RELEASE_FIXTURE.siteCode).trim() || DEFAULT_RELEASE_FIXTURE.siteCode,
    zoneCode: String(env.SMOKE_ZONE_CODE ?? DEFAULT_RELEASE_FIXTURE.zoneCode).trim() || DEFAULT_RELEASE_FIXTURE.zoneCode,
    spotCode: String(env.SMOKE_SPOT_CODE ?? DEFAULT_RELEASE_FIXTURE.spotCode).trim() || DEFAULT_RELEASE_FIXTURE.spotCode,
    mismatchPlateCompact: normalizePlate(String(env.SMOKE_MISMATCH_PLATE ?? DEFAULT_RELEASE_FIXTURE.mismatchPlateCompact)) ?? DEFAULT_RELEASE_FIXTURE.mismatchPlateCompact,
    notes: DEFAULT_RELEASE_FIXTURE.notes,
  }
}

export function buildBootstrapSteps(): ReleaseCommandStep[] {
  return [
    {
      id: 'platform-up',
      title: 'Khởi động Redis + MinIO local',
      command: 'pnpm --dir apps/api platform:up',
      intent: 'Dựng các dependency local trước khi API chạm Redis/object-storage.',
      required: true,
    },
    {
      id: 'db-migrate',
      title: 'Chạy Flyway migrate',
      command: 'pnpm --dir apps/api db:migrate',
      intent: 'Đưa schema lên version mới nhất trước khi generate Prisma hoặc seed.',
      required: true,
    },
    {
      id: 'db-validate',
      title: 'Validate migration history',
      command: 'pnpm --dir apps/api db:validate',
      intent: 'Chặn việc seed trên schema lệch hoặc migration chưa sạch.',
      required: true,
    },
    {
      id: 'prisma-generate',
      title: 'Generate Prisma client',
      command: 'pnpm --dir apps/api prisma:generate',
      intent: 'Đồng bộ Prisma client sau khi schema DB đã ổn định.',
      required: true,
    },
    {
      id: 'grant-app',
      title: 'Áp quyền runtime MVP cho parking_app',
      command: 'pnpm --dir apps/api db:grant:app',
      intent: 'PR18 smoke/auth/audit cần grant surface mức MVP để login và đọc audit bằng runtime user.',
      required: true,
    },
    {
      id: 'seed-min',
      title: 'Seed dữ liệu tối thiểu',
      command: 'pnpm --dir apps/api db:seed:min',
      intent: 'Đưa fixture demo/auth/subscription/spot về trạng thái dự đoán được.',
      required: true,
    },
  ]
}

export function buildResetSteps(): ReleaseCommandStep[] {
  return [
    {
      id: 'grant-app',
      title: 'Áp lại quyền runtime MVP cho parking_app',
      command: 'pnpm --dir apps/api db:grant:app',
      intent: 'Reset/replay phải tự chữa grant surface cho auth/audit thay vì giả định parking_app đã được cấp quyền đúng từ trước.',
      required: true,
    },
    {
      id: 'seed-reset',
      title: 'Xóa dữ liệu demo/seed cũ',
      command: 'pnpm --dir apps/api db:seed:reset',
      intent: 'Làm sạch dữ liệu seed để replay demo không bị trôi trạng thái.',
      required: true,
    },
    {
      id: 'seed-min',
      title: 'Seed lại fixture tối thiểu',
      command: 'pnpm --dir apps/api db:seed:min',
      intent: 'Đưa site, auth users, VIP subscriptions, lane/device fixture về đúng baseline.',
      required: true,
    },
  ]
}

export function buildSmokeSteps(fixture: ReleaseSmokeFixture = DEFAULT_RELEASE_FIXTURE): ReleaseCommandStep[] {
  return [
    {
      id: 'smoke-login',
      title: 'Đăng nhập user thật',
      command: `POST /api/auth/login username=${fixture.username} role=${fixture.role}`,
      intent: 'Xác nhận human auth không còn phụ thuộc static role token.',
      required: true,
    },
    {
      id: 'smoke-me',
      title: 'Kiểm tra principal hiện tại',
      command: 'GET /api/auth/me',
      intent: 'Chốt refresh/access token trả đúng principal + site scope.',
      required: true,
    },
    {
      id: 'smoke-dashboard',
      title: 'Lấy dashboard summary',
      command: `GET /api/ops/dashboard/summary?siteCode=${fixture.siteCode}`,
      intent: 'Xác nhận homepage không cần hot-join nhiều endpoint raw.',
      required: true,
    },
    {
      id: 'smoke-media',
      title: 'Upload media evidence',
      command: 'POST /api/media/upload (multipart file)',
      intent: 'Đi qua storage pipeline tối thiểu và nhận về viewUrl ổn định.',
      required: true,
    },
    {
      id: 'smoke-presence-intake',
      title: 'Bắn internal presence event',
      command: `POST /api/internal/presence-events zone=${fixture.zoneCode} spot=${fixture.spotCode}`,
      intent: 'Kiểm tra ingest presence + signature + append-only persistence.',
      required: true,
    },
    {
      id: 'smoke-reconciliation',
      title: 'Refresh spot occupancy',
      command: `GET /api/ops/spot-occupancy/${fixture.spotCode}?siteCode=${fixture.siteCode}&refresh=true`,
      intent: 'Xác nhận projection/read-model được rebuild từ source-of-truth.',
      required: true,
    },
    {
      id: 'smoke-incidents',
      title: 'List và resolve incident',
      command: 'GET /api/ops/incidents -> POST /api/ops/incidents/:incidentId/resolve',
      intent: 'Khóa vòng smoke từ intake -> reconcile -> incident -> resolution.',
      required: true,
    },
    {
      id: 'smoke-audit',
      title: 'Đọc audit sau resolution',
      command: 'GET /api/ops/audit?entityTable=gate_incidents',
      intent: 'Xác nhận action quan trọng reconstruct được từ audit record.',
      required: true,
    },
  ]
}


export function buildRcGateSteps(): ReleaseCommandStep[] {
  return [
    {
      id: 'typecheck',
      title: 'Typecheck toàn bộ API',
      command: 'pnpm --dir apps/api typecheck',
      intent: 'Khóa compile-time surface trước khi coi state hiện tại là release candidate.',
      required: true,
    },
    {
      id: 'test-pr20',
      title: 'Regression auth + RBAC',
      command: 'pnpm --dir apps/api test:pr20',
      intent: 'Bảo vệ human auth, role matrix và principal attribution.',
      required: true,
    },
    {
      id: 'test-pr21',
      title: 'Regression contract freeze',
      command: 'pnpm --dir apps/api test:pr21',
      intent: 'Khóa envelope, validation, pagination và query contract để frontend không bị drift.',
      required: true,
    },
    {
      id: 'test-pr22',
      title: 'Regression dashboard summary',
      command: 'pnpm --dir apps/api test:pr22',
      intent: 'Đảm bảo read-model overview/incidents/occupancy/lanes/subscriptions còn đúng shape.',
      required: true,
    },
    {
      id: 'test-pr23',
      title: 'Regression audit hardening',
      command: 'pnpm --dir apps/api test:pr23',
      intent: 'Khóa actor snapshot, before/after snapshot và audit list filter semantics.',
      required: true,
    },
    {
      id: 'test-pr24',
      title: 'Regression incident noise control',
      command: 'pnpm --dir apps/api test:pr24',
      intent: 'Chặn reopen/suppress/promotion logic bị regress khi hợp nhất source state.',
      required: true,
    },
    {
      id: 'test-pr25',
      title: 'Regression release hardening',
      command: 'pnpm --dir apps/api test:pr25',
      intent: 'Xác nhận bootstrap/reset/smoke contract vẫn khớp docs và env baseline.',
      required: true,
    },
    {
      id: 'release-reset',
      title: 'Reset baseline release candidate',
      command: 'pnpm --dir apps/api release:reset',
      intent: 'Đưa auth/subscription/spot fixture và grant surface về đúng trạng thái RC1.',
      required: true,
    },
    {
      id: 'smoke-bundle',
      title: 'Smoke end-to-end',
      command: 'pnpm --dir apps/api smoke:bundle',
      intent: 'Đi xuyên auth -> dashboard -> media(local) -> intake -> reconcile -> incident -> audit.',
      required: true,
    },
  ]
}

export function buildRcGateChecklistText() {
  return buildRcGateSteps().map((step) => `- ${step.command}`).join('\n')
}

export function buildRcEvidenceTemplate(fixture: ReleaseSmokeFixture = DEFAULT_RELEASE_FIXTURE) {
  return [
    `# Evidence template — ${BACKEND_RC_BASELINE_TAG}`,
    '',
    '## RC gate',
    ...buildRcGateSteps().map((step) => `- [ ] ${step.command} — ${step.intent}`),
    '',
    '## Smoke fixture',
    `- username: ${fixture.username}`,
    `- role: ${fixture.role}`,
    `- siteCode: ${fixture.siteCode}`,
    `- zoneCode: ${fixture.zoneCode}`,
    `- spotCode: ${fixture.spotCode}`,
    `- mismatchPlateCompact: ${fixture.mismatchPlateCompact}`,
  ].join('\n')
}

export function buildReleaseChecklistText(fixture: ReleaseSmokeFixture = DEFAULT_RELEASE_FIXTURE) {
  const sections = [
    'Bootstrap',
    ...buildBootstrapSteps().map((step) => `- ${step.command}`),
    'Reset',
    ...buildResetSteps().map((step) => `- ${step.command}`),
    'Smoke',
    ...buildSmokeSteps(fixture).map((step) => `- ${step.command}`),
  ]
  return sections.join('\n')
}

export function buildSmokePresenceBody(fixture: ReleaseSmokeFixture = DEFAULT_RELEASE_FIXTURE) {
  return {
    schemaVersion: 'zone.presence.v1',
    cameraCode: `CAM_${fixture.zoneCode}_${fixture.spotCode}`.replace(/[^A-Z0-9_]/gi, '_').toUpperCase(),
    zoneCode: fixture.zoneCode,
    spotCode: fixture.spotCode,
    plateCompact: fixture.mismatchPlateCompact,
    confidence: 0.97,
    capturedAt: new Date().toISOString(),
    snapshotObjectKey: `smoke/${fixture.siteCode}/${fixture.spotCode}/${Date.now()}.png`,
    modelVersion: 'smoke-release-v1',
    traceId: `smoke-${Date.now()}`,
  }
}

function normalizePlate(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normalized || null
}

function normalizeRole(value: unknown): ReleaseSmokeFixture['role'] | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (!normalized) return null
  if (normalized === 'ADMIN' || normalized === 'OPS' || normalized === 'WORKER') {
    return normalized
  }
  return asCanonicalAuthRole(normalized)
}
