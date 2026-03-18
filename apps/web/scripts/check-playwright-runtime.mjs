import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'

async function fileExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function main() {
  let playwright

  try {
    playwright = await import('@playwright/test')
  } catch (error) {
    console.error('[playwright-runtime] Khong import duoc @playwright/test. Hay chay pnpm install truoc.')
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return
  }

  const executablePath = playwright.chromium.executablePath()
  const exists = await fileExists(executablePath)

  if (exists) {
    console.log(`[playwright-runtime] Chromium runtime OK: ${executablePath}`)
    return
  }

  const parentDir = path.dirname(executablePath)
  console.error('[playwright-runtime] Thieu Chromium runtime cho Playwright.')
  console.error(`[playwright-runtime] Expected executable: ${executablePath}`)
  console.error(`[playwright-runtime] Parent directory: ${parentDir}`)
  console.error('[playwright-runtime] Chay lai: pnpm --dir apps/web playwright:runtime:install')
  console.error('[playwright-runtime] Tren CI nho cai browser runtime truoc khi goi pnpm --dir apps/web test:e2e hoac release:signoff.')
  process.exitCode = 1
}

main().catch((error) => {
  console.error('[playwright-runtime] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
