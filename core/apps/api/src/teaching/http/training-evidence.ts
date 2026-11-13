import { type Context } from 'hono';
import { TRAINING_EVIDENCE_MAX_BODY_BYTES, type TrainingEvidenceV1, parseTrainingEvidenceV1, TrainingEvidenceValidationError } from '@cuberoot/shared/teaching';
import { paginationOf, trainingPaginationOf, jsonBody } from './request.js';
import { TeachingApiException } from '../errors.js';
import { uuidParam } from '../validation/common.js';
import type { TeachingRouteContext } from './context.js';

export function registerTrainingEvidenceRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/me/training/assignments', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listSelfTrainingAssignments(
      actor,
      c.req.param('orgSlug'),
      paginationOf(c),
      requestId,
    );
    return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  const dailyBoardHandler = (learner: boolean) => (c: Context) => withActor(c, async (actor, requestId) => {
    const date = c.req.query('date') || null;
    const rankEvent = c.req.query('rankEvent') || null;
    if (rankEvent && !/^[a-zA-Z0-9_-]{1,64}$/.test(rankEvent)) throw new TeachingApiException('INVALID_INPUT', 400, 'Invalid ranking event');
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000-') || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'Invalid calendar date');
    }
    const slug = c.req.param('orgSlug');
    const assignmentId = c.req.param('assignmentId');
    if (!slug || !assignmentId) throw new TeachingApiException('INVALID_INPUT', 400, 'Missing training assignment');
    return c.json(await repository.getTrainingDailyBoard(actor, slug, uuidParam(assignmentId, 'assignmentId'), date, learner, trainingPaginationOf(c, ['date', 'rankEvent']), requestId, rankEvent));
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/daily', dailyBoardHandler(false));

  routes.get('/teaching/organizations/:orgSlug/me/training/assignments/:assignmentId/daily', dailyBoardHandler(true));

  routes.post('/teaching/organizations/:orgSlug/me/training/evidence', (c) => withActor(c, async (actor, requestId) => {
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    let input: TrainingEvidenceV1;
    try {
      input = parseTrainingEvidenceV1(body.value);
    } catch (error) {
      if (error instanceof TrainingEvidenceValidationError) {
        throw new TeachingApiException('EVIDENCE_INVALID', 400, error.message);
      }
      throw error;
    }
    const result = await repository.createSelfTrainingEvidence(
      actor,
      c.req.param('orgSlug'),
      input,
      requestId,
    );
    return c.json(result.body, result.status);
  }));

}
