import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres, { type TransactionSql } from 'postgres';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let db: ReturnType<typeof postgres>;
let afterRead: ((text: string) => Promise<void>) | undefined;
const rewrite = (text: string) => { let i = 0; return text.replace(/\?/g, () => `$${++i}`); };
async function run(text: string, params: never[] = [], connection: TransactionSql | typeof db = db) {
  const rows = await connection.unsafe(rewrite(text), params);
  if (text.startsWith('SELECT')) await afterRead?.(text);
  return rows;
}
vi.mock('../src/db/connection.js', () => ({
  query: (text: string, params?: never[]) => run(text, params),
  withTransaction: (callback: (query: (text: string, params?: never[]) => Promise<unknown>) => Promise<unknown>) =>
    db.begin(tx => callback((text, params) => run(text, params, tx))),
}));
vi.mock('../src/utils/recon_helpers.js', async original => ({
  ...await original<typeof import('../src/utils/recon_helpers.js')>(),
  requireAuth: async (c: { req: { header: (key: string) => string | undefined } }) => ({
    wcaId: c.req.header('Test-Owner') ?? 'u7', uid: 7, name: 'Writer', isAdmin: c.req.header('Test-Admin') === '1',
  }),
  checkRateLimit: vi.fn(),
}));
vi.mock('../src/utils/account.js', () => ({
  publicUserIdsForOwnerKeys: async () => new Map([['u7', 7]]),
  getAccountBasicProfile: async () => ({ forumBanned: false, forumProfileExempt: true }),
  findUserByWcaId: async () => ({ id: 7 }),
}));
vi.mock('../src/utils/notify.js', () => ({ notify: vi.fn(), adminRecipients: () => [] }));
vi.mock('../src/utils/recon_revalidate.js', () => ({ revalidateReconPages: vi.fn() }));

import { reconRoutes } from '../src/routes/recon.js';
import { quizRoutes } from '../src/routes/quiz.js';
import { algMarksRoutes } from '../src/routes/alg_marks.js';
import { algSweepRoutes } from '../src/routes/alg_sweep.js';
import { forumRoutes } from '../src/routes/forum.js';
import { paintRoutes } from '../src/routes/paint.js';
import { algSrsRoutes } from '../src/routes/alg_srs.js';
const app = new Hono().route('/v1', reconRoutes).route('/v1', quizRoutes).route('/v1', algMarksRoutes)
  .route('/v1', algSweepRoutes).route('/v1', forumRoutes).route('/v1', paintRoutes).route('/v1', algSrsRoutes);
app.onError((error, c) => c.json({ error: error.message }, error instanceof HTTPException ? error.status : 500));
const databaseUrl = process.env.CONCURRENT_WRITES_TEST_DATABASE_URL;
const call = (path: string, method: string, body?: unknown, admin = false, owner = 'u7') => app.request('/v1' + path, {
  method, headers: { 'Content-Type': 'application/json', 'Test-Owner': owner, ...(admin ? { 'Test-Admin': '1' } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const alt = (solution: string, addedById = 'u7') => ({ solution, addedById, addedBy: 'Writer', createdAt: 1 });
const putMarks = (items: unknown[]) => call('/alg/marks/3x3/pll', 'PUT', { items });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe.skipIf(!databaseUrl)('concurrent API writes (isolated PostgreSQL)', () => {
  const schema = `concurrent_writes_${randomUUID().replaceAll('-', '')}`;
  const applicationName = schema;
  let observer: ReturnType<typeof postgres>;
  const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl!).hostname)) throw new Error('Loopback PostgreSQL required');
    observer = postgres(databaseUrl!, { max: 1, onnotice: () => {} });
    await observer.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(databaseUrl!, { max: 4, connection: { search_path: schema, application_name: applicationName } });
    await db.unsafe(`CREATE TABLE recons (id integer PRIMARY KEY, alternatives text, person text, event text, comp text,
      added_by_id text DEFAULT 'u7', note text, completion_status text);
      CREATE TABLE comments (id integer PRIMARY KEY, recon_id integer REFERENCES recons(id), pinned smallint NOT NULL DEFAULT 0)`);
    await db.unsafe(migration('0100_quiz_questions.sql'));
    for (const file of ['0076_alg_case_marks.sql', '0093_drop_paused_mark.sql', '0120_drop_alg_mark_starred.sql', '0287_alg_mark_tombstones.sql']) {
      await db.unsafe(migration(file));
    }
    await db.unsafe(migration('0089_alg_case_srs.sql'));
    await db.unsafe(migration('0096_alg_set_progress.sql'));
    await db.unsafe('CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$');
    await db.unsafe(migration('0066_forum.sql'));
    await db.unsafe(migration('0074_forum_review.sql'));
    await db.unsafe(migration('0055_paint_drawings.sql'));
  });
  beforeEach(async () => {
    afterRead = undefined;
    await db.unsafe('TRUNCATE comments, recons, quiz_question_reports, quiz_questions, alg_case_marks, alg_case_srs, alg_set_progress, forum_reports, forum_reactions, forum_posts, forum_threads, paint_drawings RESTART IDENTITY');
    await db`INSERT INTO recons (id, alternatives) VALUES (1, '[]'), (2, '[]')`;
    await db`INSERT INTO comments (id, recon_id) VALUES (11, 1), (12, 1), (21, 2)`;
  });
  afterAll(async () => {
    afterRead = undefined;
    await db?.end();
    if (observer) { await observer.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await observer.end(); }
  });

  async function overlap(
    match: (text: string) => boolean,
    first: () => Promise<Response>,
    second: () => Promise<Response>,
    expectedStatuses = [200, 200],
  ) {
    const held = deferred(), release = deferred();
    let intercepted = false;
    afterRead = async text => {
      if (!intercepted && match(text)) { intercepted = true; held.resolve(); await release.promise; }
    };
    const firstRequest = first();
    let secondRequest: Promise<Response> | undefined;
    try {
      await held.promise;
      secondRequest = second();
      // Observe a real PostgreSQL lock wait instead of hoping scheduler timing overlaps.
      await vi.waitFor(async () => {
        const rows = await observer`SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE application_name = ${applicationName} AND wait_event_type = 'Lock'`;
        expect(rows[0].n).toBe(1);
      }, { timeout: 2000, interval: 10 });
    } finally {
      release.resolve();
    }
    const responses = await Promise.all([firstRequest, secondRequest!]);
    afterRead = undefined;
    expect(responses.map(response => response.status)).toEqual(expectedStatuses);
    return responses;
  }
  async function alternatives() {
    return JSON.parse((await db`SELECT alternatives FROM recons WHERE id = 1`)[0].alternatives);
  }

  it('keeps both simultaneous alternative additions', async () => {
    await overlap(text => text.startsWith('SELECT alternatives'),
      () => call('/recon/1/alternatives', 'POST', { solution: 'R' }),
      () => call('/recon/1/alternatives', 'POST', { solution: 'U' }));
    expect((await alternatives()).map((entry: { solution: string }) => entry.solution)).toEqual(['R', 'U']);
  });

  it('does not resurrect a deleted alternative when another writer appends', async () => {
    await db`UPDATE recons SET alternatives = ${JSON.stringify([alt('F')])} WHERE id = 1`;
    await overlap(text => text.startsWith('SELECT alternatives'),
      () => call('/recon/1/alternatives/0', 'DELETE', { expected: alt('F') }),
      () => call('/recon/1/alternatives', 'POST', { solution: 'U' }));
    expect((await alternatives()).map((entry: { solution: string }) => entry.solution)).toEqual(['U']);
  });

  it('retains a concurrent edit and rechecks authorship under the row lock', async () => {
    await db`UPDATE recons SET alternatives = ${JSON.stringify([alt('F')])} WHERE id = 1`;
    await overlap(text => text.startsWith('SELECT alternatives'),
      () => call('/recon/1/alternatives/0', 'PUT', { solution: 'R', expected: alt('F') }),
      () => call('/recon/1/alternatives', 'POST', { solution: 'U' }));
    expect((await alternatives()).map((entry: { solution: string }) => entry.solution)).toEqual(['R', 'U']);
    await db`UPDATE recons SET alternatives = ${JSON.stringify([alt('F', 'u8')])} WHERE id = 1`;
    expect((await call('/recon/1/alternatives/0', 'PUT', { solution: 'R', expected: alt('F', 'u8') })).status).toBe(403);
    expect((await alternatives())[0].solution).toBe('F');
    expect((await call('/recon/999/alternatives', 'POST', { solution: 'R' })).status).toBe(404);
  });

  it('rejects stale indexes and stale versions even for the same author or an administrator', async () => {
    await db`UPDATE recons SET alternatives = ${JSON.stringify([alt('F'), alt('R'), alt('U')])} WHERE id = 1`;
    expect((await call('/recon/1/alternatives/0', 'DELETE', { expected: alt('F') })).status).toBe(200);
    // Index 1 used to be R but now points to U, which belongs to the same author.
    expect((await call('/recon/1/alternatives/1', 'PUT', { solution: 'L', expected: alt('R') })).status).toBe(409);
    expect((await call('/recon/1/alternatives/1', 'DELETE', { expected: alt('R') }, true)).status).toBe(409);
    expect((await call('/recon/1/alternatives/0', 'PUT', { solution: 'L', expected: alt('R') })).status).toBe(200);
    expect((await call('/recon/1/alternatives/0', 'DELETE', { expected: alt('R') })).status).toBe(409);
    expect((await call('/recon/1/alternatives/0', 'DELETE')).status).toBe(409);
    expect((await call('/recon/1/alternatives/0', 'PUT', { solution: 'B' })).status).toBe(409);
    expect((await alternatives()).map((entry: { solution: string }) => entry.solution)).toEqual(['L', 'U']);
  });

  it('preserves newly added alternatives when an older full reconstruction form saves', async () => {
    expect((await call('/recon/1/alternatives', 'POST', { solution: 'R' })).status).toBe(200);
    const response = await call('/recon/1', 'PUT', { note: 'Updated note', alternatives: [] });
    expect(response.status).toBe(200);
    expect((await alternatives()).map((entry: { solution: string }) => entry.solution)).toEqual(['R']);
    expect((await db`SELECT note FROM recons WHERE id = 1`)[0].note).toBe('Updated note');
  });

  it('serializes competing comment pins and leaves other reconstructions unchanged', async () => {
    await db`UPDATE comments SET pinned = 1 WHERE id = 21`;
    await overlap(text => text.includes('AS recon_id FROM recons'),
      () => call('/recon/comments/11/pin', 'PUT', { pinned: true }, true),
      () => call('/recon/comments/12/pin', 'PUT', { pinned: true }, true));
    expect((await db`SELECT id FROM comments WHERE pinned = 1 ORDER BY id`).map(row => row.id)).toEqual([12, 21]);
  });

  it.each([false, true])('keeps concurrent moderation when an older content edit finishes (admin=%s)', async admin => {
    await db`INSERT INTO quiz_questions (cat, level, type, q_en, author_key) VALUES ('notation', 'easy', 'open', 'Question', 'u7')`;
    const held = deferred(), release = deferred();
    afterRead = async text => { if (text.includes('FROM quiz_questions WHERE id')) { held.resolve(); await release.promise; } };
    const pending = call('/quiz/questions/1', 'PATCH', {
      cat: 'notation', level: 'easy', type: 'open', qEn: 'Edited question', answerEn: 'R', accept: ['r'],
      ...(admin ? {} : { status: 'published', hiddenNote: '' }),
    }, admin);
    await held.promise;
    try { await db`UPDATE quiz_questions SET status = 'hidden', hidden_note = 'Correction required' WHERE id = 1`; }
    finally { release.resolve(); }
    expect((await pending).status).toBe(200);
    expect((await db`SELECT status, hidden_note, q_en FROM quiz_questions WHERE id = 1`)[0])
      .toEqual({ status: 'hidden', hidden_note: 'Correction required', q_en: 'Edited question' });
  });

  it('does not exceed the daily question cap when two creations claim the last slot', async () => {
    await db`INSERT INTO quiz_questions (cat, level, type, q_en, author_key)
      SELECT 'notation', 'easy', 'open', 'Question', 'u7' FROM generate_series(1, 29)`;
    const body = { cat: 'notation', level: 'easy', type: 'open', qEn: 'Question', answerEn: 'R', accept: ['r'] };
    const responses = await Promise.all([call('/quiz/questions', 'POST', body), call('/quiz/questions', 'POST', body)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 429]);
    expect((await db`SELECT count(*)::int n FROM quiz_questions WHERE author_key = 'u7'`)[0].n).toBe(30);
  });

  it('serializes distinct reports and keeps duplicate reports from increasing their count', async () => {
    await db`INSERT INTO quiz_questions (cat, level, type, q_en, author_key) VALUES ('notation', 'easy', 'open', 'Question', 'u8')`;
    await overlap(text => text.includes('FROM quiz_questions WHERE id'),
      () => call('/quiz/questions/1/report', 'POST', { reason: 'First reason' }),
      () => call('/quiz/questions/1/report', 'POST', { reason: 'Second reason' }, false, 'u9'));
    expect((await db`SELECT report_count FROM quiz_questions WHERE id = 1`)[0].report_count).toBe(2);
    expect((await call('/quiz/questions/1/report', 'POST', { reason: 'Updated reason' })).status).toBe(200);
    expect((await db`SELECT report_count FROM quiz_questions WHERE id = 1`)[0].report_count).toBe(2);
    expect((await db`SELECT reason FROM quiz_question_reports WHERE question_id = 1 AND reporter_key = 'u7'`)[0].reason).toBe('Updated reason');
  });

  it('persists clears, rejects stale resurrection, and accepts a genuinely newer mark', async () => {
    expect((await putMarks([{ k: '|T', s: 'mastered', t: 100 }])).status).toBe(200);
    expect((await putMarks([{ k: '|T', s: null, t: 300 }])).status).toBe(200);
    for (const t of [100, 300]) expect((await putMarks([{ k: '|T', s: 'learning', t }])).status).toBe(200);
    expect(await (await call('/alg/marks/3x3/pll', 'GET')).json()).toEqual({ marks: { '|T': { t: 300 } } });
    expect(await (await call('/alg/marks', 'GET')).json()).toEqual({ sets: [] });
    expect((await putMarks([{ k: '|T', s: 'learning', t: 400 }])).status).toBe(200);
    expect(await (await call('/alg/marks/3x3/pll', 'GET')).json()).toEqual({ marks: { '|T': { s: 'learning', t: 400 } } });
  });

  it('deduplicates repeated keys and retains clear timestamps for previously absent marks', async () => {
    expect((await putMarks([{ k: '|T', s: null, t: 300 }, { k: '|T', s: 'mastered', t: 100 }, { k: '|T', s: 'learning', t: 300 }])).status).toBe(200);
    expect((await putMarks([{ k: '|T', s: 'mastered', t: 200 }])).status).toBe(200);
    expect(await (await call('/alg/marks/3x3/pll', 'GET')).json()).toEqual({ marks: { '|T': { t: 300 } } });
  });

  it('lets a cleared mark fold out of review while protecting an active mark', async () => {
    await putMarks([{ k: '|T', s: null, t: 300 }, { k: '|J', s: 'mastered', t: 300 }]);
    await db`INSERT INTO alg_case_srs (wca_id, puzzle, set_slug, case_key, due, ivl, ease, reps, lapses, streak, hist, reviewed_at)
      VALUES ('u7', '3x3', 'pll', '|T', 100, 1, 2.5, 1, 0, 1, 1, 100),
             ('u7', '3x3', 'pll', '|J', 100, 1, 2.5, 1, 0, 1, 1, 100)`;
    const response = await call('/alg/sweep/3x3/pll/fold', 'POST', { keys: ['|T', '|J'] });
    expect(response.status).toBe(200);
    expect((await response.json()).keys).toEqual(['|T']);
    expect((await db`SELECT case_key FROM alg_case_srs`).map(row => row.case_key)).toEqual(['|J']);
  });

  it('allows existing-key clears at capacity and atomically rejects concurrent overflow', async () => {
    await db`INSERT INTO alg_case_marks (wca_id, puzzle, set_slug, case_key, status, updated_at)
      SELECT 'u7', '3x3', 'pll', 'case' || n, 'learning', 100 FROM generate_series(1, 19999) n`;
    const responses = await overlap(text => text.includes('pg_advisory_xact_lock'),
      () => putMarks([{ k: 'case1', s: 'mastered', t: 200 }]),
      () => putMarks([{ k: 'case2', s: 'mastered', t: 200 }]));
    expect(responses).toHaveLength(2);
    const writes = await Promise.all([putMarks([{ k: 'newA', s: 'mastered', t: 300 }]), putMarks([{ k: 'newB', s: 'mastered', t: 300 }])]);
    expect(writes.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await db`SELECT count(*)::int AS n FROM alg_case_marks`)[0].n).toBe(20000);
    expect((await putMarks([{ k: 'case3', s: null, t: 400 }])).status).toBe(200);
    expect((await putMarks([{ k: 'absent', s: null, t: 400 }])).status).toBe(200);
    expect((await putMarks([{ k: 'replacement', s: 'mastered', t: 400 }])).status).toBe(200);
    const overflow = await putMarks([{ k: 'case4', s: null, t: 400 }, { k: 'newC', s: 'learning', t: 400 }, { k: 'newD', s: 'learning', t: 400 }]);
    expect(overflow.status).toBe(409);
    expect((await db`SELECT status FROM alg_case_marks WHERE case_key = 'case4'`)[0].status).toBe('learning');
  });

  it('gives only one concurrent drawing creation the final library slot', async () => {
    await db`INSERT INTO paint_drawings (wca_id, title, doc, byte_size, created_at, updated_at)
      SELECT 'u7', 'Drawing', '{"shapes":{},"order":[]}', 24, 1, 1 FROM generate_series(1, 299)`;
    const create = () => call('/paint/drawings', 'POST', { title: 'Drawing', doc: '{"shapes":{},"order":[]}' });
    await overlap(text => text.includes("hashtext('paint_drawings')"), create, create, [200, 409]);
    expect((await db`SELECT count(*)::int n FROM paint_drawings WHERE wca_id = 'u7'`)[0].n).toBe(300);
  });

  it('serializes SRS quota checks while allowing old-key edits and deduplicating a batch', async () => {
    await db`INSERT INTO alg_case_srs (wca_id, puzzle, set_slug, case_key, due, ivl, ease, reps, lapses, streak, hist, reviewed_at)
      SELECT 'u7', '3x3', 'pll', 'case' || n, 100, 1, 2.5, 1, 0, 1, 1, 100 FROM generate_series(1, 19999) n`;
    const item = (k: string, t = 200) => ({ k, d: 100, iv: 1, ef: 2.5, n: 1, l: 0, st: 1, h: 1, t });
    const put = (items: unknown[]) => call('/alg/srs/3x3/pll', 'PUT', { items });
    await overlap(text => text.includes("hashtext('alg_case_srs')"),
      () => put([item('newA')]), () => put([item('newB')]), [200, 409]);
    expect((await db`SELECT count(*)::int n FROM alg_case_srs WHERE wca_id = 'u7'`)[0].n).toBe(20000);
    expect((await put([item('case1', 400), item('case1', 300)])).status).toBe(200);
    expect(Number((await db`SELECT reviewed_at FROM alg_case_srs WHERE case_key = 'case1'`)[0].reviewed_at)).toBe(400);
    expect((await put([item('case1', 500), item('newC', 500)])).status).toBe(409);
    expect(Number((await db`SELECT reviewed_at FROM alg_case_srs WHERE case_key = 'case1'`)[0].reviewed_at)).toBe(400);
  });

  async function forumThread(pending = false) {
    const response = await call('/forum/threads', 'POST', { forumSlug: 'speedcubing', title: 'Concurrency', content: 'First post' }, true);
    expect(response.status).toBe(200);
    const id = (await response.json()).id as number;
    if (pending) {
      await db`UPDATE forum_threads SET status = 'pending' WHERE id = ${id}`;
      await db`UPDATE forum_posts SET status = 'pending' WHERE thread_id = ${id}`;
    }
    return id;
  }
  const threadLock = (text: string) => text === 'SELECT id FROM forum_threads WHERE id = ? FOR UPDATE';
  async function reply(threadId: number, content = 'Reply') {
    return call('/forum/posts', 'POST', { threadId, content });
  }
  async function assertThreadSummary(threadId: number) {
    const [thread] = await db`SELECT * FROM forum_threads WHERE id = ${threadId}`;
    const posts = await db`SELECT * FROM forum_posts WHERE thread_id = ${threadId} AND NOT is_deleted AND status = 'approved' ORDER BY id`;
    expect(thread.reply_count).toBe(Math.max(0, posts.length - 1));
    expect(thread.last_post_author_id).toBe(posts.at(-1)?.author_id ?? thread.author_id);
    expect(new Date(thread.last_post_at).getTime()).toBe(new Date(posts.at(-1)?.created_at ?? thread.created_at).getTime());
  }

  it('keeps forum reply counts and latest-post metadata correct across deletion and posting', async () => {
    const id = await forumThread();
    const firstReply = await (await reply(id)).json();
    await overlap(threadLock,
      () => call(`/forum/posts/${firstReply.id}`, 'DELETE'),
      () => reply(id, 'Concurrent reply'));
    await assertThreadSummary(id);
    expect((await db`SELECT reply_count FROM forum_threads WHERE id = ${id}`)[0].reply_count).toBe(1);
  });

  it('serializes two deletions and two reaction toggles within the same thread', async () => {
    const id = await forumThread();
    const one = await (await reply(id)).json(), two = await (await reply(id)).json();
    await overlap(threadLock,
      () => call(`/forum/posts/${one.id}`, 'DELETE'),
      () => call(`/forum/posts/${two.id}`, 'DELETE'));
    await assertThreadSummary(id);
    const [first] = await db`SELECT id FROM forum_posts WHERE thread_id = ${id} ORDER BY id LIMIT 1`;
    await overlap(threadLock,
      () => call(`/forum/posts/${first.id}/react`, 'POST', { kind: 'like' }),
      () => call(`/forum/posts/${first.id}/react`, 'POST', { kind: 'like' }));
    expect(await db`SELECT * FROM forum_reactions WHERE post_id = ${first.id}`).toHaveLength(0);
  });

  it('rejects a reply whose thread was locked while the request was waiting', async () => {
    const id = await forumThread();
    await overlap(threadLock,
      () => call(`/forum/threads/${id}`, 'PATCH', { isLocked: true }, true),
      () => reply(id), [200, 403]);
    expect((await db`SELECT count(*)::int n FROM forum_posts WHERE thread_id = ${id}`)[0].n).toBe(1);
  });

  it('rejects post editing and review after a competing thread deletion commits', async () => {
    const id = await forumThread();
    const post = await (await reply(id)).json();
    await overlap(threadLock,
      () => call(`/forum/threads/${id}`, 'DELETE', undefined, true),
      () => call(`/forum/posts/${post.id}`, 'PATCH', { content: 'Late edit' }), [200, 404]);
    await db`UPDATE forum_posts SET status = 'pending' WHERE id = ${post.id}`;
    expect((await call(`/forum/review/post/${post.id}/approve`, 'POST', {}, true)).status).toBe(404);
    expect((await db`SELECT status, content FROM forum_posts WHERE id = ${post.id}`)[0]).toMatchObject({ status: 'pending', content: 'Reply' });
  });

  it('keeps summary metadata correct when approval competes with a new reply', async () => {
    const id = await forumThread();
    const [post] = await db`INSERT INTO forum_posts (thread_id, author_id, author_name, content, status)
      VALUES (${id}, 'u9', 'Pending writer', 'Pending reply', 'pending') RETURNING id`;
    await overlap(threadLock,
      () => call(`/forum/review/post/${post.id}/approve`, 'POST', {}, true),
      () => reply(id));
    await assertThreadSummary(id);
    expect((await db`SELECT reply_count FROM forum_threads WHERE id = ${id}`)[0].reply_count).toBe(2);
  });

  it('commits thread and first-post approval together and rolls both back on failure', async () => {
    const id = await forumThread(true);
    await db.unsafe(`CREATE FUNCTION reject_forum_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced status failure'; END $$;
      CREATE TRIGGER reject_forum_status BEFORE UPDATE OF status ON forum_posts
      FOR EACH ROW EXECUTE FUNCTION reject_forum_status()`);
    try {
      expect((await call(`/forum/review/thread/${id}/approve`, 'POST', {}, true)).status).toBe(500);
      expect((await db`SELECT status FROM forum_threads WHERE id = ${id}`)[0].status).toBe('pending');
      expect((await db`SELECT status FROM forum_posts WHERE thread_id = ${id}`)[0].status).toBe('pending');
    } finally {
      await db.unsafe('DROP TRIGGER reject_forum_status ON forum_posts; DROP FUNCTION reject_forum_status()');
    }
    await overlap(threadLock,
      () => call(`/forum/review/thread/${id}/approve`, 'POST', {}, true),
      () => call(`/forum/review/thread/${id}/approve`, 'POST', {}, true), [200, 404]);
    expect((await db`SELECT status FROM forum_posts WHERE thread_id = ${id}`)[0].status).toBe('approved');
    await assertThreadSummary(id);
  });
});
