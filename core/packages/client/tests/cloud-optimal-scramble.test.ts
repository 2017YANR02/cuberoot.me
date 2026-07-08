import { describe, it, expect, vi, afterEach } from 'vitest';
import { cloudOptimalScramble, firstBadHtmToken } from '@/lib/cloud-optimal-scramble';

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

describe('cloudOptimalScramble', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('throws on a solve error event', async () => {
    const events = ['event:error\ndata:{"i":0,"error":"boom"}\n\n'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)));
    await expect(cloudOptimalScramble('U')).rejects.toThrow('boom');
  });

  it('throws on a non-ok HTTP response (e.g. 401 not logged in)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    ));
    await expect(cloudOptimalScramble('U')).rejects.toThrow('Unauthorized');
  });

  it('throws if the stream ends without a solution or error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(['event:ping\ndata:\n\n'])));
    await expect(cloudOptimalScramble('U')).rejects.toThrow('stream ended without a solution');
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
