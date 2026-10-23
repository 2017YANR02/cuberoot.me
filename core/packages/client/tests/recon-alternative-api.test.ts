import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: request }));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => 'test-session', getWcaToken: () => '', getWcaId: () => '' }));
import { deleteAlternative, deleteRecon, updateAlternative } from '@/lib/recon-api';

describe('recon alternative optimistic concurrency', () => {
  const expected = { solution: "R U R'\n// original whitespace  ", addedById: '2017TEST01', createdAt: 1792713600000 };
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue(new Response(JSON.stringify({ alternatives: [] }), { status: 200 }));
  });

  it('sends the original raw alternative beside the edited solution', async () => {
    await updateAlternative(12, 1, "R U2 R'", expected);
    const [url, options] = request.mock.calls[0];
    expect(url).toMatch(/\/recon\/12\/alternatives\/1$/);
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(String(options?.body))).toEqual({ solution: "R U2 R'", expected });
  });

  it('includes a JSON version on DELETE so a shifted index cannot delete a different alternative', async () => {
    await deleteAlternative(12, 1, expected);
    const [, options] = request.mock.calls[0];
    expect(options?.method).toBe('DELETE');
    expect(new Headers(options?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(options?.body))).toEqual({ expected });
  });

  it('surfaces a version conflict without retrying the write', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Alternative changed; refresh before editing.' }), { status: 409 }));
    await expect(deleteAlternative(12, 1, expected)).rejects.toThrow('Alternative changed');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary recon deletion bodyless', async () => {
    await deleteRecon(12);
    expect(request.mock.calls[0][1]?.body).toBeUndefined();
  });
});
