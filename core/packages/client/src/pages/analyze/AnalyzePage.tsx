/**
 * @module pages/analyze/AnalyzePage
 *
 * /analyze — 3x3 scramble CFOP analyzer.
 *
 * Default worker is the TS port at worker/analyzer.worker.ts; the legacy
 * obfuscated worker is reachable via `?worker=legacy` for byte-identical
 * fallback comparison.
 *
 * URL params:
 *   - `?scramble=...`  preload scramble (URL-encoded; spaces or `_` accepted)
 *   - `?worker=legacy` use upstream's original obfuscated worker
 *
 * Reference test: B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'
 *   → ?worker=legacy:  53 / 7457 / 42664 / 21380 (matches upstream bug-for-bug)
 *   → default TS port: smaller (canonical opposite-pair ordering deduplicates
 *     the cross search; legacy double-counts due to a dead opposite-face check)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Copy, Loader2, Check, Shuffle } from 'lucide-react';
import {
  Analyzer,
  CROSS_COLORS,
  matchesCategory,
  type CrossColor,
  type Howfar,
  type Stage1,
  type Solution,
  type WorkerVariant,
} from './analyze_worker_client';
import { randomScrambleForEvent } from '../../utils/scramble';
import LangToggle from '../../components/LangToggle';
import TwistySection from '../../components/TwistySection';
import './analyze.css';

const DEFAULT_SCRAMBLE = "B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'";

const COLOR_CHAR: Record<CrossColor, string> = {
  Yellow: 'y', White: 'w', Red: 'r', Orange: 'o', Blue: 'b', Green: 'g',
};
const CHAR_COLOR: Record<string, CrossColor> = {
  y: 'Yellow', w: 'White', r: 'Red', o: 'Orange', b: 'Blue', g: 'Green',
};

const EXAMPLE_SCRAMBLES: Array<{ name: string; scramble: string }> = [
  { name: 'WR avg seed', scramble: "B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'" },
  { name: 'easy cross', scramble: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { name: 'OLL skip-friendly', scramble: "U L D R2 B2 D B2 U R2 U' F2 R2 U2 R' B D' U2 L2 B' F" },
  { name: 'long path', scramble: "U2 L2 F' D2 F' U2 L2 B R2 B2 R' D' R2 F' R F2 U' B' L" },
  { name: 'opposite pair', scramble: 'R L' },
];

type FilterMode = 'all' | 'full-step' | 'oll-skip' | 'pll-skip' | 'll-skip';

export default function AnalyzePage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialScramble = searchParams.get('scramble')?.replace(/_/g, ' ').trim() || DEFAULT_SCRAMBLE;
  const workerVariant: WorkerVariant = searchParams.get('worker') === 'legacy' ? 'legacy' : 'ts';

  const [scramble, setScramble] = useState(initialScramble);
  const [howfar, setHowfar] = useState<Howfar>(() => {
    const urlV = Number(searchParams.get('howfar'));
    if (urlV === 1 || urlV === 2 || urlV === 3 || urlV === 4) return urlV;
    const v = Number(localStorage.getItem('analyze.howfar'));
    return v === 1 || v === 2 || v === 3 || v === 4 ? v : 4;
  });
  const [stage1, setStage1] = useState<Stage1>(() => {
    const valid: Stage1[] = ['cross', 'xcross', 'xxcross', 'xxxcross'];
    const urlV = searchParams.get('stage1');
    if (urlV && (valid as string[]).includes(urlV)) return urlV as Stage1;
    const v = localStorage.getItem('analyze.stage1');
    if (v && (valid as string[]).includes(v)) return v as Stage1;
    return 'cross';
  });
  const [pseudo, setPseudo] = useState<boolean>(() => {
    if (searchParams.get('pseudo') === '1') return true;
    if (searchParams.get('pseudo') === '0') return false;
    return localStorage.getItem('analyze.pseudo') === '1';
  });
  const [colors, setColors] = useState<Record<CrossColor, boolean>>(() => {
    const urlColors = searchParams.get('colors');
    if (urlColors !== null) {
      const set = new Set(Array.from(urlColors.toLowerCase()).map((ch) => CHAR_COLOR[ch]).filter(Boolean) as CrossColor[]);
      return Object.fromEntries(CROSS_COLORS.map((c) => [c, set.has(c)])) as Record<CrossColor, boolean>;
    }
    try {
      const saved = JSON.parse(localStorage.getItem('analyze.colors') || 'null');
      if (saved && typeof saved === 'object') {
        const out = Object.fromEntries(CROSS_COLORS.map((c) => [c, true])) as Record<CrossColor, boolean>;
        for (const c of CROSS_COLORS) if (typeof saved[c] === 'boolean') out[c] = saved[c];
        return out;
      }
    } catch { /* corrupt entry — fall through to default */ }
    return Object.fromEntries(CROSS_COLORS.map((c) => [c, true])) as Record<CrossColor, boolean>;
  });
  useEffect(() => { localStorage.setItem('analyze.howfar', String(howfar)); }, [howfar]);
  useEffect(() => { localStorage.setItem('analyze.stage1', stage1); }, [stage1]);
  useEffect(() => { localStorage.setItem('analyze.pseudo', pseudo ? '1' : '0'); }, [pseudo]);
  useEffect(() => { localStorage.setItem('analyze.colors', JSON.stringify(colors)); }, [colors]);
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const trimmed = scramble.trim();
      if (trimmed) next.set('scramble', trimmed.replace(/ /g, '_'));
      else next.delete('scramble');
      if (howfar !== 4) next.set('howfar', String(howfar));
      else next.delete('howfar');
      if (stage1 !== 'cross') next.set('stage1', stage1);
      else next.delete('stage1');
      if (pseudo) next.set('pseudo', '1');
      else next.delete('pseudo');
      const checked = CROSS_COLORS.filter((c) => colors[c]);
      if (checked.length === CROSS_COLORS.length) next.delete('colors');
      else next.set('colors', checked.map((c) => COLOR_CHAR[c]).join(''));
      return next;
    }, { replace: true });
  }, [scramble, howfar, stage1, pseudo, colors, setSearchParams]);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [crossesCovered, setCrossesCovered] = useState(0);
  const [pairsCovered, setPairsCovered] = useState(0);
  const [llCovered, setLlCovered] = useState(0);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [analyzedScramble, setAnalyzedScramble] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [xcrossFallback, setXcrossFallback] = useState<boolean>(false);
  const analyzerRef = useRef<Analyzer>(new Analyzer());
  const startTimeRef = useRef<number>(0);

  useEffect(() => () => analyzerRef.current.terminate(), []);

  const counts = useMemo(() => {
    // Inclusive counts: oll-skip and pll-skip both count solutions that skip the LL.
    let full = 0, ollSkip = 0, pllSkip = 0, llSkip = 0;
    for (const sol of solutions) {
      const stages = sol[3];
      const hasOll = stages.includes('OLL');
      const hasPll = stages.includes('PLL');
      if (hasOll && hasPll) full++;
      if (!hasOll) ollSkip++;
      if (!hasPll) pllSkip++;
      if (!hasOll && !hasPll) llSkip++;
    }
    return { all: solutions.length, full, ollSkip, pllSkip, llSkip };
  }, [solutions]);

  const filtered = useMemo(() => {
    return solutions.filter((s) => matchesCategory(s[3], filter));
  }, [solutions, filter]);

  const displayed = useMemo(() => {
    // Match upstream cap: render up to 1000, plus suppress non-skip rows past 500.
    const out: Array<{ idx: number; sol: Solution }> = [];
    let count = 0;
    for (let i = 0; i < filtered.length; i++) {
      count++;
      const sol = filtered[i];
      const stages = sol[3];
      const isSkip = !stages.includes('OLL') || !stages.includes('PLL');
      if ((count >= 500 && !isSkip) || count > 1000) continue;
      out.push({ idx: i, sol });
    }
    return out;
  }, [filtered]);

  function runAnalyze() {
    if (running) return;
    const trimmed = scramble.trim();
    if (!trimmed) return;
    setRunning(true);
    setErrorMsg(null);
    setSolutions([]);
    setCrossesCovered(0);
    setPairsCovered(0);
    setLlCovered(0);
    setOpenIdx(new Set());
    setAnalyzedScramble(trimmed);
    setFilter('all');
    setElapsedMs(null);
    setXcrossFallback(false);
    startTimeRef.current = performance.now();
    analyzerRef.current.start(
      { scramble: trimmed, crosscolors: colors, howfar, stage1, pseudo },
      {
        onProgress: (p) => {
          if (p.totalnumcross !== undefined) setCrossesCovered(p.totalnumcross);
          if (p.pairscovered !== undefined) setPairsCovered(p.pairscovered);
          if (p.llcovered !== undefined) setLlCovered(p.llcovered);
        },
        onDone: (sols, meta) => {
          setSolutions(sols);
          setElapsedMs(Math.round(performance.now() - startTimeRef.current));
          setRunning(false);
          setXcrossFallback(meta?.xcrossFallback ?? false);
        },
        onError: (err) => {
          console.error('[analyze] worker error', err);
          const msg = err instanceof ErrorEvent ? err.message : err.message;
          setErrorMsg(msg || t('分析失败,请检查打乱格式', 'Analysis failed, check scramble notation'));
          setRunning(false);
        },
      },
      workerVariant,
    );
  }

  function toggleOpen(i: number) {
    const next = new Set(openIdx);
    if (next.has(i)) next.delete(i); else next.add(i);
    setOpenIdx(next);
  }

  function copyAlg(i: number, sol: Solution, e: React.MouseEvent) {
    e.stopPropagation();
    const text = `${analyzedScramble}\n\n\n${sol[1]}\n\n\n${sol[0]}HTM`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1200);
    }).catch(() => {});
  }

  return (
    <div className="analyze-page">
      <header className="analyze-header">
        <div className="analyze-header-row">
          <h1>{t('打乱分析器', 'Scramble Analyzer')}</h1>
          <LangToggle variant="inline" className="analyze-lang-toggle" />
        </div>
        <p className="analyze-sub">
          {t(
            '枚举给定 3x3 打乱所有合理的 CFOP 解法（白十字 / 黄十字 / 任意颜色十字 + F2L + OLL + PLL）。',
            'Enumerate every reasonable CFOP solution for a 3x3 scramble (cross on any color + F2L + OLL + PLL).',
          )}
        </p>
      </header>

      <div className="analyze-input-row">
        <button
          className="analyze-shuffle"
          onClick={() => {
            const s = randomScrambleForEvent('3x3');
            if (s) setScramble(s);
          }}
          disabled={running}
          title={t('生成随机 WCA 打乱', 'Generate random WCA scramble')}
          aria-label={t('生成随机打乱', 'Generate random scramble')}
        >
          <Shuffle size={14} />
        </button>
        <input
          className="analyze-scramble"
          type="text"
          value={scramble}
          onChange={(e) => setScramble(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runAnalyze(); }}
          placeholder={t('输入打乱（标准 WCA 记号）', 'Scramble (WCA notation)')}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          inputMode="text"
        />
        <button
          className="analyze-go"
          onClick={runAnalyze}
          disabled={running || !scramble.trim()}
        >
          {running ? <Loader2 size={16} className="analyze-spin" /> : null}
          {t('分析', 'Analyze')}
        </button>
      </div>

      <div className="analyze-examples">
        <span className="analyze-examples-label">
          <Shuffle size={12} />
          {t('示例', 'Examples')}:
        </span>
        {EXAMPLE_SCRAMBLES.map((ex) => (
          <button
            key={ex.scramble}
            className="analyze-example"
            onClick={() => { setScramble(ex.scramble); }}
            disabled={running}
            title={ex.scramble}
          >
            {ex.name}
          </button>
        ))}
      </div>

      <div className="analyze-filters">
        <select
          value={stage1}
          onChange={(e) => setStage1(e.target.value as Stage1)}
          disabled={running}
          className="analyze-howfar"
          title={t(
            'XCross/XXCross/XXXCross = 联合搜索 cross + N 对 F2L (wasm IDA*+pruning),含最优 + 次优一步候选。',
            'XCross/XXCross/XXXCross = joint shortest cross + N F2L pairs (wasm IDA* + pruning); includes optimal + 1-step variants.',
          )}
        >
          <option value="cross">{pseudo ? 'pCross' : 'Cross'}</option>
          <option value="xcross">{pseudo ? 'pXCross' : 'XCross'}</option>
          <option value="xxcross">{pseudo ? 'pXXCross' : 'XXCross'}</option>
          <option value="xxxcross">{pseudo ? 'pXXXCross' : 'XXXCross'}</option>
        </select>
        <label
          className="analyze-pseudo"
          title={t(
            '伪 cross/F2L:允许底层 2 层相对中心面错位一个 AUF (y/y2/y′),归位旋转计 0 HTM,仅保留真伪解 (Δ≠0)。',
            "Pseudo cross/F2L: bottom 2 layers may be one AUF off from centers (y/y2/y′); fix-up rotation costs 0 HTM, only true pseudo (Δ != 0) is kept.",
          )}
        >
          <input
            type="checkbox"
            checked={pseudo}
            onChange={(e) => setPseudo(e.target.checked)}
            disabled={running}
          />
          <span>{t('伪', 'Pseudo')}</span>
        </label>
        <select
          value={howfar}
          onChange={(e) => setHowfar(Number(e.target.value) as Howfar)}
          disabled={running}
          className="analyze-howfar"
        >
          <option value={4}>{t('完整解法', 'Full Solve')}</option>
          <option value={3}>Cross+3</option>
          <option value={2}>Cross+2</option>
          <option value={1}>Cross+1</option>
        </select>
        {CROSS_COLORS.map((c) => (
          <label key={c} className={`analyze-color analyze-color-${c.toLowerCase()}`}>
            <input
              type="checkbox"
              checked={colors[c]}
              onChange={(e) => setColors((prev) => ({ ...prev, [c]: e.target.checked }))}
              disabled={running}
            />
            <span className="analyze-color-swatch" />
            <span>{COLOR_LABEL[c][lang]}</span>
          </label>
        ))}
      </div>

      {errorMsg && (
        <div className="analyze-error" role="alert">
          {errorMsg}
        </div>
      )}

      {xcrossFallback && stage1 === 'xcross' && (
        <div className="analyze-error" role="status">
          {t(
            'XCross wasm 未返回任何解 — 已降级到 cross 启发式搜索。',
            'XCross wasm returned no valid solutions — fell back to cross heuristic search.',
          )}
        </div>
      )}

      <div className="analyze-stats">
        <div
          className="analyze-stat-row"
          title={t(
            '深度 ≤ max(5, 最优+2);非仅最优,含近优变体。每色上限 100 条,可能撞顶。',
            'Depth ≤ max(5, optimal+2); near-optimal variants included, not just the best. Capped at 100 per color.',
          )}
        >
          <span>{t('十字解法数', 'Crosses covered')}:</span>
          <strong>{crossesCovered}</strong>
        </div>
        <div className="analyze-stat-row">
          <span>{t('F2L 解法数', 'F2L pair solutions covered')}:</span>
          <strong>{pairsCovered}</strong>
        </div>
        <div className="analyze-stat-row">
          <span>{t('顶层解法数', 'Last layer solutions covered')}:</span>
          <strong>{llCovered}</strong>
        </div>
        <div className="analyze-stat-row">
          <span>{t('总解法数', 'Total solutions covered')}:</span>
          <strong>{solutions.length}</strong>
          {elapsedMs !== null && (
            <span className="analyze-elapsed">
              {(elapsedMs / 1000).toFixed(2)}s
              {workerVariant === 'legacy' ? ` · ${t('遗留 worker', 'legacy worker')}` : ''}
            </span>
          )}
        </div>
      </div>

      {solutions.length > 0 && (
        <div className="analyze-results">
          <h2>{t('结果', 'Results')}</h2>
          <div className="analyze-result-filters">
            <FilterChip
              active={filter === 'all'}
              title={t('全部解法', 'All Solves')}
              amount={counts.all}
              onClick={() => setFilter('all')}
            />
            <FilterChip
              active={filter === 'full-step'}
              title={t('完整步骤', 'Full Step')}
              amount={counts.full}
              onClick={() => setFilter('full-step')}
            />
            <FilterChip
              active={filter === 'oll-skip'}
              title={t('跳O', 'OLL Skip')}
              amount={counts.ollSkip}
              onClick={() => setFilter('oll-skip')}
            />
            <FilterChip
              active={filter === 'pll-skip'}
              title={t('跳P', 'PLL Skip')}
              amount={counts.pllSkip}
              onClick={() => setFilter('pll-skip')}
            />
            <FilterChip
              active={filter === 'll-skip'}
              title={t('跳顶层', 'LL Skip')}
              amount={counts.llSkip}
              onClick={() => setFilter('ll-skip')}
            />
          </div>

          <div className="analyze-solutions">
            {displayed.map(({ idx, sol }) => {
              const open = openIdx.has(idx);
              const stages = sol[3];
              const dataOll = stages.includes('OLL');
              const dataPll = stages.includes('PLL');
              return (
                <div
                  key={idx}
                  className="analyze-solution"
                  data-oll={dataOll}
                  data-pll={dataPll}
                >
                  <button
                    className="analyze-solution-title"
                    onClick={() => toggleOpen(idx)}
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{sol[0]}HTM</span>
                    <span className="analyze-title-right">
                      {!dataOll && <span className="analyze-skip-tag">{t('跳O', 'OLL skip')}</span>}
                      {!dataPll && <span className="analyze-skip-tag">{t('跳P', 'PLL skip')}</span>}
                      <span
                        role="button"
                        tabIndex={0}
                        className="analyze-copy-btn"
                        onClick={(e) => copyAlg(idx, sol, e)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') copyAlg(idx, sol, e as unknown as React.MouseEvent); }}
                        aria-label={t('复制', 'Copy')}
                        title={t('复制完整解法', 'Copy full solution')}
                      >
                        {copiedIdx === idx ? <Check size={13} /> : <Copy size={13} />}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="analyze-solution-content">
                      <TwistySection puzzle="3x3x3" scramble={analyzedScramble} alg={sol[1]} />
                      <pre>{`${analyzedScramble}\n\n\n${sol[1]}\n\n\n${sol[0]}HTM`}</pre>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length > displayed.length && (
              <div className="analyze-more-hint">
                {t(
                  `还有 ${filtered.length - displayed.length} 个解法未展示（仅显示前 1000 条 + 全部跳过解）`,
                  `${filtered.length - displayed.length} more solutions hidden (showing first 1000 + all skip cases)`,
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="analyze-footer">
        {t('算法移植自', 'Algorithm ported from')}{' '}
        <a href="https://speedcubedb.com/analyze" target="_blank" rel="noopener noreferrer">
          speedcubedb.com/analyze
        </a>
      </footer>
    </div>
  );
}

const COLOR_LABEL: Record<CrossColor, { zh: string; en: string }> = {
  White: { zh: '白', en: 'White' },
  Yellow: { zh: '黄', en: 'Yellow' },
  Red: { zh: '红', en: 'Red' },
  Orange: { zh: '橙', en: 'Orange' },
  Blue: { zh: '蓝', en: 'Blue' },
  Green: { zh: '绿', en: 'Green' },
};

function FilterChip(props: { active: boolean; title: string; amount: number; onClick: () => void }) {
  return (
    <button
      className={`analyze-filter-chip${props.active ? ' is-active' : ''}`}
      onClick={props.onClick}
    >
      <span className="analyze-filter-title">{props.title}</span>
      <span className="analyze-filter-amount">{props.amount}</span>
    </button>
  );
}
