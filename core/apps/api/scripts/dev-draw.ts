/** Read-only draw source preview, using the production route without API background jobs. */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { drawRoutes } from '../src/routes/draw.js';

if (process.env.NODE_ENV === 'production') throw new Error('Local preview only');

const app = new Hono();
app.use('*', async (c, next) => { c.header('X-Draw-Backend', 'local'); await next(); });
app.route('/v1', drawRoutes);
const port = Number(process.env.PORT || 3003);
serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => {
  console.log(`Local draw API: http://127.0.0.1:${port}`);
});
