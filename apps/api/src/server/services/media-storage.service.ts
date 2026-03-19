import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import { putObjectBuffer, createPresignedDownloadUrl } from '../../lib/object-storage'
import { config } from '../config'

export type StoredMediaDescriptor = {
  storageProvider: 'LOCAL' | 'MINIO'
  storageKind: 'UPLOAD'
  mediaUrl: string | null
  viewUrl: string | null
  filePath: string | null
  bucketName: string | null
  objectKey: string | null
  objectEtag: string | null
  mimeType: string
  sha256: string
  widthPx: number | null
  heightPx: number | null
  sizeBytes: number
  originalName: string | null
  filename: string
  metadataJson: Record<string, unknown>
}

function cleanSegment(value: string | null | undefined, fallback: string) {
  const text = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return text || fallback
}

function currentMediaDriver() {
  return String(process.env.MEDIA_STORAGE_DRIVER ?? config.media.driver ?? 'LOCAL')
    .trim()
    .toUpperCase()
}

function extFromMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

function publicFileUrl(filePath: string) {
  const prefix = config.upload.publicPath.replace(/\/+$/, '')
  return prefix + '/' + filePath.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/')
}

async function imageMeta(buffer: Buffer) {
  try {
    const meta = await sharp(buffer).metadata()
    return {
      widthPx: typeof meta.width === 'number' ? meta.width : null,
      heightPx: typeof meta.height === 'number' ? meta.height : null,
    }
  } catch {
    return { widthPx: null, heightPx: null }
  }
}

export async function storeUploadedMedia(input: {
  buffer: Buffer
  mimeType: string
  originalName?: string | null
  siteCode?: string | null
  laneCode?: string | null
  deviceCode?: string | null
  capturedAt?: Date | null
  metadata?: Record<string, unknown> | null
}) : Promise<StoredMediaDescriptor> {
  const mimeType = String(input.mimeType ?? '').trim()
  const ext = extFromMime(mimeType)
  const capturedAt = input.capturedAt ?? new Date()
  const yyyy = String(capturedAt.getUTCFullYear())
  const mm = String(capturedAt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(capturedAt.getUTCDate()).padStart(2, '0')
  const filename = [
    cleanSegment(input.siteCode, 'SITE'),
    cleanSegment(input.laneCode, 'LANE'),
    cleanSegment(input.deviceCode, 'DEVICE'),
    randomUUID().slice(0, 12),
  ].join('_') + '.' + ext

  const sha256 = createHash('sha256').update(input.buffer).digest('hex')
  const meta = await imageMeta(input.buffer)
  const metadataJson = {
    source: 'UPLOAD',
    originalName: input.originalName ?? null,
    sizeBytes: input.buffer.length,
    mimeType,
    sha256,
    siteCode: input.siteCode ?? null,
    laneCode: input.laneCode ?? null,
    deviceCode: input.deviceCode ?? null,
    capturedAt: capturedAt.toISOString(),
    ...(input.metadata ?? {}),
  }

  if (currentMediaDriver() === 'MINIO') {
    const bucketName = String((config).s3?.bucket ?? process.env.S3_BUCKET_MEDIA ?? 'parkly-media')
    const objectKey = ['gate-media', yyyy, mm, dd, cleanSegment(input.siteCode, 'SITE'), cleanSegment(input.laneCode, 'LANE'), filename].join('/')

    const uploaded = await putObjectBuffer({
      bucket: bucketName,
      key: objectKey,
      body: input.buffer,
      contentType: mimeType,
      metadata: {
        sha256,
        siteCode: String(input.siteCode ?? ''),
        laneCode: String(input.laneCode ?? ''),
        deviceCode: String(input.deviceCode ?? ''),
      },
    })

    // Log successful MinIO upload for debugging
    console.log(`[MediaStorage] Uploaded to MinIO: s3://${bucketName}/${objectKey} (${input.buffer.length} bytes, etag: ${uploaded.etag})`)

    const presigned = await createPresignedDownloadUrl({
      bucket: bucketName,
      key: objectKey,
      expiresInSec: config.media.presignTtlSec,
    })

    return {
      storageProvider: 'MINIO',
      storageKind: 'UPLOAD',
      mediaUrl: null,
      viewUrl: presigned.url,
      filePath: null,
      bucketName,
      objectKey,
      objectEtag: uploaded.etag,
      mimeType,
      sha256,
      widthPx: meta.widthPx,
      heightPx: meta.heightPx,
      sizeBytes: input.buffer.length,
      originalName: input.originalName ?? null,
      filename,
      metadataJson,
    }
  }

  const relativePath = path.join('gate-media', yyyy + mm + dd, filename)
  const absolutePath = path.resolve(process.cwd(), config.upload.dir, relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, input.buffer)

  const mediaUrl = publicFileUrl(relativePath)

  return {
    storageProvider: 'LOCAL',
    storageKind: 'UPLOAD',
    mediaUrl,
    viewUrl: mediaUrl,
    filePath: relativePath,
    bucketName: null,
    objectKey: null,
    objectEtag: null,
    mimeType,
    sha256,
    widthPx: meta.widthPx,
    heightPx: meta.heightPx,
    sizeBytes: input.buffer.length,
    originalName: input.originalName ?? null,
    filename,
    metadataJson,
  }
}
