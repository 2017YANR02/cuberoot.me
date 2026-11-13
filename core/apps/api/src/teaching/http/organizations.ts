import { idempotencyKeyOf, jsonBody, paginationOf } from './request.js';
import { parseOrganizationInput, parseMemberInput, parseStudentInput } from '../validation/organizations.js';
import { sha256 } from '../encoding.js';
import { uuidParam } from '../validation/common.js';
import type { TeachingRouteContext } from './context.js';

export function registerOrganizationsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations', (c) => withActor(c, async (actor) => {
    return c.json({ organizations: await repository.listOrganizations(actor) });
  }));

  routes.post('/teaching/organizations', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createOrganization(actor, parseOrganizationInput(body.value), key, sha256(body.raw), requestId);
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug', (c) => withActor(c, async (actor, requestId) => {
    return c.json({ organization: await repository.getOrganization(actor, c.req.param('orgSlug'), requestId) });
  }));

  routes.get('/teaching/organizations/:orgSlug/summary', (c) => withActor(c, async (actor, requestId) => {
    return c.json({ summary: await repository.getOrganizationSummary(actor, c.req.param('orgSlug'), requestId) });
  }));

  routes.get('/teaching/organizations/:orgSlug/members', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listMembers(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
    return c.json({ members: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/members', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createMember(actor, c.req.param('orgSlug'), parseMemberInput(body.value), key, sha256(body.raw), requestId);
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/students', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listStudents(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
    return c.json({ students: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/students', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createStudent(actor, c.req.param('orgSlug'), parseStudentInput(body.value), key, sha256(body.raw), requestId);
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/students/:studentId', (c) => withActor(c, async (actor, requestId) => {
    const student = await repository.getStudent(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'), requestId,
    );
    return c.json({ student });
  }));

}
