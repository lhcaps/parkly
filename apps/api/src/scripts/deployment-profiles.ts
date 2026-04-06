export type DeploymentProfileName = 'LOCAL_DEV' | 'DEMO' | 'RELEASE_CANDIDATE'
export type DeploymentMediaDriver = 'LOCAL' | 'MINIO'
export type DeploymentIntent = 'bootstrap' | 'reset' | 'smoke' | 'dev' | 'pilot'

export type DeploymentProfile = {
  name: DeploymentProfileName
  label: string
  description: string
  mediaDriver: DeploymentMediaDriver
  smokeMediaDriver: DeploymentMediaDriver
  composeServices: Array<'mysql' | 'redis' | 'minio' | 'minio-init'>
  composeProfiles: string[]
  bootstrapScripts: string[]
  resetScripts: string[]
  smokeScripts: string[]
}

export type DeploymentProfileResolveOptions = {
  allowMediaOverride?: boolean
}

const PROFILE_ALIASES: Record<string, DeploymentProfileName> = {
  LOCAL: 'LOCAL_DEV',
  LOCALDEV: 'LOCAL_DEV',
  LOCAL_DEV: 'LOCAL_DEV',
  DEV: 'LOCAL_DEV',
  DEMO: 'DEMO',
  RC: 'RELEASE_CANDIDATE',
  RELEASE_CANDIDATE: 'RELEASE_CANDIDATE',
  RELEASECANDIDATE: 'RELEASE_CANDIDATE',
}

const PROFILE_DEFS: Record<DeploymentProfileName, DeploymentProfile> = {
  LOCAL_DEV: {
    name: 'LOCAL_DEV',
    label: 'local-dev',
    description: 'Dev loop tối thiểu, compose chỉ dựng MySQL + Redis, media driver local để giảm phụ thuộc.',
    mediaDriver: 'LOCAL',
    smokeMediaDriver: 'LOCAL',
    composeServices: ['mysql', 'redis'],
    composeProfiles: [],
    bootstrapScripts: ['db:migrate', 'db:validate', 'prisma:generate', 'release:reset'],
    resetScripts: ['release:reset'],
    smokeScripts: ['smoke:bundle'],
  },
  DEMO: {
    name: 'DEMO',
    label: 'demo',
    description: 'Profile demo lặp lại được, giữ media local để smoke không phụ thuộc object storage.',
    mediaDriver: 'LOCAL',
    smokeMediaDriver: 'LOCAL',
    composeServices: ['mysql', 'redis'],
    composeProfiles: [],
    bootstrapScripts: ['db:migrate', 'db:validate', 'prisma:generate', 'release:reset'],
    resetScripts: ['release:reset'],
    smokeScripts: ['smoke:bundle'],
  },
  RELEASE_CANDIDATE: {
    name: 'RELEASE_CANDIDATE',
    label: 'release-candidate',
    description: 'Profile RC gần production local hơn, bật MinIO để test media pipeline thật.',
    mediaDriver: 'MINIO',
    smokeMediaDriver: 'MINIO',
    composeServices: ['mysql', 'redis', 'minio', 'minio-init'],
    composeProfiles: ['storage'],
    bootstrapScripts: ['db:migrate', 'db:validate', 'prisma:generate', 'release:reset'],
    resetScripts: ['release:reset'],
    smokeScripts: ['smoke:bundle'],
  },
}

function parseMediaDriverOverride(value: unknown): DeploymentMediaDriver | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'LOCAL') return 'LOCAL'
  if (normalized === 'MINIO') return 'MINIO'
  return null
}

function envFlagOn(value: unknown) {
  return String(value ?? '').trim().toUpperCase() === 'ON'
}

export function isMediaOverrideEnabled(
  env: NodeJS.ProcessEnv = process.env,
  options?: DeploymentProfileResolveOptions,
) {
  if (options?.allowMediaOverride === true) return true
  return envFlagOn(env.PARKLY_ALLOW_MEDIA_OVERRIDE)
}

export function normalizeDeploymentProfileName(value: unknown): DeploymentProfileName {
  const normalized = String(value ?? '').trim().replace(/[-\s]/g, '_').toUpperCase()
  return PROFILE_ALIASES[normalized] ?? 'DEMO'
}

export function resolveDeploymentProfile(
  env: NodeJS.ProcessEnv = process.env,
  explicitProfile?: string | null,
  options?: DeploymentProfileResolveOptions,
): DeploymentProfile {
  const name = normalizeDeploymentProfileName(explicitProfile ?? env.PARKLY_DEPLOYMENT_PROFILE ?? 'DEMO')
  const base = PROFILE_DEFS[name]
  const allowMediaOverride = isMediaOverrideEnabled(env, options)
  const overrideMedia = allowMediaOverride
    ? parseMediaDriverOverride(env.PARKLY_MEDIA_PROFILE ?? env.MEDIA_STORAGE_DRIVER)
    : null

  if (!overrideMedia || overrideMedia === base.mediaDriver) return { ...base }

  const composeServices = [...base.composeServices]
  const composeProfiles = [...base.composeProfiles]
  if (overrideMedia === 'MINIO' && !composeServices.includes('minio')) {
    composeServices.push('minio', 'minio-init')
    if (!composeProfiles.includes('storage')) composeProfiles.push('storage')
  }

  return {
    ...base,
    mediaDriver: overrideMedia,
    smokeMediaDriver: overrideMedia,
    composeServices,
    composeProfiles,
  }
}

export function applyDeploymentProfileEnv(
  env: NodeJS.ProcessEnv = process.env,
  profileInput?: string | null,
  options?: DeploymentProfileResolveOptions,
): NodeJS.ProcessEnv {
  const profile = resolveDeploymentProfile(env, profileInput, options)
  return {
    ...env,
    PARKLY_DEPLOYMENT_PROFILE: profile.name,
    PARKLY_MEDIA_PROFILE: profile.mediaDriver,
    MEDIA_STORAGE_DRIVER: profile.mediaDriver,
    SMOKE_MEDIA_DRIVER: profile.smokeMediaDriver,
  }
}

export function buildComposeInvocation(profile: DeploymentProfile): { file: string; args: string[] } {
  const args = ['compose', '-f', '../../infra/docker/docker-compose.local.yml']
  for (const composeProfile of profile.composeProfiles) {
    args.push('--profile', composeProfile)
  }
  return { file: '../../infra/docker/docker-compose.local.yml', args }
}

export function buildDeploymentPlan(profile: DeploymentProfile, intent: DeploymentIntent): string[] {
  if (intent === 'bootstrap') return [...profile.bootstrapScripts]
  if (intent === 'reset') return [...profile.resetScripts]
  if (intent === 'smoke') return [...profile.smokeScripts]
  if (intent === 'pilot') return [...profile.bootstrapScripts]
  return ['dev']
}
