import { jsonBody, idempotencyKeyOf } from './request.js';
import { uuidParam, assertOnlyKeys } from '../validation/common.js';
import { parseGuardianAccountBindingInviteInput, parseGuardianAccountBindingConsumeInput } from '../validation/bindings.js';
import { sha256 } from '../encoding.js';
import type { TeachingRouteContext } from './context.js';

export function registerGuardianBindingsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites',
    (c) => withActor(c, async (actor, requestId) => {
      const body = await jsonBody(c, 1_024);
      const result = await repository.createGuardianAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('guardianLinkId'), 'guardianLinkId'),
        parseGuardianAccountBindingInviteInput(body.value),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invite',
    (c) => withActor(c, async (actor, requestId) => {
      const result = await repository.getCurrentGuardianAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('guardianLinkId'), 'guardianLinkId'),
        requestId,
      );
      return c.json(result);
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites/:inviteId/revoke',
    (c) => withActor(c, async (actor, requestId) => {
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, 1_024);
      assertOnlyKeys(body.value, [], 'guardian account binding invite revoke input');
      const result = await repository.revokeGuardianAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('guardianLinkId'), 'guardianLinkId'),
        uuidParam(c.req.param('inviteId'), 'inviteId'),
        key,
        sha256(body.raw),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.post('/teaching/me/guardian-account-binding/preview', (c) => withActor(c, async (actor, requestId) => {
    const body = await jsonBody(c, 1_024);
    const parsed = parseGuardianAccountBindingConsumeInput(body.value);
    const result = await repository.previewGuardianAccountBindingInvite(
      actor,
      { tokenHash: sha256(parsed.token) },
      requestId,
    );
    return c.json(result);
  }));

  routes.post('/teaching/me/guardian-account-binding/consume', (c) => withActor(c, async (actor, requestId) => {
    const body = await jsonBody(c, 1_024);
    const parsed = parseGuardianAccountBindingConsumeInput(body.value);
    const result = await repository.consumeGuardianAccountBindingInvite(
      actor,
      { tokenHash: sha256(parsed.token) },
      requestId,
    );
    return c.json(result.body, result.status);
  }));

}
