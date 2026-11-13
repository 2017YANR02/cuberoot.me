import { type CreateTeachingConversationInput, type ReplyTeachingConversationInput, type MarkTeachingConversationReadInput } from '@cuberoot/shared/teaching';
import { type JsonObject } from '../types.js';
import { assertOnlyKeys, requiredString, requiredInteger } from './common.js';

export function parseCreateConversationInput(body: JsonObject): CreateTeachingConversationInput {
  assertOnlyKeys(body, ['subject', 'body'], 'conversation create input');
  return {
    subject: requiredString(body, 'subject', 200),
    body: requiredString(body, 'body', 10_000),
  };
}

export function parseReplyConversationInput(body: JsonObject): ReplyTeachingConversationInput {
  assertOnlyKeys(body, ['body'], 'conversation reply input');
  return { body: requiredString(body, 'body', 10_000) };
}

export function parseMarkConversationReadInput(body: JsonObject): MarkTeachingConversationReadInput {
  assertOnlyKeys(body, ['lastReadSequence'], 'conversation read input');
  return { lastReadSequence: requiredInteger(body, 'lastReadSequence', 0, 2_147_483_647) };
}
