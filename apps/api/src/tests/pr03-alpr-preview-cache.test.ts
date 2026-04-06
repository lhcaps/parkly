import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  __resetAlprPreviewCachesForTests,
  computeLocalImageFingerprint,
  createAlprPreviewRequestKey,
  readAlprPreviewCache,
  withAlprPreviewInflightDedupe,
  writeAlprPreviewCache,
} from '../server/services/alpr-preview-cache'

test('same image content yields stable preview request key', async () => {
  __resetAlprPreviewCachesForTests()

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkly-pr03-'))
  const imagePath = path.join(tmpDir, 'plate.png')
  await fs.writeFile(imagePath, Buffer.from('fake-image-content'))

  const fingerprintA = await computeLocalImageFingerprint(imagePath)
  const fingerprintB = await computeLocalImageFingerprint(imagePath)

  const keyA = createAlprPreviewRequestKey({ fingerprint: fingerprintA, imageUrl: '/uploads/plate.png', imagePath, plateHint: null })
  const keyB = createAlprPreviewRequestKey({ fingerprint: fingerprintB, imageUrl: '/uploads/plate.png', imagePath, plateHint: null })

  assert.equal(keyA, keyB)

  await fs.rm(tmpDir, { recursive: true, force: true })
})

test('preview cache expires by ttl', async () => {
  __resetAlprPreviewCachesForTests()

  await writeAlprPreviewCache('preview-key', { ok: true }, 15)
  assert.deepEqual(await readAlprPreviewCache('preview-key'), { ok: true })

  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(await readAlprPreviewCache('preview-key'), null)
})

test('inflight dedupe shares the same promise for concurrent preview work', async () => {
  __resetAlprPreviewCachesForTests()

  let executionCount = 0
  const factory = async () => {
    executionCount += 1
    await new Promise((resolve) => setTimeout(resolve, 25))
    return { recognizedPlate: '51-AB 123.45' }
  }

  const [a, b] = await Promise.all([
    withAlprPreviewInflightDedupe('same-key', factory),
    withAlprPreviewInflightDedupe('same-key', factory),
  ])

  assert.equal(executionCount, 1)
  assert.deepEqual(a, b)
})
