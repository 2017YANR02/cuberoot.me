import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';
import {
  hasTeachingPermission,
  TEACHING_CONVERSATION_ACTOR_ROLES,
  type TeachingPermission,
} from '@cuberoot/shared/teaching';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

function sourceSection(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(start, `${startNeedle} missing`).toBeGreaterThan(-1);
  expect(end, `${endNeedle} missing after ${startNeedle}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('teaching conversations schema and repository contract', () => {
  it('keeps migration 0158 represented in schema and developer ledgers', async () => {
    const [migration, schema, readme, devSchema, devApi] = await Promise.all([
      read('../migrations/0158_teaching_conversations.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/api/page.tsx'), 'utf8'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(schema).toContain(
      migration.slice(migration.indexOf('CREATE TABLE teaching_conversations')).trim(),
    );
    expect(schema).toContain('dedupe_key  VARCHAR(200)');
    expect(schema).toContain('CONSTRAINT notifications_dedupe_key_check');
    expect(schema).toContain('CREATE UNIQUE INDEX uq_notifications_user_kind_dedupe');
    expect(readme).toContain('0158_teaching_conversations.sql');
    expect(devSchema).toContain("{ n: 158, slug: 'teaching_conversations'");
    for (const table of [
      'teaching_conversations',
      'teaching_conversation_participants',
      'teaching_conversation_messages',
    ]) {
      expect(devSchema).toContain(`{ name: '${table}'`);
    }
    for (const route of [
      '/v1/teaching/organizations/:orgSlug/students/:studentId/conversations',
      '/v1/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId',
      '/v1/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/messages',
      '/v1/teaching/organizations/:orgSlug/students/:studentId/conversations/:conversationId/read',
    ]) {
      expect(devApi).toContain(route);
    }
  });

  it('grants canonical conversation permissions only to teaching roles', () => {
    const permissions: TeachingPermission[] = ['conversation:read', 'conversation:manage'];
    for (const permission of permissions) {
      expect(hasTeachingPermission('owner', permission)).toBe(true);
      expect(hasTeachingPermission('admin', permission)).toBe(true);
      expect(hasTeachingPermission('teacher', permission)).toBe(true);
      expect(hasTeachingPermission('assistant', permission)).toBe(true);
      expect(hasTeachingPermission('finance', permission)).toBe(false);
      expect(hasTeachingPermission('viewer', permission)).toBe(false);
    }
    expect(TEACHING_CONVERSATION_ACTOR_ROLES).toEqual([
      'owner', 'admin', 'teacher', 'assistant', 'student', 'guardian',
    ]);
  });

  it('enforces tenant FKs, append-only messages, continuous sequence, and monotonic cursors', async () => {
    const migration = await read('../migrations/0158_teaching_conversations.sql');
    expect(migration).toContain('UNIQUE (organization_id, id, student_id)');
    expect(migration).toContain('REFERENCES student_profiles(organization_id, id)');
    expect(migration).toContain('REFERENCES teaching_conversations(organization_id, id, student_id)');
    expect(migration).toContain('UNIQUE (organization_id, conversation_id, sequence)');
    expect(migration).toContain('NEW.sequence = max_sequence');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('sequence advances one at a time');
    expect(migration).toContain('NEW.last_read_sequence >= OLD.last_read_sequence');
    expect(migration).toContain('NEW.last_read_sequence > max_sequence');
    const participantGuard = sourceSection(
      migration,
      'CREATE FUNCTION trg_guard_teaching_conversation_participant()',
      'CREATE TRIGGER teaching_conversation_participants_guard',
    );
    expect(participantGuard).not.toContain('FOR SHARE');
  });

  it('uses actor then recipient then conversation locks and never upgrades a shared reply lock', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const reply = sourceSection(
      route,
      '  async replyConversation(',
      '  async markConversationRead(',
    );
    const scope = reply.indexOf('lockConversationActorScope');
    const recipients = reply.indexOf('lockConversationRecipientUsers');
    const conversation = reply.indexOf('FOR UPDATE');
    const idempotency = reply.indexOf('beginIdempotency');
    const append = reply.indexOf('appendConversationMessage');
    expect(scope).toBeGreaterThan(-1);
    expect(recipients).toBeGreaterThan(scope);
    expect(conversation).toBeGreaterThan(recipients);
    expect(idempotency).toBeGreaterThan(conversation);
    expect(append).toBeGreaterThan(idempotency);
    expect(reply.slice(0, conversation)).not.toContain('FOR SHARE');

    const recipientLock = sourceSection(
      route,
      'async function lockConversationRecipientUsers(',
      'async function upsertConversationParticipant(',
    );
    expect(recipientLock).toContain('.sort((left, right) => left - right)');
    expect(recipientLock).toContain('FOR KEY SHARE');
  });

  it('rechecks live scope for every read and mutation and conceals unauthorized resources', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const scope = sourceSection(
      route,
      'async function lockConversationActorScope(',
      'function conversationRow(',
    );
    expect(scope).toContain("AND status = 'active'");
    expect(scope).toContain("student.status = 'active'");
    expect(scope).toContain('FROM guardian_links');
    expect(scope).toContain('lockAndCheckTeacherStudentScope');
    expect(scope).toContain("mode === 'write' && organization.status !== 'active'");
    expect(scope).toContain("organization.status !== 'active'");
    expect(scope).toContain('ConcealedTeachingPermissionDeniedException');

    for (const operation of [
      'listConversations', 'getConversation', 'listConversationMessages',
      'replyConversation', 'markConversationRead',
    ]) {
      expect(route).toContain(`async ${operation}`);
    }
    const markRead = sourceSection(
      route,
      '  async markConversationRead(',
      '  async listLearnerWeeklyReports(',
    );
    expect(markRead).toContain("lockConversationActorScope(tx, actor, slug, studentId, 'read')");
    expect(markRead).toContain('input.lastReadSequence > lastMessageSequence');
    expect(route).toContain('DO UPDATE SET last_read_sequence = GREATEST(');
    expect(markRead).toContain('beginIdempotency');
  });

  it('writes deduplicated reminders in the message transaction and relates read state by identity', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const append = sourceSection(
      route,
      'async function appendConversationMessage(',
      'async function insertConversationAudit(',
    );
    expect(append).toContain("'teaching_message'");
    expect(append).toContain('teaching-message:${conversationId}:${sequence}');
    expect(append).toContain('ON CONFLICT (user_key, kind, dedupe_key)');
    expect(append).toContain('displayName.slice(0, 100)');
    expect(append).toContain('/learn/${encodeURIComponent(scope.organization.slug)}');
    expect(append).toContain('/org/${encodeURIComponent(scope.organization.slug)}');
    expect(append).not.toContain('notify(');

    const markRead = sourceSection(
      route,
      '  async markConversationRead(',
      '  async listLearnerWeeklyReports(',
    );
    expect(markRead).toContain('dedupe_key LIKE');
    expect(markRead).toContain('COALESCE(read_at, NOW())');
    expect(markRead).not.toMatch(/notifications\.link\s*=/);
  });

  it('clears live account references before deletion while retaining conversation snapshots', async () => {
    const accountDelete = await read('../src/utils/account_delete.ts');
    const actorLock = accountDelete.indexOf('SELECT id FROM app_users WHERE id = ${userId} FOR UPDATE');
    const creator = accountDelete.indexOf('UPDATE teaching_conversations');
    const author = accountDelete.indexOf('UPDATE teaching_conversation_messages');
    const participant = accountDelete.indexOf('UPDATE teaching_conversation_participants');
    const deleteUser = accountDelete.indexOf('DELETE FROM app_users');
    expect(actorLock).toBeGreaterThan(-1);
    expect(creator).toBeGreaterThan(actorLock);
    expect(author).toBeGreaterThan(creator);
    expect(participant).toBeGreaterThan(author);
    expect(deleteUser).toBeGreaterThan(participant);
    for (const table of [
      'teaching_conversations',
      'teaching_conversation_participants',
      'teaching_conversation_messages',
    ]) {
      expect(accountDelete).toContain(`${table}:`);
    }
  });
});
