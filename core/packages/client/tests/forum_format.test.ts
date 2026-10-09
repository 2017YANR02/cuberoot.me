import { afterEach, describe, expect, it, vi } from 'vitest';
import { excerptFromMarkdown, imageUrlsFromMarkdown } from '@cuberoot/shared/forum';
import { formatJoinedDate, formatRelativeTime } from '@/lib/forum-format';

describe('relative time duration boundaries', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [0, '刚刚', 'just now'],
    [59_999, '刚刚', 'just now'],
    [60_000, '1 分钟前', '1m ago'],
    [3_600_000, '1 小时前', '1h ago'],
    [86_400_000, '1 天前', '1d ago'],
    [30 * 86_400_000 - 1, '29 天前', '29d ago'],
    [30 * 86_400_000, '1 个月前', '1mo ago'],
    [60 * 86_400_000, '2 个月前', '2mo ago'],
    [365 * 86_400_000 - 1, '12 个月前', '12mo ago'],
    [365 * 86_400_000, '1 年前', '1y ago'],
    [3 * 365 * 86_400_000, '3 年前', '3y ago'],
  ])('formats %i elapsed milliseconds in both languages', (elapsed, zh, en) => {
    const now = Date.parse('2026-10-07T12:00:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const timestamp = new Date(now - elapsed).toISOString();
    expect(formatRelativeTime(timestamp, 'zh')).toBe(zh);
    expect(formatRelativeTime(timestamp, 'en')).toBe(en);
  });
});

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

describe('forum feed excerpts', () => {
  it('turns common Markdown into a compact plain-text preview', () => {
    expect(excerptFromMarkdown('# 标题\n\n看看 [CubeRoot](https://cuberoot.me) **论坛**。'))
      .toBe('标题 看看 CubeRoot 论坛。');
  });

  it('drops code and image payloads and applies the requested limit', () => {
    const markdown = '开头 ![图](https://example.com/a.png) `inline` ```hidden``` 后续内容';
    expect(excerptFromMarkdown(markdown, 6)).toBe('开头 后续内…');
  });
});

describe('forum feed images', () => {
  it('extracts unique Markdown image URLs in post order', () => {
    const markdown = [
      '![first](https://img.example/a.webp)',
      '[not an image](https://img.example/skip.webp)',
      '![](https://img.example/b.png "caption")',
      '![duplicate](https://img.example/a.webp)',
    ].join('\n');
    expect(imageUrlsFromMarkdown(markdown)).toEqual([
      'https://img.example/a.webp',
      'https://img.example/b.png',
    ]);
  });
});
