import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const media = vi.hoisted(() => ({ rooms: vi.fn().mockResolvedValue([]), mint: vi.fn().mockResolvedValue('test-media-token') }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAuth: async (c: { req: { header(name: string): string | undefined } }) => {
    const key = c.req.header('X-Test-Owner');
    if (!key) throw new Error('Authentication required');
    return { wcaId: key, name: 'Meeting test user' };
  },
}));
vi.mock('livekit-server-sdk', () => ({
  AccessToken: class { roomConfig: unknown; addGrant() {} toJwt() { return media.mint(); } },
  RoomServiceClient: class {
    listRooms() { return media.rooms(); }
    listParticipants() { return Promise.resolve([]); }
  },
  TrackSource: { CAMERA: 1, MICROPHONE: 2, SCREEN_SHARE: 3, SCREEN_SHARE_AUDIO: 4 },
}));

// Opt-in real PostgreSQL integration. Never connects to the default/production database.
describe.runIf(process.env.MEET_TEST_DB_PORT)('meeting schedules with real PostgreSQL', () => {
  let app: Hono;
  let owner: string;
  let sql: typeof import('../src/db/connection.js').sql;
  const draft = () => { const start = Math.ceil(Date.now() / 60000) * 60000 + 3600000;
    return { title: 'Lesson', start, end: start + 1800000, tz: 'America/Los_Angeles', rrule: 'FREQ=WEEKLY;COUNT=3' }; };
  const request = (path: string, method = 'GET', body?: unknown, identity = owner) => app.request(`/v1/video/meet${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Test-Owner': identity },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  beforeAll(async () => {
    vi.stubEnv('DB_HOST', '127.0.0.1');
    vi.stubEnv('DB_PORT', process.env.MEET_TEST_DB_PORT!);
    vi.stubEnv('DB_USER', process.env.MEET_TEST_DB_USER || 'eula');
    vi.stubEnv('DB_NAME', 'postgres');
    vi.stubEnv('DB_PASS', '');
    vi.stubEnv('LIVEKIT_URL', 'wss://meeting-test.invalid');
    vi.stubEnv('LIVEKIT_API_KEY', 'test');
    vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret-test-secret-test-secret');
    owner = `meeting-test-${Date.now()}`;
    sql = (await import('../src/db/connection.js')).sql;
    const { videoRoomsRoutes } = await import('../src/routes/video_rooms.js');
    app = new Hono().route('/v1', videoRoomsRoutes);
  });
  afterAll(async () => { await sql?.end(); vi.unstubAllEnvs(); });

  it('persists schedules and isolates owner reads and writes', async () => {
    const response = await request('/plans', 'POST', draft());
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const { meeting } = await response.json();
    expect(meeting.code).toMatch(/^\d{4}$/);
    const list = await (await request('/plans')).json();
    expect(list.meetings.map((row: { id: string }) => row.id)).toContain(meeting.id);
    expect((await (await request('/plans', 'GET', undefined, 'unrelated-user')).json()).meetings).toEqual([]);
    expect((await request(`/plans/${meeting.id}`, 'PATCH', { ...draft(), title: 'Stolen' }, 'unrelated-user')).status).toBe(404);
    expect((await request(`/plans/${meeting.id}`, 'PATCH', { cancelled: true }, 'unrelated-user')).status).toBe(404);
    const updated = await request(`/plans/${meeting.id}`, 'PATCH', { ...draft(), title: 'Updated lesson' });
    expect((await updated.json()).meeting.title).toBe('Updated lesson');
    expect((await request(`/plans/${meeting.id}`, 'PATCH', { cancelled: true })).status).toBe(200);
    media.mint.mockClear();
    expect((await request('/token', 'POST', { code: meeting.code })).status).toBe(403);
    expect(media.mint).not.toHaveBeenCalled();
    expect((await request(`/plans/${meeting.id}`, 'PATCH', draft())).status).toBe(404);
  });
  it('allocates distinct codes under simultaneous quick and scheduled requests', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => index % 2
      ? request('/plans', 'POST', draft()) : request('/code', 'POST')));
    const codes = await Promise.all(responses.map(async response => {
      expect(response.ok).toBe(true);
      const body = await response.json(); return body.code ?? body.meeting.code;
    }));
    expect(new Set(codes).size).toBe(12);
  });
  it('rejects bad schedules before reserving a code', async () => {
    for (const patch of [{ title: '' }, { start: Date.now() - 86400000 }, { tz: 'bad' }, { end: 0 }, { rrule: 'FREQ=NO' }]) {
      expect((await request('/plans', 'POST', { ...draft(), ...patch })).status).toBe(400);
    }
  });
  it.runIf(process.env.MEET_TEST_UI_PORT)('serves the isolated browser fixture until explicitly stopped', async () => {
    const { serve } = await import('@hono/node-server');
    const { cors } = await import('hono/cors');
    let done!: () => void;
    const completed = new Promise<void>(resolve => { done = resolve; });
    const fixture = new Hono();
    fixture.use('*', cors({ origin: 'http://127.0.0.1:3000', allowHeaders: ['Authorization', 'Content-Type'] }));
    fixture.post('/__test/stop', c => { done(); return c.json({ ok: true }); });
    fixture.all('*', async c => {
      const req = new Request(c.req.raw);
      req.headers.set('X-Test-Owner', owner);
      return app.fetch(req);
    });
    const server = serve({ fetch: fixture.fetch, hostname: '127.0.0.1', port: Number(process.env.MEET_TEST_UI_PORT) });
    console.log('Meeting UI fixture ready; authentication and media are mocked, PostgreSQL is real.');
    try { await completed; } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 600_000);
});
