import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
import { createAssistantSpeechRoutes } from '../src/routes/site_assistant_speech.js';
import { createSpeechSynthesizer, speechAudioType, speechChunks, speechConfig } from '../src/utils/site_assistant_speech.js';
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
  expect(await response.json()).toEqual({ audio: Buffer.from('audio').toString('base64'), mime: 'audio/mpeg', total: 1 });
});
it('preserves all text while bounding chunks and total work', () => {
  const text = '😀你好，hello. '.repeat(100);
  expect(speechChunks(text).join('')).toBe(text);
  expect([...speechChunks(text)[0]].length).toBeLessThanOrEqual(80);
  expect([...speechChunks(text)[1]].length).toBeLessThanOrEqual(160);
  expect(speechChunks(text).every(chunk => [...chunk].length <= 320)).toBe(true);
  expect(speechChunks('x'.repeat(30_000))).toHaveLength(95);
  expect(speechChunks('你好。短回答。')).toEqual(['你好。短回答。']);
  expect(speechChunks('甲'.repeat(21) + '。' + '乙'.repeat(500))[0]).toBe('甲'.repeat(21) + '。');
  expect(() => speechChunks('x'.repeat(30_001))).toThrow();
});
function enabled() {
  vi.stubEnv('SITE_ASSISTANT_TTS_ENABLED', '1'); vi.stubEnv('SITE_ASSISTANT_TTS_API_KEY', 'test-key');
  vi.stubEnv('SITE_ASSISTANT_TTS_BASE_URL', 'https://ws-test.cn-beijing.maas.aliyuncs.com');
}
it('reuses the existing Bailian chat key and Beijing workspace origin', () => {
  const existing = { SITE_ASSISTANT_TTS_ENABLED: '1', SITE_ASSISTANT_API_KEY: 'existing-key', SITE_ASSISTANT_BASE_URL: 'https://ws-test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' };
  expect(speechConfig(existing)).toMatchObject({ key: 'existing-key', origin: 'https://ws-test.cn-beijing.maas.aliyuncs.com' });
  expect(speechConfig({ ...existing, SITE_ASSISTANT_BASE_URL: 'https://api.deepseek.com' })).toBeNull();
  expect(speechConfig({ ...existing, SITE_ASSISTANT_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' })).toMatchObject({ key: 'existing-key', origin: 'https://dashscope.aliyuncs.com', model: 'qwen3-tts-flash', voice: 'Cherry' });
  expect(speechConfig({ ...existing, SITE_ASSISTANT_TTS_BASE_URL: 'invalid' })).toBeNull();
});
it('supports a standard DashScope key and preserves explicit TTS overrides', () => {
  const env = { SITE_ASSISTANT_TTS_ENABLED: '1', DASHSCOPE_API_KEY: 'standard-key' };
  expect(speechConfig(env)).toMatchObject({ key: 'standard-key', model: 'qwen3-tts-flash' });
  expect(speechConfig({ ...env, SITE_ASSISTANT_API_KEY: 'chat-key', SITE_ASSISTANT_TTS_API_KEY: 'speech-key', SITE_ASSISTANT_TTS_VOICE: 'Serena' })).toMatchObject({ key: 'speech-key', voice: 'Serena' });
  expect(speechConfig({ ...env, SITE_ASSISTANT_TTS_MODEL: 'qwen-audio-3.1-tts-flash' })).toBeNull();
});
it('uses the standard TTS protocol and downloads WAV over HTTPS without forwarding the key', async () => {
  enabled();
  vi.stubEnv('SITE_ASSISTANT_TTS_BASE_URL', 'https://dashscope.aliyuncs.com');
  const wav = Buffer.from('RIFF1234WAVEaudio');
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ output: { audio: { url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio.wav?signature=fixture' } } })).mockResolvedValueOnce(new Response(wav));
  const audio = await createSpeechSynthesizer(fetcher)(1, '你好，CubeRoot', 'zh', new AbortController().signal);
  expect(fetcher.mock.calls[0][0]).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ model: 'qwen3-tts-flash', input: { text: '你好，CubeRoot', voice: 'Cherry', language_type: 'Auto' } });
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key');
  expect(String(fetcher.mock.calls[1][0])).toBe('https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio.wav?signature=fixture');
  expect(fetcher.mock.calls[1][1].headers).toBeUndefined();
  expect(fetcher.mock.calls[1][1].redirect).toBe('error');
  expect(audio).toEqual(wav);
  expect(speechAudioType(audio)).toBe('audio/wav');
});
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
function audioEvent(data: string, finish: string | null = null) {
  return `data: ${JSON.stringify({ output: { audio: { data }, finish_reason: finish } })}\r\n\r\n`;
}
function sseResponse(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let index = 0; index < bytes.length; index += 17) controller.enqueue(bytes.slice(index, index + 17));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
it('assembles fragmented inline audio without an OSS download and caches the complete audio', async () => {
  enabled();
  const fetcher = vi.fn().mockImplementation(async () => sseResponse(audioEvent('SUQz') + audioEvent('YXVkaW8=') + audioEvent('', 'stop')));
  const speak = createSpeechSynthesizer(fetcher), signal = new AbortController().signal;
  expect(await speak(1, 'Hello', 'en', signal)).toEqual(Buffer.from('ID3audio'));
  expect(await speak(1, 'Hello', 'en', signal)).toEqual(Buffer.from('ID3audio'));
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][1].headers['X-DashScope-SSE']).toBe('enable');
});
it.each([
  audioEvent('YXVkaW8='),
  audioEvent('', 'stop'),
  audioEvent('%%%=', 'stop'),
  audioEvent('YXVkaW8=') + 'data: {"code":"ProviderError"}\n\n',
])('rejects failed or incomplete inline audio without caching partial results', async text => {
  enabled();
  const fetcher = vi.fn().mockImplementation(async () => sseResponse(text));
  const speak = createSpeechSynthesizer(fetcher), signal = new AbortController().signal;
  await expect(speak(1, 'Hello', 'en', signal)).rejects.toThrow();
  await expect(speak(1, 'Hello', 'en', signal)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects oversized decoded inline audio', async () => {
  enabled();
  const data = audioEvent(Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64'), 'stop');
  const fetcher = vi.fn().mockResolvedValue(new Response(data, { headers: { 'Content-Type': 'text/event-stream' } }));
  await expect(createSpeechSynthesizer(fetcher)(1, 'Hello', 'en', new AbortController().signal)).rejects.toThrow('speech_too_large');
});
it('delivers inline audio before synthesis ends and caches only the finished result', async () => {
  enabled();
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(c) { upstream = c; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  const fetcher = vi.fn().mockResolvedValue(response), delivered = vi.fn(async () => {});
  const speak = createSpeechSynthesizer(fetcher), signal = new AbortController().signal;
  let finished = false;
  const pending = speak(42, 'Streaming', 'en', signal, delivered).then(audio => { finished = true; return audio; });
  upstream.enqueue(new TextEncoder().encode(audioEvent('SUQz')));
  await vi.waitFor(() => expect(delivered).toHaveBeenCalledWith(Buffer.from('ID3')));
  expect(finished).toBe(false);
  upstream.enqueue(new TextEncoder().encode(audioEvent('YXVkaW8=', 'stop'))); upstream.close();
  expect(await pending).toEqual(Buffer.from('ID3audio'));
  delivered.mockClear();
  await speak(42, 'Streaming', 'en', signal, delivered);
  expect(delivered).toHaveBeenCalledWith(Buffer.from('ID3audio'));
  expect(fetcher).toHaveBeenCalledOnce();
});
it('streams authenticated audio privately and marks partial failures explicitly', async () => {
  enabled();
  synthesize.mockImplementationOnce(async (_uid, _text, _lang, _signal, send) => { await send(Buffer.from('ID3')); throw new Error('upstream failed'); });
  const response = await post({ ...body, stream: true } as typeof body);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const frames = (await response.text()).split('\n\n').filter(Boolean).map(line => JSON.parse(line.slice(6)));
  expect(frames).toEqual([{ type: 'meta', mime: 'audio/mpeg', total: 1 }, { type: 'audio', audio: 'SUQz' }, { type: 'error', error: 'speech_unavailable' }]);
});
it('cancels upstream synthesis when the downstream stream is closed', async () => {
  enabled();
  let upstreamSignal: AbortSignal | undefined;
  synthesize.mockImplementationOnce(async (_uid, _text, _lang, signal) => { upstreamSignal = signal; await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))); });
  const response = await post({ ...body, stream: true } as typeof body);
  const reader = response.body!.getReader(); await reader.read();
  await vi.waitFor(() => expect(upstreamSignal).toBeDefined());
  await reader.cancel();
  await vi.waitFor(() => expect(upstreamSignal!.aborted).toBe(true));
});
it('uses the complete WAV response for the standard model even when streaming is requested', async () => {
  enabled(); vi.stubEnv('SITE_ASSISTANT_TTS_BASE_URL', 'https://dashscope.aliyuncs.com');
  const response = await post({ ...body, stream: true } as typeof body);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect((await response.json()).total).toBe(1);
});
it('lists only model-compatible voices privately and authenticates the options endpoint', async () => {
  enabled();
  const response = await app.request('/site-assistant/speech/options');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).voices.map((voice: { id: string }) => voice.id)).toEqual(['longanhuan_v3.1', 'longanlingxin_v3.1', 'longanfengyue_v3.1', 'xunanchuan_v3.1']);
  authenticate.mockRejectedValueOnce(new Error());
  expect((await app.request('/site-assistant/speech/options')).status).toBe(401);
  vi.stubEnv('SITE_ASSISTANT_TTS_BASE_URL', 'https://dashscope.aliyuncs.com');
  expect((await (await app.request('/site-assistant/speech/options')).json()).voices.map((voice: { id: string }) => voice.id)).toEqual(['Cherry', 'Serena', 'Ethan']);
});
it('rejects unsupported voice IDs before synthesis and passes the selected voice through both transports', async () => {
  enabled();
  expect((await post({ ...body, voice: 'Cherry' } as typeof body)).status).toBe(400);
  expect(synthesize).not.toHaveBeenCalled();
  await post({ ...body, voice: 'xunanchuan_v3.1' } as typeof body);
  expect(synthesize.mock.calls[0][5]).toEqual({ voice: 'xunanchuan_v3.1' });
  synthesize.mockImplementationOnce(async (_uid, _text, _lang, _signal, send) => { await send(Buffer.from('ID3')); return Buffer.from('ID3'); });
  const response = await post({ ...body, stream: true, voice: 'longanlingxin_v3.1' } as typeof body);
  expect(await response.text()).toContain('"type":"done"');
  expect(synthesize.mock.calls[1][5]).toEqual({ voice: 'longanlingxin_v3.1' });
});
it('uses the chosen provider voice and separates its audio cache from the default voice', async () => {
  enabled();
  const fetcher = vi.fn().mockImplementation(async () => sseResponse(audioEvent('SUQz', 'stop')));
  const speak = createSpeechSynthesizer(fetcher), signal = new AbortController().signal;
  await speak(61, 'Hello', 'en', signal);
  await speak(61, 'Hello', 'en', signal, undefined, { voice: 'xunanchuan_v3.1' });
  await speak(61, 'Hello', 'en', signal, undefined, { voice: 'xunanchuan_v3.1' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).input.voice).toBe('xunanchuan_v3.1');
  await expect(speak(61, 'Hello', 'en', signal, undefined, { voice: 'invalid' })).rejects.toThrow('invalid_voice');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
