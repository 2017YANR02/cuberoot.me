import { TRAINING_EVIDENCE_MAX_BODY_BYTES } from '@cuberoot/shared/teaching';
import { type Context } from 'hono';
import { trainingAssignmentFilterOf, parseTrainingAssignmentInput } from '../validation/training.js';
import { trainingPaginationOf, idempotencyKeyOf, jsonBody, assertQueryKeys } from './request.js';
import { sha256 } from '../encoding.js';
import { uuidParam, assertOnlyKeys } from '../validation/common.js';
import type { TeachingRouteContext } from './context.js';

export function registerTrainingAssignmentsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/training/assignments', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTrainingAssignments(
      actor, c.req.param('orgSlug'), trainingAssignmentFilterOf(c),
      trainingPaginationOf(c, ['status']), requestId,
    );
    return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/training/assignments', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    const result = await repository.createTrainingAssignment(
      actor, c.req.param('orgSlug'), parseTrainingAssignmentInput(body.value),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId', (c) => withActor(c, async (actor, requestId) => {
    assertQueryKeys(c, []);
    return c.json(await repository.getTrainingAssignment(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'), requestId,
    ));
  }));

  routes.post('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/revise', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    const result = await repository.reviseTrainingAssignment(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
      parseTrainingAssignmentInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  const trainingAssignmentLifecycleHandler = (action: 'publish' | 'close') => (c: Context) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    assertOnlyKeys(body.value, [], `training assignment ${action} input`);
    const orgSlug = c.req.param('orgSlug') ?? '';
    const assignmentId = uuidParam(c.req.param('assignmentId') ?? '', 'assignmentId');
    const result = action === 'publish'
      ? await repository.publishTrainingAssignment(
        actor, orgSlug, assignmentId, key, sha256(body.raw), requestId,
      )
      : await repository.closeTrainingAssignment(
        actor, orgSlug, assignmentId, key, sha256(body.raw), requestId,
      );
    return c.json(result.body, result.status);
  });

  routes.post(
    '/teaching/organizations/:orgSlug/training/assignments/:assignmentId/publish',
    trainingAssignmentLifecycleHandler('publish'),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/training/assignments/:assignmentId/close',
    trainingAssignmentLifecycleHandler('close'),
  );

}
