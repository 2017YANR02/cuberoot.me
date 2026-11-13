import { paginationOf, idempotencyKeyOf, jsonBody } from './request.js';
import { parseCampusInput } from '../validation/organizations.js';
import { sha256 } from '../encoding.js';
import { uuidParam } from '../validation/common.js';
import { TeachingApiException } from '../errors.js';
import type { TeachingRouteContext } from './context.js';

export function registerCampusesRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/campuses', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listCampuses(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
    return c.json({ campuses: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/campuses', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createCampus(
      actor, c.req.param('orgSlug'), parseCampusInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/campuses/:campusId', (c) => withActor(c, async (actor, requestId) => {
    const campus = await repository.getCampus(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('campusId'), 'campusId'), requestId,
    );
    return c.json({ campus });
  }));

  routes.post('/teaching/organizations/:orgSlug/campuses/:campusId/archive', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    if (Object.keys(body.value).length) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'Campus archive body must be empty');
    }
    const result = await repository.archiveCampus(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('campusId'), 'campusId'),
      key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

}
