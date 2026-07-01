// 约束守卫:下拉 / 选择器 / 触发器的 ROOT 元素(类名以 -picker / -trigger / -dropdown / -combobox 结尾)
// 禁写死宽 width: <N>px(N ≥ 120)而不配 max-width —— 这类控件被塞进能被压窄的筛选/工具栏 flex 列时,
// 死宽不收缩 → 窄屏溢出、压到相邻控件(2026-07 国家框 .region-picker width:220px 事故的静态可查子类)。
//
// 正解:root 用 width:100% / fit-content,或 width:<N>px 时同规则块补 max-width:100%(只封顶、桌面不变)。
// 阈值 120px 放过 32/36px 的色板 / 圆形头像按钮等定尺小部件(width==height 的图标不是溢出源)。
//
// 这是 ratchet:BASELINE 锁存量,只降不升 —— 新写的死宽下拉 root → CI 直接红。
// 真属定尺宽部件(非可压缩下拉)→ 在该规则块上方 ~200 字符内加 CSS 注释 /* allow-fixed-width: <理由> */ 豁免。
//
// 全覆盖(含死宽/JS 定位/表 min-content 等所有机制)的经验式检查走 on-demand:
//   pnpm -F @cuberoot/client audit:overflow  (scripts/mobile-overflow-audit.cjs,需 dev server)
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];
const ROOT_TOKEN = /(picker|trigger|dropdown|combobox)$/;
const MIN_PX = 120;
const BASELINE = 0;

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.css$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

// The rule targets a control root iff any comma-branch's final element (last space/combinator token)
// has a last class ending in a control token — i.e. the styled element itself, not a descendant icon.
function targetsControlRoot(selector: string): boolean {
  return selector.split(',').some((branch) => {
    const lastToken = branch.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() || '';
    const lastClass = lastToken.split('.').filter(Boolean).pop() || '';
    return ROOT_TOKEN.test(lastClass);
  });
}

function findOffenders(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length)); // keep offsets stable
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rule.exec(clean))) {
    const sel = m[1].trim(), body = m[2];
    if (!targetsControlRoot(sel)) continue;
    const w = body.match(/(^|[;{\s])width:\s*(\d+)px/);
    if (!w || Number(w[2]) < MIN_PX) continue;
    if (/max-width:/.test(body)) continue;
    if (/width:\s*(100%|fit-content|max-content|auto)/.test(body)) continue;
    // inline exemption: /* allow-fixed-width: reason */ within ~200 chars before the rule.
    // Window runs up to the rule's `{` — the selector capture ([^{}]+) swallows any leading
    // comment (blanked in `clean` but present in `css`), so m.index can sit at the comment start.
    const start = m.index ?? 0;
    const window = css.slice(Math.max(0, start - 200), start + m[1].length);
    if (window.includes('allow-fixed-width')) continue;
    out.push(`${sel.slice(0, 60).replace(/\s+/g, ' ')}  (width:${w[2]}px, no max-width)`);
  }
  return out;
}

describe('no fixed-width dropdown/picker root without max-width', () => {
  it(`offender count stays <= ${BASELINE} (ratchet down, never up)`, () => {
    const perFile: string[] = [];
    let count = 0;
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const offs = findOffenders(readFileSync(file, 'utf8'));
        if (offs.length) { perFile.push(`${relative(ROOT, file)}\n    ${offs.join('\n    ')}`); count += offs.length; }
      }
    }
    expect(
      count,
      `Fixed-width dropdown roots without max-width = ${count} (baseline ${BASELINE}). ` +
        `Give the root width:100% / fit-content, or add max-width:100% in the same rule; ` +
        `for a genuinely fixed-size widget add /* allow-fixed-width: reason */ above the rule. Offenders:\n${perFile.join('\n')}`,
    ).toBeLessThanOrEqual(BASELINE);
  });
});
