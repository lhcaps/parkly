import { readdirSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const appRoot = process.cwd()
const testsRoot = path.join(appRoot, 'src', 'tests')
const filterIndex = process.argv.indexOf('--filter')
const filter = filterIndex >= 0 ? (process.argv[filterIndex + 1] ?? '').trim() : ''
const perFileTimeoutMs = Math.max(
  1_000,
  Number.parseInt(String(process.env.NODE_TEST_FILE_TIMEOUT_MS ?? '120000'), 10) || 120_000,
)

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

const selectedFiles = walk(testsRoot)
  .sort((left, right) => left.localeCompare(right))
  .filter((filePath) => !filter || filePath.includes(filter))

if (selectedFiles.length === 0) {
  console.error(`[node-tests] No test files matched${filter ? ` filter "${filter}"` : ''}`)
  process.exit(1)
}

const failures = []

for (const [index, filePath] of selectedFiles.entries()) {
  const relPath = path.relative(appRoot, filePath)
  console.log(`\n[node-tests] (${index + 1}/${selectedFiles.length}) ${relPath}`)

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', '--test-reporter=spec', relPath],
    {
      cwd: appRoot,
      stdio: 'inherit',
      env: process.env,
      timeout: perFileTimeoutMs,
    },
  )

  if (result.error?.name === 'Error' && /timed out/i.test(result.error.message)) {
    console.error(`[node-tests] Timed out after ${perFileTimeoutMs}ms: ${relPath}`)
    failures.push(relPath)
    continue
  }

  if (result.status !== 0) {
    failures.push(relPath)
  }
}

if (failures.length > 0) {
  console.error('\n[node-tests] Failed files:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`\n[node-tests] Passed ${selectedFiles.length} files`)
