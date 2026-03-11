import 'dotenv/config';

import test from 'node:test';
import assert from 'node:assert/strict';

function safeJson(value: unknown) {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  );
}

test('upload -> gate_read_media -> ingest -> presigned GET -> expiry works on MinIO', async (t) => {
  process.env.MEDIA_STORAGE_DRIVER = 'MINIO';
  process.env.MEDIA_PRESIGN_TTL_SEC = '2';
  process.env.S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE ?? 'ON';

  let step = 'bootstrap';
  const debug: Record<string, unknown> = {};

  try {
    step = 'import modules';
    const { prisma } = await import('../lib/prisma');
    const { getObjectStorageHealth, headStoredObject } = await import('../lib/object-storage');
    const { ingestAlprRead } = await import('../modules/gate/application/ingest-alpr-read');
    const {
      createGateReadMediaRecord,
      resolveLaneContext,
    } = await import('../modules/gate/infrastructure/gate-read-events.repo');
    const { resolveMediaViewById } = await import('../server/services/media-presign.service');
    const { storeUploadedMedia } = await import('../server/services/media-storage.service');

    step = 'object storage health';
    const health = await getObjectStorageHealth({ forceRefresh: true });
    debug.health = health;
    console.log('[pr13] health =', safeJson(health));

    if (!health.available) {
      t.skip(JSON.stringify({ reason: 'OBJECT_STORAGE_UNAVAILABLE', health }));
      return;
    }

    step = 'load lane topology';
    const laneRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ps.site_id AS siteId,
        ps.site_code AS siteCode,
        gl.lane_id AS laneId,
        gl.lane_code AS laneCode,
        gd.device_id AS deviceId,
        gd.device_code AS deviceCode,
        gl.direction AS direction
      FROM parking_sites ps
      JOIN gate_lanes gl
        ON gl.site_id = ps.site_id
      JOIN gate_lane_devices gld
        ON gld.lane_id = gl.lane_id
      JOIN gate_devices gd
        ON gd.device_id = gld.device_id
      ORDER BY ps.site_id ASC, gl.lane_id ASC, gd.device_id ASC
      LIMIT 1
    `);

    const lane = laneRows[0];
    debug.lane = lane;
    console.log('[pr13] lane =', safeJson(lane));

    if (!lane) {
      t.skip('NO_LANE_DATA');
      return;
    }

    const png1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pL5xQAAAABJRU5ErkJggg==',
      'base64',
    );

    step = 'store upload to media backend';
    const stored = await storeUploadedMedia({
      buffer: png1x1,
      mimeType: 'image/png',
      originalName: 'pr13.png',
      siteCode: String(lane.siteCode),
      laneCode: String(lane.laneCode),
      deviceCode: String(lane.deviceCode),
      metadata: { source: 'PR13_TEST' },
    });
    debug.stored = stored;
    console.log('[pr13] stored =', safeJson(stored));

    assert.equal(stored.storageProvider, 'MINIO', `expected MINIO driver, got ${stored.storageProvider}`);
    assert.ok(stored.bucketName, 'bucketName missing after upload');
    assert.ok(stored.objectKey, 'objectKey missing after upload');

    step = 'resolve lane context';
    const laneContext = await resolveLaneContext({
      siteCode: String(lane.siteCode),
      laneCode: String(lane.laneCode),
      deviceCode: String(lane.deviceCode),
      expectedDirection: String(lane.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
    });
    debug.laneContext = laneContext;
    console.log('[pr13] laneContext =', safeJson(laneContext));

    step = 'create gate_read_media record';
    const mediaId = await createGateReadMediaRecord({
      siteId: laneContext.siteId,
      laneId: laneContext.laneId,
      deviceId: laneContext.deviceId,
      media: {
        storageKind: stored.storageKind,
        storageProvider: stored.storageProvider,
        mediaUrl: stored.mediaUrl,
        filePath: stored.filePath,
        bucketName: stored.bucketName,
        objectKey: stored.objectKey,
        objectEtag: stored.objectEtag,
        mimeType: stored.mimeType,
        sha256: stored.sha256,
        widthPx: stored.widthPx,
        heightPx: stored.heightPx,
        metadataJson: stored.metadataJson,
        capturedAt: new Date(),
      },
    });
    debug.mediaId = String(mediaId);
    console.log('[pr13] mediaId =', String(mediaId));

    assert.ok(BigInt(mediaId) > 0n, `mediaId must be positive, got ${String(mediaId)}`);

    step = 'ingest ALPR read';
    const capture = await ingestAlprRead({
      requestId: `pr13:${Date.now()}`,
      idempotencyKey: `pr13:${Date.now()}:minio`,
      siteCode: String(lane.siteCode),
      laneCode: String(lane.laneCode),
      deviceCode: String(lane.deviceCode),
      direction: String(lane.direction).toUpperCase() === 'EXIT' ? 'EXIT' : 'ENTRY',
      occurredAt: new Date(),
      plateRaw: '51A12345',
      imageUrl: stored.viewUrl ?? stored.mediaUrl ?? undefined,
      sourceMediaId: String(mediaId),
      ocrConfidence: 0.99,
      rawPayload: { source: 'PR13_TEST' },
    });
    debug.capture = capture;
    console.log('[pr13] capture =', safeJson(capture));

    assert.ok(capture.readEventId, 'capture.readEventId missing');
    assert.equal(String(capture.mediaId), String(mediaId), 'capture.mediaId mismatch');

    step = 'resolve presigned view URL';
    const view = await resolveMediaViewById(String(mediaId), { ttlSec: 2 });
    debug.view = view;
    console.log('[pr13] view =', safeJson(view));
    assert.ok(view?.viewUrl, 'viewUrl missing from media presign resolver');

    step = 'head object';
    const head = await headStoredObject({
      bucket: stored.bucketName,
      key: stored.objectKey!,
    });
    debug.head = head;
    console.log('[pr13] head =', safeJson(head));
    assert.ok(head.etag !== undefined, 'headObject did not return etag field');

    step = 'fetch before expiry';
    const pre = await fetch(view!.viewUrl);
    const preBytes = Buffer.from(await pre.arrayBuffer());
    debug.pre = { status: pre.status, ok: pre.ok, bytes: preBytes.length };
    console.log('[pr13] pre =', safeJson(debug.pre));

    assert.equal(pre.ok, true, `pre-signed GET before expiry failed with status ${pre.status}`);
    assert.ok(preBytes.length > 0, 'pre-signed GET returned empty body');

    step = 'sleep for expiry';
    await new Promise((resolve) => setTimeout(resolve, 4000));

    step = 'fetch after expiry';
    const post = await fetch(view!.viewUrl);
    debug.post = { status: post.status, ok: post.ok };
    console.log('[pr13] post =', safeJson(debug.post));

    assert.equal(post.ok, false, `pre-signed URL should expire but still returned ${post.status}`);
  } catch (error) {
    console.error('[pr13] FAILED STEP =', step);
    console.error('[pr13] DEBUG =', safeJson(debug));
    throw error;
  }
});