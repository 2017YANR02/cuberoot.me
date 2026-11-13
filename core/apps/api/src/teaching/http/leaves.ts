import { uuidParam } from '../validation/common.js';
import { paginationOf, jsonBody, idempotencyKeyOf } from './request.js';
import { parseLeaveRequestInput, parseLeaveDecisionInput } from '../validation/sessions.js';
import { sha256, stableJson } from '../encoding.js';
import type { TeachingRouteContext } from './context.js';

export function registerLeavesRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId/leave-requests', (c) => withActor(c, async (actor, requestId) => {
    const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
    const page = await repository.listLeaveRequests(
      actor, c.req.param('orgSlug'), sessionId, paginationOf(c), requestId,
    );
    return c.json({
      leaveRequests: page.items, total: page.total, page: page.page, pageSize: page.pageSize,
    });
  }));

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests',
    (c) => withActor(c, async (actor, requestId) => {
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const body = await jsonBody(c, 4_096);
      const input = parseLeaveRequestInput(body.value);
      const result = await repository.createLeaveRequest(
        actor, c.req.param('orgSlug'), sessionId, attendanceId, input, idempotencyKeyOf(c),
        sha256(stableJson({ sessionId, attendanceId, input })), requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/decision',
    (c) => withActor(c, async (actor, requestId) => {
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const leaveRequestId = uuidParam(c.req.param('leaveRequestId'), 'leaveRequestId');
      const body = await jsonBody(c, 4_096);
      const input = parseLeaveDecisionInput(body.value);
      const result = await repository.decideLeaveRequest(
        actor, c.req.param('orgSlug'), sessionId, attendanceId, leaveRequestId, input,
        idempotencyKeyOf(c),
        sha256(stableJson({ sessionId, attendanceId, leaveRequestId, input })), requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/cancel',
    (c) => withActor(c, async (actor, requestId) => {
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const leaveRequestId = uuidParam(c.req.param('leaveRequestId'), 'leaveRequestId');
      const body = await jsonBody(c, 4_096);
      const input = parseLeaveRequestInput(body.value);
      const result = await repository.cancelLeaveRequest(
        actor, c.req.param('orgSlug'), sessionId, attendanceId, leaveRequestId, input,
        idempotencyKeyOf(c),
        sha256(stableJson({ sessionId, attendanceId, leaveRequestId, input })), requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

}
