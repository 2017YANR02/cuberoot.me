import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readNativeTimerReplay } from '../src/lib/native-timer-replay';

const { request, decode } = vi.hoisted(() => ({
  request: vi.fn(),
  decode: vi.fn((value: string) => Uint8Array.from(Buffer.from(value, 'base64')).buffer),
}));
vi.mock('../src/lib/native-timer-network', () => ({ nativeTimerFetch: request }));
vi.mock('../src/lib/platform', () => ({ miniProgramApi: () => ({ base64ToArrayBuffer: decode }) }));

describe('native timer replay', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('opens a full URL with native decoding and no browser URL or base64 globals', async () => {
    vi.stubGlobal('URL', undefined);
    vi.stubGlobal('atob', undefined);
    const replay = Buffer.from(JSON.stringify({
      e: '333', s: 'R', m: [["R'", 35]], t: 620, d: ['gan', '魔方'],
    })).toString('base64url');
    const solve = await readNativeTimerReplay(
      `https://cuberoot.me/zh/timer?replay=${replay}#shared`, [], new AbortController().signal,
    );
    expect(solve).toMatchObject({ event: '333', scramble: 'R', moves: [{ m: "R'", ts: 35 }], device: { name: '魔方' } });
    expect(decode).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  });

  it('uses the configured API for short shares and keeps the read ephemeral', async () => {
    request.mockResolvedValue({ ok: true, status: 200, json: async () => ({
      solve: { id: 'remote', event: '333', timeMs: 620, penalty: 'ok', scramble: 'R', ts: 1, moves: [{ m: "R'", ts: 35 }] },
    }) });
    const candidates = Object.freeze([]);
    const controller = new AbortController();
    await expect(readNativeTimerReplay('https://example.org/?share=share_123', candidates, controller.signal))
      .resolves.toMatchObject({ id: 'remote' });
    expect(request).toHaveBeenCalledWith('/v1/timer/replay-shares/share_123', expect.objectContaining({ signal: controller.signal }));
    expect(candidates).toEqual([]);
  });
});
