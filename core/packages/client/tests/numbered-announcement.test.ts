import { describe, expect, it } from 'vitest';
import { announcementItems, numberAnnouncementLines } from '../lib/numbered-announcement';

describe('numbered announcement editor', () => {
  it('numbers new lines, pasted items and blank editing rows', () => {
    expect(numberAnnouncementLines('第一条\n').text).toBe('1. 第一条\n2. ');
    expect(numberAnnouncementLines('3. A\n9、B\nC').text).toBe('1. A\n2. B\n3. C');
    expect(numberAnnouncementLines('')).toEqual({ text: '', caret: 0 });
  });
  it('preserves caret position inside a renumbered item', () => {
    expect(numberAnnouncementLines('A\nB', 3)).toEqual({ text: '1. A\n2. B', caret: 9 });
    expect(numberAnnouncementLines('1. Abc', 5).caret).toBe(5);
  });
  it('stores content without blank rows or display numbering', () => {
    expect(announcementItems('1. 中文\n2. \n3. English')).toEqual(['中文', 'English']);
  });
});
