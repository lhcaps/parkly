import 'dotenv/config';

import http from 'node:http';

import { buildApp } from './app';
import { config } from './config';
import { apiLogger, logStartup } from './logger';

process.on('unhandledRejection', (reason) => {
  apiLogger.error({ err: reason, type: 'unhandledRejection' }, String(reason));
});

process.on('uncaughtException', (err) => {
  apiLogger.error({ err, type: 'uncaughtException' }, err.message);
  process.exit(1);
});

async function main() {
  const app = await buildApp();

  const server = http.createServer(app);
  server.listen(config.port, config.host, () => {
    logStartup({
      host: config.host,
      port: config.port,
      prefix: config.prefix,
      docs: '/docs',
      authMode: config.authMode,
      redisRequired: config.redis.required,
      redisPrefix: config.redis.prefix,
    });
  });

  process.on('SIGINT', async () => {
    await (app as any).close?.().catch(() => void 0);
    server.close(() => process.exit(0));
  });
}

main().catch((e) => {
  apiLogger.error({ err: e, type: 'main' }, String(e));
  process.exitCode = 1;
});
