'use client';

/**
 * ChainExplorer — mallard 式 FMC 分步还原链(analyzer 底部挂载)。
 *
 * 引擎 = 自有服务器跑的 cubelib(joba.me/mallard 同款,经作者授权 vendoring 进
 * `fmc/`)。与上游同构:mallard 生产版也是后端求解(POST joba.me/cubeapi),
 * 这里走 `GET /v1/fmc/solve_stream`(NDJSON 流式,服务端按 2^5..2^19 step-limit
 * 倍增搜索,每出现更短解推一行)。默认请求与部署版 mallard 抓包逐字段一致
 * (relative min/max + quality=10000 + 默认 DR triggers),所以解收敛到相同长度,
 * NISS 段前/段内、RZP 行、HTR 子集 `[4a1 4e]` 注释全部一致。
 *
 * 布局复刻 mallard:Steps 标签(EO/RZP/DR/HTR/FR/Finish)+ 每步卡片(Step length
 * 双滑块、Variations 轴、NISS 双开关、DR triggers/subsets、FIN leave-slice)→
 * Solution 面板(流式收敛,逐步 `normal (inverse) // variant [subset] (len/cum)`)
 * → Exclude Solutions 标签(排除某步解重算)。共用一个 3D 播放器。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, X, Play, ChevronDown, Plus } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import TwistySection from '@/components/TwistySection';
import PillToggle from '@/components/PillToggle/PillToggle';
import { apiUrl } from '@/lib/api-base';
import { normalizeScramble } from '@/lib/cross-solver';
import './ChainExplorer.css';

type StageKey = 'eo' | 'rzp' | 'dr' | 'htr' | 'fr' | 'fin';
type ConfStage = StageKey;
type Axis = 'ud' | 'fb' | 'lr';

interface StageUI {
  axes: Axis[];
  min: number;
  max: number;
  nissBefore: boolean;
  nissDuring: boolean;
}

interface FmcStep {
  kind: string;
  variant: string;
  normal: string;
  inverse: string;
  comment: string;
  len: number;
  cancelled?: number;
  cum: number;
}
interface FmcSolution {
  steps: FmcStep[];
  solution: string;
  total: number;
}
interface StreamMsg {
  solution?: FmcSolution;
  quality?: number;
  elapsed_ms?: number;
  done?: boolean;
  exhausted?: boolean;
  error?: string;
  progress?: { limit: number; elapsed_ms: number };
  queued?: boolean;
}

const AXES: Axis[] = ['ud', 'fb', 'lr'];
const AXIS_LABEL: Record<Axis, string> = { ud: 'UD', fb: 'FB', lr: 'LR' };
/** 滑块轨道上限(显示范围);默认值 = 部署版 mallard 抓包原值。 */
const STEP_TRACK: Record<ConfStage, number> = { eo: 8, rzp: 6, dr: 14, htr: 14, fr: 12, fin: 14 };
const STAGE_DEFAULTS: Record<ConfStage, StageUI> = {
  eo: { axes: AXES, min: 0, max: 5, nissBefore: true, nissDuring: true },
  rzp: { axes: AXES, min: 0, max: 3, nissBefore: false, nissDuring: false },
  dr: { axes: AXES, min: 0, max: 12, nissBefore: true, nissDuring: false },
  htr: { axes: AXES, min: 0, max: 12, nissBefore: true, nissDuring: false },
  fr: { axes: AXES, min: 0, max: 10, nissBefore: true, nissDuring: false },
  fin: { axes: AXES, min: 0, max: 10, nissBefore: false, nissDuring: false },
};
const DEFAULT_TRIGGERS = ['R', 'R U2 R', 'R F2 R', 'R U R', "R U' R"];
/** 与上游 60s 窗口一致;服务端单飞 + 转录缓存,重复打乱秒回。 */
const BUDGET_MS = 60_000;

const TABS: { key: StageKey; label: string }[] = [
  { key: 'eo', label: 'EO' },
  { key: 'rzp', label: 'RZP' },
  { key: 'dr', label: 'DR' },
  { key: 'htr', label: 'HTR' },
  { key: 'fr', label: 'FR' },
  { key: 'fin', label: 'Finish' },
];

function initStages(): Record<ConfStage, StageUI> {
  const out = {} as Record<ConfStage, StageUI>;
  for (const k of Object.keys(STAGE_DEFAULTS) as ConfStage[]) {
    out[k] = { ...STAGE_DEFAULTS[k], axes: [...STAGE_DEFAULTS[k].axes] };
  }
  return out;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/** rev_inv 的 move 串镜像:倒序 + 翻转后缀 '' ↔ "'"(U2 不变)。 */
function revInv(tokens: string[]): string[] {
  return tokens
    .slice()
    .reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`));
}

/** 截至第 upto 步(含)的线性化序列(normal 打乱上):N ++ rev_inv(I)。 */
function linearizePrefix(steps: FmcStep[], upto: number): string {
  const n: string[] = [];
  const i: string[] = [];
  for (const s of steps.slice(0, upto + 1)) {
    if (s.normal) n.push(...s.normal.split(' '));
    if (s.inverse) i.push(...s.inverse.split(' '));
  }
  return [...n, ...revInv(i)].join(' ');
}

/** 该步在 mallard 记号下的 move 串:`normal (inverse)`(空则 '—')。 */
function stepMoves(s: FmcStep): string {
  const parts: string[] = [];
  if (s.normal) parts.push(s.normal);
  if (s.inverse) parts.push(`(${s.inverse})`);
  return parts.join(' ');
}

interface Props {
  scramble: string;
  lang: 'zh' | 'en';
}

export default function ChainExplorer({ scramble, lang }: Props) {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [stages, setStages] = useState(initStages);
  const [frEnabled, setFrEnabled] = useState(true); // mallard 默认含 FR
  const [triggers, setTriggers] = useState<string[]>(DEFAULT_TRIGGERS);
  const [enforceTriggers, setEnforceTriggers] = useState(true);
  const [triggerInput, setTriggerInput] = useState('');
  const [subsets, setSubsets] = useState<string[]>([]);
  const [subsetInput, setSubsetInput] = useState('');
  const [leaveSlice, setLeaveSlice] = useState(false);
  const [htrBreaking, setHtrBreaking] = useState(false);
  const [activeTab, setActiveTab] = useState<StageKey>('eo');
  const [excludeTab, setExcludeTab] = useState<StageKey>('eo');
  const [axisMenu, setAxisMenu] = useState<ConfStage | null>(null);
  const [excluded, setExcluded] = useState<Record<StageKey, string[]>>({
    eo: [], rzp: [], dr: [], htr: [], fr: [], fin: [],
  });
  // 双轨结果:listSols = 秒出的多解(一次性 /solve,quality 低);bestSol = 深化流
  // (/solve_stream)逐步收敛的最优解。
  const [listSols, setListSols] = useState<FmcSolution[] | null>(null);
  const [bestSol, setBestSol] = useState<FmcSolution | null>(null);
  const [trail, setTrail] = useState<{ total: number; ms: number }[]>([]);
  const [progress, setProgress] = useState<{ queued?: boolean; limit?: number; elapsedMs: number } | null>(null);
  const [doneInfo, setDoneInfo] = useState<{ ms: number; exhausted: boolean } | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [sel, setSel] = useState<{ src: 'best' | number; step: number | 'full' } | null>(null);

  const playerRef = useRef<{ jumpToStart?: (o?: { flash?: boolean }) => void; play?: () => void } | null>(null);
  const reqRef = useRef(0);
  const ranRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const normScramble = useMemo(() => normalizeScramble(scramble) ?? scramble, [scramble]);
  const scrambleRef = useRef(normScramble);
  scrambleRef.current = normScramble;

  const cfgRef = useRef({ stages, frEnabled, excluded, triggers, enforceTriggers, subsets, leaveSlice, htrBreaking });
  cfgRef.current = { stages, frEnabled, excluded, triggers, enforceTriggers, subsets, leaveSlice, htrBreaking };

  /** cubelib niss token from the two toggles. */
  const nissTok = (s: StageUI) => (s.nissDuring ? 'always' : s.nissBefore ? 'before' : 'never');

  /** Build the CLI-style steps string. 与部署版 mallard 的 SolverRequest 逐字段
   *  对齐:relative min/max 显式下发(absolute 是累计封顶,会把深解剪掉 —— 之前
   *  卡 20 步的根因)、substeps 显式、triggers 启用时带 RZP。
   *  quality:快速多解走 1000(秒出),深化流走 10000(= mallard,实际被服务端
   *  step-limit 倍增覆盖)。 */
  const buildSteps = useCallback((quality: number): string => {
    const c = cfgRef.current;
    const st = c.stages;
    const part = (key: ConfStage, extra: string[] = []) => {
      const s = st[key];
      const parts = [`min=${s.min}`, `max=${s.max}`, `niss=${nissTok(s)}`, `quality=${quality}`];
      if (key !== 'rzp') parts.push(`substeps=${s.axes.join(',')}`);
      parts.push(...extra);
      const exl = c.excluded[key].filter(Boolean);
      if (exl.length) parts.push(`excl=${exl.join('|')}`);
      return parts;
    };
    const useTriggers = c.enforceTriggers && c.triggers.length > 0;
    const drExtra: string[] = [];
    if (useTriggers) drExtra.push(`triggers=${c.triggers.join(',')}`);
    if (c.subsets.length) drExtra.push(`subsets=${c.subsets.join(',')}`);
    const finExtra: string[] = [];
    if (!c.frEnabled && c.htrBreaking) finExtra.push('htr-breaking=true');

    const chain = [`EO[${part('eo').join(';')}]`];
    if (useTriggers) chain.push(`RZP[${part('rzp').join(';')}]`);
    chain.push(`DR[${part('dr', drExtra).join(';')}]`);
    chain.push(`HTR[${part('htr').join(';')}]`);
    if (c.frEnabled) chain.push(`${c.leaveSlice ? 'FRLS' : 'FR'}[${part('fr').join(';')}]`);
    chain.push(`${c.leaveSlice ? 'FINLS' : 'FIN'}[${part('fin', finExtra).join(';')}]`);
    return chain.join(' > ');
  }, []);

  /** dev 代理在「上一条流被 abort 后的短窗口」复用半死连接报 500,带退避重试。 */
  const fetchRetry = useCallback(async (url: string, signal: AbortSignal, my: number) => {
    let res = await fetch(url, { signal });
    for (const delay of [600, 1300]) {
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, delay));
      if (reqRef.current !== my) return null;
      res = await fetch(url, { signal });
    }
    return res;
  }, []);

  /** Phase 1:一次性多解(quality=1000,秒出;nginx 7d 缓存,重复瞬时)。 */
  const fetchList = useCallback(async (scr: string, my: number) => {
    listAbortRef.current?.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;
    setListLoading(true);
    try {
      const url = apiUrl(
        `/v1/fmc/solve?scramble=${encodeURIComponent(scr)}&steps=${encodeURIComponent(buildSteps(1000))}&count=10`,
      );
      const res = await fetchRetry(url, ctrl.signal, my);
      if (!res || reqRef.current !== my) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { solutions?: FmcSolution[]; error?: string };
      if (reqRef.current !== my) return;
      if (data.error) throw new Error(data.error);
      setListSols(data.solutions ?? []);
    } catch (e) {
      if (!ctrl.signal.aborted && reqRef.current === my) {
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (reqRef.current === my) setListLoading(false);
    }
  }, [buildSteps, fetchRetry]);

  /** Phase 2:深化流(mallard 同款 step-limit 倍增),逐步更新最优解 + 进度。 */
  const runStream = useCallback(async (scr: string, my: number) => {
    streamAbortRef.current?.abort();
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    setStreaming(true);
    const t0 = performance.now();
    try {
      const url = apiUrl(
        `/v1/fmc/solve_stream?scramble=${encodeURIComponent(scr)}&steps=${encodeURIComponent(buildSteps(10000))}&budget=${BUDGET_MS}`,
      );
      const res = await fetchRetry(url, ctrl.signal, my);
      if (!res || reqRef.current !== my) return;
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (reqRef.current !== my) { void reader.cancel().catch(() => {}); return; }
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg: StreamMsg;
          try { msg = JSON.parse(line) as StreamMsg; } catch { continue; }
          if (msg.error) setErrMsg(msg.error);
          if (msg.queued) setProgress({ queued: true, elapsedMs: msg.elapsed_ms ?? 0 });
          if (msg.progress) setProgress({ limit: msg.progress.limit, elapsedMs: msg.progress.elapsed_ms });
          if (msg.solution) {
            setBestSol(msg.solution);
            setTrail((tr) => [...tr, { total: msg.solution!.total, ms: msg.elapsed_ms ?? 0 }]);
          }
          if (msg.done) {
            setDoneInfo({ ms: Math.round(performance.now() - t0), exhausted: !!msg.exhausted });
            setProgress(null);
          }
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted && reqRef.current === my) {
        setErrMsg(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (reqRef.current === my) { setStreaming(false); setProgress(null); }
    }
  }, [buildSteps, fetchRetry]);

  const compute = useCallback(() => {
    const scr = scrambleRef.current.trim();
    if (!scr) return;
    const my = ++reqRef.current;
    ranRef.current = true;
    setErrMsg('');
    setTrail([]);
    setDoneInfo(null);
    setProgress(null);
    setSel(null);
    // 串行:先秒出多解列表(prod 上并行会和深化流抢 CPU,列表从 ~2s 退化到 ~10s),
    // 列表到手再开深化流。
    void (async () => {
      await fetchList(scr, my);
      if (reqRef.current !== my) return;
      void runStream(scr, my);
    })();
  }, [fetchList, runStream]);

  /** 停止深化:只断流,保留已出的解。 */
  const stopStream = useCallback(() => {
    streamAbortRef.current?.abort();
    setStreaming(false);
    setProgress(null);
  }, []);

  // 打乱 / 配置变化 → 防抖自动重算(仅在已算过之后)。
  const firstAuto = useRef(true);
  useEffect(() => {
    if (firstAuto.current) { firstAuto.current = false; return; }
    if (!ranRef.current) return;
    const id = setTimeout(() => { void compute(); }, 600);
    return () => clearTimeout(id);
  }, [normScramble, stages, frEnabled, triggers, enforceTriggers, subsets, leaveSlice, htrBreaking, compute]);

  // 排除列表变化 → 立即重算。
  const firstExcluded = useRef(true);
  useEffect(() => {
    if (firstExcluded.current) { firstExcluded.current = false; return; }
    if (ranRef.current) void compute();
  }, [excluded, compute]);

  // 卸载时断流。
  useEffect(() => () => {
    listAbortRef.current?.abort();
    streamAbortRef.current?.abort();
  }, []);

  const setStage = useCallback((k: ConfStage, patch: Partial<StageUI>) => {
    setStages((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  }, []);

  const removeAxis = useCallback((k: ConfStage, a: Axis) => {
    setStages((prev) => {
      const next = prev[k].axes.filter((x) => x !== a);
      if (next.length === 0) return prev;
      return { ...prev, [k]: { ...prev[k], axes: next } };
    });
  }, []);

  const addAxis = useCallback((k: ConfStage, a: Axis) => {
    setStages((prev) => {
      if (prev[k].axes.includes(a)) return prev;
      const next = AXES.filter((x) => x === a || prev[k].axes.includes(x));
      return { ...prev, [k]: { ...prev[k], axes: next } };
    });
    setAxisMenu(null);
  }, []);

  const addTrigger = useCallback(() => {
    const v = triggerInput.trim();
    if (!v || !/^[RUFLDBrufldb2' ]+$/.test(v)) return;
    setTriggers((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setTriggerInput('');
  }, [triggerInput]);

  const addSubset = useCallback(() => {
    const v = subsetInput.trim();
    if (!v || !/^\d[abc]?\d?( \d+e)?$/.test(v)) return;
    setSubsets((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setSubsetInput('');
  }, [subsetInput]);

  // 排除某步:cubelib 的 FilterExcluded 比对的是「截至该步的累计 alg」(canonicalize
  // 后),与 mallard find_step 的 full_alg 一致 —— 所以这里必须发累计记号,不是单步。
  const excludeStep = useCallback((steps: FmcStep[], j: number) => {
    const n: string[] = [];
    const inv: string[] = [];
    for (const st of steps.slice(0, j + 1)) {
      if (st.normal) n.push(st.normal);
      if (st.inverse) inv.push(st.inverse);
    }
    const alg = `${n.join(' ')}${inv.length ? ` (${inv.join(' ')})` : ''}`.trim();
    if (!alg) return;
    const s = steps[j];
    const raw = s.kind === 'rzp' ? 'dr' : s.kind === 'frls' ? 'fr' : s.kind === 'finls' ? 'fin' : s.kind;
    const kind = raw as StageKey;
    setExcluded((prev) => (prev[kind].includes(alg) ? prev : { ...prev, [kind]: [...prev[kind], alg] }));
    setExcludeTab(kind);
  }, []);

  const removeExcluded = useCallback((k: StageKey, i: number) => {
    setExcluded((prev) => ({ ...prev, [k]: prev[k].filter((_, j) => j !== i) }));
  }, []);

  const select = useCallback((src: 'best' | number, step: number | 'full', play = false) => {
    setSel({ src, step });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const p = playerRef.current;
      try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
      if (play) { try { p?.play?.(); } catch { /* */ } }
    }));
  }, []);

  const selAlg = useMemo(() => {
    if (sel == null) return null;
    const s = sel.src === 'best' ? bestSol : listSols?.[sel.src] ?? null;
    if (!s) return null;
    return sel.step === 'full' ? s.solution : linearizePrefix(s.steps, sel.step);
  }, [sel, bestSol, listSols]);

  // 当前展示的解(选中优先,否则最优;= mallard 的「current solution」)。排除 tab
  // 照 mallard:把当前解在该步的 alg 渲染成一键排除按钮,而不是让用户去上面点图标。
  const currentSol = useMemo<FmcSolution | null>(() => {
    if (sel) return sel.src === 'best' ? bestSol : listSols?.[sel.src] ?? null;
    return bestSol ?? listSols?.[0] ?? null;
  }, [sel, bestSol, listSols]);
  const stepIndexForKind = (sol: FmcSolution, kind: StageKey): number =>
    sol.steps.findIndex((st) => {
      const raw = st.kind === 'rzp' ? 'dr' : st.kind === 'frls' ? 'fr' : st.kind === 'finls' ? 'fin' : st.kind;
      return raw === kind;
    });

  const busy = listLoading;
  const useTriggers = enforceTriggers && triggers.length > 0;

  const renderSteps = (s: FmcSolution, src: 'best' | number) => (
    <div className="chx-steps">
      {s.steps.map((st, j) => (
        <div
          key={j}
          className={`chx-step${sel?.src === src && sel?.step === j ? ' is-active' : ''}`}
          onClick={() => select(src, j)}
        >
          <code className="chx-step-mv">{stepMoves(st) || '—'}</code>
          <span className="chx-step-var">{`// ${st.variant}${st.comment ? ` [${st.comment}]` : ''}`}</span>
          <span className="chx-step-cnt">
            {st.cancelled ? `(${st.len}-${st.cancelled}/${st.cum})` : `(${st.len}/${st.cum})`}
          </span>
          {stepMoves(st) && (
            <button
              className="chx-step-ban"
              title={t('排除该步解并重算', 'Exclude this step solution and re-solve')}
              aria-label={t('排除该步', 'Exclude this step')}
              onClick={(e) => { e.stopPropagation(); excludeStep(s.steps, j); }}
            >
              <Ban size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  );

  const axisChips = (key: ConfStage, disabled: boolean) => {
    const s = stages[key];
    const removable = AXES.filter((a) => s.axes.includes(a));
    const addable = AXES.filter((a) => !s.axes.includes(a));
    return (
      <div className="chx-chips">
        {removable.map((a) => (
          <span key={a} className="chx-chip">
            {AXIS_LABEL[a]}
            <button
              className="chx-chip-x"
              disabled={disabled || removable.length <= 1}
              aria-label={t('移除轴', 'remove axis')}
              onClick={() => removeAxis(key, a)}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {addable.length > 0 && (
          <div className="chx-axis-add">
            <button
              className="chx-chip-add"
              disabled={disabled}
              aria-label={t('添加轴', 'add axis')}
              onClick={() => setAxisMenu(axisMenu === key ? null : key)}
            >
              <Plus size={12} />
              <ChevronDown size={12} />
            </button>
            {axisMenu === key && (
              <div className="chx-axis-menu">
                {addable.map((a) => (
                  <button key={a} className="chx-axis-menu-btn" onClick={() => addAxis(key, a)}>{AXIS_LABEL[a]}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const nissRows = (key: ConfStage, disabled: boolean) => {
    const s = stages[key];
    return (
      <div className="chx-field-block">
        <div className="chx-field-label">NISS</div>
        <label className="chx-niss-row">
          <span>{t('段前允许切换', 'Allow switching before step')}</span>
          <PillToggle
            value={s.nissBefore}
            disabled={disabled}
            onChange={(v) => setStage(key, { nissBefore: v, nissDuring: v ? s.nissDuring : false })}
            ariaLabel="NISS before"
          />
        </label>
        <label className="chx-niss-row">
          <span>{t('段内允许切换', 'Allow switching during step')}</span>
          <PillToggle
            value={s.nissDuring}
            disabled={disabled}
            onChange={(v) => setStage(key, { nissDuring: v, nissBefore: v ? true : s.nissBefore })}
            ariaLabel="NISS during"
          />
        </label>
      </div>
    );
  };

  const renderStepPanel = (key: ConfStage) => {
    const s = stages[key];
    const disabled = (key === 'fr' && !frEnabled) || (key === 'rzp' && !useTriggers);
    return (
      <div className={`chx-panel${disabled ? ' is-off' : ''}`}>
        {key === 'fr' && (
          <label className="chx-fr-enable">
            <PillToggle value={frEnabled} onChange={setFrEnabled} ariaLabel="enable FR" />
            <span>{t('启用 FR', 'Enable FR')}</span>
          </label>
        )}
        {key === 'rzp' && !useTriggers && (
          <div className="chx-axes-note">
            {t('RZP 仅在 DR 启用 triggers 时生效。', 'RZP only applies when DR triggers are enforced.')}
          </div>
        )}

        <div className="chx-field-block">
          <div className="chx-field-label">{t('步数范围', 'Step length')}</div>
          <RangeSlider
            min={0}
            max={STEP_TRACK[key]}
            value={[s.min, s.max]}
            onChange={([min, max]) => setStage(key, { min, max })}
            marks={Array.from({ length: STEP_TRACK[key] + 1 }, (_, i) => i)}
            markHighlight
            disabled={disabled}
            ariaLabel={t('步数范围', 'Step length')}
          />
        </div>

        {key !== 'rzp' && key !== 'fin' && (
          <div className="chx-field-block">
            <div className="chx-field-label">{t('变体轴', 'Variations')}</div>
            {axisChips(key, disabled)}
          </div>
        )}

        {key === 'dr' && (
          <>
            <div className="chx-field-block">
              <div className="chx-field-label">Triggers</div>
              <label className="chx-niss-row">
                <span>{t('强制 trigger 结尾(经 RZP)', 'Enforce triggers (via RZP)')}</span>
                <PillToggle value={enforceTriggers} onChange={setEnforceTriggers} ariaLabel="enforce triggers" />
              </label>
              <div className="chx-chips">
                {triggers.map((tr) => (
                  <span key={tr} className="chx-chip">
                    <code>{tr}</code>
                    <button
                      className="chx-chip-x"
                      aria-label={t('移除 trigger', 'remove trigger')}
                      onClick={() => setTriggers((prev) => prev.filter((x) => x !== tr))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <span className="chx-inline-add">
                  <input
                    className="chx-inline-add-input"
                    value={triggerInput}
                    placeholder={t('如 R U R', "e.g. R U R")}
                    onChange={(e) => setTriggerInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTrigger(); }}
                  />
                  <button className="chx-inline-add-btn" onClick={addTrigger} aria-label={t('添加 trigger', 'add trigger')}><Plus size={12} /></button>
                </span>
              </div>
            </div>
            <div className="chx-field-block">
              <div className="chx-field-label">{t('限定子集', 'Subsets')}</div>
              <div className="chx-chips">
                {subsets.map((sub) => (
                  <span key={sub} className="chx-chip">
                    <code>{sub}</code>
                    <button
                      className="chx-chip-x"
                      aria-label={t('移除子集', 'remove subset')}
                      onClick={() => setSubsets((prev) => prev.filter((x) => x !== sub))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <span className="chx-inline-add">
                  <input
                    className="chx-inline-add-input"
                    value={subsetInput}
                    placeholder={t('如 4a1', 'e.g. 4a1')}
                    onChange={(e) => setSubsetInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addSubset(); }}
                  />
                  <button className="chx-inline-add-btn" onClick={addSubset} aria-label={t('添加子集', 'add subset')}><Plus size={12} /></button>
                </span>
              </div>
            </div>
          </>
        )}

        {key !== 'fin' && nissRows(key, disabled)}

        {key === 'fin' && (
          <div className="chx-field-block">
            <label className="chx-niss-row">
              <span>{t('留中层(leave slice)', 'Leave slice')}</span>
              <PillToggle value={leaveSlice} onChange={setLeaveSlice} ariaLabel="leave slice" />
            </label>
            {!frEnabled && (
              <label className="chx-niss-row">
                <span>
                  {t('允许破坏 HTR 收尾', 'Allow HTR-breaking finish')}
                  <small className="chx-hint">{t('(需 ~10GB 表,服务器未启用)', '(needs a ~10GB table; not enabled on this server)')}</small>
                </span>
                <PillToggle value={htrBreaking} onChange={setHtrBreaking} ariaLabel="htr breaking" />
              </label>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="chx" onClick={() => axisMenu && setAxisMenu(null)}>
      {/* ── Steps ── */}
      <div className="chx-block">
        <h3 className="chx-h">{t('分步', 'Steps')}</h3>
        <div className="chx-tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`chx-tab${activeTab === key ? ' is-active' : ''}${(key === 'fr' && !frEnabled) || (key === 'rzp' && !useTriggers) ? ' is-dim' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {renderStepPanel(activeTab)}
      </div>

      <div className="chx-run">
        <button className="chx-compute" onClick={compute} disabled={busy}>
          {busy ? <Spinner size={14} /> : null}
          {ranRef.current ? t('重新计算', 'Recompute') : t('计算', 'Compute')}
        </button>
        {streaming && (
          <span className="chx-status">
            {progress?.queued
              ? t('排队中…', 'Queued…')
              : progress?.limit
                ? t(`深化中 · 宽度 ${progress.limit} · ${fmtMs(progress.elapsedMs)}`, `Deepening · width ${progress.limit} · ${fmtMs(progress.elapsedMs)}`)
                : t('深化中…', 'Deepening…')}
          </span>
        )}
        {streaming && (
          <button className="chx-stop" onClick={stopStream}>{t('停止深化', 'Stop')}</button>
        )}
        {!streaming && doneInfo && (
          <span className="chx-status">
            {doneInfo.exhausted
              ? t(`已搜尽 (${fmtMs(doneInfo.ms)})`, `Search exhausted (${fmtMs(doneInfo.ms)})`)
              : t(`深化完成 (${fmtMs(doneInfo.ms)})`, `Deepening done (${fmtMs(doneInfo.ms)})`)}
          </span>
        )}
      </div>

      {errMsg && <div className="chx-err">{t('求解失败', 'Solve failed')}: {errMsg}</div>}

      {/* ── Solution ── */}
      <div className="chx-block">
        <h3 className="chx-h">{t('解', 'Solution')}</h3>
        {!bestSol && !listSols && !busy && !streaming && !errMsg && (
          <div className="chx-empty">
            {ranRef.current
              ? t('未找到满足当前条件的解,放宽步数范围或移除排除项。', 'No solution matches — widen a length range or remove an exclusion.')
              : t('点「计算」生成分步还原链。', 'Click Compute to generate the step-by-step chain.')}
          </div>
        )}
        {(bestSol || (listSols && listSols.length > 0)) && (
          <div className="chx-result">
            <ol className="chx-chains">
              {bestSol && (
                <li className={`chx-chain chx-chain-best${sel?.src === 'best' ? ' is-active' : ''}`}>
                  <div
                    className="chx-chain-head"
                    onClick={() => select('best', 'full')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select('best', 'full'); } }}
                  >
                    <button
                      className="chx-chain-play"
                      aria-label={t('播放', 'Play')}
                      onClick={(e) => { e.stopPropagation(); select('best', 'full', true); }}
                    >
                      <Play size={11} />
                    </button>
                    <span className="chx-chain-n">{t('最优', 'Best')}</span>
                    <span className="chx-chain-total">{bestSol.total} HTM</span>
                    {streaming && <Spinner size={12} />}
                    {trail.length > 1 && (
                      <span className="chx-trail">
                        {trail.map((p, i) => (
                          <span key={i}>
                            {i > 0 && ' → '}
                            {p.total}
                            <small>@{fmtMs(p.ms)}</small>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {renderSteps(bestSol, 'best')}
                  <div className="chx-solution">{`Solution (${bestSol.total}): ${bestSol.solution}`}</div>
                </li>
              )}
              {listSols && listSols.length > 0 && (
                <div className="chx-list-h">
                  {t('更多解(快速搜索,未必最短)', 'More solutions (fast search, not necessarily shortest)')}
                </div>
              )}
              {(listSols ?? []).map((c, i) => (
                <li key={i} className={`chx-chain${sel?.src === i ? ' is-active' : ''}`}>
                  <div
                    className="chx-chain-head"
                    onClick={() => select(i, 'full')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i, 'full'); } }}
                  >
                    <button
                      className="chx-chain-play"
                      aria-label={t('播放', 'Play')}
                      onClick={(e) => { e.stopPropagation(); select(i, 'full', true); }}
                    >
                      <Play size={11} />
                    </button>
                    <span className="chx-chain-n">#{i + 1}</span>
                    <span className="chx-chain-total">{c.total} HTM</span>
                  </div>
                  {renderSteps(c, i)}
                  <div className="chx-solution">{`Solution (${c.total}): ${c.solution}`}</div>
                </li>
              ))}
            </ol>

            {selAlg ? (
              <div className="chx-player">
                <TwistySection puzzle="3x3x3" scramble={normScramble} alg={selAlg} playerRef={playerRef} />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Exclude Solutions ── */}
      <div className="chx-block">
        <h3 className="chx-h">{t('排除解', 'Exclude Solutions')}</h3>
        <div className="chx-tabs">
          {TABS.filter(({ key }) => key !== 'rzp').map(({ key, label }) => (
            <button
              key={key}
              className={`chx-tab${excludeTab === key ? ' is-active' : ''}`}
              onClick={() => setExcludeTab(key)}
            >
              {label}
              {excluded[key].length > 0 && <span className="chx-tab-dot" />}
            </button>
          ))}
        </div>
        <div className="chx-panel">
          {(() => {
            const j = currentSol ? stepIndexForKind(currentSol, excludeTab) : -1;
            const mv = j >= 0 && currentSol ? stepMoves(currentSol.steps[j]) : '';
            return mv ? (
              <button className="chx-excl-add" onClick={() => excludeStep(currentSol!.steps, j)}>
                <Ban size={13} />
                <span>{t('排除', 'Exclude')}</span>
                <code>{mv}</code>
              </button>
            ) : (
              <div className="chx-axes-note">
                {t('当前解不含该步。', 'The current solution has no step here.')}
              </div>
            );
          })()}
          {excluded[excludeTab].length > 0 && (
            <div className="chx-excl-list">
              {excluded[excludeTab].map((x, i) => (
                <span key={`${x}-${i}`} className="chx-excl-row">
                  <code>{x}</code>
                  <button
                    className="chx-excl-x"
                    onClick={() => removeExcluded(excludeTab, i)}
                    aria-label={t('移除排除项', 'Remove exclusion')}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
