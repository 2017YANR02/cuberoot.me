import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { assistantAnswerText, assistantSpokenText, type AssistantAnswer } from '@cuberoot/shared/site-assistant';
import { query, type QueryRunner } from '../db/connection.js';
import { checkRateLimit, RateLimitError } from '../utils/rate_limit.js';
import { speechChunks, synthesizeAssistantSpeech } from '../utils/site_assistant_speech.js';

const input = z.object({ messageId: z.string().uuid().optional(), requestId: z.string().uuid().optional(), answer: z.string().max(50_000), chunk: z.number().int().min(0).max(100), lang: z.enum(['zh', 'en']) }).strict().refine(v => !!v.messageId || !!v.requestId);
export function createAssistantSpeechRoutes(deps: { authenticate: (c: Context) => Promise<{ uid: number }>; run?: QueryRunner; synthesize?: typeof synthesizeAssistantSpeech }) {
  const routes = new Hono(), run = deps.run ?? query, synthesize = deps.synthesize ?? synthesizeAssistantSpeech;
  routes.use('/site-assistant/speech', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });
  routes.use('/site-assistant/speech', bodyLimit({ maxSize: 320_000 }));
  routes.post('/site-assistant/speech', async c => {
    let user;
    try { user = await deps.authenticate(c); } catch { return c.json({ error: 'login_required' }, 401); }
    const parsed = input.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_speech' }, 400);
    const data = parsed.data;
    try {
      checkRateLimit(String(user.uid), { bucket: 'assistant-speech', max: 30 });
      const rows = data.messageId
        ? await run<{ answer: AssistantAnswer }>(`SELECT m.answer FROM site_assistant_messages m JOIN site_assistant_conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=? AND m.state='completed'`, [data.messageId, user.uid])
        : await run<{ answer: AssistantAnswer }>(`SELECT response || jsonb_build_object('answer',answer) AS answer FROM site_assistant_requests WHERE id=? AND user_id=? AND status='success'`, [data.requestId!, user.uid]);
      const answer = rows[0]?.answer;
      if (!answer || !Array.isArray(answer.sources)) return c.json({ error: 'not_found' }, 404);
      const text = assistantSpokenText(assistantAnswerText(answer, 'https://cuberoot.me'));
      if (text !== data.answer) return c.json({ error: 'answer_changed' }, 409);
      const chunks = speechChunks(text);
      if (!chunks[data.chunk]) return c.json({ error: 'invalid_speech' }, 400);
      const audio = await synthesize(user.uid, chunks[data.chunk], data.lang, c.req.raw.signal);
      return c.json({ audio: audio.toString('base64'), total: chunks.length });
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof Error && error.message === 'speech_limit') return c.json({ error: 'speech_limit' }, 429);
      return c.json({ error: 'speech_unavailable' }, 503);
    }
  });
  return routes;
}
