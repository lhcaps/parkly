import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const options = {
    mode: process.env.RELEASE_SIGNOFF_MODE || 'all',
    apiUrl: process.env.RELEASE_SIGNOFF_API_URL || process.env.SMOKE_API_URL || '',
    backendProfile: process.env.RELEASE_SIGNOFF_BACKEND_PROFILE || 'local-dev',
    commitHash: process.env.RELEASE_SIGNOFF_COMMIT_HASH || process.env.GIT_COMMIT_HASH || 'unknown',
    owner: process.env.RELEASE_SIGNOFF_OWNER || '',
    reviewer: process.env.RELEASE_SIGNOFF_REVIEWER || '',
    outDir: process.env.RELEASE_SIGNOFF_OUT_DIR || '',
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--mode') options.mode = argv[index + 1] || options.mode
    if (value === '--apiUrl') options.apiUrl = argv[index + 1] || options.apiUrl
    if (value === '--backendProfile') options.backendProfile = argv[index + 1] || options.backendProfile
    if (value === '--commitHash') options.commitHash = argv[index + 1] || options.commitHash
    if (value === '--owner') options.owner = argv[index + 1] || options.owner
    if (value === '--reviewer') options.reviewer = argv[index + 1] || options.reviewer
    if (value === '--outDir') options.outDir = argv[index + 1] || options.outDir
    if (value === '--dry-run') options.dryRun = true
  }

  return options
}

function commandString(command, args) {
  return [command, ...args].join(' ')
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function detectPnpm() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

async function ensureDir(targetPath) {
  await mkdir(targetPath, { recursive: true })
}

function spawnLogged(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      output += text
    })
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      process.stderr.write(text)
      output += text
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

async function runStep(step, context) {
  const line = `# ${step.title}\n$ ${commandString(step.command, step.args)}\n\n`
  if (context.options.dryRun) {
    await writeFile(step.logFile, `${line}[dry-run] skipped\n`, 'utf8')
    return { ok: true, code: 0, output: '[dry-run] skipped' }
  }

  const result = await spawnLogged(step.command, step.args, {
    cwd: context.cwd,
    env: step.env,
  })
  await writeFile(step.logFile, `${line}${result.output}\n`, 'utf8')
  return { ok: result.code === 0, code: result.code, output: result.output }
}

async function startDevServer(context) {
  const pnpm = detectPnpm()
  if (context.options.dryRun) {
    console.log('[release-signoff] dry-run: bo qua start dev server')
    return { kill: async () => undefined }
  }

  const child = spawn(pnpm, ['dev', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: context.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const logPath = path.join(context.logsDir, 'dev-server.log')
  let output = ''
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    process.stdout.write(text)
    output += text
  })
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    process.stderr.write(text)
    output += text
  })

  await new Promise((resolve) => setTimeout(resolve, 2500))
  await writeFile(logPath, output || '[release-signoff] dev server started\n', 'utf8')

  return {
    kill: async () => {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    },
  }
}

async function writeReleaseSignoff(context, steps, smokeSummaries) {
  const status = steps.every((step) => step.ok) ? 'PASS' : 'FAIL'
  const signoffPath = path.join(context.outDir, 'release-signoff.md')
  const manifestPath = path.join(context.outDir, 'signoff-manifest.json')

  const body = `# Frontend release sign-off

- Status: ${status}
- Commit hash: ${context.options.commitHash}
- Backend profile: ${context.options.backendProfile}
- Run mode: ${context.options.mode}
- Owner: ${context.options.owner || 'TBD'}
- Reviewer: ${context.options.reviewer || 'TBD'}
- Timestamp: ${new Date().toISOString()}
- Evidence directory: ${context.outDir}

## Step results
${steps.map((step) => `- ${step.title}: ${step.ok ? 'PASS' : `FAIL (code=${step.code})`} | log=${path.basename(step.logFile)}`).join('\n')}

## Smoke summary
- Dev: ${smokeSummaries.dev || 'not-run'}
- Dist: ${smokeSummaries.dist || 'not-run'}

## Mandatory attachments
- build.log
- test-unit.log
- test-e2e.log
- smoke-dev.log
- smoke-dist.log
- latest-smoke-dev.json
- latest-smoke-dist.json
- screenshots/landing-admin.png
- screenshots/landing-ops.png
- screenshots/landing-guard.png
- screenshots/landing-cashier.png
- screenshots/landing-worker.png
- screenshots/forbidden-fallback.png
- screenshots/subscriptions-deeplink.png
- screenshots/parking-live-stale-fallback.png
- manual-qa-signoff.md

## Reviewer notes
- Khong duoc de cau chu kieu 'patch issued; rerun pending'.
- Artifact bundle phai tru ra dung commit.
- Reviewer moi phai lap lai sign-off duoc ma khong can hoi mieng.
`

  const manifest = {
    status,
    commitHash: context.options.commitHash,
    backendProfile: context.options.backendProfile,
    runMode: context.options.mode,
    owner: context.options.owner || null,
    reviewer: context.options.reviewer || null,
    generatedAt: new Date().toISOString(),
    artifacts: steps.map((step) => ({ title: step.title, ok: step.ok, code: step.code, logFile: path.basename(step.logFile) })),
    smokeSummaries,
  }

  await writeFile(signoffPath, body, 'utf8')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  return { signoffPath, manifestPath }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const pnpm = detectPnpm()
  const outDir = options.outDir || path.resolve(cwd, '../../release-evidence/frontend', nowStamp())
  const logsDir = path.join(outDir, 'raw-logs')
  const screenshotsDir = path.join(outDir, 'screenshots')
  const context = { options, cwd, outDir, logsDir, screenshotsDir }

  await ensureDir(outDir)
  await ensureDir(logsDir)
  await ensureDir(screenshotsDir)

  const steps = []

  const baseSteps = [
    { title: 'Build', command: pnpm, args: ['build'], logFile: path.join(logsDir, 'build.log') },
    { title: 'Unit tests', command: pnpm, args: ['test:unit'], logFile: path.join(logsDir, 'test-unit.log') },
    { title: 'Playwright runtime check', command: pnpm, args: ['playwright:runtime:check'], logFile: path.join(logsDir, 'playwright-runtime.log') },
    { title: 'E2E', command: pnpm, args: ['test:e2e'], env: { SIGNOFF_SCREENSHOTS_DIR: screenshotsDir }, logFile: path.join(logsDir, 'test-e2e.log') },
  ]

  for (const step of baseSteps) {
    const result = await runStep(step, context)
    steps.push({ ...step, ...result })
    if (!result.ok) break
  }

  let smokeSummaries = { dev: null, dist: null }

  if (steps.every((step) => step.ok) && (options.mode === 'all' || options.mode === 'dev')) {
    const devServer = await startDevServer(context)
    try {
      const step = {
        title: 'Smoke dev',
        command: pnpm,
        args: ['smoke:web:dev', '--', '--apiUrl', options.apiUrl, '--jsonOut', path.join(cwd, 'docs/frontend/evidence/latest-smoke-dev.json'), '--evidenceDir', path.resolve(cwd, '../../release-evidence/frontend')],
        logFile: path.join(logsDir, 'smoke-dev.log'),
      }
      const result = await runStep(step, context)
      steps.push({ ...step, ...result })
      if (result.ok && !options.dryRun) {
        smokeSummaries.dev = JSON.parse(await readFile(path.join(cwd, 'docs/frontend/evidence/latest-smoke-dev.json'), 'utf8'))
      }
    } finally {
      await devServer.kill()
    }
  }

  if (steps.every((step) => step.ok) && (options.mode === 'all' || options.mode === 'dist')) {
    const step = {
      title: 'Smoke dist',
      command: pnpm,
      args: ['smoke:web:dist', '--', '--apiUrl', options.apiUrl, '--jsonOut', path.join(cwd, 'docs/frontend/evidence/latest-smoke-dist.json'), '--evidenceDir', path.resolve(cwd, '../../release-evidence/frontend')],
      logFile: path.join(logsDir, 'smoke-dist.log'),
    }
    const result = await runStep(step, context)
    steps.push({ ...step, ...result })
    if (result.ok && !options.dryRun) {
      smokeSummaries.dist = JSON.parse(await readFile(path.join(cwd, 'docs/frontend/evidence/latest-smoke-dist.json'), 'utf8'))
    }
  }

  const signoffFiles = await writeReleaseSignoff(context, steps, {
    dev: smokeSummaries.dev ? `${smokeSummaries.dev.baseUrl} | pass=${smokeSummaries.dev.passCount}/${smokeSummaries.dev.routes.length}` : null,
    dist: smokeSummaries.dist ? `${smokeSummaries.dist.baseUrl} | pass=${smokeSummaries.dist.passCount}/${smokeSummaries.dist.routes.length}` : null,
  })

  const evidenceStep = {
    title: 'Collect evidence',
    command: pnpm,
    args: [
      'evidence:web', '--',
      '--outDir', outDir,
      '--buildLog', path.join(logsDir, 'build.log'),
      '--unitLog', path.join(logsDir, 'test-unit.log'),
      '--e2eLog', path.join(logsDir, 'test-e2e.log'),
      '--smokeDevLog', path.join(logsDir, 'smoke-dev.log'),
      '--smokeDistLog', path.join(logsDir, 'smoke-dist.log'),
      '--smokeDevJson', path.join(cwd, 'docs/frontend/evidence/latest-smoke-dev.json'),
      '--smokeDistJson', path.join(cwd, 'docs/frontend/evidence/latest-smoke-dist.json'),
      '--screensDir', screenshotsDir,
      '--manualSignoff', path.join(cwd, 'docs/frontend/manual-qa-signoff.md'),
      '--releaseSignoff', signoffFiles.signoffPath,
      '--signoffManifest', signoffFiles.manifestPath,
      '--commitHash', options.commitHash,
      '--runMode', options.mode,
    ],
    logFile: path.join(logsDir, 'collect-evidence.log'),
  }

  const evidenceResult = await runStep(evidenceStep, context)
  steps.push({ ...evidenceStep, ...evidenceResult })

  const failed = steps.filter((step) => !step.ok)
  if (failed.length > 0) {
    console.error(`[release-signoff] FAIL: ${failed.map((step) => step.title).join(', ')}`)
    process.exitCode = 1
    return
  }

  console.log(`[release-signoff] PASS: evidence bundle ready at ${outDir}`)
}

main().catch((error) => {
  console.error(`[release-signoff] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
