/**
 * battle.css 不得漏进单人模式。
 *
 * TimerShell 静态 import BattleView,BattleView import battle.css —— 所以 /timer?players=1
 * 也会加载它,且排在 timer.css / shell.css 之后。于是 battle.css 里任何「裸类名」规则都会
 * 作用到单人 DOM 上,并在同特异性下因为靠后而取胜。
 *
 * 真出过事:.history-panel 把 height:calc(100vh - 56px) 砸在单人历史面板上;基类
 * .scramble-text 的 user-select:none 让单人的打乱文字选不中。修法是把这类规则写成
 * :where(.battle-container) .foo —— :where() 不贡献特异性,battle 自身层叠不变,
 * 但不再匹配单人 DOM。
 *
 * 本测试算的是「battle.css 的裸类名 ∩ 单人侧 TSX 里真实用到的 className」,应当为空。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT = join(__dirname, '..');
const BATTLE_CSS = join(CLIENT, 'app/[lang]/battle/battle.css');
const SOLO_DIRS = [
  join(CLIENT, 'app/[lang]/timer/_components'),
  join(CLIENT, 'app/[lang]/timer/_shell'),
];
/** BattleView 是对战自己的,它的 className 不算「单人侧」。 */
const NOT_SOLO = new Set(['BattleView.tsx']);

/** battle.css 里以裸类名起头的选择器 → Map<class, 选择器[]>。 */
function bareClassSelectors(): Map<string, string[]> {
  const css = readFileSync(BATTLE_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, string[]>();
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const raw of m[1].split(',')) {
      const sel = raw.trim().replace(/\s+/g, ' ');
      if (!sel || sel.startsWith('@') || /^(from|to|\d)/.test(sel)) continue;
      // 已自带作用域 / 不作用于元素的,跳过
      if (sel.includes('battle-container') || sel.includes('.vs-')) continue;
      if (sel.startsWith(':root') || sel.startsWith('html')) continue;
      const first = sel.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!first) continue;
      const list = out.get(first[1]) ?? [];
      list.push(sel);
      out.set(first[1], list);
    }
  }
  return out;
}

/** 单人侧 TSX 里出现过的 className 字面量。 */
function soloClassNames(): Set<string> {
  const used = new Set<string>();
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.tsx') || NOT_SOLO.has(f)) continue;
      const src = readFileSync(p, 'utf8');
      for (const q of src.matchAll(/className=[{"'`]+([^"'`}]+)/g)) {
        for (const c of q[1].split(/[\s$]+/)) {
          const t = c.trim();
          if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(t)) used.add(t);
        }
      }
    }
  };
  for (const d of SOLO_DIRS) walk(d);
  return used;
}

describe('battle.css 不漏进单人模式', () => {
  it('没有裸类名规则会命中单人 DOM', () => {
    const bare = bareClassSelectors();
    const solo = soloClassNames();
    const leaks = [...bare.keys()].filter((c) => solo.has(c)).sort();
    // 报错时把肇事选择器一并打出来,免得只看到一个类名还得自己翻文件
    const detail = leaks.map((c) => `  .${c} → ${[...new Set(bare.get(c))].join(' / ')}`).join('\n');
    expect(leaks, `battle.css 裸选择器漏进单人,改写成 :where(.battle-container) 前缀:\n${detail}`).toEqual([]);
  });

  it('自检:探测器确实能认出裸类名和单人 className(否则上面那条会变成空断言)', () => {
    expect(bareClassSelectors().size).toBeGreaterThan(50);
    expect(soloClassNames().size).toBeGreaterThan(100);
  });
});
