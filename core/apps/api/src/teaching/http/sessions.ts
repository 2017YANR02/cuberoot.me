import { paginationOf, idempotencyKeyOf, jsonBody } from './request.js';
import { parseSessionInput, parseAttendanceBatchInput, parseSessionCancelInput } from '../validation/sessions.js';
import { sha256, stableJson } from '../encoding.js';
import { uuidParam } from '../validation/common.js';
import { TeachingApiException } from '../errors.js';
import type { TeachingRouteContext } from './context.js';

export function registerSessionsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/sessions', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listSessions(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
    return c.json({ sessions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/sessions', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createSession(
      actor, c.req.param('orgSlug'), parseSessionInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId', (c) => withActor(c, async (actor, requestId) => {
    const session = await repository.getSession(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'), requestId,
    );
    return c.json({ session });
  }));

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/batch', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.saveAttendanceBatch(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'),
      parseAttendanceBatchInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/complete', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    if (Object.keys(body.value).length) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'Session completion body must be empty');
    }
    const result = await repository.completeSession(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/cancel', (c) => withActor(c, async (actor, requestId) => {
    const sessionId = uuidParam(c.req.param('sessionId'), 'sessionId');
    const body = await jsonBody(c, 4_096);
    const input = parseSessionCancelInput(body.value);
    const result = await repository.cancelSession(
      actor, c.req.param('orgSlug'), sessionId, input, idempotencyKeyOf(c),
      sha256(stableJson({ sessionId, input })), requestId,
    );
    return c.json(result.body, result.status);
  }));

}
