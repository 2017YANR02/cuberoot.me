'use client';

/**
 * 面板 2 — AUF 轨道探索器(PLL):选一个 case,把 16 个「起手 AUF × 收尾 AUF」
 * 的像全画出来,一眼看出哪些重合 —— 重合越多(对称越强),这个 case 越稀有。
 * 全部 288 个 PLL 状态现场枚举分轨道;命名只按环结构铁证识别(H/Z/E/N/U/A)。
 */
import { useMemo, useState } from 'react';
import { TeXBlock } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import LLDiagram from './LLDiagram';
import {
  enumerateUniverse, orbitStats, pllOrbitLabel, displayRep, images, keyOf, type LLState,
} from './ll_math';

const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

interface OrbitEntry {
  canon: string;
  size: number;
  rep: LLState;
  label: { zh: string; en: string } | null;
}

export default function OrbitExplorer() {
  const t = useT();
  const [selIdx, setSelIdx] = useState(1);   // 默认选中第一个非还原轨道(H perm 排最前)
  const [dedup, setDedup] = useState(false);

  const orbits = useMemo<OrbitEntry[]>(() => {
    const stats = orbitStats(enumerateUniverse('pll'));
    const list: OrbitEntry[] = [];
    for (const [canon, { size, rep }] of stats.byCanon) {
      list.push({ canon, size, rep: displayRep(rep), label: pllOrbitLabel(rep, size) });
    }
    // 排序:还原最前,然后按轨道从小到大(对称越强越靠前),记名的优先
    list.sort((a, b) => {
      const aSolved = a.label?.en.startsWith('Solved') ? 0 : 1;
      const bSolved = b.label?.en.startsWith('Solved') ? 0 : 1;
      if (aSolved !== bSolved) return aSolved - bSolved;
      if (a.size !== b.size) return a.size - b.size;
      if (!!a.label !== !!b.label) return a.label ? -1 : 1;
      return a.canon < b.canon ? -1 : 1;
    });
    return list;
  }, []);

  const sel = orbits[Math.min(selIdx, orbits.length - 1)];

  // 16 像的 4×4 网格:行 = 起手 AUF a,列 = 收尾 AUF b;同态同色同编号
  const grid = useMemo(() => {
    const imgs = images(sel.rep);   // 顺序:a 外层 0..3,b 内层 0..3
    const groupOf = new Map<string, number>();
    const cells = imgs.map(s => {
      const k = keyOf(s);
      if (!groupOf.has(k)) groupOf.set(k, groupOf.size);
      return { s, g: groupOf.get(k)! };
    });
    return { cells, distinct: groupOf.size };
  }, [sel]);

  const anonCounter = (() => {
    let n = 0;
    return (e: OrbitEntry) => {
      if (e.label) return tr(e.label);
      n += 1;
      return t(`匿名 #${n}`, `case #${n}`);
    };
  })();

  const probDen = 288 / sel.size;

  return (
    <div className="prob-panel">
      <div className="prob-panel-title">{t('16 个 AUF 像:同一个 case 长几副面孔?', '16 AUF images: how many faces does one case wear?')}</div>
      <div className="prob-panel-sub">
        {t('行 = 打乱前的 U 转(起手 AUF),列 = 打乱后的 U 转(收尾 AUF)。编号相同的格子是同一个状态 —— 重合越多,case 越对称、出现越稀有。',
          'Rows: U turn before the scramble (pre-AUF); columns: after (post-AUF). Cells sharing a number are the same state — more overlap means more symmetry and a rarer case.')}
      </div>

      <div className="prob-chip-row" style={{ marginBottom: 10 }}>
        {orbits.map((e, i) => (
          <button
            key={e.canon}
            type="button"
            className={`prob-chip${i === selIdx ? ' is-active' : ''}`}
            onClick={() => setSelIdx(i)}
          >
            {anonCounter(e)}
          </button>
        ))}
      </div>

      <div className="prob-chip-row">
        <button type="button" className={`prob-chip is-ghost${dedup ? ' is-active' : ''}`} onClick={() => setDedup(d => !d)}>
          {dedup ? t('只看不同状态', 'distinct states only') : t('看全部 16 格', 'all 16 cells')}
        </button>
        <span className="prob-chip-row-label">
          {t(`${grid.distinct} 个不同状态,稳定子 ${16 / grid.distinct} 阶`, `${grid.distinct} distinct states, stabiliser of order ${16 / grid.distinct}`)}
        </span>
      </div>

      {dedup ? (
        <div className="prob-orbit-dedup">
          {grid.cells.filter((c, i) => grid.cells.findIndex(x => x.g === c.g) === i).map(c => (
            <LLDiagram key={c.g} state={c.s} size={84} highlight={PALETTE[c.g % 8]} />
          ))}
        </div>
      ) : (
        <div className="prob-orbit-grid-wrap">
          <div className="prob-orbit-grid">
            <div className="prob-orbit-corner" />
            {[0, 1, 2, 3].map(b => (
              <div key={`h${b}`} className="prob-orbit-axis">{`U^${b}`}{t(' 后', ' post')}</div>
            ))}
            {[0, 1, 2, 3].flatMap(a => [
              <div key={`v${a}`} className="prob-orbit-axis">{`U^${a}`}{t(' 前', ' pre')}</div>,
              ...[0, 1, 2, 3].map(b => {
                const c = grid.cells[a * 4 + b];
                return (
                  <div key={`c${a}${b}`} className="prob-orbit-cell">
                    <LLDiagram state={c.s} size={64} highlight={PALETTE[c.g % 8]} />
                    <span className="prob-orbit-badge" style={{ background: PALETTE[c.g % 8] }}>{c.g + 1}</span>
                  </div>
                );
              }),
            ])}
          </div>
        </div>
      )}

      <div className="prob-result">
        <span className="prob-result-num">1/{probDen}</span>
        <span className="prob-result-label">
          {t(`出现概率 = ${grid.distinct} / 288(PLL 全集)≈ ${(100 * grid.distinct / 288).toPrecision(2)}%`,
            `probability = ${grid.distinct} / 288 (PLL universe) ≈ ${(100 * grid.distinct / 288).toPrecision(2)}%`)}
        </span>
      </div>

      <TeXBlock src={String.raw`|\text{orbit}| \cdot |\text{stab}| = |\mathbb{Z}_4 \times \mathbb{Z}_4| = 16
        \qquad\Longrightarrow\qquad
        P(\text{case}) = \frac{|\text{orbit}|}{|\text{universe}|} = \frac{16/|\text{stab}|}{288}`} />

      <div className="prob-note">
        {t('这就是轨道-稳定子定理:对称(稳定子)每大一倍,轨道就小一半,case 出现的概率也小一半。H perm 稳定子 4 阶 → 1/72;Z、E 是 2 阶 → 1/36;没有对称的 16 个 case 都是 1/18。顺带一提:H perm 的轨道里躺着一个「角上看着像 U2、棱全还原」的伪装态 —— 它们真是同一个 case。',
          'That is the orbit–stabiliser theorem: each doubling of symmetry (the stabiliser) halves the orbit, and with it the probability. H perm has a stabiliser of order 4 → 1/72; Z and E have order 2 → 1/36; the 16 asymmetric cases are all 1/18. Fun fact: the H-perm orbit contains a disguised state whose corners look like a U2 with all edges solved — they really are the same case.')}
      </div>
    </div>
  );
}
