import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ChatError, CHAT_HTTP_BODY_LIMIT } from '@cuberoot/shared/chat';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { checkRateLimit } from '../utils/recon_helpers.js';
import { chatRepository } from '../utils/chat_repository.js';

export const chatRoutes = new Hono<{ Variables: { chatUserId: number } }>();
chatRoutes.use('/chat/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireAppUserId(c);
  c.set('chatUserId', uid);
  try { checkRateLimit(String(uid), { bucket: c.req.method === 'POST' ? 'chat-send' : 'chat-read', max: 120 }); }
  catch { throw new ChatError('RATE_LIMITED', 60_000); }
  await next();
});
chatRoutes.use('/chat/*', bodyLimit({ maxSize: CHAT_HTTP_BODY_LIMIT,
  onError: (c) => c.json({ error: { code: 'BODY_TOO_LARGE', message: 'BODY_TOO_LARGE' } }, 413) }));
chatRoutes.onError((error, c) => {
  c.header('Cache-Control', 'no-store');
  const failure = error instanceof ChatError ? error
    : error.name === 'BodyLimitError' ? new ChatError('BODY_TOO_LARGE')
    : error.message.includes('Authentication required') ? new ChatError('UNAUTHENTICATED') : new ChatError('INTERNAL_ERROR');
  const statuses = { UNAUTHENTICATED: 401, CHAT_NOT_FOUND: 404, CHAT_UNAVAILABLE: 403, INVALID_INPUT: 400,
    IDEMPOTENCY_CONFLICT: 409, BODY_TOO_LARGE: 413, RATE_LIMITED: 429, INTERNAL_ERROR: 500, NETWORK_ERROR: 500, INVALID_RESPONSE: 500 } as const;
  if (failure.code === 'RATE_LIMITED') c.header('Retry-After', String(Math.ceil(failure.retryAfterMs / 1000) || 60));
  if (failure.code === 'INTERNAL_ERROR') console.error('[chat] request failed');
  return c.json({ error: { code: failure.code, message: failure.code } }, statuses[failure.code]);
});
chatRoutes.get('/chat/conversations', async (c) => c.json(await chatRepository.conversations(
  c.get('chatUserId'), c.req.query('cursor'), c.req.query('limit') === undefined ? 30 : Number(c.req.query('limit')))));
chatRoutes.get('/chat/peers/:peer/messages', async (c) => c.json(await chatRepository.messages(c.get('chatUserId'), Number(c.req.param('peer')), {
  before: c.req.query('before'), after: c.req.query('after'), limit: c.req.query('limit') === undefined ? 50 : Number(c.req.query('limit')),
})));
chatRoutes.post('/chat/peers/:peer/messages', async (c) => {
  const body = await c.req.json().catch((error: unknown) => { if (error instanceof SyntaxError) throw new ChatError('INVALID_INPUT'); throw error; });
  if (!body || typeof body !== 'object') throw new ChatError('INVALID_INPUT');
  const result = await chatRepository.send(c.get('chatUserId'), Number(c.req.param('peer')), body);
  return c.json({ message: result.message }, result.replay ? 200 : 201);
});
chatRoutes.put('/chat/peers/:peer/read', async (c) => {
  const body = await c.req.json().catch((error: unknown) => { if (error instanceof SyntaxError) throw new ChatError('INVALID_INPUT'); throw error; });
  return c.json(await chatRepository.read(c.get('chatUserId'), Number(c.req.param('peer')), body?.throughSequence));
});
