import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const options = {
    outDir: process.env.EVIDENCE_OUT_DIR || '',
    buildLog: process.env.EVIDENCE_BUILD_LOG || '',
    unitLog: process.env.EVIDENCE_UNIT_LOG || '',
    e2eLog: process.env.EVIDENCE_E2E_LOG || '',
    smokeLog: process.env.EVIDENCE_SMOKE_LOG || '',
    smokeJson: process.env.EVIDENCE_SMOKE_JSON || '',
    screensDir: process.env.EVIDENCE_SCREENS_DIR || '',
    manualSignoff: process.env.EVIDENCE_MANUAL_SIGNOFF || '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--outDir') options.outDir = argv[index + 1] || options.outDir
    if (value === '--buildLog') options.buildLog = argv[index + 1] || options.buildLog
    if (value === '--unitLog') options.unitLog = argv[index + 1] || options.unitLog
    if (value === '--e2eLog') options.e2eLog = argv[index + 1] || options.e2eLog
    if (value === '--smokeLog') options.smokeLog = argv[index + 1] || options.smokeLog
    if (value === '--smokeJson') options.smokeJson = argv[index + 1] || options.smokeJson
    if (value === '--screensDir') options.screensDir = argv[index + 1] || options.screensDir
    if (value === '--manualSignoff') options.manualSignoff = argv[index + 1] || options.manualSignoff
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
  return body.split(/\r?\n/).slice(0, 20).join('\n')
}

async function main() {
  const root = process.cwd()
  const options = parseArgs(process.argv.slice(2))
  const docsDir = path.join(root, 'docs/frontend')
  const defaultSmokeJson = path.join(docsDir, 'evidence/latest-smoke.json')
  const defaultManualSignoff = path.join(docsDir, 'manual-qa-signoff.md')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = options.outDir || path.join(root, '../../release-evidence/frontend-wave-09', timestamp)
  const artifactsDir = path.join(outDir, 'artifacts')
  const docsOutDir = path.join(outDir, 'docs')
  const screenshotsOutDir = path.join(outDir, 'screenshots')

  await ensureDir(outDir)
  await ensureDir(artifactsDir)
  await ensureDir(docsOutDir)

  const smokeJsonPath = options.smokeJson || defaultSmokeJson
  const manualSignoffPath = options.manualSignoff || defaultManualSignoff

  const copied = {
    docs: [],
    logs: [],
    screenshots: [],
    smokeJson: false,
    manualSignoff: false,
  }

  const docsToCopy = [
    'runbook.md',
    'routes.md',
    'acceptance-checklist.md',
    'evidence-template.md',
    'manual-qa-signoff.md',
    'role-matrix.md',
  ]

  for (const name of docsToCopy) {
    const source = path.join(docsDir, name)
    const destination = path.join(docsOutDir, name)
    if (await copyIfExists(source, destination)) {
      copied.docs.push(name)
    }
  }

  copied.smokeJson = await copyIfExists(smokeJsonPath, path.join(artifactsDir, 'latest-smoke.json'))
  copied.manualSignoff = await copyIfExists(manualSignoffPath, path.join(artifactsDir, 'manual-qa-signoff.md'))

  const logMap = [
    ['build.log', options.buildLog],
    ['test-unit.log', options.unitLog],
    ['test-e2e.log', options.e2eLog],
    ['smoke.log', options.smokeLog],
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

  const smokeSummary = copied.smokeJson
    ? JSON.parse(await readFile(path.join(artifactsDir, 'latest-smoke.json'), 'utf8'))
    : null

  const manifest = {
    generatedAt: new Date().toISOString(),
    outDir,
    docs: copied.docs,
    logs: copied.logs,
    screenshots: copied.screenshots,
    smokeJson: copied.smokeJson,
    manualSignoff: copied.manualSignoff,
    smokeSummary: smokeSummary
      ? {
          baseUrl: smokeSummary.baseUrl,
          passCount: smokeSummary.passCount,
          failCount: smokeSummary.failCount,
          apiOk: smokeSummary.api?.ok ?? null,
        }
      : null,
  }

  const buildPreview = copied.logs.includes('build.log')
    ? readPreview(await readFile(path.join(artifactsDir, 'build.log'), 'utf8'))
    : 'Missing build.log'
  const unitPreview = copied.logs.includes('test-unit.log')
    ? readPreview(await readFile(path.join(artifactsDir, 'test-unit.log'), 'utf8'))
    : 'Missing test-unit.log'
  const e2ePreview = copied.logs.includes('test-e2e.log')
    ? readPreview(await readFile(path.join(artifactsDir, 'test-e2e.log'), 'utf8'))
    : 'Missing test-e2e.log'
  const smokePreview = copied.logs.includes('smoke.log')
    ? readPreview(await readFile(path.join(artifactsDir, 'smoke.log'), 'utf8'))
    : 'Missing smoke.log'

  const readme = `# Frontend evidence bundle\n\n- Generated at: ${manifest.generatedAt}\n- Output directory: ${outDir}\n- Docs copied: ${copied.docs.length}\n- Logs copied: ${copied.logs.length}\n- Screenshots copied: ${copied.screenshots.length}\n- latest-smoke.json: ${copied.smokeJson ? 'yes' : 'no'}\n- manual-qa-signoff.md: ${copied.manualSignoff ? 'yes' : 'no'}\n\n## Release gate status\n- Build log: ${copied.logs.includes('build.log') ? 'present' : 'missing'}\n- Unit log: ${copied.logs.includes('test-unit.log') ? 'present' : 'missing'}\n- E2E log: ${copied.logs.includes('test-e2e.log') ? 'present' : 'missing'}\n- Smoke log: ${copied.logs.includes('smoke.log') ? 'present' : 'missing'}\n- Smoke JSON: ${copied.smokeJson ? 'present' : 'missing'}\n- Manual sign-off: ${copied.manualSignoff ? 'present' : 'missing'}\n\n## Smoke summary\n${smokeSummary ? `- Base URL: ${smokeSummary.baseUrl}\n- API ok: ${smokeSummary.api?.ok ?? 'n/a'}\n- Routes pass/fail: ${smokeSummary.passCount}/${smokeSummary.routes?.length ?? 0}` : '- No smoke summary available'}\n\n## Build preview\n\`\`\`\n${buildPreview}\n\`\`\`\n\n## Unit preview\n\`\`\`\n${unitPreview}\n\`\`\`\n\n## E2E preview\n\`\`\`\n${e2ePreview}\n\`\`\`\n\n## Smoke preview\n\`\`\`\n${smokePreview}\n\`\`\`\n\n## Manual QA topics\n- login landing per role\n- forbidden direct URL\n- subscriptions deep-link recovery\n- subscriptions detail error triage\n- parking-live stale fallback\n- parking-live reconcile freshness\n`

  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await writeFile(path.join(outDir, 'README.md'), readme, 'utf8')

  console.log(`[collect-evidence] bundle ready: ${outDir}`)
  console.log(`[collect-evidence] docs copied: ${copied.docs.length}`)
  console.log(`[collect-evidence] logs copied: ${copied.logs.length}`)
  console.log(`[collect-evidence] screenshots copied: ${copied.screenshots.length}`)
}

main().catch((error) => {
  console.error('[collect-evidence] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
