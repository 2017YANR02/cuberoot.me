import { TRAINING_EVIDENCE_MAX_BODY_BYTES } from '@cuberoot/shared/teaching';
import { trainingPaginationOf, idempotencyKeyOf, jsonBody, assertQueryKeys } from './request.js';
import { parseTrainingTemplateInput, parseTrainingTemplateVersionInput } from '../validation/training.js';
import { sha256 } from '../encoding.js';
import { uuidParam, assertOnlyKeys } from '../validation/common.js';
import type { TeachingRouteContext } from './context.js';

export function registerTrainingTemplatesRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/training/templates', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTrainingTemplates(
      actor, c.req.param('orgSlug'), trainingPaginationOf(c), requestId,
    );
    return c.json({ templates: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/training/templates', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    const result = await repository.createTrainingTemplate(
      actor, c.req.param('orgSlug'), parseTrainingTemplateInput(body.value),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/training/templates/:templateId', (c) => withActor(c, async (actor, requestId) => {
    assertQueryKeys(c, []);
    const template = await repository.getTrainingTemplate(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'), requestId,
    );
    return c.json({ template });
  }));

  routes.get('/teaching/organizations/:orgSlug/training/templates/:templateId/versions', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listTrainingTemplateVersions(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
      trainingPaginationOf(c), requestId,
    );
    return c.json({ templateVersions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/training/templates/:templateId/versions', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    const result = await repository.createTrainingTemplateVersion(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
      parseTrainingTemplateVersionInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.post('/teaching/organizations/:orgSlug/training/templates/:templateId/archive', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
    assertOnlyKeys(body.value, [], 'training template archive input');
    const result = await repository.archiveTrainingTemplate(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

}
