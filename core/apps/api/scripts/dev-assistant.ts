/** Local chat API: real routes/model/telemetry, without unrelated background jobs. */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

if (process.env.NODE_ENV === 'production' || process.env.DB_HOST !== '127.0.0.1'
  || process.env.DB_NAME !== 'assistant_dev' || !process.env.JWT_SECRET) {
  throw new Error('Requires loopback assistant_dev database and an explicit JWT_SECRET');
}

const [{ siteAssistantRoutes }, { rolePreviewGuard }, { apiCors }, { requestDiagnostics }, { siteAssistantSharesRoutes }] = await Promise.all([
  import('../src/routes/site_assistant.js'),
  import('../src/routes/auth.js'),
  import('../src/api_cors.js'),
  import('../src/observability/request.js'),
  import('../src/routes/site_assistant_shares.js'),
]);
const app = new Hono();
app.use('*', requestDiagnostics);
app.use('*', apiCors);
app.use('*', async (c, next) => { c.header('X-Assistant-Backend', 'local'); await next(); });
app.use('/v1/*', rolePreviewGuard);
app.route('/v1', siteAssistantRoutes);
app.route('/v1', siteAssistantSharesRoutes);
app.get('/health', c => c.json({ backend: 'local-assistant', database: 'assistant_dev' }));
app.onError((_error, c) => c.json({ error: 'internal_error' }, 500));
const port = Number(process.env.PORT || 3002);
serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => {
  console.log(`Local chat API: http://127.0.0.1:${port} (assistant_dev)`);
});
