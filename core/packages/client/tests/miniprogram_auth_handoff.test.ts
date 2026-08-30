import { afterEach, describe, expect, it, vi } from 'vitest';

const TICKET = 'A'.repeat(43);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Mini Program web session handoff', () => {
  it('parses a fragment-only ticket and keeps a safe internal destination', async () => {
    const { parseMiniProgramHandoff } = await import('../lib/miniprogram-auth-handoff');

    expect(parseMiniProgramHandoff(`#wechat_redirect&ticket=${TICKET}&next=%2Fzh%2Falg%3Fset%3Doll`)).toEqual({
      ticket: TICKET,
      next: '/zh/alg?set=oll',
    });
  });

  it('rejects malformed tickets and blocks an external redirect', async () => {
    const { MINIPROGRAM_HANDOFF_FALLBACK, parseMiniProgramHandoff } = await import('../lib/miniprogram-auth-handoff');

    expect(parseMiniProgramHandoff('#ticket=short&next=/zh/timer')).toBeNull();
    expect(parseMiniProgramHandoff(`#ticket=${TICKET}&next=%2F%2Fevil.example`)).toEqual({
      ticket: TICKET,
      next: MINIPROGRAM_HANDOFF_FALLBACK,
    });
  });

  it('parses a logout action and keeps its redirect on the website', async () => {
    const { MINIPROGRAM_LOGOUT_FALLBACK, parseMiniProgramLogout } = await import('../lib/miniprogram-auth-handoff');

    expect(parseMiniProgramLogout('#action=logout&next=%2Fzh%2Faccount')).toEqual({
      next: '/zh/account',
    });
    expect(parseMiniProgramLogout('#action=login&next=%2Fzh%2Faccount')).toBeNull();
    expect(parseMiniProgramLogout('#action=logout&next=https%3A%2F%2Fevil.example')).toEqual({
      next: MINIPROGRAM_LOGOUT_FALLBACK,
    });
  });

  it('deduplicates a StrictMode-style exchange for the same one-time ticket', async () => {
    const session = { token: 't'.repeat(20), user: { uid: 7, wcaId: null, name: 'CubeRoot', avatar: '' } };
    const normalizedSession = {
      ...session,
      user: { ...session.user, avatarSource: 'auto', avatarPreset: null },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => session });
    vi.stubGlobal('fetch', fetchMock);
    const { exchangeMiniProgramWebSession } = await import('../lib/miniprogram-auth-handoff');

    const first = exchangeMiniProgramWebSession(TICKET);
    const second = exchangeMiniProgramWebSession(TICKET);
    await expect(Promise.all([first, second])).resolves.toEqual([normalizedSession, normalizedSession]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears a failed exchange so the user can retry', async () => {
    const session = { token: 't'.repeat(20), user: { uid: 7, wcaId: '2026TEST01', name: 'CubeRoot', avatar: '' } };
    const normalizedSession = {
      ...session,
      user: { ...session.user, avatarSource: 'auto', avatarPreset: null },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => session });
    vi.stubGlobal('fetch', fetchMock);
    const { exchangeMiniProgramWebSession } = await import('../lib/miniprogram-auth-handoff');

    await expect(exchangeMiniProgramWebSession(TICKET)).rejects.toThrow('web session exchange failed');
    await expect(exchangeMiniProgramWebSession(TICKET)).resolves.toEqual(normalizedSession);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts a stalled exchange instead of leaving the callback page loading forever', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { exchangeMiniProgramWebSession } = await import('../lib/miniprogram-auth-handoff');

    const exchange = exchangeMiniProgramWebSession(TICKET);
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(exchange).rejects.toThrow('aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    vi.useRealTimers();
  });

  it('does not reuse a successful exchange after its pending request settles', async () => {
    const session = { token: 't'.repeat(20), user: { uid: 7, wcaId: null, name: 'CubeRoot', avatar: '' } };
    const normalizedSession = {
      ...session,
      user: { ...session.user, avatarSource: 'auto', avatarPreset: null },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => session })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { exchangeMiniProgramWebSession } = await import('../lib/miniprogram-auth-handoff');

    await expect(exchangeMiniProgramWebSession(TICKET)).resolves.toEqual(normalizedSession);
    await expect(exchangeMiniProgramWebSession(TICKET)).rejects.toThrow('web session exchange failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid user payload returned by the exchange endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 't'.repeat(20), user: { uid: 0, wcaId: null, name: 'CubeRoot', avatar: '' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { exchangeMiniProgramWebSession } = await import('../lib/miniprogram-auth-handoff');

    await expect(exchangeMiniProgramWebSession(TICKET)).rejects.toThrow('invalid web session response');
  });
});
