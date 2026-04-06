-- V16: Object storage metadata for gate_read_media
-- Giữ compatibility media_url/file_path nhưng object identity mới là nguồn chính.

SET @col_storage_provider_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_media'
    AND COLUMN_NAME = 'storage_provider'
);
SET @sql_storage_provider := IF(
  @col_storage_provider_exists = 0,
  'ALTER TABLE gate_read_media ADD COLUMN storage_provider VARCHAR(32) NULL AFTER storage_kind',
  'SELECT 1'
);
PREPARE stmt_storage_provider FROM @sql_storage_provider;
EXECUTE stmt_storage_provider;
DEALLOCATE PREPARE stmt_storage_provider;

SET @col_bucket_name_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_media'
    AND COLUMN_NAME = 'bucket_name'
);
SET @sql_bucket_name := IF(
  @col_bucket_name_exists = 0,
  'ALTER TABLE gate_read_media ADD COLUMN bucket_name VARCHAR(255) NULL AFTER file_path',
  'SELECT 1'
);
PREPARE stmt_bucket_name FROM @sql_bucket_name;
EXECUTE stmt_bucket_name;
DEALLOCATE PREPARE stmt_bucket_name;

SET @col_object_key_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_media'
    AND COLUMN_NAME = 'object_key'
);
SET @sql_object_key := IF(
  @col_object_key_exists = 0,
  'ALTER TABLE gate_read_media ADD COLUMN object_key VARCHAR(1024) NULL AFTER bucket_name',
  'SELECT 1'
);
PREPARE stmt_object_key FROM @sql_object_key;
EXECUTE stmt_object_key;
DEALLOCATE PREPARE stmt_object_key;

SET @col_object_etag_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_media'
    AND COLUMN_NAME = 'object_etag'
);
SET @sql_object_etag := IF(
  @col_object_etag_exists = 0,
  'ALTER TABLE gate_read_media ADD COLUMN object_etag VARCHAR(255) NULL AFTER object_key',
  'SELECT 1'
);
PREPARE stmt_object_etag FROM @sql_object_etag;
EXECUTE stmt_object_etag;
DEALLOCATE PREPARE stmt_object_etag;

UPDATE gate_read_media
SET storage_provider = CASE
  WHEN storage_provider IS NOT NULL AND storage_provider <> '' THEN storage_provider
  WHEN bucket_name IS NOT NULL OR object_key IS NOT NULL THEN 'MINIO'
  WHEN file_path IS NOT NULL THEN 'LOCAL'
  WHEN media_url IS NOT NULL AND media_url LIKE '/uploads/%' THEN 'LOCAL'
  WHEN media_url IS NOT NULL THEN 'URL'
  ELSE 'LOCAL'
END
WHERE storage_provider IS NULL OR storage_provider = '';

ALTER TABLE gate_read_media
  MODIFY COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'LOCAL';

SET @ix_gate_read_media_bucket_key_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_media'
    AND INDEX_NAME = 'ix_gate_read_media_bucket_key'
);
SET @sql_ix_gate_read_media_bucket_key := IF(
  @ix_gate_read_media_bucket_key_exists = 0,
  'ALTER TABLE gate_read_media ADD KEY ix_gate_read_media_bucket_key (bucket_name, object_key(255))',
  'SELECT 1'
);
PREPARE stmt_ix_gate_read_media_bucket_key FROM @sql_ix_gate_read_media_bucket_key;
EXECUTE stmt_ix_gate_read_media_bucket_key;
DEALLOCATE PREPARE stmt_ix_gate_read_media_bucket_key;

SET @ix_gate_read_media_provider_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gate_read_media'
    AND INDEX_NAME = 'ix_gate_read_media_provider'
);
SET @sql_ix_gate_read_media_provider := IF(
  @ix_gate_read_media_provider_exists = 0,
  'ALTER TABLE gate_read_media ADD KEY ix_gate_read_media_provider (storage_provider, created_at)',
  'SELECT 1'
);
PREPARE stmt_ix_gate_read_media_provider FROM @sql_ix_gate_read_media_provider;
EXECUTE stmt_ix_gate_read_media_provider;
DEALLOCATE PREPARE stmt_ix_gate_read_media_provider;
