// 约束守卫:锚定下拉面板(position:absolute/fixed + top:~100%,挂在触发钮下方)必须声明
// 视口钳位 —— 触发钮靠右 + 面板较宽时,面板右缘越出视口被裁(issue #29:首页两个 picker
// 手机端被切掉半边)。max-width:90vw 只钳面板自身宽度,钳不住「锚点位置 + 宽度」合起来越界,
// 静态 CSS 也推不出触发钮会落在哪 —— 所以此守卫不猜安全性,只要求每个锚定面板**显式声明**:
//
//   /* anchored-panel: clamped (usePanelClamp in <组件>) */   ← 组件里挂了 hooks/usePanelClamp
//   /* anchored-panel: safe (<为什么不会越界>) */              ← 人工确认安全(如触发钮贴容器左缘)
//
// 天然安全形态自动豁免,无需注释:body 同时设 left/right(两侧钉死 = 面板宽随锚定父级)或 width:100%。
//
// 这是 ratchet:BASELINE 锁存量(存量面板待逐个补钳/声明,只降不升),新写的锚定面板必须带声明。
// 运行时全机制实测走 pnpm -F @cuberoot/client audit:overflow(popup pass 会点开每个
// [aria-haspopup]/[aria-expanded] 触发器实测越界)。写入即拦的孪生 hook:
// .claude/hooks/block-unclamped-anchored-panel.ps1(本测试为权威口径)。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];
const BASELINE = 21; // 2026-07-16 存量(issue #29 时点);只降不升

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

export function findUnclampedAnchoredPanels(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length)); // keep offsets stable
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rule.exec(clean))) {
    const sel = m[1].trim(), body = m[2];
    if (/::(before|after)/.test(sel)) continue;                   // 伪元素 = 装饰(下划线等),非面板
    if (!/position:\s*(absolute|fixed)/.test(body)) continue;
    if (!/top:\s*(calc\(\s*)?100%/.test(body)) continue;          // 锚在触发钮正下方的形态
    // 天然安全形态:两侧钉死(宽=锚定父级)或显式 100% 宽 → 不可能超过触发容器
    if (/(^|[;{\s])left:/.test(body) && /(^|[;{\s])right:/.test(body)) continue;
    if (/width:\s*100%/.test(body)) continue;
    // 声明窗口:规则前 ~250 字符(selector capture 会吞掉 blanked 的前置注释,同
    // no-fixed-width-dropdown-root 的实现)+ 块体内。
    const start = m.index ?? 0;
    const win = css.slice(Math.max(0, start - 250), start + m[0].length);
    if (win.includes('anchored-panel:')) continue;
    out.push(sel.slice(0, 70).replace(/\s+/g, ' '));
  }
  return out;
}

describe('anchored dropdown panels declare viewport clamping', () => {
  it(`undeclared anchored panels stay <= ${BASELINE} (ratchet down, never up)`, () => {
    const perFile: string[] = [];
    let count = 0;
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const offs = findUnclampedAnchoredPanels(readFileSync(file, 'utf8'));
        if (offs.length) { perFile.push(`${relative(ROOT, file)}\n    ${offs.join('\n    ')}`); count += offs.length; }
      }
    }
    expect(
      count,
      `Anchored panels without an anchored-panel declaration = ${count} (baseline ${BASELINE}). ` +
        `Panels anchored under a trigger (position:absolute + top:~100%) get clipped at the viewport edge ` +
        `when the trigger sits near it (issue #29). Wire hooks/usePanelClamp to the panel and mark the CSS ` +
        `rule /* anchored-panel: clamped (usePanelClamp in <Component>) */, or if provably safe, ` +
        `/* anchored-panel: safe (<reason>) */. Offenders:\n${perFile.join('\n')}`,
    ).toBeLessThanOrEqual(BASELINE);
  });
});
