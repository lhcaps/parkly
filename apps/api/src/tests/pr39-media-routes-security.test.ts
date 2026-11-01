process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://parkly_test:test@127.0.0.1:3306/parkly_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-at-least-32-chars-long';

import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../server/http';

test('Media routes security invariants: contract and export integrity', async () => {
  const mediaModule = await import('../modules/media/interfaces/http/register-media-routes');
  assert.equal(typeof mediaModule.registerMediaRoutes, 'function', 'registerMediaRoutes must be exported as a function');
});

test('Media routes security invariants: MIME validation rejects non-image', async () => {
  const { validateMediaMimeType } = await import('../modules/media/interfaces/http/register-media-routes');
  assert.equal(validateMediaMimeType('image/jpeg'), true);
  assert.equal(validateMediaMimeType('image/png'), true);
  assert.equal(validateMediaMimeType('image/webp'), true);
  assert.equal(validateMediaMimeType('text/html'), false);
  assert.equal(validateMediaMimeType('application/javascript'), false);
  assert.equal(validateMediaMimeType('application/x-sh'), false);
  assert.equal(validateMediaMimeType('image/svg+xml'), false); // prevent SVG XSS
});

test('Media routes security invariants: mediaId parsing and validation', async () => {
  const { parseMediaId } = await import('../modules/media/interfaces/http/register-media-routes');
  assert.equal(parseMediaId('12345'), 12345n);
  assert.equal(parseMediaId('1'), 1n);

  assert.throws(() => parseMediaId(''), (err: unknown) => err instanceof ApiError && err.code === 'BAD_REQUEST');
  assert.throws(() => parseMediaId('abc'), (err: unknown) => err instanceof ApiError && err.code === 'BAD_REQUEST');
  assert.throws(() => parseMediaId('-5'), (err: unknown) => err instanceof ApiError && err.code === 'BAD_REQUEST');
  assert.throws(() => parseMediaId('12.34'), (err: unknown) => err instanceof ApiError && err.code === 'BAD_REQUEST');
  assert.throws(() => parseMediaId('123; DROP TABLE'), (err: unknown) => err instanceof ApiError && err.code === 'BAD_REQUEST');
});

test('Media routes security invariants: TTL boundary clamp', async () => {
  const { clampPresignTtl } = await import('../modules/media/interfaces/http/register-media-routes');
  assert.equal(clampPresignTtl(undefined), 300); // default config TTL
  assert.equal(clampPresignTtl(10), 10);
  assert.equal(clampPresignTtl(-5), 1); // min clamp
  assert.equal(clampPresignTtl(0), 1); // min clamp
  assert.equal(clampPresignTtl(1_000_000), 604800); // max 7 days clamp
});
