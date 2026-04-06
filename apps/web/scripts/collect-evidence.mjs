import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const options = {
    outDir: process.env.EVIDENCE_OUT_DIR || '',
    buildLog: process.env.EVIDENCE_BUILD_LOG || '',
    unitLog: process.env.EVIDENCE_UNIT_LOG || '',
    e2eLog: process.env.EVIDENCE_E2E_LOG || '',
    smokeDevLog: process.env.EVIDENCE_SMOKE_DEV_LOG || '',
    smokeDistLog: process.env.EVIDENCE_SMOKE_DIST_LOG || '',
    smokeDevJson: process.env.EVIDENCE_SMOKE_DEV_JSON || '',
    smokeDistJson: process.env.EVIDENCE_SMOKE_DIST_JSON || '',
    screensDir: process.env.EVIDENCE_SCREENS_DIR || '',
    manualSignoff: process.env.EVIDENCE_MANUAL_SIGNOFF || '',
    releaseSignoff: process.env.EVIDENCE_RELEASE_SIGNOFF || '',
    signoffManifest: process.env.EVIDENCE_SIGNOFF_MANIFEST || '',
    commitHash: process.env.EVIDENCE_COMMIT_HASH || '',
    runMode: process.env.EVIDENCE_RUN_MODE || 'all',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--outDir') options.outDir = argv[index + 1] || options.outDir
    if (value === '--buildLog') options.buildLog = argv[index + 1] || options.buildLog
    if (value === '--unitLog') options.unitLog = argv[index + 1] || options.unitLog
    if (value === '--e2eLog') options.e2eLog = argv[index + 1] || options.e2eLog
    if (value === '--smokeDevLog') options.smokeDevLog = argv[index + 1] || options.smokeDevLog
    if (value === '--smokeDistLog') options.smokeDistLog = argv[index + 1] || options.smokeDistLog
    if (value === '--smokeDevJson') options.smokeDevJson = argv[index + 1] || options.smokeDevJson
    if (value === '--smokeDistJson') options.smokeDistJson = argv[index + 1] || options.smokeDistJson
    if (value === '--screensDir') options.screensDir = argv[index + 1] || options.screensDir
    if (value === '--manualSignoff') options.manualSignoff = argv[index + 1] || options.manualSignoff
    if (value === '--releaseSignoff') options.releaseSignoff = argv[index + 1] || options.releaseSignoff
    if (value === '--signoffManifest') options.signoffManifest = argv[index + 1] || options.signoffManifest
    if (value === '--commitHash') options.commitHash = argv[index + 1] || options.commitHash
    if (value === '--runMode') options.runMode = argv[index + 1] || options.runMode
  }

  return options
}

async function exists(targetPath) {
  if (!targetPath) return false
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function ensureDir(targetPath) {
  await mkdir(targetPath, { recursive: true })
}

async function copyIfExists(source, destination) {
  if (!(await exists(source))) return false
  await ensureDir(path.dirname(destination))
  await copyFile(source, destination)
  return true
}

async function copyDirectoryRecursive(sourceDir, destinationDir) {
  if (!(await exists(sourceDir))) return []
  await ensureDir(destinationDir)
  const copied = []
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const destinationPath = path.join(destinationDir, entry.name)
    if (entry.isDirectory()) {
      copied.push(...await copyDirectoryRecursive(sourcePath, destinationPath))
    } else {
      await ensureDir(path.dirname(destinationPath))
      await copyFile(sourcePath, destinationPath)
      copied.push(destinationPath)
    }
  }

  return copied
}

function readPreview(body) {
  return body.split(/\r?\n/).slice(0, 24).join('\n')
}

async function loadJsonIfExists(targetPath) {
  if (!(await exists(targetPath))) return null
  return JSON.parse(await readFile(targetPath, 'utf8'))
}

async function main() {
  const root = process.cwd()
  const options = parseArgs(process.argv.slice(2))
  const docsDir = path.join(root, 'docs/frontend')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = options.outDir || path.join(root, '../../release-evidence/frontend', timestamp)
  const artifactsDir = path.join(outDir, 'artifacts')
  const docsOutDir = path.join(outDir, 'docs')
  const screenshotsOutDir = path.join(outDir, 'screenshots')

  await ensureDir(outDir)
  await ensureDir(artifactsDir)
  await ensureDir(docsOutDir)

  const defaults = {
    smokeDevJson: path.join(docsDir, 'evidence/latest-smoke-dev.json'),
    smokeDistJson: path.join(docsDir, 'evidence/latest-smoke-dist.json'),
    manualSignoff: path.join(docsDir, 'manual-qa-signoff.md'),
    releaseSignoff: path.join(docsDir, 'runbooks/release-signoff.md'),
  }

  const copied = {
    docs: [],
    logs: [],
    screenshots: [],
    smokeDevJson: false,
    smokeDistJson: false,
    manualSignoff: false,
    releaseSignoff: false,
    signoffManifest: false,
  }

  const docsToCopy = [
    'runbook.md',
    'routes.md',
    'acceptance-checklist.md',
    'evidence-template.md',
    'manual-qa-signoff.md',
    'role-matrix.md',
    'runbooks/release-signoff.md',
    'runbooks/browser-runtime.md',
  ]

  for (const name of docsToCopy) {
    const source = path.join(docsDir, name)
    const destination = path.join(docsOutDir, name)
    if (await copyIfExists(source, destination)) {
      copied.docs.push(name)
    }
  }

  copied.smokeDevJson = await copyIfExists(options.smokeDevJson || defaults.smokeDevJson, path.join(artifactsDir, 'latest-smoke-dev.json'))
  copied.smokeDistJson = await copyIfExists(options.smokeDistJson || defaults.smokeDistJson, path.join(artifactsDir, 'latest-smoke-dist.json'))
  copied.manualSignoff = await copyIfExists(options.manualSignoff || defaults.manualSignoff, path.join(artifactsDir, 'manual-qa-signoff.md'))
  copied.releaseSignoff = await copyIfExists(options.releaseSignoff || defaults.releaseSignoff, path.join(artifactsDir, 'release-signoff.md'))
  copied.signoffManifest = await copyIfExists(options.signoffManifest, path.join(artifactsDir, 'signoff-manifest.json'))

  const logMap = [
    ['build.log', options.buildLog],
    ['test-unit.log', options.unitLog],
    ['test-e2e.log', options.e2eLog],
    ['smoke-dev.log', options.smokeDevLog],
    ['smoke-dist.log', options.smokeDistLog],
  ]

  for (const [targetName, source] of logMap) {
    if (await copyIfExists(source, path.join(artifactsDir, targetName))) {
      copied.logs.push(targetName)
    }
  }

  if (options.screensDir) {
    const copiedScreens = await copyDirectoryRecursive(options.screensDir, screenshotsOutDir)
    copied.screenshots = copiedScreens.map((file) => path.relative(outDir, file))
  }

  const smokeDevSummary = await loadJsonIfExists(path.join(artifactsDir, 'latest-smoke-dev.json'))
  const smokeDistSummary = await loadJsonIfExists(path.join(artifactsDir, 'latest-smoke-dist.json'))
  const signoffManifest = await loadJsonIfExists(path.join(artifactsDir, 'signoff-manifest.json'))

  const manifest = {
    generatedAt: new Date().toISOString(),
    outDir,
    commitHash: options.commitHash || signoffManifest?.commitHash || null,
    runMode: options.runMode,
    docs: copied.docs,
    logs: copied.logs,
    screenshots: copied.screenshots,
    smokeDevJson: copied.smokeDevJson,
    smokeDistJson: copied.smokeDistJson,
    manualSignoff: copied.manualSignoff,
    releaseSignoff: copied.releaseSignoff,
    signoffManifest: copied.signoffManifest,
    smokeSummary: {
      dev: smokeDevSummary
        ? {
            baseUrl: smokeDevSummary.baseUrl,
            passCount: smokeDevSummary.passCount,
            failCount: smokeDevSummary.failCount,
            apiOk: smokeDevSummary.api?.ok ?? null,
          }
        : null,
      dist: smokeDistSummary
        ? {
            baseUrl: smokeDistSummary.baseUrl,
            passCount: smokeDistSummary.passCount,
            failCount: smokeDistSummary.failCount,
            apiOk: smokeDistSummary.api?.ok ?? null,
          }
        : null,
    },
  }

  const previews = {}
  for (const logName of copied.logs) {
    previews[logName] = readPreview(await readFile(path.join(artifactsDir, logName), 'utf8'))
  }

  const requiredScreenshotPatterns = [
    'landing-super-admin',
    'landing-site-admin',
    'landing-manager',
    'landing-operator',
    'landing-guard',
    'landing-cashier',
    'landing-viewer',
    'forbidden-fallback',
    'review-queue-action-desk',
    'session-history-detail-error',
    'outbox-triage',
    'subscriptions-deeplink',
    'parking-live-stale-fallback',
    'mobile-pair-qr',
    'mobile-capture-receipt',
    'settings-theme-dark',
    'topology-dialogs',
  ]

  const missingScreenshots = requiredScreenshotPatterns.filter((fragment) => !copied.screenshots.some((item) => item.includes(fragment)))

  const readme = `# Frontend evidence bundle

- Generated at: ${manifest.generatedAt}
- Output directory: ${outDir}
- Commit hash: ${manifest.commitHash ?? 'unknown'}
- Run mode: ${manifest.runMode}
- Docs copied: ${copied.docs.length}
- Logs copied: ${copied.logs.length}
- Screenshots copied: ${copied.screenshots.length}
- latest-smoke-dev.json: ${copied.smokeDevJson ? 'yes' : 'no'}
- latest-smoke-dist.json: ${copied.smokeDistJson ? 'yes' : 'no'}
- release-signoff.md: ${copied.releaseSignoff ? 'yes' : 'no'}
- signoff-manifest.json: ${copied.signoffManifest ? 'yes' : 'no'}

## Release gate status
- Build log: ${copied.logs.includes('build.log') ? 'present' : 'missing'}
- Unit log: ${copied.logs.includes('test-unit.log') ? 'present' : 'missing'}
- E2E log: ${copied.logs.includes('test-e2e.log') ? 'present' : 'missing'}
- Smoke dev log: ${copied.logs.includes('smoke-dev.log') ? 'present' : 'missing'}
- Smoke dist log: ${copied.logs.includes('smoke-dist.log') ? 'present' : 'missing'}
- Smoke dev JSON: ${copied.smokeDevJson ? 'present' : 'missing'}
- Smoke dist JSON: ${copied.smokeDistJson ? 'present' : 'missing'}
- Manual sign-off: ${copied.manualSignoff ? 'present' : 'missing'}
- Release sign-off: ${copied.releaseSignoff ? 'present' : 'missing'}
- Sign-off manifest: ${copied.signoffManifest ? 'present' : 'missing'}

## Smoke summary
- Dev: ${smokeDevSummary ? `${smokeDevSummary.baseUrl} | pass=${smokeDevSummary.passCount}/${smokeDevSummary.routes?.length ?? 0} | apiOk=${smokeDevSummary.api?.ok ?? 'n/a'}` : 'missing'}
- Dist: ${smokeDistSummary ? `${smokeDistSummary.baseUrl} | pass=${smokeDistSummary.passCount}/${smokeDistSummary.routes?.length ?? 0} | apiOk=${smokeDistSummary.api?.ok ?? 'n/a'}` : 'missing'}

## Mandatory screenshot coverage
- Missing patterns: ${missingScreenshots.length > 0 ? missingScreenshots.join(', ') : 'none'}

## Build preview
\`\`\`
${previews['build.log'] || 'Missing build.log'}
\`\`\`

## Unit preview
\`\`\`
${previews['test-unit.log'] || 'Missing test-unit.log'}
\`\`\`

## E2E preview
\`\`\`
${previews['test-e2e.log'] || 'Missing test-e2e.log'}
\`\`\`

## Smoke dev preview
\`\`\`
${previews['smoke-dev.log'] || 'Missing smoke-dev.log'}
\`\`\`

## Smoke dist preview
\`\`\`
${previews['smoke-dist.log'] || 'Missing smoke-dist.log'}
\`\`\`
`

  await writeFile(path.join(outDir, 'README.md'), readme, 'utf8')
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(`[collect-evidence] Bundle ready: ${outDir}`)
}

main().catch((error) => {
  console.error(`[collect-evidence] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
