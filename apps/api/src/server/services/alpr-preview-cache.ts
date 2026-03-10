import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

const previewResultCache = new Map<string, { expiresAt: number; value: unknown }>()
const previewInflightCache = new Map<string, Promise<unknown>>()

function normalizeCachePart(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized || '-'
}

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of previewResultCache.entries()) {
    if (entry.expiresAt <= now) previewResultCache.delete(key)
  }
}

export async function computeLocalImageFingerprint(imagePath: string) {
  const hash = createHash('sha1')

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(imagePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })

  return hash.digest('hex')
}

export function createAlprPreviewRequestKey(args: {
  fingerprint?: string | null
  imageUrl?: string | null
  imagePath?: string | null
  plateHint?: string | null
}) {
  const fingerprint = normalizeCachePart(args.fingerprint)
  const imageUrl = normalizeCachePart(args.imageUrl)
  const imagePath = normalizeCachePart(args.imagePath)
  const plateHint = normalizeCachePart(args.plateHint).toUpperCase()

  return [
    'alpr-preview',
    'v1',
    `fingerprint:${fingerprint}`,
    `imageUrl:${imageUrl}`,
    `imagePath:${imagePath}`,
    `plateHint:${plateHint}`,
  ].join('|')
}

export function readAlprPreviewCache<T>(requestKey: string): T | null {
  pruneExpiredEntries()

  const entry = previewResultCache.get(requestKey)
  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    previewResultCache.delete(requestKey)
    return null
  }

  return entry.value as T
}

export function writeAlprPreviewCache<T>(requestKey: string, value: T, ttlMs: number) {
  previewResultCache.set(requestKey, {
    expiresAt: Date.now() + Math.max(1, ttlMs),
    value,
  })
}

export async function withAlprPreviewInflightDedupe<T>(requestKey: string, factory: () => Promise<T>) {
  const existing = previewInflightCache.get(requestKey)
  if (existing) return existing as Promise<T>

  const work = Promise.resolve()
    .then(factory)
    .finally(() => {
      previewInflightCache.delete(requestKey)
    })

  previewInflightCache.set(requestKey, work)
  return work
}

export function __resetAlprPreviewCachesForTests() {
  previewResultCache.clear()
  previewInflightCache.clear()
}
