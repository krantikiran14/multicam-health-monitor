import { createApp } from './app';
import { initDb } from './db/init';
import { initRealtime } from './realtime';
import { config } from './config';

/** Process entry point: prepare the DB, then start the HTTP + WebSocket server. */
async function main() {
  await initDb();
  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`API docs at http://localhost:${config.port}/api/docs`);
  });
  initRealtime(server); // attach Socket.IO to the same HTTP server
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
