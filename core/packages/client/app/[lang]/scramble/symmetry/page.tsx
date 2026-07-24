'use client';

/**
 * /scramble/symmetry —— 三阶魔方对称型工作台。
 *
 * 三个视图:
 *   搜索  = Cube Explorer 的 Symmetry Editor(选一个对称子群 + 各种约束,
 *          穷举出具有该对称的状态)。算法见 _sym_search.ts(忠实移植)。
 *   分析  = 反过来:给一堆打乱公式 / 状态,算出各自的对称群、反对称群、是否自逆。
 *          这是 D:\cube\solver_wip\tools\symmetry 那个 C++ 小工具的网页版。
 *   图鉴  = 33 种对称类型的完整表:群阶、共轭个数、状态计数、代表图案。
 *
 * 48 个对称元素的记号、几何与子群数据在 _sym_core.ts。
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useQueryState, parseAsStringEnum, parseAsInteger } from 'nuqs';
import { Search, Square as StopIcon, Copy, Check, Eraser, ArrowRight } from 'lucide-react';
import { renderCubeSVG } from '@cuberoot/visualcube';
import Link from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ClearButton } from '@/components/ClearButton';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { cubieToFacelet, normalizeFacelet, validateFacelet, faceletToCubie } from '../solver/facelet';
import {
  SYM_TYPES, SYM_ELEMENTS, SYM_CLASS_ORDER, SYM_CLASS_INFO, TYPE_DESC,
  symMask, antisymMask, classifyMask, closure, closureWithAnti, generatorsOf,
  maskToList, maskOrder, TOTAL_POSITIONS, SYMMETRIC_POSITIONS,
  type SymClass,
} from './_sym_core';
import { SymGlyph } from './_SymGlyph';
import { SYM_EXAMPLES } from './_examples';
import { applyAlgExtended } from './_alg';
import type { PermMode } from './_sym_search';
import type { WorkerRes } from './_sym_search.worker';
import './symmetry.css';

const MAX_RESULTS = 300;
const DEFAULT_TYPE = 7; // D4h

//──────────────────────── 小工具 ────────────────────────

const SUPERS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function fmtBig(n: bigint): string {
  return n.toLocaleString('en-US');
}

/** 大数的紧凑写法:4.33 × 10¹⁹。 */
function fmtCompact(n: bigint): string {
  const s = n.toString();
  if (s.length <= 7) return fmtBig(n);
  const exp = s.length - 1;
  const mant = `${s[0]}.${s.slice(1, 3)}`;
  const sup = String(exp).split('').map((d) => SUPERS[Number(d)]).join('');
  return `${mant} × 10${sup}`;
}

const CLASS_SHORT: Record<SymClass, string> = {
  E: 'E', C4: 'C₄', C2f: 'C₂', C3: 'C₃', C2e: 'C₂′', i: 'i',
  S4: 'S₄', S6: 'S₆', sh: 'σ_h', sd: 'σ_d',
};

/** 掩码 →「E + 8C₃ + 3C₂ + 6σ_d」这样的类构成。 */
function classComposition(mask: bigint): string {
  const counts = new Map<SymClass, number>();
  for (const s of maskToList(mask)) {
    const c = SYM_ELEMENTS[s].cls;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return SYM_CLASS_ORDER.filter((c) => counts.has(c))
    .map((c) => (counts.get(c)! > 1 ? `${counts.get(c)}${CLASS_SHORT[c]}` : CLASS_SHORT[c]))
    .join(' + ');
}

const CUBE_CACHE = new Map<string, string>();
function cubeSvg(facelet: string, size: number): string {
  const key = `${size}:${facelet}`;
  const hit = CUBE_CACHE.get(key);
  if (hit) return hit;
  const svg = renderCubeSVG({ facelets: facelet.toLowerCase().split(''), width: size, height: size });
  if (CUBE_CACHE.size > 400) CUBE_CACHE.clear();
  CUBE_CACHE.set(key, svg);
  return svg;
}

function CubeThumb({ facelet, size = 84 }: { facelet: string; size?: number }) {
  const svg = useMemo(() => cubeSvg(facelet, size), [facelet, size]);
  return <span className="sym-cube" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="sym-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch { /* swallow */ }
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      <span>{label}</span>
    </button>
  );
}

//──────────────────────── 48 元素网格 ────────────────────────

interface GridProps {
  sym: bigint;
  asym: bigint;
  /** 只读展示(分析视图 / 图鉴)。 */
  readOnly?: boolean;
  disabled?: boolean;
  onToggle?: (idx: number) => void;
  t: (zh: string, en: string) => string;
}

const ElementGrid = memo(function ElementGrid({ sym, asym, readOnly, disabled, onToggle, t }: GridProps) {
  return (
    <div className="sym-grid">
      {SYM_CLASS_ORDER.map((cls) => {
        const items = SYM_ELEMENTS.filter((e) => e.cls === cls);
        const info = SYM_CLASS_INFO[cls];
        return (
          <div className="sym-class" key={cls}>
            <div className="sym-class-head">
              <span className="sym-class-name">
                {items.length > 1 && <em>{items.length}</em>}
                {CLASS_SHORT[cls]}
              </span>
              <span className="sym-class-note">{t(info.zh, info.en)}</span>
            </div>
            <div className="sym-class-items">
              {items.map((e) => {
                const on = ((sym >> BigInt(e.idx)) & 1n) === 1n;
                const anti = ((asym >> BigInt(e.idx)) & 1n) === 1n;
                const cn = `sym-el${on ? ' is-on' : ''}${anti ? ' is-anti' : ''}`;
                if (readOnly) {
                  return (
                    <span className={cn} key={e.idx}>
                      <SymGlyph idx={e.idx} size={20} />
                      <span className="sym-el-label">{e.label}</span>
                    </span>
                  );
                }
                return (
                  <button
                    type="button"
                    className={cn}
                    key={e.idx}
                    disabled={disabled}
                    onClick={() => onToggle?.(e.idx)}
                    aria-pressed={on || anti}
                  >
                    <SymGlyph idx={e.idx} size={20} />
                    <span className="sym-el-label">{e.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

//──────────────────────── 搜索视图 ────────────────────────

const PERM_MODES: { v: PermMode; zh: string; en: string }[] = [
  { v: 'all', zh: '整方', en: 'Full cube' },
  { v: 'edgesEven', zh: '只换棱(偶置换)', en: 'Edges only (even)' },
  { v: 'edgesOdd', zh: '只换棱(奇置换)', en: 'Edges only (odd)' },
  { v: 'cornersEven', zh: '只换角(偶置换)', en: 'Corners only (even)' },
  { v: 'cornersOdd', zh: '只换角(奇置换)', en: 'Corners only (odd)' },
];

interface ResultItem { facelet: string; generator?: string }

const ResultCard = memo(function ResultCard({ item, index, t }: {
  item: ResultItem; index: number; t: (zh: string, en: string) => string;
}) {
  const moves = item.generator ? item.generator.split(/\s+/).filter(Boolean).length : 0;
  return (
    <li className="sym-result">
      <CubeThumb facelet={item.facelet} size={84} />
      <div className="sym-result-body">
        <div className="sym-result-head">
          <span className="sym-muted">#{index + 1}</span>
          {item.generator && <span className="sym-muted">{moves} {t('步', 'moves')}</span>}
        </div>
        {item.generator && <code className="sym-alg">{item.generator}</code>}
        <div className="sym-result-actions">
          {item.generator && <CopyButton text={item.generator} label={t('公式', 'Alg')} />}
          <CopyButton text={item.facelet} label={t('状态', 'State')} />
          <Link
            className="sym-copy"
            href={`/scramble/solver?event=333&state=${item.facelet}`}
            prefetch={false}
          >
            <ArrowRight size={13} />
            <span>{t('求解', 'Solve')}</span>
          </Link>
        </div>
      </div>
    </li>
  );
});

function SearchView({ t, typeIdx, setTypeIdx }: {
  t: (zh: string, en: string) => string;
  typeIdx: number;
  setTypeIdx: (i: number) => void;
}) {
  // 用户点过的"种子"元素;实际子群 = 种子的生成闭包(所以取消勾选也是可逆的)
  const [symSeeds, setSymSeeds] = useState<number[]>(() => generatorsOf(SYM_TYPES[typeIdx].mask));
  const [asymSeeds, setAsymSeeds] = useState<number[]>([]);
  const [antiMode, setAntiMode] = useState(false);
  const [selfInverse, setSelfInverse] = useState(false);

  const [exactSym, setExactSym] = useState(true);
  const [exactAsym, setExactAsym] = useState(false);
  const [noSelfInverse, setNoSelfInverse] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [allowIso, setAllowIso] = useState(false);
  const [isoInv, setIsoInv] = useState(false);
  const [findGenerators, setFindGenerators] = useState(true);
  const [colorCounts, setColorCounts] = useState<boolean[]>([true, true, true, true, true, true]);
  const [permMode, setPermMode] = useState<PermMode>('all');

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'tables' | 'searching' | 'generators' | 'done'>('idle');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [nodes, setNodes] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const { sym, asym } = useMemo(
    () => closureWithAnti(symSeeds, selfInverse ? [...asymSeeds, 0] : asymSeeds),
    [symSeeds, asymSeeds, selfInverse],
  );
  const curType = useMemo(() => classifyMask(sym), [sym]);
  const asymType = useMemo(
    () => (asym === 0n ? -1 : classifyMask(closure([...maskToList(sym), ...maskToList(asym)]))),
    [sym, asym],
  );

  // 下拉选类型 → 重置种子为该子群的一组生成元
  const pickType = (i: number) => {
    setTypeIdx(i);
    setSymSeeds(generatorsOf(SYM_TYPES[i].mask));
    setAsymSeeds([]);
  };

  const toggleElement = (idx: number) => {
    if (idx === 0) return; // 恒等永远在
    const seeds = antiMode ? asymSeeds : symSeeds;
    const setSeeds = antiMode ? setAsymSeeds : setSymSeeds;
    const next = seeds.includes(idx) ? seeds.filter((s) => s !== idx) : [...seeds, idx];
    setSeeds(next);
    if (!antiMode) {
      const ti = classifyMask(closure(next));
      if (ti >= 0) setTypeIdx(ti);
    }
  };

  const clearAll = () => {
    setSymSeeds([]);
    setAsymSeeds([]);
    setSelfInverse(false);
    setTypeIdx(32); // C1
  };

  const start = useCallback(() => {
    if (running) return;
    setResults([]);
    setNodes(0);
    setTruncated(false);
    setError(null);
    setRunning(true);
    setPhase('searching');
    const worker = new Worker(new URL('./_sym_search.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerRes>) => {
      const msg = ev.data;
      if (msg.type === 'phase') setPhase(msg.phase);
      else if (msg.type === 'result') {
        setResults((prev) => [...prev, { facelet: msg.facelet }]);
      } else if (msg.type === 'generator') {
        setResults((prev) => prev.map((r, i) => (i === msg.index ? { ...r, generator: msg.generator } : r)));
      } else if (msg.type === 'progress') {
        setNodes(msg.nodes);
      } else if (msg.type === 'searched') {
        setNodes(msg.nodes);
        setTruncated(msg.truncated);
      } else if (msg.type === 'done') {
        setNodes(msg.nodes);
        setTruncated(msg.truncated);
        setPhase('done');
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        setError(msg.message);
        setPhase('done');
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.postMessage({
      op: 'start',
      symMask: sym.toString(),
      asymMask: asym.toString(),
      exactSym,
      exactAsym,
      noSelfInverse,
      colorCounts,
      permMode,
      continuous,
      allowIsomorphics: allowIso,
      isoIncludeInverse: isoInv,
      findGenerators,
      maxResults: MAX_RESULTS,
    });
  }, [running, sym, asym, exactSym, exactAsym, noSelfInverse, colorCounts, permMode,
    continuous, allowIso, isoInv, findGenerators]);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setPhase('done');
  }, []);

  const info = curType >= 0 ? SYM_TYPES[curType] : null;
  const noColor = colorCounts.every((c) => !c);
  const withAlg = results.filter((r) => r.generator).length;
  const noAlg = findGenerators ? results.length - withAlg : 0;
  const nodesLabel = nodes >= 1e6 ? `${(nodes / 1e6).toFixed(0)}M` : nodes.toLocaleString('en-US');

  return (
    <>
      <section className="sym-block">
        <div className="sym-row">
          <span className="sym-label">{t('对称类型', 'Symmetry type')}</span>
          <select
            className="sym-select"
            value={typeIdx}
            onChange={(e) => pickType(Number(e.target.value))}
            disabled={running}
            aria-label={t('对称类型', 'Symmetry type')}
          >
            {SYM_TYPES.map((ty, i) => (
              <option key={ty.name} value={i}>
                {ty.name} — {t('阶', 'order')} {ty.order}
              </option>
            ))}
          </select>
        </div>
        {info && (
          <dl className="sym-facts">
            <div><dt>{t('群阶', 'Order')}</dt><dd>{maskOrder(sym)}</dd></div>
            <div><dt>{t('共轭个数', 'Conjugates')}</dt><dd>{info.conjugates}</dd></div>
            <div>
              <dt>{t('恰好是它', 'Exactly this')}</dt>
              <dd title={fmtBig(info.exact)}>{fmtCompact(info.exact)}</dd>
            </div>
            <div>
              <dt>{t('至少含它', 'At least this')}</dt>
              <dd title={fmtBig(info.atLeast)}>{fmtCompact(info.atLeast)}</dd>
            </div>
            <div className="sym-facts-wide">
              <dt>{t('元素构成', 'Elements')}</dt>
              <dd>{classComposition(sym)}</dd>
            </div>
            {TYPE_DESC[info.name] && (
              <div className="sym-facts-wide">
                <dt>{t('说明', 'Notes')}</dt>
                <dd>{t(TYPE_DESC[info.name].zh, TYPE_DESC[info.name].en)}</dd>
              </div>
            )}
          </dl>
        )}
        {info && info.exact === 0n && (
          <p className="sym-warn">
            {t(
              `不存在对称群恰好等于 ${info.name} 的状态:只要一个状态具有这 ${info.order} 个对称,它必然把剩下的也一起具有,于是落进 Oh。关掉「精确对称」才会有结果。`,
              `No position has symmetry exactly ${info.name}: any position with these ${info.order} elements automatically has all 48, so it lands in Oh. Turn off “exactly this symmetry” to get results.`,
            )}
          </p>
        )}
      </section>

      <section className="sym-block">
        <div className="sym-row">
          <span className="sym-label">{t('对称元素', 'Symmetry elements')}</span>
          <PillToggle
            value={antiMode}
            onChange={setAntiMode}
            onLabel={t('反对称', 'Antisym')}
            offLabel={t('对称', 'Symmetry')}
            disabled={running}
          />
          <BoolToggle
            value={selfInverse}
            onChange={setSelfInverse}
            disabled={running}
            label={t('自逆', 'Selfinverse')}
          />
          <button type="button" className="sym-btn" onClick={clearAll} disabled={running}>
            <Eraser size={14} />
            {t('清空', 'Clear')}
          </button>
        </div>
        <p className="sym-hint">
          {t(
            '点一个元素就把它加进生成集,群自动闭合;再点一次取消。反对称元素 S 的含义是 S·p·S⁻¹ = p⁻¹。',
            'Clicking an element adds it to the generating set (the group closes automatically); click again to remove it. An antisymmetry element S means S·p·S⁻¹ = p⁻¹.',
          )}
        </p>
        <ElementGrid sym={sym} asym={asym} disabled={running} onToggle={toggleElement} t={t} />
        {asym !== 0n && asymType >= 0 && (
          <p className="sym-hint">
            {t('对称加上反对称陪集,合起来是 ', 'Symmetry plus the antisymmetry coset together form ')}
            <strong>{SYM_TYPES[asymType].name}</strong>
            {t(':一半是对称,一半是反对称。', ': half symmetry, half antisymmetry.')}
          </p>
        )}
      </section>

      <section className="sym-block">
        <span className="sym-label">{t('约束', 'Constraints')}</span>
        <div className="sym-opts">
          <BoolToggle value={exactSym} onChange={setExactSym} disabled={running}
            label={t('精确对称(不允许更高对称)', 'Exactly this symmetry')} />
          <BoolToggle value={exactAsym} onChange={setExactAsym} disabled={running}
            label={t('精确反对称', 'Exactly this antisymmetry')} />
          <BoolToggle value={noSelfInverse} onChange={setNoSelfInverse} disabled={running}
            label={t('排除自逆状态', 'No selfinverse')} />
          <BoolToggle value={continuous} onChange={setContinuous} disabled={running || permMode !== 'all'}
            label={t('图案跨棱连续', 'Continuous pattern')} />
          <BoolToggle value={allowIso} onChange={setAllowIso} disabled={running}
            label={t('允许同构(不去重)', 'Allow isomorphics')} />
          <BoolToggle value={isoInv} onChange={setIsoInv} disabled={running || allowIso}
            label={t('去重时把逆视作同一个', 'Treat inverse as isomorphic')} />
          <BoolToggle value={findGenerators} onChange={setFindGenerators} disabled={running}
            label={t('求生成公式', 'Find generators')} />
        </div>
        <div className="sym-row">
          <span className="sym-label">{t('每面颜色数', 'Colors per face')}</span>
          <div className="sym-chips">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={`sym-chip${colorCounts[n - 1] ? ' is-on' : ''}`}
                disabled={running}
                aria-pressed={colorCounts[n - 1]}
                onClick={() => setColorCounts((prev) => prev.map((v, i) => (i === n - 1 ? !v : v)))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="sym-row">
          <span className="sym-label">{t('置换范围', 'Permutation')}</span>
          <select
            className="sym-select"
            value={permMode}
            onChange={(e) => setPermMode(e.target.value as PermMode)}
            disabled={running}
            aria-label={t('置换范围', 'Permutation')}
          >
            {PERM_MODES.map((m) => (
              <option key={m.v} value={m.v}>{t(m.zh, m.en)}</option>
            ))}
          </select>
        </div>
        {(permMode === 'edgesOdd' || permMode === 'cornersOdd') && (
          <p className="sym-hint">
            {t(
              '奇置换本身不可解;图上已按 Cube Explorer 的做法交换两块贴纸,把它画成合法状态。',
              'An odd permutation is unsolvable on its own; two stickers are swapped in the picture (as Cube Explorer does) to make it a legal state.',
            )}
          </p>
        )}
      </section>

      <section className="sym-actions">
        {running ? (
          <button type="button" className="sym-btn sym-btn-primary" onClick={stop}>
            <StopIcon size={15} />
            {t('停止', 'Stop')}
          </button>
        ) : (
          <button type="button" className="sym-btn sym-btn-primary" onClick={start} disabled={noColor}>
            <Search size={15} />
            {t('开始搜索', 'Start search')}
          </button>
        )}
        {noColor && (
          <span className="sym-hint">{t('至少勾选一个「每面颜色数」', 'Pick at least one “colors per face”')}</span>
        )}
      </section>

      {(phase !== 'idle' || results.length > 0) && (
        <section className="sym-status" aria-live="polite">
          {phase === 'tables' && <span>{t('正在构建求解表(首次约几秒)…', 'Building solver tables (a few seconds on first run)…')}</span>}
          {phase === 'searching' && (
            <span>
              {t('搜索中', 'Searching')} — {t('已找到', 'found')} {results.length}
              {nodes > 0 ? ` / ${nodesLabel} ${t('节点', 'nodes')}` : ''}
            </span>
          )}
          {phase === 'generators' && (
            <span>
              {t('搜索完成,正在求生成公式', 'Search done, solving generators')} — {withAlg} / {results.length}
            </span>
          )}
          {phase === 'done' && !error && (
            <span>
              {t('完成', 'Done')} — {results.length} {t('个结果', 'results')}
              {truncated ? t(`(已达上限 ${MAX_RESULTS},提前停止)`, ` (limit ${MAX_RESULTS} reached, stopped early)`) : ''}
              {noAlg > 0
                ? t(`,其中 ${noAlg} 个超时未求出公式`, `, ${noAlg} of them timed out without an alg`)
                : ''}
            </span>
          )}
          {error && <span className="sym-error">{t('搜索出错:', 'Search error: ')}{error}</span>}
        </section>
      )}

      {results.length > 0 && (
        <ul className="sym-results">
          {results.map((r, i) => <ResultCard key={`${r.facelet}-${i}`} item={r} index={i} t={t} />)}
        </ul>
      )}
    </>
  );
}

//──────────────────────── 分析视图 ────────────────────────

interface Analyzed {
  input: string;
  facelet?: string;
  sym?: bigint;
  asym?: bigint;
  typeIdx?: number;
  asymTypeIdx?: number;
  selfInverse?: boolean;
  reoriented?: boolean;
  error?: string;
}

function analyzeLine(line: string): Analyzed {
  const raw = line.trim();
  if (!raw) return { input: raw, error: 'empty' };
  const compact = raw.replace(/\s+/g, '');
  try {
    let cube;
    let reoriented = false;
    if (/^[URFDLB]{54}$/i.test(compact)) {
      const facelet = normalizeFacelet(compact);
      const err = validateFacelet(facelet);
      if (err) return { input: raw, error: err };
      cube = faceletToCubie(facelet);
    } else {
      const r = applyAlgExtended(raw);
      cube = r.cube;
      reoriented = r.reoriented;
    }
    const s = symMask(cube);
    const a = antisymMask(cube);
    return {
      input: raw,
      facelet: cubieToFacelet(cube),
      sym: s,
      asym: a,
      typeIdx: classifyMask(s),
      asymTypeIdx: a === 0n ? -1 : classifyMask(closure([...maskToList(s), ...maskToList(a)])),
      selfInverse: (a & 1n) === 1n,
      reoriented,
    };
  } catch (e) {
    return { input: raw, error: e instanceof Error ? e.message : String(e) };
  }
}

const SAMPLE_INPUT = [
  'U2 D2 R2 L2 F2 B2',
  'U2 D2',
  "U D'",
  'F2 R2',
  "R U R' U'",
  "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U",
].join('\n');

function AnalyzeView({ t }: { t: (zh: string, en: string) => string }) {
  const [q, setQ] = useQueryState('q');
  // IME 安全:本地态承接输入,合成结束 + 防抖后才写回 URL(直接绑 nuqs 会打断中文输入)
  const [text, setText] = useState(() => q ?? '');
  const composing = useRef(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => { if (!composing.current) setQ(text || null); }, 400);
    return () => clearTimeout(id);
  }, [text, setQ]);

  const rows = useMemo(() => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 200);
    return lines.map(analyzeLine);
  }, [text]);

  const okRows = rows.filter((r) => r.typeIdx !== undefined);
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of okRows) {
      const n = SYM_TYPES[r.typeIdx!].name;
      m.set(n, (m.get(n) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [okRows]);

  return (
    <>
      <section className="sym-block">
        <div className="sym-row">
          <span className="sym-label">{t('输入', 'Input')}</span>
          <button type="button" className="sym-btn" onClick={() => setText(SAMPLE_INPUT)}>
            {t('填入示例', 'Load samples')}
          </button>
          {text && <ClearButton variant="standalone" onClick={() => setText('')} />}
        </div>
        <textarea
          className="sym-input"
          rows={Math.min(14, Math.max(5, text.split('\n').length + 1))}
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={(e) => { composing.current = false; setText(e.currentTarget.value); }}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(
            '每行一个:打乱公式(U R F D L B,也支持宽层 Rw/r、中层 M E S、整体旋转 x y z),或 54 位 URFDLB 状态串',
            'One per line: a scramble (U R F D L B; wide Rw/r, slices M E S and rotations x y z are fine too) or a 54-character URFDLB state string',
          )}
        />
        <p className="sym-hint">
          {t(
            '整体旋转按标准约定处理:结果是把魔方转回标准朝向后的状态。对称型本身不受朝向影响。',
            'Rotations follow the usual convention: the result is the position after turning the cube back to standard orientation. The symmetry type itself does not depend on orientation.',
          )}
        </p>
      </section>

      {tally.length > 1 && (
        <section className="sym-block">
          <span className="sym-label">{t('汇总', 'Summary')}</span>
          <dl className="sym-facts">
            {tally.map(([name, n]) => (
              <div key={name}><dt>{name}</dt><dd>{n}</dd></div>
            ))}
          </dl>
        </section>
      )}

      <ol className="sym-analyzed">
        {rows.map((r, i) => (
          <li className="sym-analyzed-row" key={`${r.input}-${i}`}>
            {r.error ? (
              <>
                <span className="sym-cube sym-cube-empty" aria-hidden />
                <div className="sym-analyzed-body">
                  <code className="sym-alg">{r.input}</code>
                  <span className="sym-error">
                    {r.error === 'empty'
                      ? t('空行', 'Empty line')
                      : t(`无法解析:${r.error}`, `Cannot parse: ${r.error}`)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <CubeThumb facelet={r.facelet!} size={72} />
                <div className="sym-analyzed-body">
                  <code className="sym-alg">{r.input}</code>
                  <div className="sym-analyzed-facts">
                    <strong className="sym-typename">{SYM_TYPES[r.typeIdx!].name}</strong>
                    <span className="sym-muted">{t('阶', 'order')} {SYM_TYPES[r.typeIdx!].order}</span>
                    <span className="sym-muted">{classComposition(r.sym!)}</span>
                    {r.selfInverse && <span className="sym-badge">{t('自逆', 'Selfinverse')}</span>}
                    {r.reoriented && <span className="sym-badge">{t('已折算旋转', 'Reoriented')}</span>}
                    {r.asymTypeIdx! >= 0 && (
                      <span className="sym-muted">
                        {t('含反对称 →', 'with antisymmetry →')} {SYM_TYPES[r.asymTypeIdx!].name}
                      </span>
                    )}
                  </div>
                  <div className="sym-result-actions">
                    <button
                      type="button"
                      className="sym-copy"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      {expanded === i ? t('收起元素', 'Hide elements') : t('查看 48 元素', 'Show 48 elements')}
                    </button>
                    <CopyButton text={r.facelet!} label={t('状态', 'State')} />
                    <Link
                      className="sym-copy"
                      href={`/scramble/solver?event=333&state=${r.facelet}`}
                      prefetch={false}
                    >
                      <ArrowRight size={13} />
                      <span>{t('求解', 'Solve')}</span>
                    </Link>
                  </div>
                  {expanded === i && <ElementGrid sym={r.sym!} asym={r.asym!} readOnly t={t} />}
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

//──────────────────────── 图鉴视图 ────────────────────────

const EXAMPLE_FACELETS = new Map<string, string>(
  SYM_EXAMPLES.map((e) => [
    e.name,
    e.alg === null ? '' : cubieToFacelet(applyAlgExtended(e.alg).cube),
  ]),
);

function CatalogView({ t, onPick }: {
  t: (zh: string, en: string) => string;
  onPick: (i: number) => void;
}) {
  return (
    <>
      <section className="sym-block">
        <p className="sym-hint">
          {t(
            `立方体的对称群 O_h 共有 98 个子群,归为 33 个共轭类 —— 也就是魔方状态可能具有的 33 种对称型。全部 ${fmtCompact(TOTAL_POSITIONS)} 个状态里,只有 ${fmtBig(SYMMETRIC_POSITIONS)} 个带有非平凡对称。`,
            `The cube symmetry group O_h has 98 subgroups falling into 33 conjugacy classes — the 33 symmetry types a cube position can have. Of all ${fmtCompact(TOTAL_POSITIONS)} positions, only ${fmtBig(SYMMETRIC_POSITIONS)} have any non-trivial symmetry.`,
          )}
        </p>
      </section>
      <ol className="sym-catalog">
        {SYM_TYPES.map((ty, i) => {
          const ex = SYM_EXAMPLES.find((e) => e.name === ty.name);
          const facelet = EXAMPLE_FACELETS.get(ty.name) ?? '';
          return (
            <li className="sym-cat-row" key={ty.name}>
              {facelet
                ? <CubeThumb facelet={facelet} size={72} />
                : <span className="sym-cube sym-cube-empty" aria-hidden />}
              <div className="sym-cat-body">
                <div className="sym-cat-head">
                  <strong className="sym-typename">{ty.name}</strong>
                  <span className="sym-muted">{t('阶', 'order')} {ty.order}</span>
                  <span className="sym-muted">{ty.conjugates} {t('个共轭', 'conjugates')}</span>
                  <button type="button" className="sym-copy" onClick={() => onPick(i)}>
                    <Search size={13} />
                    <span>{t('用它搜索', 'Search this')}</span>
                  </button>
                </div>
                <div className="sym-cat-facts">
                  <span className="sym-muted">{classComposition(ty.mask)}</span>
                  <span className="sym-muted" title={fmtBig(ty.classCount)}>
                    {t('状态数(全部共轭合计)', 'positions (all conjugates)')} {fmtCompact(ty.classCount)}
                  </span>
                </div>
                {TYPE_DESC[ty.name] && (
                  <p className="sym-cat-desc">{t(TYPE_DESC[ty.name].zh, TYPE_DESC[ty.name].en)}</p>
                )}
                {ex?.alg ? (
                  <div className="sym-cat-alg">
                    <code className="sym-alg">{ex.alg}</code>
                    {ex.label && <span className="sym-muted">{t(ex.label.zh, ex.label.en)}</span>}
                    <CopyButton text={ex.alg} label={t('复制', 'Copy')} />
                  </div>
                ) : (
                  <p className="sym-warn">
                    {t(
                      '没有状态的对称群恰好是它:具有这些对称的状态一定同时具有全部 48 个。',
                      'No position has exactly this symmetry — anything with these elements automatically has all 48.',
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

//──────────────────────── 页面 ────────────────────────

const VIEWS = ['search', 'analyze', 'catalog'] as const;

export default function SymmetryPage() {
  useDocumentTitle('对称型', 'Symmetry');
  const t = useT();
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum([...VIEWS]).withDefault('search').withOptions({ history: 'push' }),
  );
  const [typeIdx, setTypeIdx] = useQueryState('t', parseAsInteger.withDefault(DEFAULT_TYPE));

  const safeIdx = typeIdx >= 0 && typeIdx < SYM_TYPES.length ? typeIdx : DEFAULT_TYPE;
  const pick = (i: number) => setTypeIdx(i === DEFAULT_TYPE ? null : i);

  return (
    <div className="sym-page">
      <header className="sym-header">
        <h1>{t('对称型', 'Symmetry')}</h1>
        <p className="sym-lead">
          {t(
            '把整个立方体旋转或镜射之后,一个魔方状态如果还长得一模一样,就说它具有那个对称。这些对称合起来构成 O_h 的一个子群,一共只有 33 种可能。这里既能按对称型反向搜索状态,也能算出任意状态的对称型。移植自 Herbert Kociemba 的 Cube Explorer。',
            'A cube position has a symmetry when rotating or reflecting the whole cube leaves it looking exactly the same. Those symmetries form a subgroup of O_h, and there are only 33 possibilities. Search positions by symmetry type, or go the other way and classify any position. Ported from Herbert Kociemba\'s Cube Explorer.',
          )}
        </p>
      </header>

      <nav className="sym-tabs" aria-label={t('视图', 'View')}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={`sym-tab${view === v ? ' is-on' : ''}`}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {v === 'search' && t('搜索', 'Search')}
            {v === 'analyze' && t('分析', 'Analyze')}
            {v === 'catalog' && t('图鉴', 'Catalog')}
          </button>
        ))}
      </nav>

      {view === 'search' && <SearchView t={t} typeIdx={safeIdx} setTypeIdx={pick} />}
      {view === 'analyze' && <AnalyzeView t={t} />}
      {view === 'catalog' && <CatalogView t={t} onPick={(i) => { pick(i); setView('search'); }} />}
    </div>
  );
}
