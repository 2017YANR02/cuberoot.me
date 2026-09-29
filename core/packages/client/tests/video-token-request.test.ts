import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMeetToken, VideoDeniedError } from '@/lib/video-room-api';

vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => 'test-session' }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function pendingRequest() {
  vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
    const signal = init.signal!;
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  })));
}

describe('meeting token request lifecycle', () => {
  it('aborts the network request when the user cancels', async () => {
    pendingRequest();
    const controller = new AbortController();
    const result = getMeetToken('7576', controller.signal);
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
  });

  it('bounds a stalled request to 20 seconds and preserves the timeout reason', async () => {
    pendingRequest();
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const assertion = expect(getMeetToken('7576')).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(timeout).toHaveBeenCalledWith(20_000);
    deadline.abort(new DOMException('Timed out', 'TimeoutError'));
    await assertion;
  });

  it('can retry after cancellation without reusing the aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    pendingRequest();
    await expect(getMeetToken('7576', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => {
      expect(init.signal!.aborted).toBe(false);
      return Response.json({ room: 'meet-7576' });
    }));
    await expect(getMeetToken('7576')).resolves.toEqual({ room: 'meet-7576' });
  });

  it('keeps service rejection distinct from a client timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'unavailable' }, { status: 503 })));
    await expect(getMeetToken('7576')).rejects.toEqual(new VideoDeniedError('unavailable'));
  });
});
