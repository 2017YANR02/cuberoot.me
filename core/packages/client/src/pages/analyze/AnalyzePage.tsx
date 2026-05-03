/**
 * @module pages/analyze/AnalyzePage
 *
 * /analyze — 3x3 scramble CFOP analyzer.
 * Ports speedcubedb.com/analyze; the heavy enumeration (cross / F2L / OLL / PLL)
 * runs in the bundled Web Worker at /analyze-worker/ear.js. This page is just
 * the form, progress display, and result list.
 *
 * Test scramble: B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'
 *   → 53 crosses · 7457 F2L · 42664 LL · 21380 total (21022 / 96 / 262 / 0).
 *   Numbers must match speedcubedb exactly because we run their worker verbatim.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import {
  Analyzer,
  CROSS_COLORS,
  matchesCategory,
  type CrossColor,
  type Howfar,
  type Solution,
} from './analyze_worker_client';
import './analyze.css';

const DEFAULT_SCRAMBLE = "B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'";

type FilterMode = 'all' | 'full-step' | 'oll-skip' | 'pll-skip' | 'll-skip';

export default function AnalyzePage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [scramble, setScramble] = useState(DEFAULT_SCRAMBLE);
  const [howfar, setHowfar] = useState<Howfar>(4);
  const [colors, setColors] = useState<Record<CrossColor, boolean>>(() =>
    Object.fromEntries(CROSS_COLORS.map((c) => [c, true])) as Record<CrossColor, boolean>,
  );
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [crossesCovered, setCrossesCovered] = useState(0);
  const [pairsCovered, setPairsCovered] = useState(0);
  const [llCovered, setLlCovered] = useState(0);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [analyzedScramble, setAnalyzedScramble] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set());
  const analyzerRef = useRef<Analyzer>(new Analyzer());

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
    analyzerRef.current.start(
      { scramble: trimmed, crosscolors: colors, howfar },
      {
        onProgress: (p) => {
          if (p.totalnumcross !== undefined) setCrossesCovered(p.totalnumcross);
          if (p.pairscovered !== undefined) setPairsCovered(p.pairscovered);
          if (p.llcovered !== undefined) setLlCovered(p.llcovered);
        },
        onDone: (sols) => {
          setSolutions(sols);
          setRunning(false);
        },
        onError: (err) => {
          console.error('[analyze] worker error', err);
          const msg = err instanceof ErrorEvent ? err.message : err.message;
          setErrorMsg(msg || t('分析失败,请检查打乱格式', 'Analysis failed, check scramble notation'));
          setRunning(false);
        },
      },
    );
  }

  function toggleOpen(i: number) {
    const next = new Set(openIdx);
    if (next.has(i)) next.delete(i); else next.add(i);
    setOpenIdx(next);
  }

  return (
    <div className="analyze-page">
      <header className="analyze-header">
        <h1>{t('打乱分析器', 'Scramble Analyzer')}</h1>
        <p className="analyze-sub">
          {t(
            '枚举给定 3x3 打乱所有合理的 CFOP 解法（白十字 / 黄十字 / 任意颜色十字 + F2L + OLL + PLL）。',
            'Enumerate every reasonable CFOP solution for a 3x3 scramble (cross on any color + F2L + OLL + PLL).',
          )}
        </p>
      </header>

      <div className="analyze-input-row">
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

      <div className="analyze-filters">
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

      <div className="analyze-stats">
        <div className="analyze-stat-row">
          <span>{t('十字解法数', 'Crosses covered')}:</span>
          <strong>{crossesCovered}</strong>
        </div>
        <div className="analyze-stat-row">
          <span>{t('F2L 解法数', 'F2L pair solutions covered')}:</span>
          <strong>{pairsCovered}</strong>
        </div>
        <div className="analyze-stat-row">
          <span>{t('末层解法数', 'Last layer solutions covered')}:</span>
          <strong>{llCovered}</strong>
        </div>
        <div className="analyze-stat-row">
          <span>{t('总解法数', 'Total solutions covered')}:</span>
          <strong>{solutions.length}</strong>
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
              title={t('OLL 跳过', 'OLL Skip')}
              amount={counts.ollSkip}
              onClick={() => setFilter('oll-skip')}
            />
            <FilterChip
              active={filter === 'pll-skip'}
              title={t('PLL 跳过', 'PLL Skip')}
              amount={counts.pllSkip}
              onClick={() => setFilter('pll-skip')}
            />
            <FilterChip
              active={filter === 'll-skip'}
              title={t('末层跳过', 'LL Skip')}
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
                    {!dataOll && <span className="analyze-skip-tag">{t('OLL 跳', 'OLL skip')}</span>}
                    {!dataPll && <span className="analyze-skip-tag">{t('PLL 跳', 'PLL skip')}</span>}
                  </button>
                  {open && (
                    <div className="analyze-solution-content">
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
