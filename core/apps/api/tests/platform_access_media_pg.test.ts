import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown, lookup: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ get sql() { return state.db; } }));
// Session verification is the boundary fixture; Platform actor mapping and all
// course ownership/entitlement decisions below use the production implementation.
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async (c: { req: { header(name: string): string | undefined } }) => {
    const actor = c.req.header('X-Fixture-Actor');
    if (actor === 'suspended') throw new Error('Account suspended');
    if (!actor) throw new Error('Authentication required');
    if (actor === 'legacy') return { wcaId: '2099TEST01', name: 'Legacy', isAdmin: false };
    if (actor === 'unregistered') return { wcaId: 'external-subject', name: 'External', isAdmin: false };
    const uid = Number(actor);
    return { uid, wcaId: `u${uid}`, name: `Fixture ${uid}`, isAdmin: uid === 5 };
  },
  requireAdminOrApiKey: async (c: { req: { header(name: string): string | undefined } }) => {
    if (c.req.header('X-Admin-Key') !== 'fixture-only-valid') throw new Error('Invalid key');
  },
}));
vi.mock('../src/utils/account.js', async importOriginal => ({ ...await importOriginal<typeof import('../src/utils/account.js')>(), findUserByWcaId: state.lookup }));

import { requirePlatformActor, requirePlatformAdmin } from '../src/platform/auth.js';
import { platformRouter } from '../src/platform/http.js';
import { createPlatformMediaToken } from '../src/platform/media_access.js';
import { authorizeCourseWrite } from '../src/platform/catalog/course-access.js';
import { registerCourseRoutes, saveCourseTrialLessonSelection } from '../src/platform/catalog/course-routes.js';
import { registerContentReviewRoutes } from '../src/platform/catalog/content-review-routes.js';
import { contentReviewIntent, requiresContentReview } from '../src/platform/catalog/content-review.js';
import { registerPublicRoutes } from '../src/platform/catalog/public-routes.js';
import { registerQuizRoutes } from '../src/platform/catalog/quiz-routes.js';
import { registerQuizRoutes as registerClassroomQuizRoutes } from '../src/platform/learning/quiz-routes.js';
import { registerProgressRoutes } from '../src/platform/learning/progress-routes.js';
import { registerCertificateRoutes } from '../src/platform/learning/certificate-routes.js';
import { registerReviewRoutes } from '../src/platform/learning/review-routes.js';
import { registerEnrollmentRoutes } from '../src/platform/learning/enrollment-routes.js';
import { registerLessonRoutes } from '../src/platform/catalog/lesson-routes.js';
import { registerMediaRoutes } from '../src/platform/learning/media-routes.js';
import { platformDb, type PlatformDb } from '../src/platform/db.js';

const authApp = platformRouter();
authApp.get('/actor', async c => c.json(await requirePlatformActor(c)));
authApp.get('/admin', async c => c.json(await requirePlatformAdmin(c)));

describe('Platform authentication adapter', () => {
  it('routes upload HEAD requests through authentication before touching storage', async () => {
    const app = platformRouter();
    registerLessonRoutes(app);
    const path = '/platform/instructor/courses/00000000-0000-4000-8000-000000000001/lesson-uploads/00000000-0000-4000-8000-000000000002';
    expect((await app.request(path, { method: 'HEAD' })).status).toBe(401);
  });

  it('keeps guest, suspended, and unregistered identities out of user-backed features', async () => {
    expect((await authApp.request('/actor')).status).toBe(401);
    expect((await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'suspended' } })).status).toBe(403);
    expect((await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'unregistered' } })).status).toBe(401);
  });

  it('resolves legacy WCA identity to an existing account without changing its owner key', async () => {
    state.lookup.mockResolvedValueOnce({ id: 17 });
    const response = await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'legacy' } });
    expect(await response.json()).toMatchObject({ userId: 17, ownerKey: '2099TEST01', wcaId: '2099TEST01', viaApiKey: false });
    expect(state.lookup).toHaveBeenCalledWith('2099TEST01');
    state.lookup.mockResolvedValueOnce(null);
    expect((await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'legacy' } })).status).toBe(401);
  });

  it('requires administrator role or a verified admin key', async () => {
    expect((await authApp.request('/admin', { headers: { 'X-Fixture-Actor': '1' } })).status).toBe(403);
    expect((await authApp.request('/admin', { headers: { 'X-Fixture-Actor': '5' } })).status).toBe(200);
    const valid = await authApp.request('/admin', { headers: { 'X-Admin-Key': 'fixture-only-valid' } });
    expect(await valid.json()).toMatchObject({ userId: null, viaApiKey: true, isAdmin: true });
    expect((await authApp.request('/admin', { headers: { 'X-Admin-Key': 'invalid', 'X-Fixture-Actor': '5' } })).status).toBe(403);
  });

  it('only gates publication, and denies instructor access to the decision route', async () => {
    expect(['draft', 'published', 'unlisted', 'archived'].map(status => requiresContentReview(false, status))).toEqual([false, true, true, false]);
    expect(requiresContentReview(true, 'published')).toBe(false);
    expect(contentReviewIntent({ status: 'pending_review', targetStatus: 'published' }, false)).toMatchObject({ status: 'published' });
    expect(() => contentReviewIntent({ status: 'pending_review', targetStatus: 'unlisted' }, false, true)).toThrow();
    const app = platformRouter();
    registerContentReviewRoutes(app);
    const response = await app.request(`/platform/admin/courses/${randomUUID()}/content-reviews/${randomUUID()}/decision`, {
      method: 'POST', headers: { 'X-Fixture-Actor': '3', 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approved' }),
    });
    expect(response.status).toBe(403);
  });
});

const databaseUrl = process.env.PLATFORM_MEDIA_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('course access and signed media with PostgreSQL and actual files', () => {
  const schema = `platform_media_${randomUUID().replaceAll('-', '')}`;
  const courseId = randomUUID();
  const legacyCourseId = randomUUID();
  const lessons = [randomUUID(), randomUUID(), randomUUID()];
  const mediaId = randomUUID();
  const coverId = randomUUID();
  const bytes = Buffer.from('0123456789abcdef');
  let admin: ReturnType<typeof postgres>;
  let db: ReturnType<typeof postgres>;
  let mediaDirectory: string;
  const app = platformRouter();
  registerMediaRoutes(app);
  registerLessonRoutes(app);
  registerCourseRoutes(app);
  registerContentReviewRoutes(app);
  registerPublicRoutes(app);
  registerQuizRoutes(app);
  registerClassroomQuizRoutes(app);
  registerProgressRoutes(app);
  registerCertificateRoutes(app);
  registerReviewRoutes(app);
  registerEnrollmentRoutes(app);
  app.get('/course/:id/write-access', async c => c.json({
    id: await authorizeCourseWrite(platformDb(), await requirePlatformActor(c), c.req.param('id')),
  }));
  const headers = (actor?: number) => actor == null ? {} : { 'X-Fixture-Actor': String(actor) };
  const descriptor = (index = 0, actor?: number) => app.request(`/lessons/${lessons[index]}/media`, { headers: headers(actor) });
  const requestUrl = (url: string, init?: RequestInit) => {
    const parsed = new URL(url);
    return app.request(parsed.pathname + parsed.search, init);
  };

  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl!).hostname)) throw new Error('Explicit loopback PostgreSQL required');
    admin = postgres(databaseUrl!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(databaseUrl!, { max: 3, onnotice: () => {}, connection: { search_path: schema } });
    state.db = db;
    const scratch = fileURLToPath(new URL('../../../../.tmp/scratch/', import.meta.url));
    await mkdir(scratch, { recursive: true });
    mediaDirectory = await mkdtemp(path.join(scratch, 'platform-media-'));
    await writeFile(path.join(mediaDirectory, 'lesson.mp4'), bytes);
    await writeFile(path.join(mediaDirectory, 'cover.png'), bytes);
    vi.stubEnv('PLATFORM_MEDIA_DIR', mediaDirectory);
    vi.stubEnv('PLATFORM_DATA_ENCRYPTION_KEY_V1', Buffer.alloc(32, 47).toString('base64'));
    vi.stubEnv('PLATFORM_MEDIA_SIGNING_SECRET', 'platform-media-integration-fixture-secret');
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id BIGINT PRIMARY KEY, wca_id VARCHAR(20), display_name TEXT);
      CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY, kind TEXT, is_visible BOOLEAN, name_zh TEXT, name_en TEXT);`);
    for (const migration of ['0070_notifications.sql', '0167_platform_core.sql', '0184_drive.sql', '0189_drive_shares.sql', '0216_drive_member_folders.sql', '0218_drive_compressions.sql', '0219_platform_lesson_grants.sql', '0220_platform_review_titles.sql', '0244_platform_lesson_covers.sql', '0259_platform_learning_completion.sql', '0349_platform_content_reviews.sql', '0360_platform_lesson_type_and_order.sql']) {
      await db.unsafe(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await db.unsafe(`INSERT INTO platform_courses(id,slug) VALUES($1,'yan-ruimin-3x3-beginner')`, [legacyCourseId]);
    await db.unsafe(`INSERT INTO platform_course_revisions(course_id,revision,title_en,status,content_hash,presentation)
      VALUES($1,1,'Legacy course','draft',decode(repeat('ab',32),'hex'),'{"targetEn":"Custom goal"}'::jsonb)`, [legacyCourseId]);
    await db.unsafe('UPDATE platform_courses SET current_revision=1 WHERE id=$1', [legacyCourseId]);
    await db.unsafe(await readFile(new URL('../migrations/0361_platform_course_presentation_defaults.sql', import.meta.url), 'utf8'));
    await db.unsafe(await readFile(new URL('../migrations/0362_platform_quiz_content_reviews.sql', import.meta.url), 'utf8'));
    await db.unsafe('ALTER TABLE notifications ADD COLUMN dedupe_key VARCHAR(200)');
    await db.unsafe('CREATE UNIQUE INDEX test_notification_dedupe ON notifications(user_key,kind,dedupe_key)');
    await db.unsafe('INSERT INTO app_users VALUES (1),(2),(3),(4),(5)');
    await db.unsafe(`INSERT INTO platform_courses(id,slug,status)
      VALUES ($1,'media-course','draft')`, [courseId]);
    await db.unsafe(`INSERT INTO platform_course_revisions(course_id,revision,title_en,status,content_hash,published_at)
      VALUES ($1,1,'Media course','published',decode(repeat('ab',32),'hex'),NOW())`, [courseId]);
    await db.unsafe(`UPDATE platform_courses SET status='published',current_revision=1,published_at=NOW() WHERE id=$1`, [courseId]);
    for (const [id, key, mime] of [[mediaId, 'lesson.mp4', 'video/mp4'], [coverId, 'cover.png', 'image/png']]) {
      await db.unsafe(`INSERT INTO platform_media_assets(id,owner_user_id,storage_key,mime_type,size_bytes,sha256,access_scope,status)
        VALUES($1,3,$2,$3,$4,decode(repeat('ab',32),'hex'),'entitled','ready')`, [id, key, mime, bytes.length]);
    }
    for (const [index, lesson] of lessons.entries()) {
      await db.unsafe(`INSERT INTO platform_lessons(id,course_id,slug,ordinal,access_scope)
        VALUES($1,$2,$3,$4,$5)`, [lesson, courseId, `lesson-${index}`, index, index === 2 ? 'public' : 'entitled']);
      await db.unsafe(`INSERT INTO platform_lesson_revisions(lesson_id,revision,title_en,status,content_hash,media_id,cover_media_id,published_at)
        VALUES($1,1,'Lesson','published',decode(repeat('ab',32),'hex'),$2,$3,NOW())`, [lesson, mediaId, coverId]);
      await db.unsafe(`UPDATE platform_lessons SET status='published',current_revision=1 WHERE id=$1`, [lesson]);
    }
    const entitlement = (await db.unsafe(`INSERT INTO platform_course_entitlements(user_id,course_id,valid_from)
      VALUES(1,$1,NOW()) RETURNING id`, [courseId]))[0].id;
    await db.unsafe(`INSERT INTO platform_entitlement_ledger(entitlement_id,entry_type,delta_access,valid_from,lesson_ids,reason,actor_user_id)
      VALUES($1,'grant',1,NOW(),ARRAY[$2::uuid],'Acceptance fixture',5)`, [entitlement, lessons[0]]);
    for (const user of [3, 4]) {
      const instructor = (await db.unsafe(`INSERT INTO platform_instructors(user_id,status,display_name_snapshot)
        VALUES($1,'active','Fixture instructor') RETURNING id`, [user]))[0].id;
      if (user === 3) await db.unsafe(`INSERT INTO platform_course_owners(course_id,instructor_id,role) VALUES($1,$2,'owner')`, [courseId, instructor]);
    }
  }, 30_000);

  afterAll(async () => {
    await db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); }
    if (mediaDirectory) await rm(mediaDirectory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('enforces exact lesson grants, instructor ownership, and administrator access', async () => {
    expect((await descriptor()).status).toBe(401);
    expect((await descriptor(0, 2)).status).toBe(403);
    expect((await descriptor(0, 1)).status).toBe(200);
    expect((await descriptor(1, 1)).status).toBe(403);
    expect((await descriptor(1, 3)).status).toBe(200);
    expect((await descriptor(1, 4)).status).toBe(403);
    expect((await descriptor(1, 5)).status).toBe(200);
    expect((await descriptor(2)).status).toBe(200);
    for (const [actor, status] of [[1, 403], [2, 403], [3, 200], [4, 404], [5, 200]]) {
      expect((await app.request(`/course/${courseId}/write-access`, { headers: headers(actor) })).status).toBe(status);
    }
  });

  it('restricts course upload progress to the owner and the course folder', async () => {
    const folder = randomUUID(), node = randomUUID(), upload = randomUUID();
    await db.unsafe(`INSERT INTO drive_nodes(id,owner_user_id,kind,name) VALUES($1,3,'folder',$2)`, [folder, `course-media-${courseId}`]);
    await db.unsafe(`INSERT INTO drive_nodes(id,owner_user_id,parent_id,kind,name,mime_type,status) VALUES($1,3,$2,'file','lesson.mp4','video/mp4','uploading')`, [node, folder]);
    await db.unsafe(`INSERT INTO drive_uploads(id,node_id,owner_user_id,expected_bytes,received_bytes,expires_at) VALUES($1,$2,3,100,50,NOW()+INTERVAL '1 hour')`, [upload, node]);
    try {
      const url = `/platform/instructor/courses/${courseId}/lesson-uploads/${upload}`;
      const response = await app.request(url, { method: 'HEAD', headers: headers(3) });
      expect(response.status).toBe(204);
      expect(response.headers.get('Upload-Offset')).toBe('50');
      const get = await app.request(url, { headers: headers(3) });
      expect(get.status).toBe(405);
      expect(get.headers.get('Allow')).toBe('HEAD');
      expect((await app.request(url, { method: 'HEAD', headers: headers(4) })).status).toBe(404);
      expect((await app.request(url, { method: 'HEAD' })).status).toBe(401);
      await db.unsafe('UPDATE drive_nodes SET parent_id=NULL WHERE id=$1', [node]);
      expect((await app.request(url, { method: 'HEAD', headers: headers(3) })).status).toBe(404);
    } finally {
      await db.unsafe('DELETE FROM drive_nodes WHERE id=$1 OR id=$2', [node, folder]);
    }
  });

  it('updates trial access against actual stored lessons and restores entitlement checks', async () => {
    const select = (ids: string[]) => db.begin(tx => saveCourseTrialLessonSelection(tx as unknown as PlatformDb, courseId, ids));
    try {
      await select([lessons[1]]);
      expect((await descriptor(1)).status).toBe(200);
      expect((await descriptor(2)).status).toBe(401);
    } finally { await select([lessons[2]]); }
  });

  it('serializes simultaneous lesson appends to distinct consecutive positions', async () => {
    const create = (suffix: string) => app.request(`/platform/instructor/courses/${courseId}/lessons`, {
      method: 'POST', headers: { ...headers(3), 'Content-Type': 'application/json', 'Idempotency-Key': `append-lesson-fixture-${suffix}` },
      body: JSON.stringify({ slug: `append-${suffix}`, ordinal: 3, appendToCourse: true, titleEn: `Append ${suffix}`, status: 'draft' }),
    });
    const results = await Promise.all([create('one'), create('two')]);
    expect(results.map(response => response.status)).toEqual([201, 201]);
    const rows = await db.unsafe(`SELECT ordinal FROM platform_lessons WHERE course_id=$1 AND slug LIKE 'append-%' ORDER BY ordinal`, [courseId]);
    expect(rows.map(row => Number(row.ordinal))).toEqual([3, 4]);
  });

  it('requires administrator approval for publication and preserves the live revision during review', async () => {
    const mutation = (url: string, method: string, actor: number, body: unknown) => app.request(url, {
      method, headers: { ...headers(actor), 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(body),
    });
    const create = await mutation('/platform/instructor/courses', 'POST', 3, { slug: 'review-course-fixture', titleEn: 'Draft course', status: 'draft' });
    expect(create.status).toBe(201);
    const { course: { id } } = await create.json();
    expect((await db.unsafe('SELECT status FROM platform_courses WHERE id=$1', [id]))[0].status).toBe('draft');
    const submit = await mutation(`/platform/instructor/courses/${id}`, 'PATCH', 3, { status: 'pending_review', targetStatus: 'published', titleEn: 'Reviewed course' });
    expect(submit.status).toBe(200);
    const { course: { reviewId } } = await submit.json();
    expect((await db.unsafe('SELECT status FROM platform_courses WHERE id=$1', [id]))[0].status).toBe('draft');
    const decision = `/platform/admin/courses/${id}/content-reviews/${reviewId}/decision`;
    expect((await mutation(decision, 'POST', 3, { decision: 'approved' })).status).toBe(403);
    expect((await mutation(decision, 'POST', 5, { decision: 'approved' })).status).toBe(200);
    expect((await db.unsafe('SELECT status FROM platform_courses WHERE id=$1', [id]))[0].status).toBe('published');
    const lessonCreate = await mutation(`/platform/instructor/courses/${id}/lessons`, 'POST', 3, {
      slug: 'text-lesson', ordinal: 1, status: 'published', titleEn: 'Original lesson', bodyEn: { markdown: 'Original text' },
    });
    expect(lessonCreate.status).toBe(201);
    const { lesson: { id: lessonId } } = await lessonCreate.json();
    const query = () => db.unsafe(`SELECT l.status,r.body_en FROM platform_lessons l JOIN platform_lesson_revisions r ON r.lesson_id=l.id AND r.revision=l.current_revision WHERE l.id=$1`, [lessonId]);
    expect((await query())[0].status).toBe('draft');
    const lessonReviews = await db.unsafe('SELECT id FROM platform_content_reviews WHERE lesson_id=$1 AND status=$2', [lessonId, 'pending']);
    expect((await mutation(`/platform/admin/courses/${id}/content-reviews/${lessonReviews[0].id}/decision`, 'POST', 5, { decision: 'approved' })).status).toBe(200);
    expect((await query())[0]).toMatchObject({ status: 'published', body_en: { markdown: 'Original text' } });
    const edit = await mutation(`/platform/instructor/courses/${id}/lessons/${lessonId}`, 'PATCH', 3, { status: 'published', bodyEn: { markdown: 'Revision for review' } });
    expect(edit.status).toBe(200);
    expect((await query())[0].body_en).toEqual({ markdown: 'Original text' });
    const { lesson: { reviewId: editReview } } = await edit.json();
    expect((await mutation(`/platform/admin/courses/${id}/content-reviews/${editReview}/decision`, 'POST', 5, { decision: 'rejected', note: 'Please revise' })).status).toBe(200);
    expect((await query())[0].body_en).toEqual({ markdown: 'Original text' });
    const [notification] = await db.unsafe('SELECT title, excerpt FROM notifications WHERE dedupe_key=$1',
      [`content-review:${editReview}:rejected`]);
    expect(notification).toMatchObject({ title: expect.stringContaining('Rejected'), excerpt: 'Original lesson\nPlease revise' });
  });

  it('publishes a text preview, reorders lessons atomically and preserves hidden reviews after edits', async () => {
    const write = (url: string, actor: number, body: unknown, method = 'POST', idempotencyKey: string = randomUUID()) => app.request(url, {
      method, headers: { ...headers(actor), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    });
    const create = await write('/platform/instructor/courses', 3, {
      slug: 'qa-text-course', titleEn: 'Text-only beginner course', status: 'published',
      presentation: { tags: ['puzzle:333', 'topic:beginner'], target: 'Solve independently' },
    });
    expect(create.status, await create.clone().text()).toBe(201);
    const id = (await create.json()).course.id;
    const editor = `/platform/instructor/courses/${id}`;
    const adminCourse = `/platform/admin/courses/${id}`;
    const createLesson = (slug: string, ordinal: number, lessonType: string, accessScope: string) => write(`${editor}/lessons`, 3, {
      slug, ordinal, lessonType, accessScope, status: 'published', titleEn: `QA ${slug}`, bodyEn: { markdown: '**Notes**' },
    });
    const introResult = await createLesson('intro-qa', 4, 'introduction', 'public');
    const trialResult = await createLesson('free-qa', 9, 'core', 'public');
    expect([introResult.status, trialResult.status]).toEqual([201, 201]);
    const { lesson: { id: intro } } = await introResult.json();
    const { lesson: { id: trial } } = await trialResult.json();
    const reviewQueue = await app.request('/platform/admin/courses?pending=1', { headers: headers(5) });
    expect(await reviewQueue.json()).toMatchObject({ courses: expect.arrayContaining([expect.objectContaining({ id, reviewStatus: 'pending' })]) });
    const quiz = { titleEn: 'After reading', status: 'published', passingScoreBps: 6000,
      questions: [{ type: 'boolean', promptEn: 'Read the notes?', answerKey: true, explanation: 'The lesson includes written notes.' }] };
    expect((await write(`${editor}/lessons/${trial}/quizzes`, 3, quiz)).status).toBe(409);
    const approveUrl = `${adminCourse}/content-reviews/approve-all`;
    expect((await write(approveUrl, 3, {})).status).toBe(403);
    const approved = await write(approveUrl, 5, {}, 'POST', 'qa-batch-approve');
    expect(approved.status, await approved.clone().text()).toBe(200);
    expect(await approved.json()).toEqual({ approvedCount: 3 });
    expect(await (await write(approveUrl, 5, {}, 'POST', 'qa-batch-approve')).json()).toEqual({ approvedCount: 3 });
    expect(await db.unsafe(`SELECT count(*)::int AS count FROM notifications
      WHERE user_key='u3' AND kind='teaching_message' AND dedupe_key LIKE '%:approved' AND link=$1`, [`/platform/instructor/courses/${id}`])).toEqual([{ count: 3 }]);
    expect(await db.unsafe(`SELECT count(*)::int AS count FROM platform_outbox_events
      WHERE event_type='platform.lesson.updated' AND aggregate_id=ANY($1::text[])`, [[intro, trial]])).toEqual([{ count: 2 }]);

    const quizResult = await write(`${editor}/lessons/${trial}/quizzes`, 3, quiz);
    expect(quizResult.status, await quizResult.clone().text()).toBe(201);
    const { id: quizId, reviewId: quizReview, reviewStatus } = (await quizResult.json()).quiz;
    expect(reviewStatus).toBe('pending');
    const quizPath = `${editor}/lessons/${trial}/quizzes/${quizId}`;
    const adminQuizPath = `${adminCourse}/lessons/${trial}/quizzes/${quizId}`;
    const readQuiz = async (url: string, actor: number) => (await app.request(url, { headers: headers(actor) })).json();
    const readLiveQuiz = async () => (await db.unsafe('SELECT slug,status,current_revision FROM platform_quizzes WHERE id=$1', [quizId]))[0];
    const initialQuiz = await readLiveQuiz();
    expect(initialQuiz.slug).toMatch(/^quiz-[0-9a-f-]+$/);
    expect(initialQuiz.status).toBe('draft');
    expect((await write(`/learning/lessons/${trial}/quiz`, 1, { quizId, answers: [false] })).status).toBe(404);
    expect((await readQuiz(adminCourse, 5)).course.pendingQuizzes).toMatchObject([{ id: quizId, lessonId: trial, titleEn: quiz.titleEn }]);
    expect((await readQuiz(adminQuizPath, 5)).quiz).toMatchObject({
      titleZh: quiz.titleEn, titleEn: quiz.titleEn, reviewId: quizReview,
      questions: [expect.objectContaining({ explanation: 'The lesson includes written notes.' })],
    });
    expect((await write(quizPath, 3, { titleEn: 'Pending lock' }, 'PATCH')).status).toBe(409);
    expect((await write(approveUrl, 5, {})).status).toBe(200);
    const liveQuiz = await readLiveQuiz();
    expect(liveQuiz.status).toBe('published');
    expect(liveQuiz.current_revision).toBeGreaterThan(initialQuiz.current_revision);
    const submission = await write(`/learning/lessons/${trial}/quiz`, 1, { quizId, answers: [false] });
    expect(submission.status, await submission.clone().text()).toBe(201);
    expect(await submission.json()).toMatchObject({ passed: false, feedback: [
      expect.objectContaining({ correct: false, explanation: 'The lesson includes written notes.' }),
    ] });

    const draft = await write(quizPath, 3, { status: 'draft', titleZh: '新版测验', titleEn: '', passingScoreBps: 7000,
      questions: [{ type: 'single_choice', promptEn: 'Read the notes?', choices: ['No', 'Yes'], answerKey: 1, explanation: 'New explanation.' }],
    }, 'PATCH');
    expect(draft.status, await draft.clone().text()).toBe(200);
    expect(await readLiveQuiz()).toEqual(liveQuiz);
    expect((await readQuiz(quizPath, 3)).quiz).toMatchObject({ editStatus: 'draft', titleEn: '新版测验', revision: expect.any(Number) });
    const resubmitQuiz = () => write(quizPath, 3, { status: 'pending_review', targetStatus: 'published' }, 'PATCH');
    const pendingQuiz = await resubmitQuiz();
    expect(pendingQuiz.status, await pendingQuiz.clone().text()).toBe(200);
    const pendingId = (await pendingQuiz.json()).quiz.reviewId;
    expect((await readQuiz(adminQuizPath, 5)).quiz).toMatchObject({
      passingScoreBps: 7000, questions: [{ choices: ['No', 'Yes'], explanation: 'New explanation.' }],
      reviewBase: { titleEn: quiz.titleEn, passingScoreBps: 6000, questions: [{ explanation: 'The lesson includes written notes.' }] },
    });
    expect((await write(`${editor}/content-reviews/${pendingId}/withdraw`, 3, {})).status).toBe(200);
    expect((await readQuiz(quizPath, 3)).quiz.reviewStatus).toBe('withdrawn');
    expect(await readLiveQuiz()).toEqual(liveQuiz);
    const rejectedId = (await (await resubmitQuiz()).json()).quiz.reviewId;
    expect((await write(`${adminCourse}/content-reviews/${rejectedId}/decision`, 5, { decision: 'rejected', note: 'Revise options' })).status).toBe(200);
    expect((await readQuiz(quizPath, 3)).quiz).toMatchObject({ reviewStatus: 'rejected', reviewNote: 'Revise options' });
    expect(await readLiveQuiz()).toEqual(liveQuiz);
    const finalReview = (await (await resubmitQuiz()).json()).quiz.reviewId;
    expect((await write(`${adminCourse}/content-reviews/${finalReview}/decision`, 5, { decision: 'approved' })).status).toBe(200);
    expect((await readLiveQuiz()).current_revision).toBeGreaterThan(liveQuiz.current_revision);
    expect((await db.unsafe('SELECT title, excerpt FROM notifications WHERE dedupe_key=$1', [`content-review:${finalReview}:approved`]))[0])
      .toMatchObject({ title: expect.stringContaining('Quiz'), excerpt: '新版测验' });

    const moved = await write(`${editor}/lessons/${trial}`, 3, { move: 'up' }, 'PATCH', 'qa-move-lesson');
    expect(moved.status, await moved.clone().text()).toBe(200);
    expect((await write(`${editor}/lessons/${trial}`, 3, { move: 'up' }, 'PATCH', 'qa-move-lesson')).status).toBe(200);
    expect(await db.unsafe('SELECT id::text, ordinal FROM platform_lessons WHERE course_id=$1 ORDER BY ordinal', [id]))
      .toEqual([{ id: trial, ordinal: 4 }, { id: intro, ordinal: 9 }]);

    const list = '/platform/courses?trial=1&puzzle=333&category=beginner&facets=1&q=Text-only+beginner&pageSize=1';
    const catalog = await app.request(list);
    expect(catalog.status, await catalog.clone().text()).toBe(200);
    expect(await catalog.json()).toMatchObject({ total: 1, courses: [{ id, firstTrialLessonId: trial, presentation: { target: 'Solve independently' } }],
      categories: expect.arrayContaining(['puzzle:333', 'topic:beginner']), catalogTopicPuzzles: { beginner: ['333'] } });
    expect(await (await app.request(list + '&page=2')).json()).toMatchObject({ total: 1, courses: [] });
    const lessonPage = await app.request(`/platform/courses/${id}/lessons/${trial}`);
    expect(await lessonPage.json()).toMatchObject({ lesson: { mediaId: null, lessonType: 'core', bodyEn: { markdown: '**Notes**' } } });
    expect((await app.request(`/lessons/${trial}/media`)).status).toBe(404);

    const [entitlement] = await db.unsafe('INSERT INTO platform_course_entitlements(user_id,course_id,valid_from) VALUES(1,$1,NOW()) RETURNING id', [id]);
    await db.unsafe(`INSERT INTO platform_entitlement_ledger(entitlement_id,entry_type,delta_access,valid_from,reason,actor_user_id)
      VALUES($1,'grant',1,NOW(),'Course test fixture',5)`, [entitlement.id]);
    for (const lessonId of [trial, intro]) {
      const progress = await write(`/me/progress/${lessonId}`, 1, { positionSeconds: 0, progressBps: 10000, status: 'completed' }, 'PUT');
      expect(progress.status, await progress.clone().text()).toBe(200);
    }
    const courses = await app.request(`/me/courses?courseIds=${id}`, { headers: headers(1) });
    expect(await courses.json()).toMatchObject({ items: [{ id, completedLessons: 2, progressBps: 10000 }] });
    const certificate = await write('/me/certificates', 1, { courseId: id });
    expect(certificate.status, await certificate.clone().text()).toBe(201);

    const review = await write(`/courses/${id}/reviews`, 1, { rating: 2, body: 'Original comment' });
    expect(review.status, await review.clone().text()).toBe(200);
    const { id: reviewId } = await review.json();
    const hideUrl = `/admin/courses/${id}/reviews/${reviewId}`;
    expect((await write(hideUrl, 1, { note: 'Test moderation' }, 'PATCH')).status).toBe(403);
    const hidden = await write(hideUrl, 5, { note: 'Test moderation' }, 'PATCH');
    expect(hidden.status, await hidden.clone().text()).toBe(200);
    expect(await (await write(`/courses/${id}/reviews`, 1, { rating: 3, body: 'Edited comment' })).json())
      .toMatchObject({ status: 'hidden', body: 'Edited comment' });
    const view = await app.request(adminCourse, { headers: headers(5) });
    expect(view.status, await view.clone().text()).toBe(200);
    expect(await view.json()).toMatchObject({ course: { reviewsForModeration: [{ id: reviewId, status: 'hidden', moderationNote: 'Test moderation' }] } });

    const resubmit = await write(editor, 3, { status: 'published', titleEn: 'Updated lesson course', baseAmountMinor: 3500 }, 'PATCH');
    expect(resubmit.status).toBe(200);
    const comparison = await app.request(adminCourse, { headers: headers(5) });
    expect(await comparison.json()).toMatchObject({ course: {
      titleEn: 'Updated lesson course', reviewMetadata: { baseAmountMinor: 3500 },
      reviewBase: { titleEn: 'Text-only beginner course', baseAmountMinor: 0 },
    } });
  });

  it('keeps effective trial permissions through old snapshots and independent course and lesson approvals', async () => {
    const id = randomUUID();
    await db.begin(async tx => {
      await tx.unsafe("INSERT INTO platform_courses(id,slug,status,current_revision,published_at) VALUES($1,'qa-stale-trials','published',1,NOW())", [id]);
      await tx.unsafe(`INSERT INTO platform_course_revisions(course_id,revision,title_en,status,content_hash,presentation,published_at)
        VALUES($1,1,'Independent trials','published',decode(repeat('ab',32),'hex'),'{"trialLessonIds":[]}'::jsonb,NOW())`, [id]);
      await tx.unsafe(`INSERT INTO platform_course_owners(course_id,instructor_id,role)
        SELECT $1,id,'owner' FROM platform_instructors WHERE user_id=3`, [id]);
    });
    const editor = `/platform/instructor/courses/${id}`;
    const adminCourse = `/platform/admin/courses/${id}`;
    const write = (path: string, actor: number, body: unknown, method = 'POST') => app.request(path, {
      method, headers: { ...headers(actor), 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body),
    });
    const getCourse = async (path: string, actor: number) => (await (await app.request(path, { headers: headers(actor) })).json()).course;
    const add = async (ordinal: number, lessonType: string, accessScope?: string) => {
      const result = await write(`${adminCourse}/lessons`, 5, { ordinal, lessonType, slug: `trial-test-${ordinal}`, titleZh: `课时 ${ordinal}`, status: 'published', accessScope });
      expect(result.status, await result.clone().text()).toBe(201);
      return (await result.json()).lesson.id;
    };
    const scope = async (lesson: string) => (await db.unsafe('SELECT access_scope FROM platform_lessons WHERE id=$1', [lesson]))[0].access_scope;
    const intro = await add(1, 'introduction');
    const preview = await add(2, 'core', 'public');
    const paid = await add(3, 'core', 'entitled');
    const other = await add(4, 'core', 'entitled');
    expect(await scope(intro)).toBe('public');
    expect((await getCourse(editor, 3)).presentation).not.toHaveProperty('trialLessonIds');
    const stale = await write(adminCourse, 5, { titleEn: 'Title only', presentation: { trialLessonIds: [] } }, 'PATCH');
    expect(stale.status, await stale.clone().text()).toBe(200);
    expect(await scope(preview)).toBe('public');
    const next = await write(editor, 3, { status: 'published', trialSelectionChanged: true, presentation: { trialLessonIds: [preview, paid] } }, 'PATCH');
    expect(next.status, await next.clone().text()).toBe(200);
    expect((await getCourse(editor, 3)).presentation.trialLessonIds).toEqual([paid, preview].sort());
    const lessonChange = await write(`${editor}/lessons/${other}`, 3, { status: 'published', accessScope: 'public' }, 'PATCH');
    expect(lessonChange.status, await lessonChange.clone().text()).toBe(200);
    expect((await getCourse(editor, 3)).lessons.find((lesson: { id: string }) => lesson.id === other)).toMatchObject({
      accessScope: 'public', liveAccessScope: 'entitled', reviewBase: { accessScope: 'entitled' },
    });
    const { reviewId: lessonReview } = (await lessonChange.json()).lesson;
    expect((await write(`${adminCourse}/content-reviews/${lessonReview}/decision`, 5, { decision: 'approved' })).status).toBe(200);
    expect((await write(`${adminCourse}/content-reviews/approve-all`, 5, {})).status).toBe(200);
    expect(await Promise.all([intro, preview, paid, other].map(scope))).toEqual(['public', 'public', 'public', 'public']);
    const published = await getCourse(`/platform/courses/${id}`, 1);
    expect(published.presentation).not.toHaveProperty('trialLessonIds');
    expect(published.lessons[0]).toMatchObject({ lessonType: 'introduction', titleZh: '课时 1', titleEn: '课时 1' });
    expect((await (await app.request('/platform/courses?trial=1&q=Title+only')).json()).courses).toMatchObject([{ id, firstTrialLessonId: preview }]);
  });

  it('exposes legacy presentation defaults without changing the sealed course revision', async () => {
    const response = await app.request(`/platform/admin/courses/${legacyCourseId}`, { headers: headers(5) });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ course: { presentation: {
      levelZh: '零基础学员', targetEn: 'Custom goal', tags: ['puzzle:333', 'topic:beginner'],
    } } });
    const [row] = await db.unsafe('SELECT presentation FROM platform_course_revisions WHERE course_id=$1', [legacyCourseId]);
    expect(row.presentation).toEqual({ targetEn: 'Custom goal' });
  });

  it('denies new media access when an entitlement expires or is revoked', async () => {
    try {
      await db.unsafe(`UPDATE platform_course_entitlements SET valid_from=NOW()-INTERVAL '2 days',valid_until=NOW()-INTERVAL '1 day' WHERE user_id=1`);
      expect((await descriptor(0, 1)).status).toBe(403);
      await db.unsafe(`UPDATE platform_course_entitlements SET valid_until=NULL,status='revoked' WHERE user_id=1`);
      expect((await descriptor(0, 1)).status).toBe(403);
    } finally {
      await db.unsafe(`UPDATE platform_course_entitlements SET valid_from=NOW(),valid_until=NULL,status='active' WHERE user_id=1`);
    }
  });

  it('hides new media access for draft or archived courses, including public lessons', async () => {
    try {
      for (const status of ['draft', 'archived']) {
        await db.unsafe('UPDATE platform_courses SET status=$2,archived_at=NOW() WHERE id=$1', [courseId, status]);
        expect((await descriptor(0, 1)).status).toBe(404);
        expect((await descriptor(2)).status).toBe(404);
      }
      await db.unsafe(`UPDATE platform_courses SET status='unlisted',archived_at=NULL WHERE id=$1`, [courseId]);
      expect((await descriptor(0, 1)).status).toBe(200);
    } finally {
      await db.unsafe(`UPDATE platform_courses SET status='published',archived_at=NULL WHERE id=$1`, [courseId]);
    }
  });

  it('serves signed video ranges and cover bytes with private headers and HEAD support', async () => {
    const response = await descriptor(0, 1);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { accessUrl, posterUrl } = await response.json();
    const ranged = await requestUrl(accessUrl, { headers: { Range: 'bytes=2-5' } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('Content-Range')).toBe('bytes 2-5/16');
    expect(ranged.headers.get('Cache-Control')).toBe('private, no-store');
    expect(ranged.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await ranged.text()).toBe('2345');
    const head = await requestUrl(accessUrl, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('Content-Length')).toBe('16');
    expect(await head.text()).toBe('');
    const unsatisfiable = await requestUrl(accessUrl, { headers: { Range: 'bytes=16-' } });
    expect(unsatisfiable.status).toBe(416);
    expect(unsatisfiable.headers.get('Content-Range')).toBe('bytes */16');
    const poster = await requestUrl(posterUrl);
    expect(poster.headers.get('Content-Type')).toBe('image/png');
    expect(Buffer.from(await poster.arrayBuffer())).toEqual(bytes);
  });

  it('rejects tampered, expired, cross-lesson and video-as-cover tokens', async () => {
    const { accessUrl } = await (await descriptor(0, 1)).json();
    const signed = new URL(accessUrl);
    const token = signed.searchParams.get('token')!;
    const expired = createPlatformMediaToken({ mediaId, binding: `lesson:${lessons[0]}:1`, nowSeconds: Math.floor(Date.now() / 1000) - 301 });
    const [payload, signature] = token.split('.');
    const tampered = `${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    for (const invalid of [tampered, expired.token]) {
      expect((await app.request(`/lessons/${lessons[0]}/media?token=${invalid}`)).status).toBe(403);
    }
    expect((await app.request(`/lessons/${lessons[1]}/media?token=${token}`)).status).toBe(403);
    expect((await app.request(`/lessons/${lessons[0]}/cover?token=${token}`)).status).toBe(403);
  });

  it('fails closed when the stored media no longer matches its metadata', async () => {
    const { accessUrl } = await (await descriptor(0, 1)).json();
    await writeFile(path.join(mediaDirectory, 'lesson.mp4'), bytes.subarray(1));
    try {
      const response = await requestUrl(accessUrl);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: { code: 'PRIVATE_DATA_UNREADABLE' } });
    } finally { await writeFile(path.join(mediaDirectory, 'lesson.mp4'), bytes); }
  });
});
