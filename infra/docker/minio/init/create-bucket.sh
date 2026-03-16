#!/bin/sh
set -eu

: "${MINIO_ENDPOINT:=http://minio:9000}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${S3_BUCKET_MEDIA:=parkly-media}"
: "${MINIO_ALIAS:=parkly}"

echo "[minio-init] waiting for MinIO endpoint: ${MINIO_ENDPOINT}"

i=0
until mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1
do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then
    echo "[minio-init] alias bootstrap timeout after ${i} attempts"
    exit 1
  fi
  echo "[minio-init] MinIO not ready yet, retry ${i}/60 ..."
  sleep 2
done

echo "[minio-init] alias ready: ${MINIO_ALIAS}"

mc mb --ignore-existing "$MINIO_ALIAS/$S3_BUCKET_MEDIA"
mc anonymous set none "$MINIO_ALIAS/$S3_BUCKET_MEDIA" >/dev/null 2>&1 || true

echo "[minio-init] bucket ready: $S3_BUCKET_MEDIA"