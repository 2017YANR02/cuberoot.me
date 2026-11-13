import { auditEventFilterOf } from '../validation/feedback.js';
import { trainingPaginationOf } from './request.js';
import type { TeachingRouteContext } from './context.js';

export function registerOperationsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/operations/overview', (c) => withActor(c, async (actor, requestId) => {
    return c.json({ operationsOverview: await repository.getOperationsOverview(actor, c.req.param('orgSlug'), requestId) });
  }));

  routes.get('/teaching/organizations/:orgSlug/audit-events', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listAuditEvents(
      actor,
      c.req.param('orgSlug'),
      auditEventFilterOf(c),
      trainingPaginationOf(c, ['q', 'outcome']),
      requestId,
    );
    return c.json({ auditEvents: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

}
