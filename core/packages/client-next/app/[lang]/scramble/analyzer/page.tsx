'use client';

/**
 * /scramble/analyzer — 3x3 scramble CFOP analyzer.
 *
 * Ported from packages/client/src/pages/analyze/AnalyzePage.tsx.
 * The classic-worker assets (analyzer.js + boohoo/hs/zbh/xcross/eocross/pair/
 * pseudo-cross/pseudo-pair) are copied verbatim under
 * client-next/public/analyze-worker/ and loaded via `new Worker('/analyze-worker/analyzer.js')`.
 * Random 3x3 scramble uses cubing.js to avoid pulling in the timer scramble
 * tree (owned by another subagent).
 */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Copy, Loader2, Check, Shuffle, Dices } from 'lucide-react';
import { solveCross } from '@/lib/cross-solver';
import {
  Analyzer,
  CROSS_COLORS,
  matchesCategory,
  type CrossColor,
  type Howfar,
  type Stage,
  type Variant,
  type Solution,
  type WorkerVariant,
} from './analyze_worker_client';
import TwistySection from '@/components/TwistySection';
import RustCrossSection from './RustCrossSection';
import { Flag } from '@/components/Flag';
import { loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { WheelPicker } from '@/components/WheelPicker';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './analyze.css';

const DEFAULT_SCRAMBLE = "B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'";

const COLOR_CHAR: Record<CrossColor, string> = {
  Yellow: 'y', White: 'w', Red: 'r', Orange: 'o', Blue: 'b', Green: 'g',
};
const CHAR_COLOR: Record<string, CrossColor> = {
  y: 'Yellow', w: 'White', r: 'Red', o: 'Orange', b: 'Blue', g: 'Green',
};

type FilterMode = 'all' | 'full-step' | 'oll-skip' | 'pll-skip' | 'll-skip';

const COLOR_LABEL: Record<CrossColor, { zh: string; en: string }> = {
  White: { zh: '白', en: 'White' },
  Yellow: { zh: '黄', en: 'Yellow' },
  Red: { zh: '红', en: 'Red' },
  Orange: { zh: '橙', en: 'Orange' },
  Blue: { zh: '蓝', en: 'Blue' },
  Green: { zh: '绿', en: 'Green' },
};

// WCA real-scramble pools: /stats/scramble/wca_cross/<letter>.json, bucketed by cross length.
const COLOR_LETTER: Record<CrossColor, string> = {
  White: 'W', Yellow: 'Y', Red: 'R', Orange: 'O', Blue: 'B', Green: 'G',
};
const ROUND_LABEL: Record<string, { zh: string; en: string }> = {
  '0': { zh: '资格赛', en: 'Qualification' }, h: { zh: '资格赛', en: 'Qualification' },
  '1': { zh: '第一轮', en: 'Round 1' }, d: { zh: '第一轮', en: 'Round 1' },
  '2': { zh: '第二轮', en: 'Round 2' }, e: { zh: '第二轮', en: 'Round 2' },
  '3': { zh: '复赛', en: 'Semi-Final' }, g: { zh: '第三轮', en: 'Round 3' },
  c: { zh: '决赛', en: 'Final' }, f: { zh: '决赛', en: 'Final' }, b: { zh: 'B 决赛', en: 'B-Final' },
};
interface WcaEntry { s: string; c: string; d: string; r: string; g: string; n: number; e: string }
interface WcaFile { color: string; bins: Record<string, WcaEntry[]> }

// cubing.js's search worker normally bootstraps via `import.meta.resolve(...)`
// which Turbopack can't follow. The esbuild-workaround path uses a plain
// dynamic import that Turbopack DOES statically follow. Apply once before
// the first scramble call.
let cubingWorkerHintApplied = false;
async function applyCubingWorkerHint(): Promise<void> {
  if (cubingWorkerHintApplied) return;
  cubingWorkerHintApplied = true;
  try {
    const { setSearchDebug } = await import('cubing/search');
    setSearchDebug({
      prioritizeEsbuildWorkaroundForWorkerInstantiation: true,
      showWorkerInstantiationWarnings: false,
    });
  } catch (err) {
    console.warn('[analyzer] setSearchDebug not available', err);
  }
}

async function randomThreeByThreeScramble(): Promise<string> {
  await applyCubingWorkerHint();
  const { randomScrambleForEvent } = await import('cubing/scramble');
  const alg = await randomScrambleForEvent('333');
  return alg.toString();
}

// wca_cross 条目只有比赛名,没有 ID。WCA 比赛 ID = 比赛名 NFKD 去重音 + 删非字母数字
// (世锦赛特例 WCYYYY)。据此反查 comp_countries 拿国旗,~92% 命中,未命中不显示。
function compFlagFromName(name: string): string {
  const id = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');
  let iso = compFlagIso2(id);
  if (!iso) {
    const m = name.match(/World Championship\s+(\d{4})/i);
    if (m) iso = compFlagIso2(`WC${m[1]}`);
  }
  return iso;
}

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

function AnalyzePageInner() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  useDocumentTitle('打乱分析', 'Scramble Analyzer');
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const searchParams = useSearchParams();
  const router = useRouter();
  const initialScramble = searchParams.get('scramble')?.replace(/_/g, ' ').trim() || DEFAULT_SCRAMBLE;
  const workerVariant: WorkerVariant = searchParams.get('worker') === 'legacy' ? 'legacy' : 'ts';

  const [scramble, setScramble] = useState(initialScramble);
  const [howfar, setHowfar] = useState<Howfar>(() => {
    const urlV = Number(searchParams.get('howfar'));
    if (urlV === 1 || urlV === 2 || urlV === 3 || urlV === 4) return urlV;
    if (typeof localStorage === 'undefined') return 4;
    const v = Number(localStorage.getItem('analyze.howfar'));
    return v === 1 || v === 2 || v === 3 || v === 4 ? v : 4;
  });
  const [stage, setStage] = useState<Stage>(() => {
    const valid: Stage[] = ['cross', 'xcross', 'xxcross', 'xxxcross'];
    const urlV = searchParams.get('stage');
    if (urlV && (valid as string[]).includes(urlV)) return urlV as Stage;
    if (typeof localStorage === 'undefined') return 'cross';
    const v = localStorage.getItem('analyze.stage');
    if (v && (valid as string[]).includes(v)) return v as Stage;
    return 'cross';
  });
  const [variant, setVariant] = useState<Variant>(() => {
    const valid: Variant[] = ['std', 'eo', 'pair', 'pseudo', 'pseudo_pair'];
    const urlV = searchParams.get('variant');
    if (urlV && (valid as string[]).includes(urlV)) return urlV as Variant;
    if (typeof localStorage === 'undefined') return 'std';
    const v = localStorage.getItem('analyze.variant');
    if (v && (valid as string[]).includes(v)) return v as Variant;
    return 'std';
  });
  const [colors, setColors] = useState<Record<CrossColor, boolean>>(() => {
    const urlColors = searchParams.get('colors');
    if (urlColors !== null) {
      const set = new Set(Array.from(urlColors.toLowerCase()).map((ch) => CHAR_COLOR[ch]).filter(Boolean) as CrossColor[]);
      return Object.fromEntries(CROSS_COLORS.map((c) => [c, set.has(c)])) as Record<CrossColor, boolean>;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('analyze.colors') || 'null');
        if (saved && typeof saved === 'object') {
          const out = Object.fromEntries(CROSS_COLORS.map((c) => [c, true])) as Record<CrossColor, boolean>;
          for (const c of CROSS_COLORS) if (typeof saved[c] === 'boolean') out[c] = saved[c];
          return out;
        }
      } catch { /* corrupt entry */ }
    }
    return Object.fromEntries(CROSS_COLORS.map((c) => [c, true])) as Record<CrossColor, boolean>;
  });

  useEffect(() => { try { localStorage.setItem('analyze.howfar', String(howfar)); } catch { /* */ } }, [howfar]);
  useEffect(() => { try { localStorage.setItem('analyze.stage', stage); } catch { /* */ } }, [stage]);
  useEffect(() => { try { localStorage.setItem('analyze.variant', variant); } catch { /* */ } }, [variant]);
  useEffect(() => { try { localStorage.setItem('analyze.colors', JSON.stringify(colors)); } catch { /* */ } }, [colors]);

  // Sync URL params (replace, not push).
  useEffect(() => {
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    const trimmed = scramble.trim();
    if (trimmed) next.set('scramble', trimmed.replace(/ /g, '_'));
    else next.delete('scramble');
    if (howfar !== 4) next.set('howfar', String(howfar)); else next.delete('howfar');
    if (stage !== 'cross') next.set('stage', stage); else next.delete('stage');
    if (variant !== 'std') next.set('variant', variant); else next.delete('variant');
    const checked = CROSS_COLORS.filter((c) => colors[c]);
    if (checked.length === CROSS_COLORS.length) next.delete('colors');
    else next.set('colors', checked.map((c) => COLOR_CHAR[c]).join(''));
    const q = next.toString();
    router.replace(q ? `?${q}` : '?', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, howfar, stage, variant, colors]);

  // WCA real-scramble pool + cross-step filter
  const [wcaColor, setWcaColor] = useState<CrossColor>('White');
  const [wcaBins, setWcaBins] = useState<number[] | null>(null);
  const [wcaStep, setWcaStep] = useState<number | null>(null);
  const [wcaMeta, setWcaMeta] = useState<WcaEntry | null>(null);
  const [wcaLoading, setWcaLoading] = useState(false);
  const [crossSol, setCrossSol] = useState<{ length: number; moves: string[] } | null>(null);
  const [wheelIdx, setWheelIdx] = useState(0); // 滚筒锚点 = wcaBins 的索引(兼容跳号)
  const [, setFlagDataVer] = useState(0); // 国旗映射异步加载完后触发重渲染
  const wcaCacheRef = useRef<Map<string, WcaFile>>(new Map());

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
  const [variantUnsupported, setVariantUnsupported] = useState<boolean>(false);
  const analyzerRef = useRef<Analyzer>(new Analyzer());
  const startTimeRef = useRef<number>(0);

  useEffect(() => () => analyzerRef.current.terminate(), []);

  const counts = useMemo(() => {
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

  const filtered = useMemo(() => solutions.filter((s) => matchesCategory(s[3], filter)), [solutions, filter]);

  const displayed = useMemo(() => {
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
    setVariantUnsupported(false);
    startTimeRef.current = performance.now();
    analyzerRef.current.start(
      { scramble: trimmed, crosscolors: colors, howfar, variant, stage },
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
          setVariantUnsupported(meta?.variantUnsupported ?? false);
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
    }).catch(() => { /* clipboard blocked */ });
  }

  async function fillRandom() {
    try {
      const s = await randomThreeByThreeScramble();
      if (s) setScramble(s);
    } catch (err) {
      console.warn('random scramble failed', err);
    }
  }

  const loadWcaColor = useCallback(async (color: CrossColor): Promise<WcaFile | null> => {
    const letter = COLOR_LETTER[color];
    const cached = wcaCacheRef.current.get(letter);
    if (cached) return cached;
    setWcaLoading(true);
    try {
      const r = await fetch(`/stats/scramble/wca_cross/${letter}.json`);
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as WcaFile;
      wcaCacheRef.current.set(letter, data);
      return data;
    } catch (err) {
      console.warn('[wca-cross] load failed', err);
      return null;
    } finally {
      setWcaLoading(false);
    }
  }, []);

  const selectWcaColor = useCallback(async (color: CrossColor) => {
    setWcaColor(color);
    setWcaStep(null);
    setWcaMeta(null);
    const data = await loadWcaColor(color);
    setWcaBins(data ? Object.keys(data.bins).map(Number).sort((a, b) => a - b) : null);
  }, [loadWcaColor]);

  const pickWca = useCallback((color: CrossColor, step: number) => {
    const data = wcaCacheRef.current.get(COLOR_LETTER[color]);
    const arr = data?.bins[String(step)];
    if (!arr || !arr.length) return;
    const entry = arr[Math.floor(Math.random() * arr.length)];
    setScramble(entry.s);
    setWcaStep(step);
    setWcaMeta(entry);
  }, []);

  // Lazily load the default color's pool after first paint (208KB, only on idle).
  useEffect(() => {
    const t = setTimeout(() => { void selectWcaColor('White'); }, 300);
    return () => clearTimeout(t);
  }, [selectWcaColor]);

  // Optimal cross solution for the loaded scramble (first call builds tables ~0.5s, then instant).
  useEffect(() => {
    if (!wcaMeta) { setCrossSol(null); return; }
    const t = setTimeout(() => setCrossSol(solveCross(wcaMeta.s, wcaColor)), 0);
    return () => clearTimeout(t);
  }, [wcaMeta, wcaColor]);

  // 国旗映射(comp_countries 等)首屏后异步拉,完成后重渲染让旗出现。
  useEffect(() => { void loadFlagData().then(setFlagDataVer); }, []);

  // bins 加载 / 换色后把滚筒居中到中间档(不自动取打乱,等用户滚定再取)。
  useEffect(() => {
    if (wcaBins && wcaBins.length) setWheelIdx(Math.floor(wcaBins.length / 2));
  }, [wcaBins]);

  const wheelRenderSlot = useCallback(
    (i: number) => (wcaBins && wcaBins[i] != null ? String(wcaBins[i]) : ''),
    [wcaBins],
  );
  const wheelSettle = useCallback((i: number) => {
    if (wcaBins && wcaBins[i] != null) pickWca(wcaColor, wcaBins[i]);
  }, [wcaBins, wcaColor, pickWca]);

  const wcaFlagIso = wcaMeta ? compFlagFromName(wcaMeta.c) : '';

  return (
    <div className="analyze-page">
      <header className="analyze-header">
        <div className="analyze-header-row">
          <h1>{t('打乱分析器', 'Scramble Analyzer')}</h1>
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
          onClick={fillRandom}
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

      <div className="analyze-wca">
        <span className="analyze-wca-label">
          <Dices size={13} />
          {t('WCA 真实打乱', 'Real WCA scramble')}
        </span>
        <select
          className="analyze-wca-color"
          value={wcaColor}
          onChange={(e) => { void selectWcaColor(e.target.value as CrossColor); }}
          disabled={running}
          aria-label={t('十字颜色', 'Cross color')}
        >
          {CROSS_COLORS.map((c) => (
            <option key={c} value={c}>
              {t(`${COLOR_LABEL[c].zh}十字`, `${COLOR_LABEL[c].en} cross`)}
            </option>
          ))}
        </select>
        <div className="analyze-wca-steps">
          {wcaBins && wcaBins.length ? (
            <WheelPicker
              className="analyze-wca-wheel"
              value={wheelIdx}
              minValue={0}
              maxValue={wcaBins.length - 1}
              renderSlot={wheelRenderSlot}
              onChange={setWheelIdx}
              onSettle={wheelSettle}
              width={50}
              slots={7}
              itemHeight={28}
              disabled={running}
              ariaLabel={t('十字步数', 'Cross length')}
            />
          ) : (
            <Loader2 size={14} className="analyze-spin" aria-label={t('加载中', 'Loading')} />
          )}
        </div>
        {wcaMeta && wcaStep != null && (
          <button
            className="analyze-wca-reshuffle"
            onClick={() => pickWca(wcaColor, wcaStep)}
            disabled={running || wcaLoading}
            title={t('同条件换一个', 'Another with same filter')}
          >
            <Shuffle size={13} />
            {t('换一个', 'Shuffle')}
          </button>
        )}
      </div>

      {wcaMeta && (
        <div className="analyze-wca-meta">
          {wcaFlagIso && <Flag iso2={wcaFlagIso} className="analyze-wca-flag" />}
          <span className="analyze-wca-comp">{wcaMeta.c}</span>
          {wcaMeta.d && <span className="analyze-wca-date">{wcaMeta.d}</span>}
          <span className="analyze-wca-round">
            {ROUND_LABEL[wcaMeta.r]?.[lang] ?? wcaMeta.r}
            {wcaMeta.g ? (lang === 'zh' ? ` ${wcaMeta.g} 组` : ` Group ${wcaMeta.g}`) : ''}
            {` #${wcaMeta.n}`}
          </span>
          {wcaMeta.e !== '333' && <span className="analyze-wca-event">{wcaMeta.e}</span>}
          {crossSol && (
            <span className="analyze-wca-cross">
              {t(`${COLOR_LABEL[wcaColor].zh}十字`, `${COLOR_LABEL[wcaColor].en} cross`)}
              {' '}({crossSol.length}): {crossSol.moves.join(' ') || '—'}
            </span>
          )}
        </div>
      )}

      <div className="analyze-filters">
        <label className="analyze-control">
          <span>{t('变体', 'Variant')}</span>
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as Variant)}
            disabled={running}
          >
            <option value="std">{t('标准', 'Standard')}</option>
            <option value="eo">EOCross</option>
            <option value="pair">{t('十字+基态', 'Cross + Pair')}</option>
            <option value="pseudo">{t('伪十字', 'Pseudo')}</option>
            <option value="pseudo_pair">{t('伪十字+基态', 'Pseudo + Pair')}</option>
          </select>
        </label>
        <label className="analyze-control">
          <span>{t('阶段', 'Stage')}</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
            disabled={running}
          >
            <option value="cross">Cross</option>
            <option value="xcross">XCross</option>
            <option value="xxcross">XXCross</option>
            <option value="xxxcross">XXXCross</option>
          </select>
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

      {xcrossFallback && variant === 'std' && stage === 'xcross' && (
        <div className="analyze-error" role="status">
          {t(
            'XCross wasm 未返回任何解 — 已降级到 cross 启发式搜索。',
            'XCross wasm returned no valid solutions — fell back to cross heuristic search.',
          )}
        </div>
      )}

      {variantUnsupported && (
        <div className="analyze-error" role="status">
          {t(
            '当前 变体 × 阶段 组合尚未实现 — 目前可用:Standard 全部 4 档,Pseudo + Cross (pCross)。',
            'This Variant × Stage combination is not yet wired. Available: Standard (all 4 stages), Pseudo + Cross (pCross).',
          )}
        </div>
      )}

      {xcrossFallback && variant === 'pseudo' && stage === 'cross' && (
        <div className="analyze-error" role="status">
          {t(
            'pCross wasm 在搜索深度内未找到 Δ≠0 的伪解 — 已退回普通 cross 启发式。',
            'pCross wasm found no Δ≠0 pseudo solutions within depth bound — fell back to regular cross heuristic.',
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
            <FilterChip active={filter === 'all'} title={t('全部解法', 'All Solves')} amount={counts.all} onClick={() => setFilter('all')} />
            <FilterChip active={filter === 'full-step'} title={t('完整步骤', 'Full Step')} amount={counts.full} onClick={() => setFilter('full-step')} />
            <FilterChip active={filter === 'oll-skip'} title={t('跳O', 'OLL Skip')} amount={counts.ollSkip} onClick={() => setFilter('oll-skip')} />
            <FilterChip active={filter === 'pll-skip'} title={t('跳P', 'PLL Skip')} amount={counts.pllSkip} onClick={() => setFilter('pll-skip')} />
            <FilterChip active={filter === 'll-skip'} title={t('跳顶层', 'LL Skip')} amount={counts.llSkip} onClick={() => setFilter('ll-skip')} />
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

      <RustCrossSection scramble={scramble} lang={lang} />

      <footer className="analyze-footer">
        {t('算法移植自', 'Algorithm ported from')}{' '}
        <a href="https://speedcubedb.com/analyze" target="_blank" rel="noopener noreferrer">
          speedcubedb.com/analyze
        </a>
      </footer>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AnalyzePageInner />
    </Suspense>
  );
}
