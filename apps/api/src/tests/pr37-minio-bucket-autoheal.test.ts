import 'dotenv/config'

import test from 'node:test'
import assert from 'node:assert/strict'

import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'

test('storeUploadedMedia auto-creates missing MinIO bucket before first upload', async (t) => {
  const endpoint = String(process.env.S3_ENDPOINT ?? '').trim()
  const accessKey = String(process.env.S3_ACCESS_KEY ?? '').trim()
  const secretKey = String(process.env.S3_SECRET_KEY ?? '').trim()
  const region = String(process.env.S3_REGION ?? 'us-east-1').trim() || 'us-east-1'
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE ?? 'ON').trim().toUpperCase() === 'ON'

  if (!endpoint || !accessKey || !secretKey) {
    t.skip('OBJECT_STORAGE_ENV_NOT_CONFIGURED')
    return
  }

  const rawClient = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  })

  try {
    await rawClient.send(new ListBucketsCommand({}))
  } catch {
    t.skip('OBJECT_STORAGE_UNAVAILABLE')
    return
  } finally {
    rawClient.destroy()
  }

  const uniqueBucket = `parkly-media-autoheal-${Date.now()}`
  process.env.MEDIA_STORAGE_DRIVER = 'MINIO'
  process.env.S3_BUCKET_MEDIA = uniqueBucket
  process.env.MEDIA_PRESIGN_TTL_SEC = '60'

  const { storeUploadedMedia } = await import('../server/services/media-storage.service')
  const { headStoredObject } = await import('../lib/object-storage')

  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pL5xQAAAABJRU5ErkJggg==',
    'base64',
  )

  const stored = await storeUploadedMedia({
    buffer: png1x1,
    mimeType: 'image/png',
    originalName: 'autoheal.png',
    siteCode: 'SITE_DN_01',
    laneCode: 'LANE_ENTRY_01',
    deviceCode: 'CAM_ENTRY_01',
    metadata: { source: 'PR37_TEST' },
  })

  assert.equal(stored.storageProvider, 'MINIO')
  assert.equal(stored.bucketName, uniqueBucket)
  assert.ok(stored.objectKey)

  const head = await headStoredObject({
    bucket: uniqueBucket,
    key: stored.objectKey!,
  })

  assert.equal(head.bucket, uniqueBucket)
  assert.ok(head.etag !== undefined)
  assert.equal(head.contentType, 'image/png')
})
