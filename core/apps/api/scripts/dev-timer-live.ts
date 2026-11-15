/** Isolated timer-sharing preview. Never loads the production API background jobs. */
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

if (process.env.NODE_ENV === 'production' || process.env.DB_HOST !== '127.0.0.1'
  || !process.env.DB_PORT || process.env.DB_PORT === '5432' || !process.env.DB_NAME) {
  throw new Error('Explicit loopback DB_HOST, non-production DB_PORT and DB_NAME required');
}
const { timerLiveSharesRoutes, timerLiveRelay } = await import('../src/routes/timer_live_shares.js');
const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.use('/v1/timer/live-shares*', cors({ origin: origin => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : '' }));
app.route('/v1', timerLiveSharesRoutes);
app.get('/v1/timer/live-shares/socket', upgradeWebSocket(() => {
  let connection: ReturnType<typeof timerLiveRelay.connect> | undefined;
  return {
    onOpen(_event, ws) { connection = timerLiveRelay.connect({
      get bufferedAmount() { return ws.raw?.bufferedAmount ?? 0; },
      send(data) { ws.send(data); }, close(code, reason) { ws.close(code, reason); },
    }, 'local-preview'); },
    onMessage(event) { connection?.handleMessage(event.data); },
    onClose() { connection?.handleClose(); },
  };
}));
const port = Number(process.env.PORT || 3006);
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port });
injectWebSocket(server);
console.log(`Local timer-sharing API: http://127.0.0.1:${port}`);
