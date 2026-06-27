// CSS 约定守卫:禁止「容器 class/id + 后代/子 裸交互标签(button/input/select/textarea)」选择器。
//
// 为什么:`.foo button {}`(特异性 0-1-1)会匹配容器内任意后代 button/input —— 包括后来塞进去的
// 共享组件(ClearButton / PillToggle / 各种 Picker),而 0-1-1 压过共享组件自身的单 class(0-1-0),
// 哪怕不带 !important 也会把它压变形。本仓库已两次踩坑(ClearButton 被压成椭圆 / 被穿透)。
// 正解:给目标元素加专属角色 class,选择器命中 class(如 .wse-filter-input / .colpi-pill-btn)。
//
// CI 跑 vitest(不跑 stylelint / eslint),故约定靠本测试当红灯。baseline = 0(全站已清,2026-06-27)。
// 例外两种:
//  1) 整文件待清(有并发/外部约束)→ 加进 ALLOWLIST_FILES 并写理由;
//  2) 单条选择器确属封闭容器、绝不会塞共享组件 → 加进 ALLOWLIST(`文件 → 选择器`)并写理由。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];

// 整文件豁免:sim/* 正被另一个 AI 并发编辑(引擎重构中),留待其稳定后单独清,届时删除这些行。
const ALLOWLIST_FILES = new Set<string>([
  'app/[lang]/sim/algs-panel.css',
  'app/[lang]/sim/player-controls.css',
  'app/[lang]/sim/setting-drawer.css',
  'app/[lang]/sim/sim.css',
]);

// 单条选择器豁免:`文件相对路径 → 选择器`(确属封闭容器、不会塞共享组件)
const ALLOWLIST = new Set<string>([]);

// 容器(class/id) + 后代或子组合 + 裸交互标签结尾(可带伪类)
const BARE_INTERACTIVE_DESCENDANT =
  /[.#][\w-][\w\s.#:()>[\]="'-]*\s>?\s*\b(?:button|input|select|textarea)\b\s*(?::[\w-]+(?:\([^)]*\))?)*$/;

function safeReaddir(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (ent.name.endsWith('.css')) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

function offenders(css: string): string[] {
  // 先全局剥注释,避免块切分把注释里的字符串误判成选择器。
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  const block = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = block.exec(stripped))) {
    const sel = m[1].trim();
    for (const part of sel.split(',').map((s) => s.trim())) {
      if (BARE_INTERACTIVE_DESCENDANT.test(part)) out.push(part);
    }
  }
  return out;
}

describe('CSS — no bare-interactive (button/input/select/textarea) descendant selectors', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of CSS files', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('has no `.container button/input/select/textarea {…}` outside the allowlist', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (ALLOWLIST_FILES.has(rel)) continue;
      for (const sel of offenders(readFileSync(file, 'utf8'))) {
        if (ALLOWLIST.has(`${rel} → ${sel}`)) continue;
        violations.push(`${rel} → ${sel}`);
      }
    }
    expect(
      violations,
      '裸交互标签后代选择器(.容器 button/input/select/textarea)会匹配容器内任意后代,\n' +
        '压坏塞进去的共享组件(ClearButton/PillToggle/Picker…),0-1-1 > 0-1-0 不带 !important 也会。\n' +
        '请把目标元素加专属角色 class,选择器改成命中 class。\n' +
        '确属封闭容器、绝不会塞共享组件时,把 "文件 → 选择器" 加进 ALLOWLIST 并写理由。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
