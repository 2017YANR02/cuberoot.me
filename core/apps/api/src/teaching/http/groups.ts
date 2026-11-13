import { paginationOf, idempotencyKeyOf, jsonBody } from './request.js';
import { parseGroupInput, parseStudentGroupMembershipInput, teacherAssignmentTargetOf, parseTeacherAssignmentInput } from '../validation/organizations.js';
import { sha256 } from '../encoding.js';
import { uuidParam } from '../validation/common.js';
import { TeachingApiException } from '../errors.js';
import type { TeachingRouteContext } from './context.js';

export function registerGroupsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/groups', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listGroups(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
    return c.json({ groups: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/groups', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createGroup(
      actor, c.req.param('orgSlug'), parseGroupInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/groups/:groupId', (c) => withActor(c, async (actor, requestId) => {
    const group = await repository.getGroup(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'), requestId,
    );
    return c.json({ group });
  }));

  routes.post('/teaching/organizations/:orgSlug/groups/:groupId/archive', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    if (Object.keys(body.value).length) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'Group archive body must be empty');
    }
    const result = await repository.archiveGroup(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/groups/:groupId/students', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listGroupStudents(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'), paginationOf(c), requestId,
    );
    return c.json({ memberships: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/groups/:groupId/students', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createStudentGroupMembership(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'),
      parseStudentGroupMembershipInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.post('/teaching/organizations/:orgSlug/student-group-memberships/:membershipId/revoke', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    if (Object.keys(body.value).length) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'Membership revoke body must be empty');
    }
    const result = await repository.revokeStudentGroupMembership(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('membershipId'), 'membershipId'),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/teacher-assignments', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTeacherAssignments(
      actor, c.req.param('orgSlug'), teacherAssignmentTargetOf(c), paginationOf(c), requestId,
    );
    return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/teacher-assignments', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createTeacherAssignment(
      actor, c.req.param('orgSlug'), parseTeacherAssignmentInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.post('/teaching/organizations/:orgSlug/teacher-assignments/:assignmentId/revoke', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    if (Object.keys(body.value).length) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'Assignment revoke body must be empty');
    }
    const result = await repository.revokeTeacherAssignment(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

}
