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
import { normalizeScramble } from '@/lib/cross-solver';
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
// 复用计时器的「打乱来源」综合配置 + 真题池引擎(analyzer 自持一份独立状态)。
import WcaSourceConfig, { type WcaSourceSettings } from '@/components/WcaSourceConfig';
import { nextWca, prefetchWca, wcaMetaFor, isWcaSourceEmpty, type WcaSourceSpec, type WcaScrambleMeta } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import ChainExplorer from '@/components/ChainExplorer';
import PillToggle from '@/components/PillToggle/PillToggle';
import { Flag } from '@/components/Flag';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';
import { loadFlagData, compFlagIso2 } from '@/lib/country-flags';
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

// 打乱来源综合配置默认值 + 本地持久化(analyzer 自持一份,独立于计时器设置)。
const WCA_SRC_KEY = 'analyze.wcaSrc.v1';
const DEFAULT_WCA_SRC: WcaSourceSettings = {
  wcaScrambleMode: 'date',
  wcaComp: '', wcaCompName: '', wcaCompCountry: '', wcaRound: '', wcaGroup: '',
  wcaDateFrom: '', wcaDateTo: '',
  wcaUseOptimal: false,
  wcaDifficultyOn: false,
  wcaDiffVariant: 'std', wcaDiffStage: 'cross', wcaDiffColors: 'BGORWY', wcaDiffSteps: [],
  autoMarkWcaScramble: false, // analyzer 无「打卡」概念(隐藏该开关)
};
function loadWcaSrc(): WcaSourceSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_WCA_SRC };
  try {
    const raw = localStorage.getItem(WCA_SRC_KEY);
    if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') return { ...DEFAULT_WCA_SRC, ...o }; }
  } catch { /* corrupt entry */ }
  return { ...DEFAULT_WCA_SRC };
}
// WcaSourceSettings → wca_pool 的 WcaSourceSpec(event 恒 333;难度关或步数空则不带 diff)。
function specFromWcaSrc(s: WcaSourceSettings): WcaSourceSpec {
  return {
    event: '333' as EventId,
    mode: s.wcaScrambleMode,
    comp: s.wcaComp, compName: s.wcaCompName, round: s.wcaRound, group: s.wcaGroup,
    from: s.wcaDateFrom, to: s.wcaDateTo,
    optimal: s.wcaUseOptimal,
    diff: s.wcaDifficultyOn && s.wcaDiffSteps.length
      ? { variant: s.wcaDiffVariant, stage: s.wcaDiffStage, colors: s.wcaDiffColors, steps: s.wcaDiffSteps }
      : undefined,
  };
}

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
  // slot = StageSolver 指定的固定已解 F2L 槽组合(逗号分隔索引,如 "2" / "0,1");持久化可分享,空=自动。
  slot: parseAsString,
  // base = StageSolver 基态/自由对(单槽索引 "0".."3",对齐 or18 Free Pair);仅 pair/pseudo_pair,空=自动。
  base: parseAsString,
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

  // 打乱来源综合配置(复用计时器 WcaSourceConfig UI + wca_pool 引擎;analyzer 自持一份,
  // 独立于计时器设置,存 localStorage)。抽题走 nextWca(spec),来源元数据走 wcaMetaFor()。
  const [wcaSrc, setWcaSrc] = useState<WcaSourceSettings>(() => loadWcaSrc());
  useEffect(() => { try { localStorage.setItem(WCA_SRC_KEY, JSON.stringify(wcaSrc)); } catch { /* */ } }, [wcaSrc]);
  const patchWcaSrc = useCallback((patch: Partial<WcaSourceSettings>) => setWcaSrc((p) => ({ ...p, ...patch })), []);
  const [wcaMeta, setWcaMeta] = useState<WcaScrambleMeta | null>(null);
  const [wcaLoading, setWcaLoading] = useState(false);
  const [wcaEmpty, setWcaEmpty] = useState(false); // 该来源确认无真题(难度组合无匹配 / 比赛缺此项目)
  const [, setFlagDataVer] = useState(0); // 国旗映射异步加载完后触发重渲染

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

  // 抽一条真实打乱:把综合配置转成 WcaSourceSpec,走 wca_pool.nextWca(与计时器同一引擎:
  // 按日期随机 / 指定比赛 / 按难度过滤 / 最优等态)。null = 该来源确认无真题 → 提示。
  const drawWca = useCallback(async () => {
    const spec = specFromWcaSrc(wcaSrc);
    setWcaLoading(true);
    setWcaEmpty(false);
    try {
      const s = await nextWca(spec);
      if (s) {
        setScramble(s);
        setWcaMeta(wcaMetaFor(s));
      } else {
        setWcaMeta(null);
        setWcaEmpty(isWcaSourceEmpty(spec));
      }
    } finally {
      setWcaLoading(false);
    }
  }, [wcaSrc]);

  // WCA 模式下配置变化时后台预热对应来源队列,首次「换一条」更快。
  useEffect(() => {
    if (scrSource !== 'wca') return;
    prefetchWca(specFromWcaSrc(wcaSrc));
  }, [scrSource, wcaSrc]);

  // 国旗映射(comp_countries 等)首屏后异步拉,完成后重渲染让旗出现。
  useEffect(() => { void loadFlagData().then(setFlagDataVer); }, []);

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
        <button
          className="analyze-wca-reshuffle"
          onClick={() => (scrSource === 'wca' ? void drawWca() : void fillRandom())}
          disabled={running || wcaLoading}
          title={scrSource === 'wca' ? t('换一条真实打乱', 'Draw another real scramble') : t('换一个随机打乱', 'New random scramble')}
          aria-label={scrSource === 'wca' ? t('换一条真实打乱', 'Draw another real scramble') : t('换一个随机打乱', 'New random scramble')}
        >
          {wcaLoading ? <Loader2 size={13} className="analyze-spin" /> : <Shuffle size={13} />}
        </button>
      </div>

      {/* 综合来源配置:复用计时器的 WcaSourceConfig(按日期范围 / 指定比赛 / 按难度 / 最优等态)。
          始终展开内联;自动打卡对分析器无意义,隐藏。 */}
      {scrSource === 'wca' && (
        <div className="analyze-wca-src">
          <WcaSourceConfig
            isZh={lang === 'zh'}
            event={'333' as EventId}
            settings={wcaSrc}
            updateSettings={patchWcaSrc}
            showAutoMark={false}
          />
        </div>
      )}

      {/* 来源信息行:WCA 真实打乱显示比赛出处 / 无匹配提示;随机无出处不显示。 */}
      <div className="analyze-srcline">
        {scrSource === 'wca' && wcaMeta && (() => {
          const iso = compFlagIso2(wcaMeta.ci);
          return (
            <Link
              href={`/${lang}/scramble/gen?comp=${wcaMeta.ci}`}
              className="analyze-scr-src"
              title={t('在生成器中打开该比赛', 'Open this competition in the generator')}
            >
              {iso && <Flag iso2={iso} className="analyze-scr-flag" />}
              <span className="analyze-scr-comp">{localizeCompName(wcaMeta.ci, wcaMeta.cn, lang === 'zh')}</span>
              <EventIcon event={wcaMeta.e} className="analyze-scr-evt" />
              <span className="analyze-scr-meta">{compSourceLine(wcaMeta.r, wcaMeta.g, wcaMeta.n, lang === 'zh')}</span>
            </Link>
          );
        })()}
        {scrSource === 'wca' && wcaEmpty && (
          <span className="analyze-scr-meta">{t('该组合没有匹配的真题,换个条件或点右上角换一条', 'No real scramble matches these filters — adjust them or draw again')}</span>
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
            initialBase={initUrlRef.current.base ?? undefined}
            onSelectionChange={(m, s) => {
              void setUrlState({ method: m === 'std' ? null : m, mstage: s === 0 ? null : s });
            }}
            onSlotChange={(sl) => { void setUrlState({ slot: sl || null }); }}
            onBaseChange={(b) => { void setUrlState({ base: b || null }); }}
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
            className="analyze-control-select"
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
            className="analyze-control-select"
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
            {/* allow-checkbox: 十字颜色多选过滤网格 */}
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
