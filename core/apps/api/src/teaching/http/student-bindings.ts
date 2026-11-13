import { jsonBody, idempotencyKeyOf } from './request.js';
import { uuidParam, assertOnlyKeys } from '../validation/common.js';
import { parseStudentAccountBindingInviteInput, parseStudentAccountBindingConsumeInput } from '../validation/bindings.js';
import { sha256 } from '../encoding.js';
import type { TeachingRouteContext } from './context.js';

export function registerStudentBindingsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.post('/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites', (c) => withActor(c, async (actor, requestId) => {
    const body = await jsonBody(c, 1_024);
    const result = await repository.createStudentAccountBindingInvite(
      actor,
      c.req.param('orgSlug'),
      uuidParam(c.req.param('studentId'), 'studentId'),
      parseStudentAccountBindingInviteInput(body.value),
      requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/students/:studentId/account-binding-invite', (c) => withActor(c, async (actor, requestId) => {
    const result = await repository.getCurrentStudentAccountBindingInvite(
      actor,
      c.req.param('orgSlug'),
      uuidParam(c.req.param('studentId'), 'studentId'),
      requestId,
    );
    return c.json(result);
  }));

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites/:inviteId/revoke',
    (c) => withActor(c, async (actor, requestId) => {
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, 1_024);
      assertOnlyKeys(body.value, [], 'student account binding invite revoke input');
      const result = await repository.revokeStudentAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('inviteId'), 'inviteId'),
        key,
        sha256(body.raw),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.post('/teaching/me/student-account-binding/preview', (c) => withActor(c, async (actor, requestId) => {
    const body = await jsonBody(c, 1_024);
    const parsed = parseStudentAccountBindingConsumeInput(body.value);
    const result = await repository.previewStudentAccountBindingInvite(
      actor,
      { tokenHash: sha256(parsed.token) },
      requestId,
    );
    return c.json(result);
  }));

  routes.post('/teaching/me/student-account-binding/consume', (c) => withActor(c, async (actor, requestId) => {
    const body = await jsonBody(c, 1_024);
    const parsed = parseStudentAccountBindingConsumeInput(body.value);
    const result = await repository.consumeStudentAccountBindingInvite(
      actor,
      { tokenHash: sha256(parsed.token) },
      requestId,
    );
    return c.json(result.body, result.status);
  }));

}
