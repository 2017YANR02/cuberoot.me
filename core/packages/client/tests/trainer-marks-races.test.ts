// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseMarks } from '@/lib/trainer-marks';

const mocks = vi.hoisted(() => ({ token: 'owner-a', request: vi.fn<typeof fetch>() }));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => mocks.token, getWcaToken: () => '' }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: mocks.request }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = (data: unknown) => new Response(JSON.stringify(data));
const localKey = 'trainer:marks:3x3/pll';

describe('trainer mark async ownership', () => {
  let marks: typeof import('@/lib/trainer-marks');
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const writes = () => mocks.request.mock.calls.filter(([, init]) => init?.method === 'PUT');
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    localStorage.clear();
    mocks.token = 'owner-a';
    mocks.request.mockReset().mockImplementation(async (_url, init) => response(init?.method === 'PUT' ? { ok: true } : { marks: {} }));
    marks = await import('@/lib/trainer-marks');
    marks.useTrainerMarks.getState().loadMarks('3x3', 'pll');
    await settle();
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('never uploads an old account debounce batch with a new account credential', async () => {
    marks.useTrainerMarks.getState().applyMarks(['T'], { s: 'learning' });
    mocks.token = 'owner-b';
    await vi.advanceTimersByTimeAsync(800);
    expect(writes()).toEqual([]);
  });

  it('waits for a PUT already in flight before resolving flushMarks and reading overview', async () => {
    const saving = deferred<Response>();
    mocks.request.mockImplementation(async (url, init) => {
      if (init?.method === 'PUT') return saving.promise;
      return response(String(url) === '/v1/alg/marks?v=3' ? { sets: [] } : { marks: {} });
    });
    marks.useTrainerMarks.getState().applyMarks(['T'], { s: 'learning' });
    await vi.advanceTimersByTimeAsync(800);
    let flushed = false;
    const pending = marks.flushMarks().then(() => { flushed = true; });
    const overview = marks.loadMarkOverview();
    await settle();
    expect(flushed).toBe(false);
    expect(mocks.request.mock.calls.some(([url]) => url === '/v1/alg/marks?v=3')).toBe(false);
    saving.resolve(response({ ok: true }));
    await Promise.all([pending, overview]);
    expect(flushed).toBe(true);
    expect(mocks.request.mock.calls.some(([url]) => url === '/v1/alg/marks?v=3')).toBe(true);
  });

  it('ignores old account reads including retired-field cleanup uploads', async () => {
    const reading = deferred<Response>();
    mocks.request.mockReturnValueOnce(reading.promise);
    marks.useTrainerMarks.getState().loadMarks('3x3', 'pll');
    mocks.token = 'owner-b';
    reading.resolve(response({ marks: { old: { s: 'paused', t: 1 }, private: { s: 'mastered', t: 1 } } }));
    await settle();
    await vi.advanceTimersByTimeAsync(800);
    expect(marks.useTrainerMarks.getState().marks).toEqual({});
    expect(localStorage.getItem(localKey)).toBe('{}');
    expect(writes()).toEqual([]);
  });

  it('preserves a same-millisecond edit made while reset is saving its tombstones', async () => {
    marks.useTrainerMarks.getState().applyMarks(['T'], { s: 'learning' });
    const resetting = deferred<Response>();
    mocks.request.mockImplementation(async (_url, init) => init?.method === 'PUT' ? resetting.promise : response({ marks: {} }));
    const pending = marks.resetSetMarks('3x3', 'pll');
    await settle();
    marks.useTrainerMarks.getState().applyMarks(['T', 'new'], { s: 'mastered' });
    resetting.resolve(response({ ok: true }));
    await pending;
    const expected: CaseMarks = { T: { s: 'mastered', t: 1002 }, new: { s: 'mastered', t: 1002 } };
    expect(marks.useTrainerMarks.getState().marks).toEqual(expected);
    expect(JSON.parse(localStorage.getItem(localKey)!)).toEqual(expected);
    expect(JSON.parse(writes()[0][1]!.body as string).items).toEqual([{ k: 'T', s: null, t: 1001 }]);
  });

  it('merges detail reads against edits made after the request began', async () => {
    const reading = deferred<Response>();
    mocks.request.mockReturnValueOnce(reading.promise);
    const pending = marks.loadMarkDetails([{ puzzle: '3x3', set: 'pll' }]);
    await settle();
    marks.useTrainerMarks.getState().applyMarks(['T'], { s: 'mastered' });
    reading.resolve(response({ marks: { T: { s: 'learning', t: 1 } } }));
    const details = await pending;
    expect(details['3x3/pll'].T).toEqual({ s: 'mastered', t: 1000 });
    expect(JSON.parse(localStorage.getItem(localKey)!).T).toEqual({ s: 'mastered', t: 1000 });
  });

  it('does not requeue an old account failed upload into the new account queue', async () => {
    const saving = deferred<Response>();
    mocks.request.mockReturnValueOnce(saving.promise);
    marks.useTrainerMarks.getState().applyMarks(['T'], { s: 'learning' });
    await vi.advanceTimersByTimeAsync(800);
    mocks.token = 'owner-b';
    saving.reject(new Error('old account request failed'));
    await settle();
    await marks.flushMarks();
    expect(writes()).toHaveLength(1);
    expect(new Headers(writes()[0][1]?.headers).get('Authorization')).toBe('Bearer owner-a');
  });
});
