import jwt from 'jsonwebtoken';
import mammoth from 'mammoth';
import { RateLimitError } from '../utils/rate_limit.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { query, withTransaction } from '../db/connection.js';
import { optionalAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { createWorkspaceService, WorkspaceError } from '../workspace/service.js';
export const workspaceRoutes = new Hono();
const service = createWorkspaceService(query, withTransaction);
workspaceRoutes.use('/workspace/*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });
workspaceRoutes.use('/workspace/*', (c, next) => {
  const acceptsContractFile = /\/(contract-upload|contract-draft-publish)$/.test(c.req.path);
  return bodyLimit({ maxSize: acceptsContractFile ? 8 * 1024 * 1024 : 262144 })(c, next);
});
workspaceRoutes.all('/workspace/:action', async c => {
  const decoded = jwt.decode((c.req.header('Authorization') ?? '').replace(/^Bearer /, ''));
  if (decoded && typeof decoded === 'object' && decoded.previewId) return c.json({error:'请使用本人账号 / Use your own account'},403);
  const user = await optionalAuth(c);
  if (!user?.uid) return c.json({ error: '请登录 CubeRoot / Sign in to CubeRoot' }, 401);
  const identity = { uid: user.uid, isAdmin: user.isAdmin, name: user.name };
  try {
    const action = c.req.param('action');
    if (c.req.method === 'GET' && (action === 'contract-file' || action === 'contract-preview')) {
      const file = await service.contractFile(identity, new URL(c.req.url).searchParams);
      if (action === 'contract-preview') {
        if (!file.filename.toLowerCase().endsWith('.docx')) return c.json({ error: 'DOCX required' }, 400);
        const preview = await mammoth.extractRawText({ buffer: Buffer.from(file.data) });
        return c.json({ text: preview.value });
      }
      c.header('Content-Type', file.mime);
      c.header('X-Content-Type-Options', 'nosniff');
      c.header('Content-Security-Policy', "sandbox; default-src 'none'");
      c.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g, '%27')}`);
      return c.body(new Uint8Array(file.data));
    }
    if (c.req.method === 'GET') return c.json(await service.get(identity, action, new URL(c.req.url).searchParams));
    if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);
    if (!c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'JSON required' }, 415);
    checkRateLimit(`workspace:${user.uid}`, { bucket: 'workspace', max: 60 });
    return c.json(await service.post(identity, action, await c.req.json()));
  } catch(error) {
    if (error instanceof WorkspaceError) return c.json({error:error.message}, error.status as 400|401|403|404|409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return c.json({error:'请求内容无效 / Invalid request'},400);
    if (error && typeof error==='object' && 'code' in error && error.code==='23505') return c.json({error:'记录已存在，请打开原记录 / Record already exists'},409);
    if (error instanceof RateLimitError) return c.json({error:'请求过于频繁 / Too many requests'},429);
    console.error('[workspace]', error instanceof Error ? error.name : 'Unavailable');
    return c.json({error:'工作台服务暂不可用 / Workspace unavailable'},503);
  }
});
