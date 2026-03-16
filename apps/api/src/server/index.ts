import 'dotenv/config';

import http from 'node:http';

import { buildApp } from './app';
import { config } from './config';

async function main() {
  const app = await buildApp();

  const server = http.createServer(app);
  server.listen(config.port, config.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          msg: 'Parkly API started',
          host: config.host,
          port: config.port,
          prefix: config.prefix,
          docs: '/docs',
          authMode: config.authMode,
          redisRequired: config.redis.required,
          redisPrefix: config.redis.prefix,
        },
        null,
        2
      )
    );
  });

  process.on('SIGINT', async () => {
    await (app as any).close?.().catch(() => void 0);
    server.close(() => process.exit(0));
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
