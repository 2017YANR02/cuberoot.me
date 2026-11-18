import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queries: [] as { statement: string; parameters: readonly unknown[] }[],
  entitled: true, count: 5, average: 4.8 as number | null, writtenReviews: 1,
}));
vi.mock('../src/db/connection.js', () => {
  const unsafe = async (statement: string, parameters: readonly unknown[] = []) => {
    state.queries.push({ statement, parameters });
    if (statement.includes('INSERT INTO platform_idempotency_requests')) return [{ id: 'request' }];
    if (statement.includes('SELECT id::text AS id, encode(request_hash')) {
      return [{ id: 'request', request_hash_hex: state.queries[0]!.parameters[4], state: 'processing' }];
    }
    if (statement.includes('SELECT lesson.id::text AS id, progress.status AS status')) {
      return [{ id: 'unlocked-lesson', status: 'in_progress' }];
    }
    if (statement.includes('FROM platform_course_entitlements')) return state.entitled ? [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] : [];
    if (statement.includes('INSERT INTO platform_course_reviews')) return [{ id: 'review', rating: parameters[3], body: parameters[4], title: parameters[5] }];
    if (statement.includes('AVG(rating)')) return [{ count: state.count, average: state.average, distribution: [0, 0, 0, 0, state.count] }];
    if (statement.includes('FROM platform_course_reviews WHERE user_id')) return [{ id: 'mine', rating: 4, title: '自己的评价', body: '小记' }];
    if (statement.includes('FROM platform_course_reviews review')) {
      const limit = Number(parameters[1]);
      const offset = Number(parameters[2]);
      return state.count ? Array.from({ length: state.writtenReviews }, (_, index) => ({
        id: `review-${index + 1}`, rating: 5, title: '清楚易懂', body: '学会了', authorName: '学员甲',
      })).slice(offset, offset + limit) : [];
    }
    if (statement.includes('FROM platform_courses c')) return [{ id: '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc', lessons: [], instructors: [] }];
    return [];
  };
  return { sql: { unsafe, begin: async (run: (db: unknown) => Promise<unknown>) => run({ unsafe }) } };
});
vi.mock('../src/platform/auth.js', () => ({
  requirePlatformAdmin: async () => ({ userId: 7, ownerKey: 'test', isAdmin: true }),
  requirePlatformActor: async () => ({ userId: 7, ownerKey: 'test', isAdmin: false }),
}));
import { platformLearningRoutes } from '../src/routes/platform_learning.js';
import { platformCatalogRoutes } from '../src/routes/platform_catalog.js';

const COURSE = '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc';
const post = (body: unknown) => platformLearningRoutes.request(`/courses/${COURSE}/reviews`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'course-review-test' }, body: JSON.stringify(body),
});
beforeEach(() => { state.queries = []; state.entitled = true; state.count = 5; state.average = 4.8; state.writtenReviews = 1; });

it.each([undefined, null, '', '清楚易懂'])('persists an optional review title: %s', async title => {
  const response = await post({ rating: 5, title, body: '学会了' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ rating: 5, title: title ?? '', body: '学会了' });
  const insert = state.queries.find(q => q.statement.includes('INSERT INTO platform_course_reviews'))!;
  expect(insert.parameters[5]).toBe(title ?? '');
  expect(insert.statement).toContain('title = EXCLUDED.title');
});
it.each([{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: '5' }, { rating: 5, title: 'x'.repeat(161) }])('rejects invalid review input: %j', async body => {
  expect((await post(body)).status).toBe(400);
  expect(state.queries.some(q => q.statement.includes('INSERT INTO platform_course_reviews'))).toBe(false);
});
it('still requires an active course entitlement', async () => {
  state.entitled = false;
  expect((await post({ rating: 5 })).status).toBe(400);
  expect(state.queries.some(q => q.statement.includes('INSERT INTO platform_course_reviews'))).toBe(false);
});
it.each([{ count: 5, average: 4.8 }, { count: 0, average: null }])('returns real public review totals: %j', async summary => {
  Object.assign(state, summary);
  const response = await platformCatalogRoutes.request('/platform/courses/yan-ruimin-3x3-beginner');
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ course: { id: COURSE, reviewSummary: summary, reviews: summary.count ? [expect.objectContaining({ title: '清楚易懂' })] : [] } });
  const aggregate = state.queries.find(q => q.statement.includes('AVG(rating)'))!;
  expect(aggregate.statement).toContain("status = 'published'");
  expect(aggregate.parameters).toEqual([COURSE]);
  const reviews = state.queries.find(q => q.statement.includes('FROM platform_course_reviews review'))!;
  expect(reviews.statement).toContain("review.status = 'published'");
  expect(reviews.statement).toContain('LIMIT $2 OFFSET $3');
  expect(reviews.parameters).toEqual([COURSE, 11, 0]);
  expect((await platformCatalogRoutes.request('/platform/courses/yan-ruimin-3x3-beginner?reviewPage=0')).status).toBe(400);
  expect(reviews.statement).toContain('author.display_name');
  expect(reviews.statement).not.toContain('email');
});

it('only returns personal course lesson access when explicitly requested', async () => {
  const path = '/platform/courses/yan-ruimin-3x3-beginner';
  const publicCourse = await (await platformCatalogRoutes.request(path)).json();
  expect(publicCourse.course).not.toHaveProperty('lessonAccess');
  expect(publicCourse.course).not.toHaveProperty('myReview');
  expect(state.queries.some(query => query.statement.includes('progress.status AS status'))).toBe(false);

  const response = await platformCatalogRoutes.request(path + '?includeAccess=1');
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const course = (await response.json()).course;
  expect(course.lessonAccess).toEqual([{ id: 'unlocked-lesson', status: 'in_progress' }]);
  expect(course).toMatchObject({ canReview: true, myReview: { id: 'mine', rating: 4 }, reviewsHasMore: false });
  await platformCatalogRoutes.request(path + '?reviewPage=2');
  expect(state.queries.filter(item => item.statement.includes('FROM platform_course_reviews review')).at(-1)?.parameters)
    .toEqual([COURSE, 11, 10]);
  const query = state.queries.find(item => item.statement.includes('progress.status AS status'))!;
  expect(query.parameters).toEqual([7, COURSE, false]);
  expect(query.statement).toContain('lesson.id = ANY(grant_entry.lesson_ids)');
  expect(query.statement).toContain("lesson.access_scope = 'public'");
});

it('indicates another review page without duplicating the lookahead item', async () => {
  state.count = 12;
  state.writtenReviews = 12;
  const path = '/platform/courses/yan-ruimin-3x3-beginner';
  const first = (await (await platformCatalogRoutes.request(path)).json()).course;
  const second = (await (await platformCatalogRoutes.request(path + '?reviewPage=2')).json()).course;
  expect(first.reviews).toHaveLength(10);
  expect(first.reviewsHasMore).toBe(true);
  expect(second.reviews.map((review: { id: string }) => review.id)).toEqual(['review-11', 'review-12']);
  expect(second.reviewsHasMore).toBe(false);
});
