// 约束守卫:布尔开关一律走 components/BoolToggle(左滑钮 + 右文字),不许写裸 <input type="checkbox">(☑)。
// 多选「网格/列表」式勾选属例外(允许行内 allow-checkbox: <理由> 豁免)。详见 issue #2。
//
// 这是 ratchet:BASELINE 锁住当前存量,只许降不许升 —— 新写的 ☑ → CI 直接红。
// 转一个 checkbox → BoolToggle 就把 BASELINE 减 1(改 baseline 当 review 信号)。清零后改成 toBe(0)。
// 配套写入即拦 hook:.claude/hooks/block-raw-checkbox.ps1 → hook-detect-raw-checkbox.mjs。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];

// 当前存量(本测试口径:.tsx 里的 type="checkbox" / type='checkbox',allow-checkbox 豁免不计)。
// 转一个 → BoolToggle 就把 BASELINE 减 1。起点 115;已转 /wca 去重 + 豁免逐行多选 → 113。
const BASELINE = 113;

const CHECKBOX_RE = /type=["']checkbox["']/g;

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

describe('no raw <input type="checkbox"> — use components/BoolToggle', () => {
  it(`checkbox count stays <= ${BASELINE} (ratchet down, never up)`, () => {
    let count = 0;
    const perFile: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const src = readFileSync(file, 'utf8');
        let n = 0;
        for (const m of src.matchAll(CHECKBOX_RE)) {
          const idx = m.index ?? 0;
          // 行内豁免:命中点前 ~200 字符内有 allow-checkbox(多选网格等特例)。
          if (src.slice(Math.max(0, idx - 200), idx).includes('allow-checkbox')) continue;
          n++;
        }
        if (n > 0) perFile.push(`${n}\t${relative(ROOT, file)}`);
        count += n;
      }
    }
    expect(
      count,
      `Raw checkboxes = ${count} (baseline ${BASELINE}). Convert to <BoolToggle> and lower BASELINE; ` +
        `never raise it. Offenders:\n${perFile.sort().reverse().join('\n')}`,
    ).toBeLessThanOrEqual(BASELINE);
  });
});
