/** Local-only category-award preview, without starting production API background jobs. */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { competitionGroupAwardsRoutes } from '../src/routes/competition_group_awards.js';
import { databaseSettings } from '../src/db/settings.js';
const settings = databaseSettings();
if (!['127.0.0.1', 'localhost', '::1'].includes(settings.host)) throw new Error('Local database required');
const app = new Hono();
app.route('/v1', competitionGroupAwardsRoutes);
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: Number(process.env.PORT || 3041) });
console.log('Local category awards API ready');
