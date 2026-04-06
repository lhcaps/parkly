import 'dotenv/config'

import { randomUUID } from 'node:crypto'

import {
  createPresignedDownloadUrl,
  deleteStoredObject,
  getObjectStorageHealth,
  headStoredObject,
  putObjectBuffer,
} from '../lib/object-storage'

async function main() {
  const ttlSec = Number(process.env.S3_SMOKE_TTL_SEC ?? 2)
  const key = `smoke/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.txt`
  const body = Buffer.from(`parkly-minio-smoke:${new Date().toISOString()}`)

  const health = await getObjectStorageHealth({ forceRefresh: true })
  if (!health.configured) {
    throw new Error('Object storage is not configured. Check S3_* env vars.')
  }
  if (!health.available) {
    throw new Error(`Object storage is unavailable: ${health.lastError ?? 'unknown error'}`)
  }

  const putResult = await putObjectBuffer({
    key,
    body,
    contentType: 'text/plain; charset=utf-8',
    metadata: {
      scope: 'smoke',
      service: 'parkly-api',
    },
  })

  const headBeforeDelete = await headStoredObject({ key })
  const presigned = await createPresignedDownloadUrl({
    key,
    expiresInSec: ttlSec,
  })

  const preExpiry = await fetch(presigned.url, { method: 'GET' })
  const preExpiryBody = await preExpiry.text()

  await new Promise((resolve) => setTimeout(resolve, Math.max(1, ttlSec + 1) * 1000))

  const postExpiry = await fetch(presigned.url, { method: 'GET' })

  await deleteStoredObject({ key })

  let deletedHeadStatus = 'deleted'
  try {
    await headStoredObject({ key })
    deletedHeadStatus = 'still_exists'
  } catch (error) {
    deletedHeadStatus = String(
      (error as { name?: string; message?: string } | null | undefined)?.name ??
        (error as Error)?.message ??
        'not_found',
    )
  }

  console.log(
    JSON.stringify(
      {
        ok:
          preExpiry.ok &&
          preExpiryBody.includes('parkly-minio-smoke') &&
          !postExpiry.ok &&
          deletedHeadStatus !== 'still_exists',
        health,
        putResult,
        headBeforeDelete,
        presigned: {
          expiresInSec: presigned.expiresInSec,
          url: presigned.url,
        },
        preExpiry: {
          status: preExpiry.status,
          ok: preExpiry.ok,
          body: preExpiryBody,
        },
        postExpiry: {
          status: postExpiry.status,
          ok: postExpiry.ok,
        },
        deleteResult: {
          key,
          deletedHeadStatus,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
