import { uuidParam } from '../validation/common.js';
import { paginationOf, jsonBody, idempotencyKeyOf } from './request.js';
import { parseMakeupScheduleInput } from '../validation/sessions.js';
import { sha256, stableJson } from '../encoding.js';
import type { TeachingRouteContext } from './context.js';

export function registerMakeupsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups',
    (c) => withActor(c, async (actor, requestId) => {
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const page = await repository.listMakeupAttempts(
        actor, c.req.param('orgSlug'), sessionId, attendanceId, paginationOf(c), requestId,
      );
      return c.json({
        makeupAttempts: page.items, total: page.total, page: page.page, pageSize: page.pageSize,
      });
    }),
  );

  routes.get(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups/candidates',
    (c) => withActor(c, async (actor, requestId) => {
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const page = await repository.listMakeupCandidates(
        actor, c.req.param('orgSlug'), sessionId, attendanceId, paginationOf(c), requestId,
      );
      return c.json({ candidates: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups',
    (c) => withActor(c, async (actor, requestId) => {
      const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
      const attendanceId = uuidParam(c.req.param('attendanceId'), 'attendanceId');
      const body = await jsonBody(c, 4_096);
      const input = parseMakeupScheduleInput(body.value);
      const result = await repository.scheduleMakeup(
        actor, c.req.param('orgSlug'), sessionId, attendanceId, input, idempotencyKeyOf(c),
        sha256(stableJson({ sessionId, attendanceId, input })), requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

}
