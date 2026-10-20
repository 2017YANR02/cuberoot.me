import { describe, expect, it, vi } from 'vitest';
import { resolveGroundTruthReplay } from '@/lib/recon-ground-truth-api';
import { encodeReplayPayload } from '@cuberoot/shared/timer/replay-encode';
import { decodeReplayParam } from '@cuberoot/shared/timer/replay-decode';
import type { Solve } from '@cuberoot/shared/timer';
const fetcher = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: fetcher }));
const solve: Solve = { id: 'test', event: '333', scramble: "R U R'", timeMs: 1500,
  penalty: 'ok', ts: 0, moves: [{ m: 'R', ts: 0 }, { m: "U'", ts: 500 }, { m: "R'", ts: 1000 }] };

describe('ground-truth replay input', () => {
  it('explains missing or malformed recordings instead of synthesizing one', async () => {
    await expect(resolveGroundTruthReplay('')).rejects.toThrow('replay_required');
    await expect(resolveGroundTruthReplay('not a replay')).rejects.toThrow('replay_malformed');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves valid replay tokens exactly', async () => {
    const token = encodeReplayPayload(solve);
    expect(await resolveGroundTruthReplay(token)).toBe(token);
    expect(await resolveGroundTruthReplay('https://cuberoot.me/timer?replay=' + token)).toBe(token);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('resolves a share through the configured API, never the pasted host', async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ solve }), { status: 200 }));
    const result = await resolveGroundTruthReplay('https://untrusted.example/timer?share=oPAYPI4Qe-I');
    expect(fetcher.mock.calls[0][0]).toContain('/v1/timer/replay-shares/oPAYPI4Qe-I');
    expect(fetcher.mock.calls[0][0]).not.toContain('untrusted.example');
    expect(decodeReplayParam(result)?.moves).toEqual(solve.moves);
    fetcher.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(resolveGroundTruthReplay('?share=oPAYPI4Qe-I')).rejects.toThrow('replay_malformed');
  });
});
