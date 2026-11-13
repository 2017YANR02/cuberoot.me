import { uuidParam } from '../validation/common.js';
import { trainingPaginationOf, jsonBody, idempotencyKeyOf, assertQueryKeys, conversationMessagePaginationOf } from './request.js';
import { parseCreateConversationInput, parseReplyConversationInput, parseMarkConversationReadInput } from '../validation/conversations.js';
import { sha256, stableJson } from '../encoding.js';
import type { TeachingRouteContext } from './context.js';

export function registerConversationsRoutes({ routes, repository, withActor }: TeachingRouteContext): void {
  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations',
    (c) => withActor(c, async (actor, requestId) => {
      const page = await repository.listConversations(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        trainingPaginationOf(c),
        requestId,
      );
      return c.json({
        conversations: page.items,
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      });
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations',
    (c) => withActor(c, async (actor, requestId) => {
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      // JSON may encode CJK text as UTF-8 or \uXXXX escapes; keep the byte cap above
      // the strict 10,000-character field limit so valid localized content is accepted.
      const body = await jsonBody(c, 65_536);
      const input = parseCreateConversationInput(body.value);
      const result = await repository.createConversation(
        actor,
        c.req.param('orgSlug'),
        studentId,
        input,
        idempotencyKeyOf(c),
        sha256(stableJson({ studentId, input })),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId',
    (c) => withActor(c, async (actor, requestId) => {
      assertQueryKeys(c, []);
      const conversation = await repository.getConversation(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('conversationId'), 'conversationId'),
        requestId,
      );
      return c.json({ conversation });
    }),
  );

  routes.get(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/messages',
    (c) => withActor(c, async (actor, requestId) => {
      const page = await repository.listConversationMessages(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        uuidParam(c.req.param('conversationId'), 'conversationId'),
        conversationMessagePaginationOf(c),
        requestId,
      );
      return c.json({
        messages: page.items,
        afterSequence: page.afterSequence,
        nextAfterSequence: page.nextAfterSequence,
        hasMore: page.hasMore,
      });
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/messages',
    (c) => withActor(c, async (actor, requestId) => {
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const conversationId = uuidParam(c.req.param('conversationId'), 'conversationId');
      const body = await jsonBody(c, 65_536);
      const input = parseReplyConversationInput(body.value);
      const result = await repository.replyConversation(
        actor,
        c.req.param('orgSlug'),
        studentId,
        conversationId,
        input,
        idempotencyKeyOf(c),
        sha256(stableJson({ studentId, conversationId, input })),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/read',
    (c) => withActor(c, async (actor, requestId) => {
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const conversationId = uuidParam(c.req.param('conversationId'), 'conversationId');
      const body = await jsonBody(c, 1_024);
      const input = parseMarkConversationReadInput(body.value);
      const result = await repository.markConversationRead(
        actor,
        c.req.param('orgSlug'),
        studentId,
        conversationId,
        input,
        idempotencyKeyOf(c),
        sha256(stableJson({ studentId, conversationId, input })),
        requestId,
      );
      return c.json(result.body, result.status);
    }),
  );

}
