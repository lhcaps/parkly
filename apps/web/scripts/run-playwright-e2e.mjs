import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightCli = require.resolve('@playwright/test/cli')
const forwardedArgs = process.argv.slice(2)

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
  })

  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runPnpm(args, env = process.env) {
  if (process.platform === 'win32') {
    run('cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], env)
    return
  }

  run('pnpm', args, env)
}

const buildEnv = {
  ...process.env,
  VITE_API_BASE_URL: process.env.PLAYWRIGHT_E2E_API_BASE_URL ?? '',
}

runPnpm(['run', 'build:web'], buildEnv)
run(process.execPath, [path.resolve(process.cwd(), 'scripts/check-playwright-runtime.mjs')], process.env)
run(process.execPath, [playwrightCli, 'test', ...forwardedArgs], process.env)
