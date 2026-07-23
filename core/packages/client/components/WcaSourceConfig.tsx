'use client';

/**
 * WcaSourceConfig — settings sub-panel shown when scrambleSource === 'wca'.
 * Lets the user pick HOW real WCA scrambles are drawn:
 *   - 'date': uniformly random across all official scrambles in a date range.
 *   - 'comp': one specific competition, optionally narrowed to a round / group.
 * Writes its state into TimerSettings; the wca_pool reads those to fetch.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CompPicker } from '@/components/CompPicker';
import { ClearButton } from '@/components/ClearButton';
import PillToggle from '@/components/PillToggle/PillToggle';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import type { Comp } from '@/lib/comp-search';
import { fetchWcaScrambles, type WcaScrambleRow } from '@/lib/wca-results-api';
import { roundTypeShort } from '@/lib/comp-schedule';
import { ROUND_ORDER } from '@/lib/wca-round-meta';
import { wcaEventId, probeCompCoverage, getCompCoverage, WCA_OPTIMAL_EVENTS } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import { groupIdxOf } from '@/lib/wca-scramble-group';
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import { VariantSelect } from '@/components/VariantSelect';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { useSubsetSelection, SubsetColorPicker } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { stageLabel, LENGTH_VARIANT, WHOLE_VARIANT, usesStepsIndex, uiVariantOf, uiVariantOptions, uiStagesOf, dataVariantOfStage } from '@/lib/scramble-variants';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';
import './wca-source.css';

// WCA history floor (WC1982) — see CLAUDE.md. No scrambles exist before it.
const WCA_MIN_DATE = '1982-06-05';

// 难度过滤只适用 3x3-family(随机态打乱,有十字/方法步数);其余项目无此数据。
const DIFFICULTY_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf']);
// 「合并」可用的项目 —— 与 server 的 FAMILY_333 一致。333mbf 不在 wca_scramble_steps 里(多盲拆子
// 打乱会撞自然键),合并对它无操作,故不给开关。
const MERGE_EVENT_LIST = ['333', '333oh', '333bf', '333fm', '333ft'] as const;
const MERGE_EVENTS = new Set<string>(MERGE_EVENT_LIST);
// 步数范围(覆盖常用 cross/xcross;深阶段超出 14 的步数 v1 暂不在此选)。难度开启默认带这个范围。
const STEP_MIN = 0;
const STEP_MAX = 14;
const DEFAULT_STEP_RANGE: [number, number] = [4, 6]; // 难度首开默认中等十字区间
const stepRange = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

interface StepsLayout { variants: Record<string, Record<string, Record<string, number>>> }

// distribution.json 里每 (方法,阶段,底色) 步数直方图带真实 min/max —— 滑块端点取这个,
// 不再写死 0..14(六色十字其实 0–7、白十字 0–8、xcross 1–8…实际可选范围差很多)。
interface DiffHist { min: number; max: number; counts: Record<string, number> }
interface DiffDistJson {
  sets: Record<string, { variants: Record<string, { data: Record<string, Record<string, DiffHist>> }> }>;
}

// 打乱长度直方图(stats/scramble/event_lengths.json):counts[招式数] = 条数。用于「打乱」这一项的
// 可用性判断(定长项目只有一个键)与滑块端点。
interface EventLengthsJson { events: Record<string, { counts: Record<string, number> }> }

/**
 * The slice of settings this config reads / writes. Decoupled from the timer's
 * full TimerSettings so the same component can be reused by any host that holds
 * these fields (timer settings store, the analyzer's own local state, …).
 * TimerSettings structurally satisfies this, so timer callers pass it as-is.
 */
export interface WcaSourceSettings {
  wcaScrambleMode: 'date' | 'comp';
  wcaComp: string;
  wcaCompName: string;
  wcaCompCountry: string;
  wcaRound: string;
  wcaGroup: string;
  wcaDateFrom: string;
  wcaDateTo: string;
  wcaUseOptimal: boolean;
  wcaDifficultyOn: boolean;
  wcaDiffVariant: string;
  wcaDiffStage: string;
  wcaDiffColors: string;
  wcaDiffSteps: number[];
  wcaDiffMerged: boolean;
}

interface Props {
  isZh: boolean;
  event: EventId;
  settings: WcaSourceSettings;
  updateSettings: (patch: Partial<WcaSourceSettings>) => void;
}

export default function WcaSourceConfig({
  isZh, event, settings, updateSettings,
}: Props) {
  const wev = wcaEventId(event);
  const mode = settings.wcaScrambleMode;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // comp mode: fetch the picked comp's scrambles (cached) → which rounds / groups
  // exist for the *current* event. evRows = null until loaded; [] = no such event.
  const [evRows, setEvRows] = useState<WcaScrambleRow[] | null>(null);
  useEffect(() => {
    if (mode !== 'comp' || !settings.wcaComp || !wev) { setEvRows(null); return; }
    let cancelled = false;
    setEvRows(null);
    void fetchWcaScrambles(settings.wcaComp).then((rows) => {
      if (!cancelled) setEvRows((rows ?? []).filter((r) => r.event_id === wev));
    });
    return () => { cancelled = true; };
  }, [mode, settings.wcaComp, wev]);

  const rounds = useMemo(
    () => (evRows
      ? [...new Set(evRows.map((r) => r.round_type_id))].sort((a, b) => (ROUND_ORDER[a] ?? 9) - (ROUND_ORDER[b] ?? 9))
      : []),
    [evRows],
  );
  const groups = useMemo(() => {
    if (!evRows) return [];
    const inRound = evRows.filter((r) => !settings.wcaRound || r.round_type_id === settings.wcaRound);
    return [...new Set(inRound.map((r) => r.group_id).filter(Boolean))].sort((a, b) => groupIdxOf(a) - groupIdxOf(b));
  }, [evRows, settings.wcaRound]);
  const hasEvent = evRows === null ? null : evRows.length > 0;

  // 「最优打乱」是跨项目粘滞的设置(默认开),切到不支持最优等态的项目(如魔表)不复位 ——
  // 复位会让默认开的值在逛一次魔表后永久变假。安全性由 wca_pool 保证:specKey/fillComp/fillDate
  // 都用 supportsOptimal(w) 与 spec.optimal 取与,不支持的项目直接忽略该标志,不会把真题过滤成空。

  // Reset round/group when they fall outside the loaded comp's options.
  useEffect(() => {
    if (settings.wcaRound && rounds.length > 0 && !rounds.includes(settings.wcaRound)) {
      updateSettings({ wcaRound: '', wcaGroup: '' });
    }
  }, [rounds, settings.wcaRound, updateSettings]);
  useEffect(() => {
    if (settings.wcaGroup && groups.length > 0 && !groups.includes(settings.wcaGroup)) {
      updateSettings({ wcaGroup: '' });
    }
  }, [groups, settings.wcaGroup, updateSettings]);

  const onPick = (c: Comp) => updateSettings({ wcaComp: c.id, wcaCompName: c.name, wcaCompCountry: c.country, wcaRound: '', wcaGroup: '' });
  const onCompText = (v: string) => {
    // typing/clearing the box; clearing also drops the locked-in comp id.
    updateSettings(v ? { wcaCompName: v } : { wcaComp: '', wcaCompName: '', wcaCompCountry: '', wcaRound: '', wcaGroup: '' });
  };
  const clearComp = () => updateSettings({ wcaComp: '', wcaCompName: '', wcaCompCountry: '', wcaRound: '', wcaGroup: '' });

  // ── 按难度出题(3x3-family;date 随机采样 + comp 单场过滤) ─────────────────
  // 可用方法/阶段来自 steps_layout.json(哪些 (方法,阶段) 已回填);拿不到则回退静态 VARIANT 定义。
  // date 模式服务端 /random 直接筛;comp 模式走 by-difficulty 端点按本场逐 bin 拉(见 wca_pool.fillComp)。
  const canDifficulty = !!wev && DIFFICULTY_EVENTS.has(wev);
  const canMerge = !!wev && MERGE_EVENTS.has(wev);

  // 「难度过滤」和「最优打乱」一样跨项目粘滞:在 3x3 族开了之后切到无难度数据的项目(如 6x6/魔表),
  // 开关本身隐藏(canDifficulty=false),但设置值仍是 true → SoloView 的 wcaSpec.diff 照建 → 服务端拿
  // 3x3 十字步数去筛该项目真题 → 全被过滤成空,误报「该难度组合没有匹配」。开关一消失就顺手复位。
  useEffect(() => {
    if (!canDifficulty && settings.wcaDifficultyOn) updateSettings({ wcaDifficultyOn: false });
  }, [canDifficulty, settings.wcaDifficultyOn, updateSettings]);

  // comp 模式选中比赛后,提前探测该场在难度库有无步数数据(离线管道对新赛滞后)。没有 → 把「难度」开关灰锁,
  // 点击给原因,并让难度过滤对该场旁路(见 SoloView 的 wcaCompUnindexed)。'loading' 期间不灰(乐观)。
  const [compDiffCov, setCompDiffCov] = useState<'loading' | 'ok' | 'none'>('ok');
  useEffect(() => {
    if (mode !== 'comp' || !settings.wcaComp || !canDifficulty || !wev) { setCompDiffCov('ok'); return; }
    const cached = getCompCoverage(settings.wcaComp, wev);
    if (cached !== null) { setCompDiffCov(cached ? 'ok' : 'none'); return; }
    let cancelled = false;
    setCompDiffCov('loading');
    void probeCompCoverage(settings.wcaComp, settings.wcaCompName, wev).then((r) => {
      if (!cancelled) setCompDiffCov(r === false ? 'none' : 'ok'); // null(判不了)→ 不灰
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, settings.wcaComp, wev, canDifficulty]);
  // 灰锁只对「阶段步数」这类方法成立 —— 整体 / 打乱各有自己的数据源,该场有没有回填阶段步数与它们无关。
  const diffLocked = compDiffCov === 'none' && usesStepsIndex(settings.wcaDiffVariant);
  const [showDiffWhy, setShowDiffWhy] = useState(false);
  useEffect(() => { setShowDiffWhy(false); }, [settings.wcaComp, diffLocked]); // 换比赛 / 状态变即收起原因

  const [layout, setLayout] = useState<StepsLayout | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(statsUrl('/stats/scramble/steps/steps_layout.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.variants) setLayout(j as StepsLayout); })
      .catch(() => { /* 未发布 → 回退静态定义 */ });
    return () => { cancelled = true; };
  }, []);

  // 打乱长度直方图(~2KB,同 /scramble/stats 长度 tab):决定「打乱」这一项给不给、滑块端点多少。
  const [eventLengths, setEventLengths] = useState<EventLengthsJson | null>(null);
  useEffect(() => {
    if (!canDifficulty) return;
    let cancelled = false;
    void fetch(statsUrl('/stats/scramble/event_lengths.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.events) setEventLengths(j as EventLengthsJson); })
      .catch(() => { /* 拉不到 → 不给「打乱」这一项 */ });
    return () => { cancelled = true; };
  }, [canDifficulty]);

  // 配色子集:复用 /scramble/stats 的选择器;sel.subsetKey 变化写回 settings(filter 性质)。
  const diffSel = useSubsetSelection('cn', settings.wcaDiffColors);
  useEffect(() => {
    if (diffSel.subsetKey !== settings.wcaDiffColors) updateSettings({ wcaDiffColors: diffSel.subsetKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffSel.subsetKey]);

  // 方法 / 阶段两个下拉与首页「近期打乱」同一套聚合(lib/scramble-variants):方法只出 9 项
  // (块族折成「砖」、eoline 并入「EO」),细分落到阶段下拉。设置里仍存底层数据变体 + 阶段键
  // (= 后端筛选与 distribution 查表的口径),UI 侧按 uiVariantOf 反推当前方法。
  // 「整体」(整解最优 HTM)不在 steps 布局里 —— 它的步数存在另一张表(wca_scramble_optimal.htm,
  // 见 server 的 isWholeSolve),故不看布局;但那张表只灌了同态项目(见 WCA_OPTIMAL_EVENTS,
  // 盲拧/多盲的 WCA 打乱带宽块定向后缀,最优等态不成立)→ 只对这些项目给这一项。
  // 「打乱」(按原打乱招式数取题)同理不看布局,谓词直接落打乱文本(server 的 isLengthFilter);
  // 只对长度真的会变的项目给这一项(定长项目的 counts 只有一个键,筛了没意义)。
  const canWhole = !!wev && WCA_OPTIMAL_EVENTS.has(wev);
  const lenCounts = wev ? eventLengths?.events?.[wev]?.counts : undefined;
  const canLength = Object.keys(lenCounts ?? {}).length > 1;
  // 两个伪方法的「阶段」是同名占位键,布局里当然查不到 —— 不特判会把它们的唯一阶段过滤空,
  // 点了下拉却什么也不发生。
  const hasStage = (dv: string, stage: string) => (
    dv === WHOLE_VARIANT ? canWhole
      : dv === LENGTH_VARIANT ? canLength
        : (layout ? !!layout.variants[dv]?.[stage] : true));
  const hasVariant = (dv: string) => (dv === WHOLE_VARIANT ? canWhole : (layout ? !!layout.variants[dv] : true));
  const variantOpts = useMemo(
    () => [...uiVariantOptions(hasVariant), ...(canLength ? [LENGTH_VARIANT] : [])],
    [layout, canWhole, canLength], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const uiVariant = uiVariantOf(settings.wcaDiffVariant);
  const stagesOfUi = (v: string) => uiStagesOf(v).filter((s) => hasStage(dataVariantOfStage(v, s), s));
  const stageOpts = useMemo(() => stagesOfUi(uiVariant), [layout, uiVariant]); // eslint-disable-line react-hooks/exhaustive-deps
  // 选方法 / 阶段都要连带写回数据变体(聚合方法下,变体由阶段决定)。
  const pickStage = (v: string, s: string) => updateSettings({ wcaDiffVariant: dataVariantOfStage(v, s), wcaDiffStage: s });
  const pickVariant = (v: string) => {
    const s = stagesOfUi(v)[0];
    if (s) pickStage(v, s);
  };

  // 方法切换后阶段不在新方法里 → 回退首个;方法不在可选列表 → 回退首个。
  useEffect(() => {
    if (variantOpts.length && !variantOpts.includes(uiVariant)) pickVariant(variantOpts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantOpts]);
  useEffect(() => {
    if (stageOpts.length && !stageOpts.includes(settings.wcaDiffStage)) pickStage(uiVariant, stageOpts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOpts]);

  // 实际可选步数范围:distribution.json 里当前 (方法,阶段,底色) 直方图的真实 min/max,
  // 用作滑块端点。仅难度过滤开启时惰性拉(~429KB);拉到前 / 缺数据回退静态 [STEP_MIN, STEP_MAX]。
  const [diffDist, setDiffDist] = useState<DiffDistJson | null>(null);
  useEffect(() => {
    if (!(canDifficulty && settings.wcaDifficultyOn) || diffDist) return;
    let cancelled = false;
    void fetch(statsUrl('/stats/scramble/distribution.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.sets) setDiffDist(j as DiffDistJson); })
      .catch(() => { /* 拉不到 → 回退静态 0..14 */ });
    return () => { cancelled = true; };
  }, [canDifficulty, settings.wcaDifficultyOn, diffDist]);

  // 整解(方法 '333')无配色维度,数据落伪子集 'ALL';其余按所选底色子集查直方图。
  const isWhole = settings.wcaDiffVariant === WHOLE_VARIANT;
  // 「打乱」(伪变体)按招式数筛,端点来自长度直方图而非 distribution;同样无底色 / 无阶段。
  const isLength = settings.wcaDiffVariant === LENGTH_VARIANT;
  const effectiveDiffSubset = isWhole ? 'ALL' : diffSel.subsetKey;
  // 长度端点:合并开 → 3x3 族各项目长度直方图取并;否则只看当前项目。
  const lenBounds = useMemo<[number, number] | null>(() => {
    if (!isLength) return null;
    const evs = canMerge && settings.wcaDiffMerged ? [...MERGE_EVENT_LIST] : (wev ? [wev] : []);
    let lo = Infinity;
    let hi = -Infinity;
    for (const e of evs) {
      for (const k of Object.keys(eventLengths?.events?.[e]?.counts ?? {})) {
        const n = Number(k);
        if (!Number.isInteger(n)) continue;
        if (n < lo) lo = n;
        if (n > hi) hi = n;
      }
    }
    return hi >= lo ? [lo, hi] : null;
  }, [isLength, eventLengths, canMerge, settings.wcaDiffMerged, wev]);
  // 端点必须与后端取题池同口径,否则滑杆放得出池子里根本没有的步数(BG 十字 8 步全库只有一条,
  // 且在 333bf —— 练 333 时选 8 必然空手)。合并开 → 3x3 族各项目端点取并(= server 的 FAMILY_333,
  // 不含 333mbf,它不在 steps 表里);合并关 → 只看当前项目自己的 per-event 集。
  const [stepLo, stepHi] = useMemo<[number, number]>(() => {
    if (isLength) return lenBounds ?? [STEP_MIN, STEP_MAX];
    const bounds = (setKey: string): [number, number] | null => {
      const h = diffDist?.sets?.[setKey]?.variants?.[settings.wcaDiffVariant]?.data?.[settings.wcaDiffStage]?.[effectiveDiffSubset];
      if (!h || !Number.isFinite(h.min) || !Number.isFinite(h.max) || h.max < h.min) return null;
      return [h.min, h.max];
    };
    const keys = canMerge && settings.wcaDiffMerged
      ? MERGE_EVENT_LIST.map((e) => `wca_${e}`)
      : [`wca_${wev}`];
    let lo = Infinity;
    let hi = -Infinity;
    for (const k of keys) {
      const b = bounds(k);
      if (!b) continue;
      if (b[0] < lo) lo = b[0];
      if (b[1] > hi) hi = b[1];
    }
    if (hi >= lo) return [lo, hi];
    // per-event 集缺失(旧 distribution.json)→ 退合并池端点,再退静态范围
    return bounds('wca') ?? [STEP_MIN, STEP_MAX];
  }, [diffDist, settings.wcaDiffVariant, settings.wcaDiffStage, effectiveDiffSubset, settings.wcaDiffMerged, canMerge, wev, isLength, lenBounds]);
  // 刻度尽量标全整数;范围宽到标签会重叠时,按 nice 步长(1/2/5/10…)抽稀,始终含两端。
  const stepMarks = useMemo(() => {
    const span = stepHi - stepLo;
    if (span <= 0) return [stepLo];
    const MAX_LABELS = 16;
    const stride = [1, 2, 5, 10, 20, 50].find((s) => Math.floor(span / s) + 1 <= MAX_LABELS) ?? span;
    const marks: number[] = [];
    for (let n = stepLo; n <= stepHi; n += stride) marks.push(n);
    if (marks[marks.length - 1] !== stepHi) marks.push(stepHi);
    return marks;
  }, [stepLo, stepHi]);

  // 步数范围以连续区间 [lo, hi] 表示,落库仍是展开的步数列表(端点 / spec 不变)。
  const diffLo = settings.wcaDiffSteps.length ? settings.wcaDiffSteps[0] : DEFAULT_STEP_RANGE[0];
  const diffHi = settings.wcaDiffSteps.length ? settings.wcaDiffSteps[settings.wcaDiffSteps.length - 1] : DEFAULT_STEP_RANGE[1];
  // 显示时夹进实际范围(切到端点更窄的方法/阶段/底色时即时收拢,滑块不越界)。
  const shownLo = Math.min(Math.max(diffLo, stepLo), stepHi);
  const shownHi = Math.max(Math.min(diffHi, stepHi), stepLo);

  // 滑块 debounce:原生 range 拖动中连续 onChange,直写 settings 会让拖动路径上每个中间区间都
  // 触发出题池重灌(逐值打一发 /random)。拖动期间只更新本地显示,停手 350ms 才落库;卸载前有
  // 未落库的拖动值则立即冲刷(不丢用户最后的选择)。
  const [dragSteps, setDragSteps] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ timer: number | null; pending: [number, number] | null }>({ timer: null, pending: null });
  const updateSettingsRef = useRef(updateSettings);
  updateSettingsRef.current = updateSettings;
  const onStepsDrag = ([a, b]: [number, number]) => {
    setDragSteps([a, b]);
    const d = dragRef.current;
    d.pending = [a, b];
    if (d.timer !== null) window.clearTimeout(d.timer);
    d.timer = window.setTimeout(() => {
      d.timer = null; d.pending = null;
      setDragSteps(null);
      updateSettings({ wcaDiffSteps: stepRange(a, b) });
    }, 350);
  };
  useEffect(() => () => {
    const d = dragRef.current;
    if (d.timer !== null) window.clearTimeout(d.timer);
    if (d.pending) updateSettingsRef.current({ wcaDiffSteps: stepRange(d.pending[0], d.pending[1]) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 难度开启但步数为空(首次开 / 历史遗留)→ 填默认区间,保证滑块与过滤口径一致。
  useEffect(() => {
    if (canDifficulty && settings.wcaDifficultyOn && settings.wcaDiffSteps.length === 0) {
      updateSettings({ wcaDiffSteps: stepRange(...DEFAULT_STEP_RANGE) });
    }
  }, [canDifficulty, settings.wcaDifficultyOn, settings.wcaDiffSteps.length, updateSettings]);
  // 端点收窄后把已存的范围夹回去(持久化,过滤口径与滑块一致)。
  useEffect(() => {
    if (!(canDifficulty && settings.wcaDifficultyOn) || settings.wcaDiffSteps.length === 0) return;
    // 新旧范围完全不相交(十字 0–8 → 整体 12–19 这种跨方法切换)→ 夹只会坍成一个端点(12 步整解全库
    // 才 2 条,一开就「无匹配」)。这种情况放开成整段,让用户自己再缩。
    if (diffHi < stepLo || diffLo > stepHi) { updateSettings({ wcaDiffSteps: stepRange(stepLo, stepHi) }); return; }
    if (shownLo !== diffLo || shownHi !== diffHi) updateSettings({ wcaDiffSteps: stepRange(shownLo, shownHi) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepLo, stepHi]);

  return (
    <div className="wca-src-config">
      <div className="settings-row wca-src-toprow">
        <span className="settings-row-control">
          <select
            className="settings-row-control-select"
            value={mode}
            onChange={(e) => updateSettings({ wcaScrambleMode: e.target.value as 'date' | 'comp' })}
          >
            <option value="comp">{tr({ zh: '比赛', en: 'Comp' })}</option>
            <option value="date">{tr({ zh: '日期', en: 'Date' })}</option>
          </select>
        </span>
        {mode === 'date' && (
          <span className="settings-row-control wca-src-dates">
            <input
              type="date"
              value={settings.wcaDateFrom}
              min={WCA_MIN_DATE}
              max={settings.wcaDateTo || today}
              onChange={(e) => updateSettings({ wcaDateFrom: e.target.value })}
              aria-label={tr({ zh: '起始日期', en: 'From date' })}
            />
            <span className="wca-src-dash">–</span>
            <input
              type="date"
              value={settings.wcaDateTo}
              min={settings.wcaDateFrom || WCA_MIN_DATE}
              max={today}
              onChange={(e) => updateSettings({ wcaDateTo: e.target.value })}
              aria-label={tr({ zh: '结束日期', en: 'To date' })}
            />
          </span>
        )}
        {mode === 'comp' && (
          // 已选中一场:短名不撑满行(不留大片空白把「难度」推到行尾);未选中(搜索框态)仍占满可用宽度。
          <span className={`settings-row-control wca-src-comp-inline${settings.wcaComp ? ' wca-src-comp-inline--picked' : ''}`}>
            <span className="wca-src-comppick">
              {settings.wcaComp ? (
                // 已锁定一场:展示「国旗 + 比赛名(省略号截断)+ 清除」,避免长名溢出。
                <span className="wca-src-comp-selected">
                  <Flag iso2={settings.wcaCompCountry} className="wca-src-comp-flag" />
                  <span className="wca-src-comp-name">{localizeCompName(settings.wcaComp, settings.wcaCompName, isZh)}</span>
                  <ClearButton
                    variant="standalone"
                    onClick={clearComp}
                    isZh={isZh}
                    ariaLabel={tr({ zh: '清除比赛', en: 'Clear competition' })}
                  />
                </span>
              ) : (
                <CompPicker
                  value={settings.wcaCompName}
                  onChange={onCompText}
                  onPick={onPick}
                  isZh={isZh}
                  hideFuture
                />
              )}
            </span>
          </span>
        )}
        {/* 合并:难度筛跨整个 3x3 族取题,与 /scramble/stats 难度 tab 同口径。只在难度开着时有意义,
            故跟着它显示;多盲不在 steps 表里(见 MERGE_EVENTS),对它不给这个开关。 */}
        {canMerge && settings.wcaDifficultyOn && !diffLocked && (
          <span className="settings-row-tight-group">
            <span className="settings-row-label">{tr({ zh: '合并', en: 'Merge' })}</span>
            <PillToggle
              value={settings.wcaDiffMerged}
              onChange={(v) => updateSettings({ wcaDiffMerged: v })}
              ariaLabel={tr({ zh: '合并 3x3 全族真题', en: 'Merge all 3x3-family scrambles' })}
            />
          </span>
        )}
        {canDifficulty && (
          <span className="settings-row-tight-group">
            <span className="settings-row-label">{tr({ zh: '难度', en: 'Difficulty' })}</span>
            <PillToggle
              value={diffLocked ? false : settings.wcaDifficultyOn}
              onChange={(v) => {
                // 灰锁(该场未入库):任何点击/拖动都不切换,只弹出原因说明(拖动多次触发也只是保持展开)。
                if (diffLocked) { setShowDiffWhy(true); return; }
                updateSettings({ wcaDifficultyOn: v });
              }}
              className={diffLocked ? 'pill-toggle--locked' : undefined}
              ariaLabel={tr({ zh: '难度过滤', en: 'Difficulty filter' })}
            />
          </span>
        )}
      </div>

      {diffLocked && showDiffWhy && (
        <p className="wca-src-hint wca-src-warn">
          {tr({ zh: '难度库待更新', en: 'Difficulty index not updated yet' })}
        </p>
      )}

      {/* 难度过滤:date + comp 两模式共用同一组控件(方法/阶段/配色 + 步数范围)。该场未入库时灰锁 → 隐藏。 */}
      {canDifficulty && settings.wcaDifficultyOn && !diffLocked && (
        <div className="wca-src-diff">
          <div className="wca-src-diff-row">
            {/* 整解按整颗魔方的最优步数、「打乱」按招式数,都没有「底色」这一维 → 不给选择器。 */}
            {!isWhole && !isLength && <SubsetColorPicker sel={diffSel} isZh={isZh} />}
            <VariantSelect
              className="settings-row-control-select"
              value={uiVariant}
              options={variantOpts}
              onChange={pickVariant}
              isZh={isZh}
              ariaLabel={tr({ zh: '方法', en: 'Method' })}
            />
            {/* 「打乱」筛的是招式数,没有阶段可选 → 阶段下拉整个不给(占位键与方法同名)。 */}
            {!isLength && (
              <VariantSelect
                className="settings-row-control-select"
                value={settings.wcaDiffStage}
                options={stageOpts}
                onChange={(s) => pickStage(uiVariant, s)}
                isZh={isZh}
                label={stageLabel}
                ariaLabel={tr({ zh: '阶段', en: 'Stage' })}
              />
            )}
          </div>
          <div className="wca-src-steps-range">
            <RangeSlider
              min={stepLo}
              max={stepHi}
              value={dragSteps ?? [shownLo, shownHi]}
              onChange={onStepsDrag}
              marks={stepMarks}
              ariaLabel={isLength ? tr({ zh: '打乱长度范围', en: 'Scramble length range' }) : tr({ zh: '步数范围', en: 'Step range' })}
            />
          </div>
        </div>
      )}

      {mode === 'comp' && (
        <>
          {settings.wcaComp && hasEvent === false && (
            <p className="wca-src-hint wca-src-warn">
              {tr({ zh: '该比赛没有当前项目的打乱,会回退到随机生成。', en: 'This competition has no scrambles for the current event — falls back to generated.' })}
            </p>
          )}

          {settings.wcaComp && hasEvent && (
            <div className="settings-row wca-src-comp-rounds">
              <span className="settings-row-tight-group">
                <span className="settings-row-label">{tr({ zh: '轮次', en: 'Round' })}</span>
                <select
                  className="settings-row-control-select"
                  value={settings.wcaRound}
                  onChange={(e) => updateSettings({ wcaRound: e.target.value, wcaGroup: '' })}
                  aria-label={tr({ zh: '轮次', en: 'Round' })}
                >
                  <option value="">{tr({ zh: '全部', en: 'All' })}</option>
                  {rounds.map((rt) => (
                    <option key={rt} value={rt}>{roundTypeShort(rt, isZh)}</option>
                  ))}
                </select>
              </span>
              <span className="settings-row-tight-group">
                <span className="settings-row-label">{tr({ zh: '组别', en: 'Group' })}</span>
                <select
                  className="settings-row-control-select"
                  value={settings.wcaGroup}
                  onChange={(e) => updateSettings({ wcaGroup: e.target.value })}
                  disabled={groups.length === 0}
                  aria-label={tr({ zh: '组别', en: 'Group' })}
                >
                  <option value="">{tr({ zh: '全部', en: 'All' })}</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{tr({ zh: `${g} 组`, en: `Group ${g}` })}</option>
                  ))}
                </select>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
