import { describe, expect, it } from 'vitest';
import { formatJoinedDate } from '@/app/[lang]/forum/_lib/forum-format';

describe('forum joined date formatting', () => {
  it('shows the complete local calendar date', () => {
    const localNoon = new Date(2026, 7, 19, 12).toISOString();
    expect(formatJoinedDate(localNoon)).toBe('2026-08-19');
  });

  it('returns an empty string for absent or invalid timestamps', () => {
    expect(formatJoinedDate(null)).toBe('');
    expect(formatJoinedDate('not-a-date')).toBe('');
  });
});
