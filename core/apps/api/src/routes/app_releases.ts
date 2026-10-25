/** Administrator-only release control, separate from anonymous download events. */
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { parseAppReleaseRequest } from '@cuberoot/shared/android-release';
import { requireAdmin } from '../utils/recon_helpers.js';
import { createReleaseService } from '../releases/service.js';
import { diagnosticLog } from '../observability/request.js';

export function createAppReleaseRoutes(options: {
  authorize?: (c: Context) => Promise<{ wcaId: string }>;
  service?: ReturnType<typeof createReleaseService>;
} = {}) {
  const routes = new Hono();
  const service = options.service ?? createReleaseService();
  const authorize = options.authorize ?? requireAdmin;
  routes.use('/admin/app-releases', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    await next();
  });
  routes.get('/admin/app-releases', async c => {
    await authorize(c);
    try { return c.json(await service.status()); }
    catch { return c.json({ error: 'Unable to read release status' }, 502); }
  });
  routes.post('/admin/app-releases', bodyLimit({ maxSize: 20_000 }), async c => {
    const actor = await authorize(c);
    if (!c.req.header('Content-Type')?.startsWith('application/json')) return c.json({ error: 'JSON required' }, 415);
    let request;
    try { request = parseAppReleaseRequest(await c.req.json()); }
    catch { return c.json({ error: 'Invalid release request' }, 400); }
    try {
      const receipt = await service.dispatch(request, actor.wcaId);
      diagnosticLog('app_release_requested', { actor: actor.wcaId, requestId: request.requestId, platform: request.platform, commit: request.commit, state: receipt.state });
      return c.json(receipt, 202);
    } catch (error) {
      if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
      return c.json({ error: 'Unable to submit release. Refresh status before retrying.' }, 502);
    }
  });
  return routes;
}
export const appReleaseRoutes = createAppReleaseRoutes();
