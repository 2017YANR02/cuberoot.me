import { describe, it, expect, vi, afterEach } from 'vitest';
import { cloudOptimalScramble, firstBadHtmToken } from '@/lib/cloud-optimal-scramble';
import { CloudOptimalScrambleHttpError } from '@cuberoot/shared/timer';
import { useAuthStore } from '@/lib/auth-store';

const realLogout = useAuthStore.getState().logout;

function sseResponse(events: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const ev of events) controller.enqueue(enc.encode(ev));
      controller.close();
    },
  });
  return new Response(body, { status });
}

function memoryStorage(entries: Record<string, string>): Storage {
  const values = new Map(Object.entries(entries));
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('cloudOptimalScramble', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useAuthStore.setState({ logout: realLogout });
  });

  it('inverts the returned optimal solution into a scramble, reporting phases', async () => {
    const events = [
      'event:solving\ndata:{"i":0}\n\n',
      `data:${JSON.stringify({ i: 0, htm: 4, solution: "R U R' U'" })}\n\n`,
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)));
    const phases: string[] = [];
    const result = await cloudOptimalScramble('U R2 F', (p) => phases.push(p.phase));
    expect(result.scramble).toBe("U R U' R'");
    expect(result.moves).toBe(4);
    expect(phases).toEqual(['solving']);
  });

  it('reports queued phase with the ahead count', async () => {
    const events = [
      'event:queued\ndata:{"i":0,"ahead":2}\n\n',
      `data:${JSON.stringify({ i: 0, htm: 0, solution: '' })}\n\n`,
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)));
    const phases: import('@/lib/cloud-optimal-scramble').CloudOptimalScramblePhase[] = [];
    await cloudOptimalScramble('U', (p) => phases.push(p));
    expect(phases).toEqual([{ phase: 'queued', ahead: 2 }]);
  });

  it('reuses the shared 3x3 converter before posting non-HTM input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      `data:${JSON.stringify({ i: 0, htm: 1, solution: 'U' })}\n\n`,
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await cloudOptimalScramble("r U r' M");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { scrambles: string[] };
    expect(firstBadHtmToken(body.scrambles[0]!)).toBeNull();
  });

  it('throws on a solve error event', async () => {
    const events = ['event:error\ndata:{"i":0,"error":"boom"}\n\n'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)));
    await expect(cloudOptimalScramble('U')).rejects.toThrow('boom');
  });

  it('throws on a non-ok HTTP response (e.g. 401 not logged in)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    ));
    await expect(cloudOptimalScramble('U')).rejects.toMatchObject({
      message: 'Unauthorized',
      name: CloudOptimalScrambleHttpError.name,
      status: 401,
    });
  });

  it('logs out only the web session whose token received 401', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage({ cuberoot_jwt: 'expired' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    ));
    const logout = vi.fn();
    useAuthStore.setState({ logout });
    await expect(cloudOptimalScramble('U')).rejects.toThrow('Unauthorized');
    expect(logout).toHaveBeenCalledOnce();
  });

  it('does not let a stale 401 log out a newer web session', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage({ cuberoot_jwt: 'old' }));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      localStorage.setItem('cuberoot_jwt', 'new');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }));
    const logout = vi.fn();
    useAuthStore.setState({ logout });
    await expect(cloudOptimalScramble('U')).rejects.toThrow('Unauthorized');
    expect(logout).not.toHaveBeenCalled();
  });

  it('throws if the stream ends without a solution or error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(['event:ping\ndata:\n\n'])));
    await expect(cloudOptimalScramble('U')).rejects.toThrow('stream ended without a solution');
  });

  it('does not fetch after cancellation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(cloudOptimalScramble('U', undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('firstBadHtmToken', () => {
  it('accepts plain HTM face turns', () => {
    expect(firstBadHtmToken("U R2 F' D L B2")).toBeNull();
  });

  it('flags wide / slice / rotation tokens', () => {
    expect(firstBadHtmToken('Rw U M')).toBe('Rw');
    expect(firstBadHtmToken('U x R')).toBe('x');
  });
});
