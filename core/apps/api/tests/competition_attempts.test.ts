import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), query: vi.fn(), ready: vi.fn(), scramble: vi.fn() }));
vi.mock('../src/platform/auth.js', () => ({ requirePlatformActor: mocks.actor }));
vi.mock('../src/platform/db.js', () => ({
  platformDb: () => ({}), platformQuery: mocks.query,
  withIdempotency: async (_c: unknown, _actor: unknown, _scope: unknown, _body: unknown, run: (db: object) => Promise<unknown>) => run({}),
  sendMutation: (c: { json: (body: unknown, status: number) => Response }, result: { body: unknown; status: number }) => c.json(result.body, result.status),
}));
vi.mock('../src/routes/video_rooms.js', () => ({ competitionSupervisionReady: mocks.ready }));
vi.mock('../src/utils/battle_scramble.js', () => ({ generateNetBattleScramble: mocks.scramble }));
import { platformCompetitionAttemptRoutes } from '../src/routes/platform_competition_attempts.js';

const app = new Hono().route('/v1', platformCompetitionAttemptRoutes);
const id = '11111111-1111-4111-8111-111111111111';
const path = `/v1/platform/competitions/registrations/${id}/attempts`;
let row: Record<string, unknown>;
let attempts: Array<Record<string, unknown>>;
let busy: boolean;
const post = (suffix: string, body = {}) => app.request(path + suffix, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'test-attempt' }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  row = { id, user_id: 1, supervisor_user_id: 2, status: 'confirmed', event_status: 'published', checked_in_at: '2026-09-10T12:00:00Z', in_window: true, competition_video_generation: id, competition_project: '333', result_recorded_at: null };
  attempts = []; busy = false;
  mocks.actor.mockResolvedValue({ userId: 2 });
  mocks.ready.mockResolvedValue(true);
  mocks.scramble.mockResolvedValue("R U R'");
  mocks.query.mockImplementation(async (_db, sql, params) => {
    if (sql.includes('SELECT r.id::text')) return [row];
    if (sql.includes('SELECT a.registration_id')) return busy ? [{ registration_id: 'other' }] : [];
    if (sql.includes('SELECT a.attempt_number')) return attempts;
    if (sql.includes('INSERT INTO platform_competition_attempts')) {
      attempts.push({ attemptNumber: params[1], scramble: params[2], issuedAt: '2026-09-10T12:00:01Z', recordedAt: null });
      return [];
    }
    if (sql.includes('UPDATE platform_competition_attempts')) {
      const attempt = attempts.find(a => a.attemptNumber === params[1] && !a.recordedAt);
      if (!attempt) return [];
      Object.assign(attempt, { centiseconds: params[2], penalty: params[3], recordedAt: '2026-09-10T12:01:00Z' });
      return [{ attempt_number: params[1] }];
    }
    return [];
  });
});

describe('supervised attempts HTTP boundaries', () => {
  it('lets the entrant read but never issue or record their own attempt', async () => {
    mocks.actor.mockResolvedValue({ userId: 1 });
    expect((await app.request(path)).status).toBe(200);
    expect((await post('/next')).status).toBe(403);
    expect((await post('/1/result', { centiseconds: 1234, penalty: 'none' })).status).toBe(403);
    expect(mocks.scramble).not.toHaveBeenCalled();
  });
  it('rejects outsiders before exposing a scramble', async () => {
    mocks.actor.mockResolvedValue({ userId: 3 });
    expect((await app.request(path)).status).toBe(403);
  });
  it.each([
    { status: 'cancelled' }, { event_status: 'draft' }, { checked_in_at: null }, { in_window: false }, { result_recorded_at: '2026-09-10T12:00:00Z' },
  ])('rejects an inactive supervision state %j', async change => {
    Object.assign(row, change);
    expect((await post('/next')).status).toBe(409);
    expect(mocks.scramble).not.toHaveBeenCalled();
  });
  it('fails closed if either live camera is unavailable', async () => {
    mocks.ready.mockResolvedValue(false);
    expect((await post('/next')).status).toBe(409);
    expect(mocks.scramble).not.toHaveBeenCalled();
  });
  it('returns the pending scramble on repeated next requests', async () => {
    expect((await post('/next')).status).toBe(201);
    expect((await post('/next')).status).toBe(200);
    expect(mocks.scramble).toHaveBeenCalledTimes(1);
    expect(attempts.length).toBe(1);
  });
  it('does not allow one supervisor to issue simultaneous attempts to multiple entrants', async () => {
    busy = true;
    expect((await post('/next')).status).toBe(409);
    expect(mocks.scramble).not.toHaveBeenCalled();
  });
  it('records only an issued attempt, exactly once, and advances to five', async () => {
    expect((await post('/1/result', { centiseconds: 1000, penalty: 'none' })).status).toBe(409);
    for (let n = 1; n <= 5; n++) {
      expect((await post('/next')).status).toBe(201);
      expect((await post(`/${n}/result`, { centiseconds: 1000 + n, penalty: 'none' })).status).toBe(200);
      expect((await post(`/${n}/result`, { centiseconds: 999, penalty: 'none' })).status).toBe(409);
    }
    expect((await post('/next')).status).toBe(409);
    expect(attempts.map(a => a.centiseconds)).toEqual([1001, 1002, 1003, 1004, 1005]);
  });
  it('rejects invalid times and out-of-range attempt numbers before mutation', async () => {
    expect((await post('/6/result', { centiseconds: 1000, penalty: 'none' })).status).toBe(400);
    expect((await post('/1/result', { centiseconds: -1, penalty: 'none' })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
