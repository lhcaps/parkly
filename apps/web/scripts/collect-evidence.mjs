import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const evidenceDir = path.join(root, 'docs/frontend/evidence')
const smokePath = path.join(evidenceDir, 'latest-smoke.json')
const signoffPath = path.join(evidenceDir, 'manual-qa-signoff.md')
const readmePath = path.join(evidenceDir, 'README.md')

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(evidenceDir, { recursive: true })

  const timestamp = new Date().toISOString()
  const smokeSummary = await exists(smokePath)
    ? JSON.parse(await readFile(smokePath, 'utf8'))
    : { note: 'Chưa có latest-smoke.json. Hãy chạy pnpm smoke:web:dist trước.' }

  const readme = `# Frontend evidence bundle\n\n- Generated at: ${timestamp}\n- Build log: dán từ terminal vào file kèm theo khi bàn giao\n- Smoke output: ${await exists(smokePath) ? 'latest-smoke.json đã có' : 'chưa có'}\n- Screenshots: chụp thủ công theo docs/frontend/acceptance-checklist.md\n- Manual signoff: manual-qa-signoff.md\n\n## Smoke snapshot\n\n\
\
${JSON.stringify(smokeSummary, null, 2)}\n\
\
`

  const signoffTemplate = `# Manual QA signoff\n\n- Owner:\n- Date:\n- Backend profile: local-dev / demo / rc\n- Web commit / patch: \n- API base: \n\n## Signoff\n- [ ] Login thành công\n- [ ] Overview mở ổn\n- [ ] Run Lane mở route sâu ổn\n- [ ] Review Queue handoff sang Session/Audit ổn\n- [ ] Sync Outbox handoff ổn\n- [ ] Mobile Pairing và Mobile Capture mở được\n- [ ] Refresh route sâu không trắng màn\n- [ ] Stale / degraded / unauthorized hiển thị đúng\n- [ ] Không còn wording nội bộ thừa ở flow chính\n\n## Notes\n\n`

  await writeFile(readmePath, readme, 'utf8')
  if (!(await exists(signoffPath))) {
    await writeFile(signoffPath, signoffTemplate, 'utf8')
  }

  console.log(`[evidence] updated ${readmePath}`)
  console.log(`[evidence] ready ${signoffPath}`)
}

main().catch((error) => {
  console.error('[collect-evidence] failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
