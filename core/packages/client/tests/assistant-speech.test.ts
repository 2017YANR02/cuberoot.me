// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({ Authorization: 'Bearer fixture' }) }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: vi.fn() }));
import { sessionFetch } from '@/lib/session-fetch';
import { playAssistantSpeech } from '@/lib/assistant-speech';
const input = { requestId: 'fixture', answer: 'hello', lang: 'en' as const };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.mocked(sessionFetch).mockReset(); });
function audioFixture() {
  const audio = { src: '', onended: null as null | (() => void), onerror: null as null | (() => void), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), play: vi.fn(async () => {}) };
  vi.stubGlobal('Audio', class { constructor() { return audio; } });
  URL.createObjectURL = vi.fn(() => 'blob:fixture'); URL.revokeObjectURL = vi.fn();
  return audio;
}
it('plays segments in order and releases every audio URL', async () => {
  const audio = audioFixture(), playing = vi.fn();
  audio.play.mockImplementation(async () => { queueMicrotask(() => audio.onended?.()); });
  vi.mocked(sessionFetch).mockImplementation(async () => Response.json({ audio: btoa('audio'), total: 2 }));
  await playAssistantSpeech(input, new AbortController().signal, playing);
  expect(vi.mocked(sessionFetch).mock.calls.map(call => JSON.parse(call[1]!.body as string).chunk)).toEqual([0, 1]);
  expect(playing).toHaveBeenCalledTimes(2); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it('stops playback and never fetches the next segment after cancellation', async () => {
  const audio = audioFixture(), controller = new AbortController();
  vi.mocked(sessionFetch).mockResolvedValue(Response.json({ audio: btoa('audio'), total: 2 }));
  const playback = playAssistantSpeech(input, controller.signal, () => controller.abort());
  await expect(playback).rejects.toThrow();
  expect(sessionFetch).toHaveBeenCalledTimes(1); expect(audio.pause).toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});
it('surfaces browser playback rejection for the explicit fallback', async () => {
  const audio = audioFixture(); audio.play.mockRejectedValue(new Error('NotAllowedError'));
  vi.mocked(sessionFetch).mockResolvedValue(Response.json({ audio: btoa('audio'), total: 1 }));
  await expect(playAssistantSpeech(input, new AbortController().signal, vi.fn())).rejects.toThrow('NotAllowedError');
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});
it('plays standard Bailian WAV with the matching Blob type', async () => {
  const audio = audioFixture();
  audio.play.mockImplementation(async () => { queueMicrotask(() => audio.onended?.()); });
  vi.mocked(sessionFetch).mockResolvedValue(Response.json({ audio: btoa('RIFF1234WAVEaudio'), mime: 'audio/wav', total: 1 }));
  await playAssistantSpeech(input, new AbortController().signal, vi.fn());
  expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toHaveProperty('type', 'audio/wav');
});
it('rejects unsupported response formats before creating audio URLs', async () => {
  audioFixture();
  vi.mocked(sessionFetch).mockResolvedValue(Response.json({ audio: btoa('audio'), mime: 'text/html', total: 1 }));
  await expect(playAssistantSpeech(input, new AbortController().signal, vi.fn())).rejects.toThrow('invalid_audio');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('prefetches only one segment during playback and aborts it on stop', async () => {
  const audio = audioFixture(), controller = new AbortController();
  let prefetchSignal: AbortSignal | undefined;
  vi.mocked(sessionFetch).mockResolvedValueOnce(Response.json({ audio: btoa('audio'), total: 3 })).mockImplementationOnce(async (_url, init) => {
    prefetchSignal = init?.signal as AbortSignal;
    return new Promise((_resolve, reject) => prefetchSignal!.addEventListener('abort', () => reject(prefetchSignal!.reason)));
  });
  const playback = playAssistantSpeech(input, controller.signal, vi.fn());
  await vi.waitFor(() => expect(sessionFetch).toHaveBeenCalledTimes(2));
  expect(audio.play).toHaveBeenCalledOnce();
  controller.abort();
  await expect(playback).rejects.toThrow();
  expect(prefetchSignal?.aborted).toBe(true);
  expect(sessionFetch).toHaveBeenCalledTimes(2);
});
it('finishes the current segment before reporting a prefetch failure', async () => {
  const audio = audioFixture();
  vi.mocked(sessionFetch).mockResolvedValueOnce(Response.json({ audio: btoa('audio'), total: 2 })).mockRejectedValueOnce(new Error('network failed'));
  let finished = false;
  const playback = playAssistantSpeech(input, new AbortController().signal, vi.fn());
  const outcome = playback.catch(error => { finished = true; return error; });
  await vi.waitFor(() => expect(sessionFetch).toHaveBeenCalledTimes(2));
  expect(finished).toBe(false);
  audio.onended?.();
  expect(await outcome).toHaveProperty('message', 'network failed');
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});
function streamFixture(audio: ReturnType<typeof audioFixture>) {
  const appended: Uint8Array[] = [];
  class BufferFixture extends EventTarget {
    appendBuffer(bytes: Uint8Array) { appended.push(bytes); queueMicrotask(() => this.dispatchEvent(new Event('updateend'))); }
  }
  class SourceFixture extends EventTarget {
    static isTypeSupported = () => true;
    addSourceBuffer = () => new BufferFixture();
    endOfStream = vi.fn(() => queueMicrotask(() => audio.onended?.()));
  }
  vi.stubGlobal('MediaSource', SourceFixture);
  URL.createObjectURL = vi.fn(source => { if (source instanceof SourceFixture) queueMicrotask(() => source.dispatchEvent(new Event('sourceopen'))); return 'blob:stream'; });
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const response = new Response(new ReadableStream<Uint8Array>({ start(c) { stream = c; }, cancel }), { headers: { 'Content-Type': 'text/event-stream' } });
  const send = (frame: object) => stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`));
  return { response, send, appended, close: () => stream.close(), cancel };
}
it('starts playback before the audio stream completes, then appends later frames in order', async () => {
  const audio = audioFixture(), fixture = streamFixture(audio), playing = vi.fn();
  vi.mocked(sessionFetch).mockResolvedValue(fixture.response);
  const playback = playAssistantSpeech(input, new AbortController().signal, playing);
  fixture.send({ type: 'meta', mime: 'audio/mpeg', total: 1 });
  fixture.send({ type: 'audio', audio: btoa('first') });
  await vi.waitFor(() => expect(playing).toHaveBeenCalledOnce());
  expect(JSON.parse(vi.mocked(sessionFetch).mock.calls[0][1]!.body as string).stream).toBe(true);
  fixture.send({ type: 'audio', audio: btoa('second') }); fixture.send({ type: 'done' }); fixture.close();
  await playback;
  expect(fixture.appended.map(bytes => new TextDecoder().decode(bytes))).toEqual(['first', 'second']);
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});
it('does not prefetch while the provider is generating and stops without further playback', async () => {
  const audio = audioFixture(), fixture = streamFixture(audio), controller = new AbortController(), playing = vi.fn();
  vi.mocked(sessionFetch).mockResolvedValue(fixture.response);
  const playback = playAssistantSpeech(input, controller.signal, playing);
  fixture.send({ type: 'meta', mime: 'audio/mpeg', total: 2 }); fixture.send({ type: 'audio', audio: btoa('first') });
  await vi.waitFor(() => expect(playing).toHaveBeenCalledOnce());
  expect(sessionFetch).toHaveBeenCalledOnce();
  controller.abort(); fixture.close();
  await expect(playback).rejects.toThrow();
  expect(audio.pause).toHaveBeenCalled(); expect(sessionFetch).toHaveBeenCalledOnce();
});
it.each(['truncated', 'error'])('stops a %s stream without silently retrying or generating the next segment', async failure => {
  const audio = audioFixture(), fixture = streamFixture(audio);
  vi.mocked(sessionFetch).mockResolvedValue(fixture.response);
  const playback = playAssistantSpeech(input, new AbortController().signal, vi.fn());
  fixture.send({ type: 'meta', mime: 'audio/mpeg', total: 2 }); fixture.send({ type: 'audio', audio: btoa('first') });
  if (failure === 'error') fixture.send({ type: 'error', error: 'speech_unavailable' });
  fixture.close();
  await expect(playback).rejects.toThrow(failure === 'error' ? 'speech_unavailable' : 'speech_incomplete');
  expect(sessionFetch).toHaveBeenCalledOnce(); expect(audio.pause).toHaveBeenCalled();
});
