// 约束守卫:按钮式 onClick 不许落在非交互静态元素(<div>/<span>/<li>…)上。
// iOS Safari(实测 iOS 26)不可靠把 tap 合成 click 给静态元素 —— 连 cursor:pointer 都救不了,
// 选择器/开关点不动,且 :hover 灰色 sticky 会伪装成选中(2026-06-16 /trainer/333/f2l 真案例)。
// 按钮式交互必须用真 <button> / 框架 <Link>/AppLink(或 role="button" + tabIndex + 键盘处理)。
//
// 只盯"高信号"的:静态元素 + onClick + className 含按钮词 + 无 role=。背景遮罩 / 事件委托类
// div onClick(className 不含按钮词)不计。与用户级写入即拦 hook block-static-onclick-button.ps1 同口径。
//
// 这是 ratchet:BASELINE 锁住当前存量,只许降不许升 —— 新写的"假按钮" → CI 直接红。
// 修一个就把 BASELINE 减 1(改 baseline 当 review 信号)。彻底清零后可改成 toBe(0)。
// 豁免:违规处附近写注释 allow-static-onclick: <理由>,或把文件加进 ALLOWLIST。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];

// 当前存量(按本测试口径)。修按钮 → 改小;别调大放新债。
const BASELINE = 45;

// 整文件豁免(各文件已属特殊;尽量用行内 allow-static-onclick 而非整文件)
const ALLOWLIST = new Set<string>([]);

const SKIP_PATH = /(^|[\\/])(roux|_roux|roux-smoke)([\\/]|$)/;

// 静态(非交互)元素的开标签;brace-aware:容忍属性里的箭头函数 `=>` / 表达式 `{...}` 中的 `>`
const TAG_RE =
  /<(?:div|span|li|ul|ol|p|section|article|header|footer|nav|aside|td|th|tr|figure)\b((?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*)>/g;
const BTN_WORD = /(btn|button|toggle|chip|pill|swatch|segment|choice|selectable|clickable|cell|option)/i;

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

function violationsIn(src: string): number {
  let n = 0;
  for (const m of src.matchAll(TAG_RE)) {
    const attrs = m[1];
    if (!/onClick/.test(attrs)) continue;       // 不是点击目标
    if (/\brole\s*=/.test(attrs)) continue;      // 有 role → a11y 已处理,iOS 也认
    if (!/className/.test(attrs)) continue;       // 无 className → 信号不足(背景/委托类),放行
    if (!BTN_WORD.test(attrs)) continue;          // className 不含按钮词 → 放行
    // 行内豁免:命中点前 ~160 字符内有 allow-static-onclick
    const idx = m.index ?? 0;
    if (src.slice(Math.max(0, idx - 160), idx).includes('allow-static-onclick')) continue;
    n++;
  }
  return n;
}

describe('No button-like onClick on static elements (iOS Safari tap guard)', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('does not exceed the locked baseline of static-element button onClicks', () => {
    let total = 0;
    const perFile: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (SKIP_PATH.test(rel) || ALLOWLIST.has(rel)) continue;
      const n = violationsIn(readFileSync(file, 'utf8'));
      if (n > 0) { total += n; perFile.push(`${rel} → ${n}`); }
    }
    expect(
      total,
      `按钮式 onClick 落在静态元素上的数量(${total})超过了 BASELINE(${BASELINE})。\n` +
        '新写的请用真 <button>/<Link>/AppLink(或 role="button"+tabIndex+onKeyDown);\n' +
        '若确属例外(纯展示 className 碰巧含 cell/option、背景遮罩、事件委托)在违规处加注释 allow-static-onclick: <理由> 或加进 ALLOWLIST。\n' +
        '修好存量请把 BASELINE 同步减小。命中分布:\n' + perFile.join('\n'),
    ).toBeLessThanOrEqual(BASELINE);
  });
});
