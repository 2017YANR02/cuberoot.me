import { expect, it } from 'vitest';
import { startsChatTimeGroup } from './chat-time';
it('starts a group for the first message, five-minute gaps and local midnight', () => {
  expect(startsChatTimeGroup('2026-10-30T12:00:00')).toBe(true);
  expect(startsChatTimeGroup('2026-10-30T12:04:59', '2026-10-30T12:00:00')).toBe(false);
  expect(startsChatTimeGroup('2026-10-30T12:05:00', '2026-10-30T12:00:00')).toBe(true);
  expect(startsChatTimeGroup('2026-10-31T00:00:00', '2026-10-30T23:59:00')).toBe(true);
});
