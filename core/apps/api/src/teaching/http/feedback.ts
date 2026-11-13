import { weeklyReportFilterOf, parseGenerateWeeklyReportInput, parsePublishWeeklyReportInput, parseLessonFeedbackInput } from '../validation/feedback.js';
import { paginationOf, idempotencyKeyOf, jsonBody } from './request.js';
import { sha256 } from '../encoding.js';
import { uuidParam } from '../validation/common.js';
import type { TeachingRouteContext } from './context.js';

export function registerFeedbackRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/weekly-reports', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listWeeklyReports(
      actor,
      c.req.param('orgSlug'),
      weeklyReportFilterOf(c),
      paginationOf(c),
      requestId,
    );
    return c.json({
      weeklyReports: page.items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    });
  }));

  routes.post('/teaching/organizations/:orgSlug/weekly-reports/generate', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.generateWeeklyReport(
      actor,
      c.req.param('orgSlug'),
      parseGenerateWeeklyReportInput(body.value),
      key,
      sha256(body.raw),
      requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/weekly-reports/:reportId', (c) => withActor(c, async (actor, requestId) => {
    const weeklyReport = await repository.getWeeklyReport(
      actor,
      c.req.param('orgSlug'),
      uuidParam(c.req.param('reportId'), 'reportId'),
      requestId,
    );
    return c.json({ weeklyReport });
  }));

  routes.post('/teaching/organizations/:orgSlug/weekly-reports/:reportId/publish', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const reportId = uuidParam(c.req.param('reportId'), 'reportId');
    const result = await repository.publishWeeklyReport(
      actor,
      c.req.param('orgSlug'),
      reportId,
      parsePublishWeeklyReportInput(body.value),
      key,
      sha256(body.raw),
      requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId/feedback', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listLessonFeedback(
      actor,
      c.req.param('orgSlug'),
      uuidParam(c.req.param('sessionId'), 'sessionId'),
      paginationOf(c),
      requestId,
    );
    return c.json({ feedback: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/students/:studentId/feedback', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
    const studentId = uuidParam(c.req.param('studentId'), 'studentId');
    const result = await repository.createLessonFeedback(
      actor,
      c.req.param('orgSlug'),
      sessionId,
      studentId,
      parseLessonFeedbackInput(body.value),
      key,
      sha256(JSON.stringify([sessionId, studentId, body.raw])),
      requestId,
    );
    return c.json(result.body, result.status);
  }));

}
