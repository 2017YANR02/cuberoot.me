import { beforeEach, expect, it, vi } from 'vitest';
import type { Context } from 'hono';
import { platformRouter } from '../src/platform/http.js';

const state = vi.hoisted(() => ({ user: 7, admin: false, status: '', instructor: '', profile: 0, note: '', query: vi.fn() }));
const id = '00000000-0000-4000-8000-000000000001';
const instructorId = '00000000-0000-4000-8000-000000000002';
vi.mock('../src/utils/account.js', () => ({ ownerKey: (uid: number, wcaId: string | null) => wcaId || `u${uid}` }));
vi.mock('../src/platform/auth.js', async () => {
  const { forbidden } = await import('../src/platform/errors.js');
  const actor = () => ({ userId: state.user, ownerKey: `u${state.user}`, isAdmin: state.admin, displayName: 'Demo teacher', viaApiKey: false, wcaId: null });
  return { requirePlatformActor: async () => actor(), requirePlatformAdmin: async () => { if (!state.admin) forbidden(); return actor(); } };
});
vi.mock('../src/platform/db.js', async () => {
  const { forbidden } = await import('../src/platform/errors.js');
  return { platformDb: () => ({}), platformQuery: (_db: unknown, sql: string, args: unknown[] = []) => state.query(sql, args),
    withIdempotency: async (_c: Context, _actor: unknown, _scope: string, _body: unknown, run: (db: object) => Promise<unknown>) => run({}),
    enqueuePlatformEvent: vi.fn(), isPostgresConflict: () => false, requireCourseOwner: vi.fn(),
    requireInstructor: async () => { if (state.instructor !== 'active') forbidden(); return '00000000-0000-4000-8000-000000000002'; },
    sendMutation: (c: Context, result: { status: 200 | 201; body: object }) => c.json(result.body, result.status),
  };
});
import { registerInstructorRoutes } from '../src/platform/catalog/instructor-routes.js';
const app = platformRouter();
registerInstructorRoutes(app);
const post = (path: string, body: object = {}) => app.request(`/platform/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture' }, body: JSON.stringify(body) });
const form = { experience: 'Three years', specialties: ['333'], contact: 'demo@example.test', city: 'Shanghai', teachingMode: 'both' };

beforeEach(() => {
  Object.assign(state, { user: 7, admin: false, status: '', instructor: '', profile: 0, note: '' });
  state.query.mockReset().mockImplementation(async (sql: string, args: unknown[]) => {
    if (sql.includes('SELECT wca_id FROM app_users')) return [{ wca_id: null }];
    if (sql.includes('SELECT id FROM app_users')) return [{ id: 7 }];
    if (sql.includes('SELECT id, status FROM platform_instructors')) return state.instructor ? [{ id: instructorId, status: state.instructor }] : [];
    if (sql.includes('SELECT id FROM platform_instructors WHERE id::text')) return state.instructor === 'active' ? [{ id: instructorId }] : [];
    if (sql.includes("status = 'pending'")) return state.status === 'pending' ? [{ id }] : [];
    if (sql.includes('INSERT INTO platform_instructor_applications')) { state.status = 'pending'; return [{ id, status: 'pending' }]; }
    if (sql.includes('SELECT status FROM platform_instructor_applications')) return args[1] === 7 && state.status ? [{ status: state.status }] : [];
    if (sql.includes('SELECT applicant_user_id, applicant_display_name_snapshot')) return state.status ? [{ applicant_user_id: 7, applicant_display_name: 'Demo teacher', status: state.status }] : [];
    if (sql.includes('FROM teacher_directory_entries t WHERE t.owner_key')) return state.profile ? [{ id: state.profile, nameZh: 'Demo', isVisible: false }] : [];
    if (sql.includes('SELECT id FROM teacher_directory_entries')) return args[0] === state.profile && args[1] === 'u7' ? [{ id: state.profile }] : [];
    if (sql.includes('INSERT INTO platform_instructors')) { if (!state.instructor || sql.includes("status = 'active'")) state.instructor = 'active'; return [{ id: instructorId }]; }
    if (sql.includes("SET status='withdrawn'")) { state.status = 'withdrawn'; return []; }
    if (sql.includes('UPDATE platform_instructor_applications SET status=$2')) { state.status = String(args[1]); state.note = String(args[2]); return []; }
    if (sql.includes('UPDATE platform_instructors SET teacher_entry_id')) return [{ id: instructorId }];
    if (sql.includes('FROM platform_instructor_applications WHERE applicant_user_id')) return state.status ? [{ id, status: state.status, application: form }] : [];
    if (sql.includes('FROM platform_instructors i LEFT JOIN teacher_directory_entries')) return state.instructor ? [{ id: instructorId, status: state.instructor, teacherEntryId: state.profile || null, profileVisible: false }] : [];
    return [];
  });
});

it('submits a snapshot once and prevents active instructors or duplicate pending applications', async () => {
  expect((await post('instructor/applications', { ...form, specialties: [] })).status).toBe(400);
  expect((await post('instructor/applications', form)).status).toBe(201);
  expect(state.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO platform_instructor_applications'))?.[1][2]).toMatchObject(form);
  expect((await post('instructor/applications', form)).status).toBe(409);
  state.status = ''; state.instructor = 'active';
  expect((await post('instructor/applications', form)).status).toBe(409);
  state.instructor = 'suspended';
  expect((await post('instructor/applications', form)).status).toBe(409);
});

it('only withdraws an owned pending application and permits reapplication afterwards', async () => {
  state.status = 'pending'; state.user = 8;
  expect((await post(`instructor/applications/${id}/withdraw`)).status).toBe(404);
  state.user = 7;
  expect((await post(`instructor/applications/${id}/withdraw`)).status).toBe(200);
  expect(state.status).toBe('withdrawn');
  expect((await post(`instructor/applications/${id}/withdraw`)).status).toBe(409);
  expect((await post('instructor/applications', form)).status).toBe(201);
});

it('requires an administrator and a rejection reason, then approves once and links an owned profile', async () => {
  state.status = 'pending';
  const path = `admin/instructor-applications/${id}/decision`;
  expect((await post(path, { decision: 'approved' })).status).toBe(403);
  state.admin = true;
  expect((await post(path, { decision: 'rejected', note: ' ' })).status).toBe(400);
  expect((await post(path, { decision: 'rejected', note: 'Add examples' })).status).toBe(200);
  expect(state.note).toBe('Add examples');
  state.status = 'pending'; state.profile = 42;
  expect((await post(path, { decision: 'approved', note: 'Complete' })).status).toBe(200);
  expect(state.instructor).toBe('active'); expect(state.status).toBe('approved');
  expect(state.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO platform_instructors'))?.[1][1]).toBe(42);
  expect(state.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO notifications'))).toHaveLength(2);
  expect((await post(path, { decision: 'approved' })).status).toBe(409);
});

it('returns direct instructor access and only links profiles owned by the active instructor', async () => {
  state.instructor = 'active'; state.profile = 42;
  const response = await app.request('/platform/instructor/applications/current');
  expect(await response.json()).toMatchObject({ application: null, instructor: { status: 'active' } });
  expect((await post('instructor/profile-link', { teacherEntryId: 73 })).status).toBe(404);
  expect((await post('instructor/profile-link', { teacherEntryId: 42 })).status).toBe(200);
  state.instructor = 'suspended';
  expect((await post('instructor/profile-link', { teacherEntryId: 42 })).status).toBe(403);
});

it('lets an archived instructor reapply, then reactivates the same instructor without restoring past course permissions', async () => {
  state.instructor = 'archived'; state.status = 'approved'; state.profile = 42;
  expect((await post('instructor/applications', form)).status).toBe(201);
  expect(state.instructor).toBe('archived');
  expect(await (await app.request('/platform/instructor/applications/current')).json()).toMatchObject({ application: { status: 'pending' }, instructor: { id: instructorId, status: 'archived' } });
  expect((await post('instructor/applications', form)).status).toBe(409);
  state.admin = true;
  const path = `admin/instructor-applications/${id}/decision`;
  const approval = await post(path, { decision: 'approved' });
  expect(approval.status).toBe(200);
  expect(await approval.json()).toMatchObject({ application: { instructorId, status: 'approved' } });
  expect(state.instructor).toBe('active');
  expect(state.query.mock.calls.some(([sql]) => sql.includes('UPDATE platform_course_owners'))).toBe(false);
});

it('does not use a pending application to restore a suspended instructor', async () => {
  state.instructor = 'suspended'; state.status = 'pending'; state.admin = true;
  expect((await post(`admin/instructor-applications/${id}/decision`, { decision: 'approved' })).status).toBe(409);
  expect(state.instructor).toBe('suspended');
  expect(state.status).toBe('pending');
});
