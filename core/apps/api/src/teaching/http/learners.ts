import { uuidParam } from '../validation/common.js';
import { paginationOf, jsonBody, idempotencyKeyOf } from './request.js';
import { parseLeaveRequestInput } from '../validation/sessions.js';
import { sha256, stableJson } from '../encoding.js';
import type { TeachingRouteContext } from './context.js';

export function registerLearnersRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/me/learning-contexts', (c) => withActor(c, async (actor, requestId) => {
    return c.json({
      learningContexts: await repository.listLearningContexts(actor, null, requestId),
    });
  }));

  routes.get('/teaching/organizations/:orgSlug/me/students', (c) => withActor(c, async (actor, requestId) => {
    return c.json({
      learningContexts: await repository.listLearningContexts(
        actor,
        c.req.param('orgSlug'),
        requestId,
      ),
    });
  }));

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports',
    (c) => withActor(c, async (actor, requestId) => {
      const page = await repository.listLearnerWeeklyReports(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        paginationOf(c),
        requestId,
      );
      return c.json({
        weeklyReports: page.items,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      });
    }),
  );

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports/:reportId',
    (c) => withActor(c, async (actor, requestId) => {
      const weeklyReport = await repository.getLearnerWeeklyReport(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('reportId'), 'reportId'),
        requestId,
      );
      return c.json({ weeklyReport });
    }),
  );

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/lesson-feedback',
    (c) => withActor(c, async (actor, requestId) => {
      const page = await repository.listLearnerLessonFeedback(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        paginationOf(c),
        requestId,
      );
      return c.json({
        feedback: page.items,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      });
    }),
  );

  routes.get('/teaching/organizations/:orgSlug/me/students/:studentId/sessions', (c) => withActor(c, async (actor, requestId) => {
    const studentId = uuidParam(c.req.param('studentId'), 'studentId');
    const page = await repository.listLearnerSessions(
      actor, c.req.param('orgSlug'), studentId, paginationOf(c), requestId,
    );
    return c.json({ sessions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.get(
    '/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/leave-requests',
    (c) => withActor(c, async (actor, requestId) => {
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const page = await repository.listLearnerLeaveRequests(
        actor, c.req.param('orgSlug'), studentId, sessionId, paginationOf(c), requestId,
      );
      return c.json({
        leaveRequests: page.items, total: page.total, page: page.page, pageSize: page.pageSize,
      });
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/attendance/:attendanceId/leave-requests',
    (c) => withActor(c, async (actor, requestId) => {
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const body = await jsonBody(c, 4_096);
      const input = parseLeaveRequestInput(body.value);
      const result = await repository.createLearnerLeaveRequest(
        actor, c.req.param('orgSlug'), studentId, sessionId, attendanceId, input,
        idempotencyKeyOf(c), sha256(stableJson({ studentId, sessionId, attendanceId, input })), requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/cancel',
    (c) => withActor(c, async (actor, requestId) => {
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const leaveRequestId = uuidParam(c.req.param('leaveRequestId'), 'leaveRequestId');
      const body = await jsonBody(c, 4_096);
      const input = parseLeaveRequestInput(body.value);
      const result = await repository.cancelLearnerLeaveRequest(
        actor, c.req.param('orgSlug'), studentId, sessionId, attendanceId, leaveRequestId, input,
        idempotencyKeyOf(c),
        sha256(stableJson({ studentId, sessionId, attendanceId, leaveRequestId, input })), requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

}
