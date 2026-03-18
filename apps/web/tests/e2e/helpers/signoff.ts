import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

export async function saveSignoffScreenshot(page, fileName) {
  const targetDir = process.env.SIGNOFF_SCREENSHOTS_DIR || 'screenshots'
  await mkdir(targetDir, { recursive: true })
  await page.screenshot({ path: path.join(targetDir, fileName), fullPage: true })
}
