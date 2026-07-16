'use client';

/**
 * 面板 3 — Burnside 计数实验室:五个全集现场枚举,数出轨道(= case 数)、
 * 轨道大小直方图,并用 Burnside 引理(不动点均值)交叉验证。
 * 1LLL 有 62,208 个状态,枚举约一秒,放在按钮后面按需算。
 */
import { useMemo, useRef, useState } from 'react';
import { TeXBlock } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import {
  enumerateUniverse, orbitStats, fixedPoints, ollOrbitStats, type UniverseId,
} from './ll_math';

interface LabResult {
  states: number;
  orbits: number;
  hist: Array<[number, number]>;      // [轨道大小, 条数]
  /** Burnside 不动点:PLL/ELL/ZBLL 是 4×4(双边),OLL 是 1×4(旋转) */
  fixed: number[] | null;
  fixedShape: 'grid' | 'row' | null;
}

const UNIVERSES: ReadonlyArray<{ id: UniverseId; label: string; heavy?: boolean }> = [
  { id: 'pll', label: 'PLL 288' },
  { id: 'oll', label: 'OLL 216' },
  { id: 'ell', label: 'ELL 384' },
  { id: 'zbll', label: 'ZBLL 7776' },
  { id: '1lll', label: '1LLL 62208', heavy: true },
];

function compute(id: UniverseId): LabResult {
  if (id === 'oll') {
    const r = ollOrbitStats();
    return {
      states: r.states,
      orbits: r.orbits,
      hist: [...r.histogram.entries()].sort((a, b) => a[0] - b[0]),
      fixed: r.fixed,
      fixedShape: 'row',
    };
  }
  const states = enumerateUniverse(id);
  const r = orbitStats(states);
  let fixed: number[] | null = null;
  let fixedShape: LabResult['fixedShape'] = null;
  if (id !== '1lll') {  // 1LLL 的 16×62208 不动点扫描太重,只给轨道数
    fixed = [];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) fixed.push(fixedPoints(states, a, b));
    fixedShape = 'grid';
  }
  return {
    states: states.length,
    orbits: r.orbits,
    hist: [...r.histogram.entries()].sort((a, b) => a[0] - b[0]),
    fixed,
    fixedShape,
  };
}

export default function BurnsideLab() {
  const t = useT();
  const [sel, setSel] = useState<UniverseId>('pll');
  const [computing, setComputing] = useState(false);
  const [heavyDone, setHeavyDone] = useState(false);
  const cache = useRef(new Map<UniverseId, LabResult>());

  const result = useMemo<LabResult | null>(() => {
    const uni = UNIVERSES.find(u => u.id === sel)!;
    if (uni.heavy && !cache.current.has(sel) && !heavyDone) return null;
    if (!cache.current.has(sel)) cache.current.set(sel, compute(sel));
    return cache.current.get(sel)!;
  }, [sel, heavyDone]);

  const runHeavy = () => {
    setComputing(true);
    // 先让「枚举中…」画出来,再做那 ~1s 的同步枚举
    window.setTimeout(() => {
      if (!cache.current.has(sel)) cache.current.set(sel, compute(sel));
      setComputing(false);
      setHeavyDone(true);
    }, 30);
  };

  const BAR_W = 480;
  const BAR_H = 150;

  return (
    <div className="prob-panel">
      <div className="prob-panel-title">{t('数 case:轨道计数 = Burnside 不动点均值', 'Counting cases: orbits = average fixed points (Burnside)')}</div>
      <div className="prob-panel-sub">
        {t('每个全集的所有状态都在浏览器里现场枚举 —— 这些数字不是抄来的,是算出来的。',
          'Every universe is enumerated live in your browser — these numbers are computed, not quoted.')}
      </div>

      <div className="prob-chip-row">
        {UNIVERSES.map(u => (
          <button
            key={u.id}
            type="button"
            className={`prob-chip${sel === u.id ? ' is-active' : ''}`}
            onClick={() => setSel(u.id)}
          >
            {u.label}
          </button>
        ))}
      </div>

      {!result ? (
        <div className="prob-heavy-gate">
          <button type="button" className="prob-btn" onClick={runHeavy} disabled={computing}>
            {computing
              ? t('枚举 62,208 个状态中…', 'Enumerating 62,208 states…')
              : t('现场枚举 62,208 个状态(约 1 秒)', 'Enumerate all 62,208 states (~1 s)')}
          </button>
        </div>
      ) : (
        <>
          <div className="prob-result">
            <span className="prob-result-num">{result.orbits.toLocaleString('en-US')}</span>
            <span className="prob-result-label">
              {t(`条轨道(case,含还原)/ ${result.states.toLocaleString('en-US')} 个状态`,
                `orbits (cases, incl. solved) / ${result.states.toLocaleString('en-US')} states`)}
            </span>
          </div>

          <svg viewBox={`0 0 ${BAR_W} ${BAR_H + 40}`} width="100%" style={{ maxWidth: BAR_W }}>
            {(() => {
              const maxCount = Math.max(...result.hist.map(([, n]) => n));
              const bw = Math.min(90, (BAR_W - 40) / result.hist.length - 18);
              return result.hist.map(([size, count], i) => {
                const h = Math.max(4, Math.sqrt(count / maxCount) * BAR_H);
                const x = 30 + i * ((BAR_W - 40) / result.hist.length);
                return (
                  <g key={size}>
                    <rect x={x} y={BAR_H - h + 10} width={bw} height={h} rx={5} fill="var(--accent)" opacity={0.32 + 0.17 * i} />
                    <text x={x + bw / 2} y={BAR_H - h + 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--foreground)">
                      {count.toLocaleString('en-US')}
                    </text>
                    <text x={x + bw / 2} y={BAR_H + 26} textAnchor="middle" fontSize={11.5} fill="var(--muted-foreground)">
                      {t(`轨道大小 ${size}`, `orbit size ${size}`)}
                    </text>
                  </g>
                );
              });
            })()}
          </svg>

          {result.fixed && (
            <div className="prob-burnside">
              <div className="prob-burnside-title">
                {result.fixedShape === 'grid'
                  ? t('16 个群元素 (a, b) 的不动点数(行 = 起手,列 = 收尾):', 'Fixed points of the 16 group elements (a, b) (row = pre, column = post):')
                  : t('4 个旋转的不动点数:', 'Fixed points of the 4 rotations:')}
              </div>
              <div className={`prob-burnside-grid${result.fixedShape === 'row' ? ' is-row' : ''}`}>
                {result.fixed.map((f, i) => (
                  <span key={i} className={`prob-burnside-cell${f > 0 ? ' is-hot' : ''}`}>{f.toLocaleString('en-US')}</span>
                ))}
              </div>
              <div className="prob-burnside-sum">
                {t(
                  `均值 = ${result.fixed.reduce((x, y) => x + y, 0).toLocaleString('en-US')} ÷ ${result.fixed.length} = ${result.fixed.reduce((x, y) => x + y, 0) / result.fixed.length} —— 正好是轨道数`,
                  `average = ${result.fixed.reduce((x, y) => x + y, 0).toLocaleString('en-US')} ÷ ${result.fixed.length} = ${result.fixed.reduce((x, y) => x + y, 0) / result.fixed.length} — exactly the orbit count`,
                )}
              </div>
            </div>
          )}
        </>
      )}

      <TeXBlock src={String.raw`\#\{\text{cases}\} \;=\; \#\{\text{orbits}\} \;=\; \frac{1}{|G|}\sum_{g \in G} |\mathrm{Fix}(g)|`} />

      <div className="prob-note">
        {t('OLL 只看朝向图案,作用是单边旋转(4 阶);其余全集吃完整的起手 × 收尾 AUF(16 阶)。OLL 的 58 条轨道 = 57 个标准 OLL + 还原;ZBLL 的 494 = 472 个 ZBLL + 21 个 PLL + 还原;1LLL 的 3,916 = 3,915 个 case + 还原。',
          'OLL looks at orientation patterns only, so the action is a single rotation (order 4); every other universe takes the full pre × post AUF action (order 16). OLL’s 58 orbits = 57 standard OLLs + solved; ZBLL’s 494 = 472 ZBLLs + 21 PLLs + solved; 1LLL’s 3,916 = 3,915 cases + solved.')}
      </div>
    </div>
  );
}
