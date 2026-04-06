import { spawnSync } from 'node:child_process'

const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'ci'

if (!['ci', 'full'].includes(mode)) {
  console.error(`[quality] Unsupported mode: ${mode}`)
  process.exit(1)
}

const bootstrapProfile = String(
  process.env.QUALITY_GATE_PROFILE ?? (mode === 'full' ? 'release-candidate' : 'demo'),
).trim().toLowerCase()
const shouldBootstrap = String(process.env.QUALITY_GATE_BOOTSTRAP ?? 'ON').trim().toUpperCase() !== 'OFF'

function runPnpm(args, options = {}) {
  const invocation = process.platform === 'win32'
    ? {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', `pnpm ${args.join(' ')}`],
      }
    : {
        command: 'pnpm',
        args,
      }

  return spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    stdio: options.stdio ?? 'inherit',
    env: process.env,
  })
}

function normalizeBootstrapProfile(profile) {
  if (profile === 'local' || profile === 'local-dev' || profile === 'local_dev') {
    return 'local-dev'
  }
  if (profile === 'rc' || profile === 'release-candidate' || profile === 'release_candidate') {
    return 'release-candidate'
  }
  return 'demo'
}

function ensureSuccess(result) {
  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runBootstrap(profile) {
  const normalizedProfile = normalizeBootstrapProfile(profile)
  const verifyArgs = ['--dir', 'apps/api', 'verify:deployment', '--', '--profile', normalizedProfile, '--intent', 'bootstrap']
  const verify = runPnpm(verifyArgs, { stdio: 'ignore' })
  const reuseExistingDependencies = verify.status === 0
  const bootstrapArgs = reuseExistingDependencies
    ? ['--dir', 'apps/api', 'exec', 'tsx', 'src/scripts/deployment-bootstrap.ts', '--profile', normalizedProfile]
    : ['--dir', 'apps/api', 'exec', 'tsx', 'src/scripts/deployment-bootstrap.ts', '--profile', normalizedProfile, '--compose-up']

  console.log(
    `[quality] Dependency strategy: ${reuseExistingDependencies ? 'reuse existing services' : 'compose-up required'}`,
  )

  const result = runPnpm(bootstrapArgs)
  ensureSuccess(result)
}

const tasks = [
  { label: 'Validate i18n JSON (en)', cmd: 'python', args: ['scripts/i18n-safe-edit.py', 'validate', 'apps/web/src/i18n/locales/en.json'] },
  { label: 'Validate i18n JSON (vi)', cmd: 'python', args: ['scripts/i18n-safe-edit.py', 'validate', 'apps/web/src/i18n/locales/vi.json'] },
  {
    label: 'i18n en/vi structural parity',
    cmd: 'python',
    args: ['scripts/i18n-safe-edit.py', 'parity', 'apps/web/src/i18n/locales/en.json', 'apps/web/src/i18n/locales/vi.json'],
  },
  {
    label: 'i18n schema (en required keys)',
    cmd: 'python',
    args: [
      'scripts/i18n-safe-edit.py',
      'schema-validate',
      'apps/web/src/i18n/locales/en.json',
      'apps/web/src/i18n/locales/i18n.locale.schema.json',
    ],
  },
  {
    label: 'i18n schema (vi required keys)',
    cmd: 'python',
    args: [
      'scripts/i18n-safe-edit.py',
      'schema-validate',
      'apps/web/src/i18n/locales/vi.json',
      'apps/web/src/i18n/locales/i18n.locale.schema.json',
    ],
  },
  { label: 'Generate Prisma client', args: ['prisma:generate'] },
  { label: 'Typecheck API', args: ['typecheck:api'] },
  { label: 'Typecheck Web', args: ['typecheck:web'] },
  { label: 'API tests', args: ['test:api'] },
  { label: 'Web tests and build', args: ['test:web'] },
  { label: 'Web Playwright E2E', args: ['test:web:e2e'], modes: ['full'] },
]

if (shouldBootstrap) {
  console.log(`\n[quality] Bootstrap API integration environment (${bootstrapProfile})`)
  const startedAt = Date.now()
  runBootstrap(bootstrapProfile)
  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[quality] Completed in ${durationSeconds}s`)
}

for (const task of tasks) {
  if (task.modes && !task.modes.includes(mode)) continue

  console.log(`\n[quality] ${task.label}`)
  const startedAt = Date.now()

  let result
  if (task.cmd) {
    // Raw command (e.g., Python)
    const invocation = process.platform === 'win32'
      ? { command: 'cmd.exe', args: ['/d', '/s', '/c', `"${task.cmd}" ${task.args.map(a => `"${a}"`).join(' ')}`] }
      : { command: task.cmd, args: task.args }
    result = spawnSync(invocation.command, invocation.args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    })
  } else {
    result = runPnpm(task.args)
  }
  ensureSuccess(result)

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[quality] Completed in ${durationSeconds}s`)
}
