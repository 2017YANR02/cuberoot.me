// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { puzzleMenuCatalogs, puzzleMenuLabelViolations } from '../scripts/puzzle-menu-label-guard.mts';

const root = resolve(import.meta.dirname, '../../../..');
it('checks every menu catalog and rejects long names without banning prose', () => {
  for (const path of puzzleMenuCatalogs) {
    expect(puzzleMenuLabelViolations(path, readFileSync(resolve(root, path), 'utf8'))).toEqual([]);
    expect(puzzleMenuLabelViolations(path, "zh: '二重奏魔方'")).toHaveLength(1);
    expect(puzzleMenuLabelViolations(path.replaceAll('/', '\\'), 'labelZh:\n"枫叶魔方"')).toHaveLength(1);
    expect(puzzleMenuLabelViolations(path, "zh: '二重奏', description: '魔方介绍'")).toEqual([]);
    for (const field of ['zh', 'en', 'labelZh', 'labelEn', 'nameZh', 'nameEn', 'textLabel']) {
      expect(puzzleMenuLabelViolations(path, `${field}: '齿轮魔方'`)).toHaveLength(1);
      expect(puzzleMenuLabelViolations(path, `${field}: '2×3×3'`)).toHaveLength(1);
      expect(puzzleMenuLabelViolations(path, `${field}: '3x3x4'`)).toHaveLength(1);
      expect(puzzleMenuLabelViolations(path, `${field}: '334'`)).toEqual([]);
    }
  }
  expect(puzzleMenuLabelViolations('article.tsx', "zh: '魔方介绍'")).toEqual([]);
});

it('checks event-keyed WCA names as well as timer group labels', () => {
  const dictionary = puzzleMenuCatalogs.find(path => path.endsWith('/wca_events.ts'))!;
  const groups = puzzleMenuCatalogs.find(path => path.endsWith('/timer/event-catalog.ts'))!;
  expect(dictionary).toBeDefined();
  expect(groups).toBeDefined();
  expect(puzzleMenuLabelViolations(dictionary, "'333': '三阶魔方'")).toHaveLength(1);
  expect(puzzleMenuLabelViolations(dictionary, '"333": "3x3x3"')).toHaveLength(1);
  expect(puzzleMenuLabelViolations(dictionary, "'333': '三阶', '222': '2×2'")).toEqual([]);
  expect(puzzleMenuLabelViolations(groups, "nameZh: '其他魔方'")).toHaveLength(1);
});

it('keeps supplied menu labels, headings and accessible names short', () => {
  const source = readFileSync(resolve(root, 'core/packages/client/components/PuzzlePicker/PuzzlePicker.tsx'), 'utf8');
  const body = source.match(/const menuLabel = \(label: string\): string => ([^;]+);/)![1];
  const format = new Function('label', `return ${body}`);
  expect(format('二重奏魔方')).toBe('二重奏');
  expect(format('枫叶魔方')).toBe('枫叶');
  expect(format('Redi Cube')).toBe('Redi Cube');
  expect(format('多米诺 2×3×3')).toBe('多米诺 233');
  expect(format('3×3×4')).toBe('334');
  expect(format('3x3x5')).toBe('335');
  expect(source).toContain('menuLabel(item.textLabel ?? item.id)');
  for (const contract of ['{menuLabel(item.label)}', '{menuLabel(group.label)}', 'item => menuLabel(item.label)', 'menuLabel(placeholderLabel']) expect(source).toContain(contract);
});
