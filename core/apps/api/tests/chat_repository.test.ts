import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { compareChatSequence, isChatSequence, normalizeChatBody } from '@cuberoot/shared/chat';
describe('chat persistence contract', () => {
  it('keeps the applied schema and new migration aligned', async () => {
    const [schema, migration] = await Promise.all(['../src/db/schema.pg.sql', '../migrations/0249_friend_chat.sql']
      .map((p) => readFile(new URL(p, import.meta.url), 'utf8')));
    expect(schema.replace(/\s+/g, ' ')).toContain(migration.trim().replace(/\s+/g, ' '));
  });
  it('validates lossless bigint sequence cursors', () => {
    expect(isChatSequence('9223372036854775807')).toBe(true);
    for (const value of ['9223372036854775808', '01', '-1', '1e5', '', 1]) expect(isChatSequence(value)).toBe(false);
    expect(compareChatSequence('9007199254740993', '9007199254740992')).toBe(1);
  });
  it('preserves whitespace and normalizes line endings while counting Unicode scalars', () => {
    expect(normalizeChatBody('  你好\r\nworld\r ')).toBe('  你好\nworld\n ');
    expect(normalizeChatBody('😀'.repeat(2000))).toBe('😀'.repeat(2000));
    for (const text of ['😀'.repeat(2001), ' \n\t', 'a\0b', '\uD800', '\uDC00']) expect(normalizeChatBody(text)).toBeNull();
    expect(normalizeChatBody('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });
});
