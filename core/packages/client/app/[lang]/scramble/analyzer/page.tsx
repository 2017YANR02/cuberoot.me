'use client';

/**
 * /scramble/analyzer — 3x3 scramble CFOP analyzer.
 *
 * Ported from packages/client-vite/src/pages/analyze/AnalyzePage.tsx.
 * The classic-worker assets (analyzer.js + boohoo/hs/zbh/xcross/eocross/pair/
 * pseudo-cross/pseudo-pair) are copied verbatim under
 * client/public/analyze-worker/ and loaded via `new Worker('/analyze-worker/analyzer.js')`.
 * Random 3x3 scramble uses cubing.js to avoid pulling in the timer scramble
 * tree (owned by another subagent).
 */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useQueryState, useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from 'nuqs';
import dynamic from 'next/dynamic';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Copy, Loader2, Check, Shuffle } from 'lucide-react';
import { solveCross, normalizeScramble } from '@/lib/cross-solver';
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
import StageSolver, { METHOD_KEYS, type Method as SsMethod } from '@/components/StageSolver';
import ChainExplorer from '@/components/ChainExplorer';
import PillToggle from '@/components/PillToggle/PillToggle';
import { Flag } from '@/components/Flag';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';
import { loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { statsUrl } from '@/lib/stats-base';
import { variantLabel, stageLabel } from '@/lib/scramble-variants';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import SolveTabs from '../_components/SolveTabs';
import LazyVisible from '../_components/LazyVisible';
import './analyze.css';

// 分布区(下半区)懒载:求解/分布合页后,analyzer(3×3 阶段/CFOP/DR)下方接同一份分布。
// embedded 模式 → 分布的 URL 键加 d 前缀,避开 analyzer 自己的 scramble/variant/stage/colors/tool。
// ssr:false + LazyVisible 滚入才挂,首屏不拉 chunk、不跑分布现场求解。
const ScrambleStatsPage = dynamic(() => import('../stats/page'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading…</div>,
});

const DEFAULT_SCRAMBLE = "B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'";

const COLOR_CHAR: Record<CrossColor, string> = {
  Yellow: 'y', White: 'w', Red: 'r', Orange: 'o', Blue: 'b', Green: 'g',
};
const CHAR_COLOR: Record<string, CrossColor> = {
  y: 'Yellow', w: 'White', r: 'Red', o: 'Orange', b: 'Blue', g: 'Green',
};

type FilterMode = 'all' | 'full-step' | 'oll-skip' | 'pll-skip' | 'll-skip';

// 顶部三选一:逐阶段最优解 / CFOP 解法枚举 / FMC 分步还原链。选中谁,下方只渲染谁。
type Tool = 'stage' | 'cfop' | 'fmc';
const TOOL_VALUES: Tool[] = ['stage', 'cfop', 'fmc'];

const COLOR_LABEL: Record<CrossColor, { zh: string; en: string
 }> = {
  White: { zh: '白', en: 'White' },
  Yellow: { zh: '黄', en: 'Yellow'
},
  Red: { zh: '红', en: 'Red'
},
  Orange: { zh: '橙', en: 'Orange' },
  Blue: { zh: '蓝', en: 'Blue'
},
  Green: { zh: '绿', en: 'Green'
},
};

// WCA real-scramble pools: /stats/scramble/wca_cross/<letter>.json, bucketed by cross length.
const COLOR_LETTER: Record<CrossColor, string> = {
  White: 'W', Yellow: 'Y', Red: 'R', Orange: 'O', Blue: 'B', Green: 'G',
};
interface WcaEntry { s: string; c: string; d: string; r: string; g: string; n: number; e: string; id?: string }
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
// (世锦赛特例 WCYYYY)。据此反查 comp_countries 拿国旗 + 拼 /scramble/gen?comp= 链接,~92% 命中。
function compStripId(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');
}
function resolveComp(name: string): { id: string; iso: string } {
  const strip = compStripId(name);
  const iso = compFlagIso2(strip);
  if (iso) return { id: strip, iso };
  const m = name.match(/World Championship\s+(\d{4})/i);
  if (m) { const wc = `WC${m[1]}`; const wcIso = compFlagIso2(wc); if (wcIso) return { id: wc, iso: wcIso }; }
  return { id: strip, iso: '' };
}

// URL state (nuqs, replace semantics — filters/scramble shouldn't pile history).
// `scramble` keeps the original `_`-for-space encoding; `colors` keeps the compact
// per-color char string. Parsers carry no `.withDefault` so an absent param reads
// back as null — the useState initializers below preserve the original
// URL > localStorage > hardcoded-default priority. `worker` is read-only.
const STAGE_VALUES: Stage[] = ['cross', 'xcross', 'xxcross', 'xxxcross'];
const VARIANT_VALUES: Variant[] = ['std', 'eo', 'pair', 'pseudo', 'pseudo_pair'];
const URL_KEYS = {
  scramble: parseAsString,
  howfar: parseAsInteger,
  stage: parseAsStringEnum<Stage>(STAGE_VALUES),
  variant: parseAsStringEnum<Variant>(VARIANT_VALUES),
  colors: parseAsString,
  src: parseAsStringEnum<'wca' | 'random'>(['wca', 'random']),
  worker: parseAsStringEnum(['ts', 'legacy']),
  // 逐阶段最优解(StageSolver,tool=stage)的深链:method = 方法(含 block 等,独立于 CFOP 的
  // variant 枚举),mstage = VARIANT_STAGES[method] 里的阶段索引。两者与 CFOP 的 variant/stage 互不相干。
  method: parseAsStringEnum<SsMethod>(METHOD_KEYS),
  mstage: parseAsInteger,
  // face = StageSolver 6 视角(D/U/L/R/F/B)索引,锁定底色对应的那一面;只在挂载时读一次(jump-to 提示),
  // 读完即从地址栏清掉(之后实际选中视角由 StageSolver 内部驱动,不再持久化)。
  face: parseAsInteger,
  // slot = StageSolver 指定的 F2L 槽位组合(逗号分隔索引,如 "2" / "0,1");持久化可分享,空=自动。
  slot: parseAsString,
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

function AnalyzePageInner() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  useDocumentTitle('求解', 'Solve');
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [urlState, setUrlState] = useQueryStates(URL_KEYS, { history: 'replace', scroll: false });
  // Snapshot the URL params at mount for the useState initializers below — they
  // run once and must reflect the deep-linked URL, not later edits.
  const initUrlRef = useRef(urlState);
  const workerVariant: WorkerVariant = urlState.worker === 'legacy' ? 'legacy' : 'ts';

  // 消费 face 深链后立即从地址栏清掉(initialFace 已在首渲染快照 initUrlRef 里捕获,清 URL 不影响它)。
  useEffect(() => {
    if (initUrlRef.current.face != null) void setUrlState({ face: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [scramble, setScramble] = useState(
    () => initUrlRef.current.scramble?.replace(/_/g, ' ').trim() || DEFAULT_SCRAMBLE,
  );
  // 打乱输入框自动撑高,长打乱在窄屏(手机/iOS,无 CSS field-sizing)能完整换行显示
  const scrambleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = scrambleRef.current;
    if (!el) return;
    const grow = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
    grow();
    window.addEventListener('resize', grow);
    return () => window.removeEventListener('resize', grow);
  }, [scramble]);
  const [howfar, setHowfar] = useState<Howfar>(() => {
    const urlV = initUrlRef.current.howfar;
    if (urlV === 1 || urlV === 2 || urlV === 3 || urlV === 4) return urlV;
    if (typeof localStorage === 'undefined') return 4;
    const v = Number(localStorage.getItem('analyze.howfar'));
    return v === 1 || v === 2 || v === 3 || v === 4 ? v : 4;
  });
  const [stage, setStage] = useState<Stage>(() => {
    const urlV = initUrlRef.current.stage;
    if (urlV) return urlV;
    if (typeof localStorage === 'undefined') return 'cross';
    const v = localStorage.getItem('analyze.stage');
    if (v && (STAGE_VALUES as string[]).includes(v)) return v as Stage;
    return 'cross';
  });
  const [variant, setVariant] = useState<Variant>(() => {
    const urlV = initUrlRef.current.variant;
    if (urlV) return urlV;
    if (typeof localStorage === 'undefined') return 'std';
    const v = localStorage.getItem('analyze.variant');
    if (v && (VARIANT_VALUES as string[]).includes(v)) return v as Variant;
    return 'std';
  });
  const [colors, setColors] = useState<Record<CrossColor, boolean>>(() => {
    const urlColors = initUrlRef.current.colors;
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

  // Sync URL params (replace, not push). nuqs omits keys set to null.
  useEffect(() => {
    const trimmed = scramble.trim();
    const checked = CROSS_COLORS.filter((c) => colors[c]);
    void setUrlState({
      scramble: trimmed ? trimmed.replace(/ /g, '_') : null,
      howfar: howfar !== 4 ? howfar : null,
      stage: stage !== 'cross' ? stage : null,
      variant: variant !== 'std' ? variant : null,
      colors: checked.length === CROSS_COLORS.length ? null : checked.map((c) => COLOR_CHAR[c]).join(''),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, howfar, stage, variant, colors]);

  // 打乱来源:WCA 真实打乱(带比赛信息)/ 随机生成(cubing.js,无比赛信息)。
  const [scrSource, setScrSource] = useState<'wca' | 'random'>(() => initUrlRef.current.src ?? 'wca');
  useEffect(() => {
    void setUrlState({ src: scrSource === 'wca' ? null : scrSource });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrSource]);

  // WCA real-scramble pool。颜色 + 步数都是「可选过滤器」,默认「任意」=随机抽一条真实打乱。
  // 颜色文件互不相交(每色 ~1500 条独立样本),任意颜色 = 随机挑一个颜色文件再抽。
  const [wcaColor, setWcaColor] = useState<CrossColor | 'any'>('any');
  const [wcaLen, setWcaLen] = useState<number | 'any'>('any');
  const [wcaBins, setWcaBins] = useState<number[] | null>(null); // 选定具体颜色后该色的步数桶
  const [wcaMeta, setWcaMeta] = useState<WcaEntry | null>(null);
  const [wcaLoading, setWcaLoading] = useState(false);
  const [crossSol, setCrossSol] = useState<{ length: number; moves: string[] } | null>(null);
  const [crossColor, setCrossColor] = useState<CrossColor>('White'); // 十字解读数用的颜色 = 实际抽到的颜色
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
  // 顶部工具切换(大 mode → push history,后退可返回)。默认逐阶段最优解。
  const [tool, setTool] = useQueryState(
    'tool',
    parseAsStringEnum<Tool>(TOOL_VALUES).withDefault('stage').withOptions({ history: 'push' }),
  );
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
    // Re-orient wide moves / rotations (e.g. 3BLD's Rw2 suffix) back to white-top/
    // green-front so the HTM-only analyzer reads the right cube; pure HTM is unchanged.
    const analyzed = normalizeScramble(trimmed) ?? trimmed;
    setRunning(true);
    setErrorMsg(null);
    setSolutions([]);
    setCrossesCovered(0);
    setPairsCovered(0);
    setLlCovered(0);
    setOpenIdx(new Set());
    setAnalyzedScramble(analyzed);
    setFilter('all');
    setElapsedMs(null);
    setXcrossFallback(false);
    setVariantUnsupported(false);
    startTimeRef.current = performance.now();
    analyzerRef.current.start(
      { scramble: analyzed, crosscolors: colors, howfar, variant, stage },
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
          setErrorMsg(msg || t('求解失败,请检查打乱格式', 'Solve failed, check scramble notation'));
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
      if (s) { setScramble(s); setWcaMeta(null); } // 随机打乱无比赛信息,清掉残留 meta
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
      const r = await fetch(statsUrl(`/stats/scramble/wca_cross/${letter}.json`));
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

  // 选具体颜色:加载该色文件取步数桶供「步数」下拉;切回任意则清空(任意不按步数过滤)。
  const selectWcaColor = useCallback(async (color: CrossColor | 'any') => {
    setWcaColor(color);
    setWcaLen('any');
    setWcaMeta(null);
    if (color === 'any') { setWcaBins(null); return; }
    const data = await loadWcaColor(color);
    setWcaBins(data ? Object.keys(data.bins).map(Number).sort((a, b) => a - b) : null);
  }, [loadWcaColor]);

  // 抽一条真实打乱:任意颜色→随机挑色;任意步数(或任意颜色)→该色全部桶合并随机。
  const drawWca = useCallback(async () => {
    const color: CrossColor = wcaColor === 'any'
      ? CROSS_COLORS[Math.floor(Math.random() * CROSS_COLORS.length)]
      : wcaColor;
    const data = await loadWcaColor(color);
    if (!data) return;
    const pool: WcaEntry[] = (wcaColor !== 'any' && wcaLen !== 'any' && data.bins[String(wcaLen)])
      ? data.bins[String(wcaLen)]
      : Object.values(data.bins).flat();
    if (!pool.length) return;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    setScramble(entry.s);
    setWcaMeta(entry);
    setCrossColor(color);
  }, [wcaColor, wcaLen, loadWcaColor]);

  // Lazily warm the default color's pool after first paint (only on idle) so the
  // first 任意 draw is snappy. Doesn't pick a scramble — user clicks 换一个.
  useEffect(() => {
    const t = setTimeout(() => { void loadWcaColor('White'); }, 300);
    return () => clearTimeout(t);
  }, [loadWcaColor]);

  // Optimal cross solution for the loaded scramble (first call builds tables ~0.5s, then instant).
  useEffect(() => {
    if (!wcaMeta) { setCrossSol(null); return; }
    const t = setTimeout(() => setCrossSol(solveCross(wcaMeta.s, crossColor)), 0);
    return () => clearTimeout(t);
  }, [wcaMeta, crossColor]);

  // 国旗映射(comp_countries 等)首屏后异步拉,完成后重渲染让旗出现。
  useEffect(() => { void loadFlagData().then(setFlagDataVer); }, []);

  const wcaComp = wcaMeta ? resolveComp(wcaMeta.c) : null;

  return (
    <div className="analyze-page">
      <SolveTabs puzzle="3x3" mode="solve" sub={tool} />

      <div className="analyze-input-row">
        {/* 当前打乱的 2D 打乱图(点击看大图);打乱文字唯一来源是右侧输入框,不再重复 */}
        <div className="analyze-input-img">
          <ScramblePreview2D
            event="333"
            scramble={scramble.trim()}
            size={44}
            fullSizeLink
            linkTitle={t('查看大图', 'View full size')}
          />
        </div>
        <textarea
          ref={scrambleRef}
          className="analyze-scramble"
          rows={1}
          value={scramble}
          onChange={(e) => { setScramble(e.target.value.replace(/\n/g, ' ')); setWcaMeta(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void setTool('cfop'); runAnalyze(); } }}
          placeholder={t('输入打乱（标准 WCA 记号）', 'Scramble (WCA notation)')}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          inputMode="text"
        />
      </div>

      <div className="analyze-wca">
        {/* 来源切换:WCA 真实打乱(带比赛信息)/ 随机生成 */}
        <PillToggle
          value={scrSource === 'wca'}
          onChange={(v) => setScrSource(v ? 'wca' : 'random')}
          onLabel={t('WCA 真题', 'WCA real')}
          offLabel={t('随机生成', 'Random')}
          ariaLabel={t('打乱来源', 'Scramble source')}
          className="analyze-src-pill"
        />

        {scrSource === 'wca' ? (
          <>
            {/* 颜色 + 步数都是可选过滤器,默认「任意」= 随机一条真实打乱 */}
            <select
              className="analyze-wca-color"
              value={wcaColor}
              onChange={(e) => { void selectWcaColor(e.target.value as CrossColor | 'any'); }}
              disabled={running}
              aria-label={t('十字颜色', 'Cross color')}
            >
              <option value="any">{t('任意颜色', 'Any color')}</option>
              {CROSS_COLORS.map((c) => (
                <option key={c} value={c}>
                  {t(`${COLOR_LABEL[c].zh}十字`, `${COLOR_LABEL[c].en} cross`)}
                </option>
              ))}
            </select>
            {wcaColor !== 'any' && (
              <select
                className="analyze-wca-color"
                value={String(wcaLen)}
                onChange={(e) => setWcaLen(e.target.value === 'any' ? 'any' : Number(e.target.value))}
                disabled={running || !wcaBins}
                aria-label={t('十字步数', 'Cross length')}
              >
                <option value="any">{t('任意步数', 'Any length')}</option>
                {(wcaBins ?? []).map((n) => (
                  <option key={n} value={n}>{t(`${n} 步`, `${n} moves`)}</option>
                ))}
              </select>
            )}
            <button
              className="analyze-wca-reshuffle"
              onClick={() => void drawWca()}
              disabled={running || wcaLoading}
              title={t('换一条真实打乱', 'Draw another real scramble')}
              aria-label={t('换一条真实打乱', 'Draw another real scramble')}
            >
              {wcaLoading ? <Loader2 size={13} className="analyze-spin" /> : <Shuffle size={13} />}
            </button>
          </>
        ) : (
          <button
            className="analyze-wca-reshuffle"
            onClick={() => void fillRandom()}
            disabled={running}
            title={t('换一个随机打乱', 'New random scramble')}
            aria-label={t('换一个随机打乱', 'New random scramble')}
          >
            <Shuffle size={13} />
          </button>
        )}
      </div>

      {/* 来源信息行:WCA 真实打乱显示比赛出处,随机显示标签;不重复打乱文字/图 */}
      <div className="analyze-srcline">
        {scrSource === 'wca' && wcaMeta && (
          <Link
            href={`/${lang}/scramble/gen?comp=${wcaComp?.id ?? ''}`}
            className="analyze-scr-src"
            title={t('在生成器中打开该比赛', 'Open this competition in the generator')}
          >
            {wcaComp?.iso && <Flag iso2={wcaComp.iso} className="analyze-scr-flag" />}
            <span className="analyze-scr-comp">{localizeCompName(wcaComp?.id ?? '', wcaMeta.c, lang === 'zh')}</span>
            <EventIcon event={wcaMeta.e} className="analyze-scr-evt" />
            <span className="analyze-scr-meta">{compSourceLine(wcaMeta.r, wcaMeta.g, wcaMeta.n, lang === 'zh')}</span>
          </Link>
        )}
        {crossSol && (
          <span className="analyze-scr-cross">
            {t(`${COLOR_LABEL[crossColor].zh}十字`, `${COLOR_LABEL[crossColor].en} cross`)}
            {' '}({crossSol.length}): {crossSol.moves.join(' ') || '—'}
          </span>
        )}
      </div>

      {tool === 'stage' && (
        <section className="analyze-primary">
          <StageSolver
            scramble={scramble}
            lang={lang}
            initialMethod={initUrlRef.current.method ?? 'std'}
            initialStage={Math.max(0, initUrlRef.current.mstage ?? 0)}
            initialFace={initUrlRef.current.face ?? undefined}
            initialSlot={initUrlRef.current.slot ?? undefined}
            onSelectionChange={(m, s) => {
              void setUrlState({ method: m === 'std' ? null : m, mstage: s === 0 ? null : s });
            }}
            onSlotChange={(sl) => { void setUrlState({ slot: sl || null }); }}
          />
        </section>
      )}

      {tool === 'cfop' && (
      <section className="analyze-cfop-panel">

      <div className="analyze-filters">
        <button
          className="analyze-go"
          onClick={runAnalyze}
          disabled={running || !scramble.trim()}
        >
          {running ? <Loader2 size={16} className="analyze-spin" /> : null}
          {t('求解', 'Solve')}
        </button>
        <label className="analyze-control">
          <select
            value={variant}
            aria-label={t('变体', 'Variant')}
            onChange={(e) => setVariant(e.target.value as Variant)}
            disabled={running}
          >
            {VARIANT_VALUES.map((v) => (
              <option key={v} value={v}>{variantLabel(v, lang === 'zh')}</option>
            ))}
          </select>
        </label>
        <label className="analyze-control">
          <select
            value={stage}
            aria-label={t('阶段', 'Stage')}
            onChange={(e) => setStage(e.target.value as Stage)}
            disabled={running}
          >
            {STAGE_VALUES.map((s) => (
              <option key={s} value={s}>{stageLabel(s, lang === 'zh')}</option>
            ))}
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

      </section>
      )}

      {tool === 'fmc' && (
        <section className="analyze-chain-panel">
          <ChainExplorer scramble={scramble} lang={lang} />
        </section>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AnalyzePageInner />
      {/* 分布区:同一滚动页,求解(阶段/CFOP/DR)下方;懒挂载,首屏零分布开销。 */}
      <LazyVisible className="scramble-dist-embed">
        <ScrambleStatsPage embedded />
      </LazyVisible>
    </Suspense>
  );
}
