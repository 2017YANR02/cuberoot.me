import { describe, expect, it } from 'vitest';
import { excerptFromMarkdown } from '@cuberoot/shared/forum';
import { formatJoinedDate } from '@/lib/forum-format';

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
