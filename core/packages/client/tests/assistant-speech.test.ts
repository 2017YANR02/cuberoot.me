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
