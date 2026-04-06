/**
 * index.ts — Parkly Edge Node Entry Point
 *
 * Usage:
 *   EDGE_NODE_ID=edge-hcm01 EDGE_SITE_CODE=SITE_HCM_01 \
 *   EDGE_CLOUD_API_URL=https://api.parkly.vn \
 *   EDGE_CLOUD_API_KEY=your_key \
 *   npx tsx src/index.ts
 *
 * Or with Docker:
 *   docker run -p 8080:8080 \
 *     -e EDGE_NODE_ID=edge-hcm01 \
 *     -e EDGE_SITE_CODE=SITE_HCM_01 \
 *     -e EDGE_CLOUD_API_URL=https://api.parkly.vn \
 *     -e EDGE_CLOUD_API_KEY=your_key \
 *     parkly/edge-node
 */

import { EdgeNodeConfigSchema } from './types.js';
import { initLocalDb } from './local-db.js';
import { SyncService, type ConnectivityState } from './sync-service.js';
import { BarrierController } from './barrier-controller.js';
import { createEdgeServer } from './edge-server.js';

/* ─── Load & validate configuration ──────────────────────────── */

const rawConfig = {
  EDGE_NODE_ID:               process.env.EDGE_NODE_ID               ?? 'edge-unknown',
  EDGE_SITE_CODE:             process.env.EDGE_SITE_CODE             ?? '',
  EDGE_CLOUD_API_URL:         process.env.EDGE_CLOUD_API_URL         ?? 'http://localhost:3000',
  EDGE_CLOUD_API_KEY:         process.env.EDGE_CLOUD_API_KEY         ?? '',
  EDGE_SYNC_INTERVAL_MS:      Number(process.env.EDGE_SYNC_INTERVAL_MS      ?? 300_000),
  EDGE_OFFLINE_SESSION_TTL_HOURS: Number(process.env.EDGE_OFFLINE_SESSION_TTL_HOURS ?? 24),
  EDGE_SQLITE_PATH:           process.env.EDGE_SQLITE_PATH           ?? './parkly-edge.db',
  EDGE_PORT:                  Number(process.env.EDGE_PORT              ?? 8080),
  EDGE_LAN_SUBNET:            process.env.EDGE_LAN_SUBNET            ?? '192.168.1.0/24',
  EDGE_BARRIER_ENDPOINT:      process.env.EDGE_BARRIER_ENDPOINT      ?? 'http://192.168.1.100:9090',
  EDGE_PRINTER_ENDPOINT:      process.env.EDGE_PRINTER_ENDPOINT      ?? 'http://192.168.1.101:9091',
  EDGE_MIN_HEALTHY_SUBSCRIPTIONS: Number(process.env.EDGE_MIN_HEALTHY_SUBSCRIPTIONS ?? 5),
};

const parseResult = EdgeNodeConfigSchema.safeParse(rawConfig);

if (!parseResult.success) {
  console.error('[parkly-edge] Configuration errors:');
  for (const issue of parseResult.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const config = parseResult.data;

console.log('╔═══════════════════════════════════════════════════╗');
console.log('║          Parkly Edge Node — Local Survivability     ║');
console.log('╠═══════════════════════════════════════════════════╣');
console.log(`║  Node ID    : ${config.EDGE_NODE_ID.padEnd(35)}║`);
console.log(`║  Site       : ${config.EDGE_SITE_CODE.padEnd(35)}║`);
console.log(`║  Cloud API  : ${config.EDGE_CLOUD_API_URL.slice(0, 35).padEnd(35)}║`);
console.log(`║  SQLite     : ${config.EDGE_SQLITE_PATH.padEnd(35)}║`);
console.log(`║  Listen     : 0.0.0.0:${String(config.EDGE_PORT).padEnd(28)}║`);
console.log('╚═══════════════════════════════════════════════════╝');

/* ─── Initialize subsystems ──────────────────────────────────── */

const db = initLocalDb(config.EDGE_SQLITE_PATH);
console.log('[parkly-edge] SQLite initialized:', config.EDGE_SQLITE_PATH);

const syncService = new SyncService({
  config,
  onConnectivityChange(state: ConnectivityState) {
    const emoji = state === 'ONLINE' ? '🟢' : state === 'DEGRADED' ? '🟡' : '🔴';
    console.log(`[parkly-edge] Cloud connectivity: ${emoji} ${state}`);
  },
});

const barrierController = new BarrierController({
  barrierEndpoint: config.EDGE_BARRIER_ENDPOINT,
});

const app = createEdgeServer({ config, syncService, barrierController });

/* ─── Start services ────────────────────────────────────────── */

syncService.start();

// Start HTTP server
const server = app.listen(config.EDGE_PORT, '0.0.0.0', () => {
  console.log(`[parkly-edge] HTTP server listening on :${config.EDGE_PORT}`);
  console.log('[parkly-edge] Ready to serve capture requests (offline mode)');
});

// Initial connectivity check
syncService.checkConnectivity()
  .then((state) => {
    console.log(`[parkly-edge] Initial cloud state: ${state}`);
  })
  .catch(console.error);

/* ─── Graceful shutdown ──────────────────────────────────────── */

async function shutdown(signal: string) {
  console.log(`[parkly-edge] Received ${signal} — shutting down gracefully...`);

  server.close(async () => {
    console.log('[parkly-edge] HTTP server closed');
  });

  syncService.stop();
  console.log('[parkly-edge] Sync service stopped');

  db.close();
  console.log('[parkly-edge] SQLite closed');

  console.log('[parkly-edge] Goodbye!');
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/* ─── Export for testing ─────────────────────────────────────── */
export { syncService, barrierController, config };
