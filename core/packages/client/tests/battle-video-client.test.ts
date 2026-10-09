import { describe, expect, it, vi } from 'vitest';
import { createBattleVideoClient, VideoDeniedError } from '@cuberoot/shared/video';

describe('battle video capability transport', () => {
  it('keeps capability in the header and propagates cancellation while consuming the response', async () => {
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return { ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }) } as Response;
    });
    const client = createBattleVideoClient({ apiUrl: path => `https://api.test${path}`, fetcher });
    const pending = client.getToken('1234', 'player', 'private-capability', controller.signal);
    await Promise.resolve();
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ 'Content-Type': 'application/json', 'X-Battle-Token': 'private-capability' });
    expect(fetcher.mock.calls[0][1]?.body).toBe('{"code":"1234","pid":"player"}');
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(signal?.aborted).toBe(true);
  });

  it('rejects malformed tokens and reports a non-JSON unauthorized response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ token: 'x', url: 'https://untrusted.test' }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));
    const client = createBattleVideoClient({ apiUrl: path => path, fetcher });
    await expect(client.getToken('1234', 'player', 'cap')).rejects.toEqual(new VideoDeniedError('unavailable'));
    await expect(client.getToken('1234', 'player', 'cap')).rejects.toEqual(new VideoDeniedError('auth'));
  });
});
