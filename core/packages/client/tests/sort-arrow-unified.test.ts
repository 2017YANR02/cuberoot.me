// 约束守卫:表头排序指示一律走全站统一的 components/SortArrow(↑/↓,放表头文字右侧)。
// 禁再用 ChevronsUpDown(双向 ^v 形)自造排序箭头 —— 历史上 EventStatsTab / CompsTab 各写一份,
// 风格不一(详见 issue #2)。统一后这里锁死:任何 `<ChevronsUpDown` JSX = CI 直接红。
//
// 注:ChevronUp / ChevronDown 仍可用于「展开/折叠」三角(census toggle 等),故不一刀切禁;
// 只禁 ChevronsUpDown 这个「双向排序图标」的 JSX 渲染。要排序箭头 → import { SortArrow }。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.tsx$/.test(ent.name) && !/\.test\.tsx$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

describe('sort arrows are unified on components/SortArrow', () => {
  it('no <ChevronsUpDown> hand-rolled sort indicator', () => {
    const offenders: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const src = readFileSync(file, 'utf8');
        if (/<ChevronsUpDown\b/.test(src)) offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders, `Use <SortArrow active dir/> instead of <ChevronsUpDown> in:\n${offenders.join('\n')}`).toEqual([]);
  });
});
