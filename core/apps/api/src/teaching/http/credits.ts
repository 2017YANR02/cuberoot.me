import { paginationOf, idempotencyKeyOf, jsonBody } from './request.js';
import { parsePackageProductInput, parseStudentPackageInput, parseCreditRefundInput, parseCreditReversalInput } from '../validation/credits.js';
import { sha256 } from '../encoding.js';
import { uuidParam, bigintParam } from '../validation/common.js';
import type { TeachingRouteContext } from './context.js';

export function registerCreditsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get('/teaching/organizations/:orgSlug/package-products', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listPackageProducts(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
    return c.json({ packageProducts: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/package-products', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createPackageProduct(
      actor, c.req.param('orgSlug'), parsePackageProductInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/students/:studentId/packages', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listStudentPackages(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'), paginationOf(c), requestId,
    );
    return c.json({ studentPackages: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/students/:studentId/packages', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const body = await jsonBody(c);
    const result = await repository.createStudentPackage(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'),
      parseStudentPackageInput(body.value), key, sha256(body.raw), requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.get('/teaching/organizations/:orgSlug/student-packages/:studentPackageId/ledger', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listStudentPackageLedger(
      actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentPackageId'), 'studentPackageId'),
      paginationOf(c), requestId,
    );
    return c.json({ ledger: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
  }));

  routes.post('/teaching/organizations/:orgSlug/student-packages/:packageId/refunds', (c) => withActor(c, async (actor, requestId) => {
    const key = idempotencyKeyOf(c);
    const packageId = uuidParam(c.req.param('packageId'), 'packageId');
    const body = await jsonBody(c, 4_096);
    const result = await repository.refundStudentPackageCredits(
      actor,
      c.req.param('orgSlug'),
      packageId,
      parseCreditRefundInput(body.value),
      key,
      sha256(JSON.stringify([packageId, body.raw])),
      requestId,
    );
    return c.json(result.body, result.status);
  }));

  routes.post(
    '/teaching/organizations/:orgSlug/student-packages/:packageId/ledger/:ledgerId/reversal',
    (c) => withActor(c, async (actor, requestId) => {
      const key = idempotencyKeyOf(c);
      const packageId = uuidParam(c.req.param('packageId'), 'packageId');
      const ledgerId = bigintParam(c.req.param('ledgerId'), 'ledgerId');
      const body = await jsonBody(c, 4_096);
      const result = await repository.reverseStudentPackageLedgerEntry(
        actor,
        c.req.param('orgSlug'),
        packageId,
        ledgerId,
        parseCreditReversalInput(body.value),
        key,
        sha256(JSON.stringify([packageId, ledgerId, body.raw])),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.get('/teaching/organizations/:orgSlug/operations/credit-adjustments', (c) => withActor(c, async (actor, requestId) => {
    const page = await repository.listCreditAdjustments(
      actor, c.req.param('orgSlug'), paginationOf(c), requestId,
    );
    return c.json({
      creditAdjustments: page.items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    });
  }));

}
