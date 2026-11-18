import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
import { createAssistantSpeechRoutes } from '../src/routes/site_assistant_speech.js';
import { createSpeechSynthesizer, speechChunks, speechConfig } from '../src/utils/site_assistant_speech.js';
const run = vi.fn(), authenticate = vi.fn(), synthesize = vi.fn();
const app = createAssistantSpeechRoutes({ run, authenticate, synthesize });
const body = { messageId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', answer: 'Hello.', lang: 'en', chunk: 0 };
const post = (value = body) => app.request('/site-assistant/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); authenticate.mockResolvedValue({ uid: 7 }); run.mockResolvedValue([{ answer: { answer: 'Hello.', sources: [] } }]); synthesize.mockResolvedValue(Buffer.from('audio')); });
afterEach(() => vi.unstubAllEnvs());
it('authenticates and scopes completed answers before spending on speech', async () => {
  authenticate.mockRejectedValueOnce(new Error());
  expect((await post()).status).toBe(401); expect(run).not.toHaveBeenCalled();
  run.mockResolvedValueOnce([]);
  expect((await post()).status).toBe(404); expect(synthesize).not.toHaveBeenCalled();
  expect(run).toHaveBeenCalledWith(expect.stringContaining("c.user_id=? AND m.state='completed'"), [body.messageId, 7]);
});
it('rejects changed answers and invalid chunks then returns private audio', async () => {
  expect((await post({ ...body, answer: 'Read arbitrary text' })).status).toBe(409);
  expect((await post({ ...body, chunk: 99 })).status).toBe(400);
  expect(synthesize).not.toHaveBeenCalled();
  const response = await post();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ audio: Buffer.from('audio').toString('base64'), total: 1 });
});
it('preserves all text while bounding chunks and total work', () => {
  const text = '😀你好，hello. '.repeat(100);
  expect(speechChunks(text).join('')).toBe(text);
  expect(speechChunks(text).every(chunk => [...chunk].length <= 501)).toBe(true);
  expect(() => speechChunks('x'.repeat(30_001))).toThrow();
});
function enabled() {
  vi.stubEnv('SITE_ASSISTANT_TTS_ENABLED', '1'); vi.stubEnv('SITE_ASSISTANT_TTS_API_KEY', 'test-key');
  vi.stubEnv('SITE_ASSISTANT_TTS_BASE_URL', 'https://ws-test.cn-beijing.maas.aliyuncs.com');
}
it('requires opt-in and rejects untrusted origins', () => {
  vi.stubEnv('SITE_ASSISTANT_TTS_ENABLED', '0'); expect(speechConfig()).toBeNull();
  enabled(); vi.stubEnv('SITE_ASSISTANT_TTS_BASE_URL', 'https://example.com'); expect(speechConfig()).toBeNull();
});
it('reuses audio only within account and voice/text identity', async () => {
  enabled();
  const fetcher = vi.fn().mockImplementation(async (url: string | URL) => String(url).includes('SpeechSynthesizer') ? Response.json({ output: { audio: { url: 'https://result.oss-cn-beijing.aliyuncs.com/audio.mp3' } } }) : new Response('audio'));
  const speak = createSpeechSynthesizer(fetcher), signal = new AbortController().signal;
  await speak(1, 'Hello', 'en', signal); await speak(1, 'Hello', 'en', signal);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await speak(2, 'Hello', 'en', signal); expect(fetcher).toHaveBeenCalledTimes(4);
  vi.stubEnv('SITE_ASSISTANT_TTS_VOICE', 'another'); await speak(1, 'Hello', 'en', signal); expect(fetcher).toHaveBeenCalledTimes(6);
});
it('rejects provider URLs to private hosts without fetching them', async () => {
  enabled();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ output: { audio: { url: 'http://127.0.0.1/private' } } }));
  await expect(createSpeechSynthesizer(fetcher)(1, 'Hello', 'en', new AbortController().signal)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('bounds concurrent calls and forwards cancellation', async () => {
  enabled();
  const fetcher = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const speak = createSpeechSynthesizer(fetcher), controller = new AbortController();
  const first = speak(1, 'Hello', 'en', controller.signal);
  await expect(speak(1, 'Another', 'en', controller.signal)).rejects.toThrow('speech_limit');
  controller.abort(); await expect(first).rejects.toThrow('aborted');
});
