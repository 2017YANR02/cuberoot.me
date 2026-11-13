import { TRAINING_EVIDENCE_MAX_BODY_BYTES } from '@cuberoot/shared/teaching';
import { uuidParam } from '../validation/common.js';
import { trainingTargetFilterOf, parseTrainingReviewInput } from '../validation/training.js';
import { trainingPaginationOf, idempotencyKeyOf, jsonBody, trainingReviewRequestHash } from './request.js';
import type { TeachingRouteContext } from './context.js';

export function registerTrainingReviewsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTrainingAssignmentTargets(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
      trainingTargetFilterOf(c), trainingPaginationOf(c, ['targetKind']), requestId,
    );
    return c.json({ targets: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/evidence', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTrainingTargetEvidence(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
      uuidParam(c.req.param('studentId'), 'studentId'), trainingPaginationOf(c), requestId,
    );
    return c.json({ evidence: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTrainingTargetReviews(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
      uuidParam(c.req.param('studentId'), 'studentId'), trainingPaginationOf(c), requestId,
    );
    return c.json({ reviews: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    const assignmentId = uuidParam(c.req.param('assignmentId'), 'assignmentId');
    const studentId = uuidParam(c.req.param('studentId'), 'studentId');
    const result = await repository.createTrainingTargetReview(
      actor, c.req.param('orgSlug'), assignmentId, studentId, parseTrainingReviewInput(body.value),
      key, trainingReviewRequestHash(assignmentId, studentId, body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

}
