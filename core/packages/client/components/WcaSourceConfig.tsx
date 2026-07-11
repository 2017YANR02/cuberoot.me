'use client';

/**
 * WcaSourceConfig — settings sub-panel shown when scrambleSource === 'wca'.
 * Lets the user pick HOW real WCA scrambles are drawn:
 *   - 'date': uniformly random across all official scrambles in a date range.
 *   - 'comp': one specific competition, optionally narrowed to a round / group.
 * Writes its state into TimerSettings; the wca_pool reads those to fetch.
 */
import { useEffect, useMemo, useState } from 'react';
import { CompPicker } from '@/components/CompPicker';
import { ClearButton } from '@/components/ClearButton';
import PillToggle from '@/components/PillToggle/PillToggle';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import type { Comp } from '@/lib/comp-search';
import { fetchWcaScrambles, type WcaScrambleRow } from '@/lib/wca-results-api';
import { roundTypeShort } from '@/lib/comp-schedule';
import { ROUND_ORDER } from '@/lib/wca-round-meta';
import { wcaEventId } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import { VariantSelect } from '@/components/VariantSelect';
import { RangeSlider } from '@/components/RangeSlider/RangeSlider';
import { useSubsetSelection, SubsetColorPicker } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { stageLabel, VARIANT_ORDER, VARIANT_STAGES, type ScrambleVariant } from '@/lib/scramble-variants';
import { statsUrl } from '@/lib/stats-base';
import { tr } from '@/i18n/tr';
import './wca-source.css';

// WCA history floor (WC1982) — see CLAUDE.md. No scrambles exist before it.
const WCA_MIN_DATE = '1982-06-05';

// 难度过滤只适用 3x3-family(随机态打乱,有十字/方法步数);其余项目无此数据。
const DIFFICULTY_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf']);
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

// 同态项目:打乱可由 God's-number 最优等态打乱作真题的等价替身(同一魔方态,更短)。
// 3x3 纯面转族(333/oh/ft/fm)+ 二阶/金字塔/斜转(各自精确最优 solver)。
// 盲拧/多盲带宽块定向(本地求解的是剥定向后的态,非同态)、sq1(近最优,无 solver 解列)、
// 魔表/五魔(无 solver)都没有最优打乱数据。
const OPTIMAL_EVENTS = new Set(['333', '333oh', '333ft', '333fm', '222', 'pyram', 'skewb']);

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
  autoMarkWcaScramble: boolean;
}

interface Props {
  isZh: boolean;
  event: EventId;
  settings: WcaSourceSettings;
  updateSettings: (patch: Partial<WcaSourceSettings>) => void;
  /** 自动打卡(做完标记为「做过」)只对会记成绩的计时器有意义;分析器等场景传 false 隐藏。 */
  showAutoMark?: boolean;
}

export default function WcaSourceConfig({ isZh, event, settings, updateSettings, showAutoMark = true }: Props) {
  const wev = wcaEventId(event);
  const hasOptimal = !!wev && OPTIMAL_EVENTS.has(wev); // 同态项目才显示「最优打乱」开关
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
    return [...new Set(inRound.map((r) => r.group_id).filter(Boolean))].sort();
  }, [evRows, settings.wcaRound]);
  const hasEvent = evRows === null ? null : evRows.length > 0;

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

  // ── 按难度出题(date 模式 + 3x3-family) ────────────────────────────────
  // 可用方法/阶段来自 steps_layout.json(哪些 (方法,阶段) 已回填);拿不到则回退静态 VARIANT 定义。
  const canDifficulty = mode === 'date' && !!wev && DIFFICULTY_EVENTS.has(wev);
  const [layout, setLayout] = useState<StepsLayout | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(statsUrl('/stats/scramble/steps/steps_layout.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.variants) setLayout(j as StepsLayout); })
      .catch(() => { /* 未发布 → 回退静态定义 */ });
    return () => { cancelled = true; };
  }, []);

  // 配色子集:复用 /scramble/stats 的选择器;sel.subsetKey 变化写回 settings(filter 性质)。
  const diffSel = useSubsetSelection('cn', settings.wcaDiffColors);
  useEffect(() => {
    if (diffSel.subsetKey !== settings.wcaDiffColors) updateSettings({ wcaDiffColors: diffSel.subsetKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffSel.subsetKey]);

  const orderIdx = (k: string) => { const i = (VARIANT_ORDER as readonly string[]).indexOf(k); return i < 0 ? 999 : i; };
  const variantOpts = useMemo(() => {
    const keys = layout
      ? Object.keys(layout.variants)
      : (VARIANT_ORDER as readonly string[]).filter((v) => (VARIANT_STAGES[v as ScrambleVariant]?.length ?? 0) > 0);
    return [...keys].sort((a, b) => orderIdx(a) - orderIdx(b));
  }, [layout]);
  const stageOpts = useMemo(() => {
    if (layout?.variants[settings.wcaDiffVariant]) return Object.keys(layout.variants[settings.wcaDiffVariant]);
    return VARIANT_STAGES[settings.wcaDiffVariant as ScrambleVariant] ?? [];
  }, [layout, settings.wcaDiffVariant]);

  // 方法切换后阶段不在新方法里 → 回退首个;方法不在可选列表 → 回退首个。
  useEffect(() => {
    if (variantOpts.length && !variantOpts.includes(settings.wcaDiffVariant)) updateSettings({ wcaDiffVariant: variantOpts[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantOpts]);
  useEffect(() => {
    if (stageOpts.length && !stageOpts.includes(settings.wcaDiffStage)) updateSettings({ wcaDiffStage: stageOpts[0] });
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
  const effectiveDiffSubset = settings.wcaDiffVariant === '333' ? 'ALL' : diffSel.subsetKey;
  const [stepLo, stepHi] = useMemo<[number, number]>(() => {
    const h = diffDist?.sets?.wca?.variants?.[settings.wcaDiffVariant]?.data?.[settings.wcaDiffStage]?.[effectiveDiffSubset];
    if (h && Number.isFinite(h.min) && Number.isFinite(h.max) && h.max >= h.min) return [h.min, h.max];
    return [STEP_MIN, STEP_MAX];
  }, [diffDist, settings.wcaDiffVariant, settings.wcaDiffStage, effectiveDiffSubset]);
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

  // 难度开启但步数为空(首次开 / 历史遗留)→ 填默认区间,保证滑块与过滤口径一致。
  useEffect(() => {
    if (canDifficulty && settings.wcaDifficultyOn && settings.wcaDiffSteps.length === 0) {
      updateSettings({ wcaDiffSteps: stepRange(...DEFAULT_STEP_RANGE) });
    }
  }, [canDifficulty, settings.wcaDifficultyOn, settings.wcaDiffSteps.length, updateSettings]);
  // 端点收窄后把已存的范围夹回去(持久化,过滤口径与滑块一致)。
  useEffect(() => {
    if (!(canDifficulty && settings.wcaDifficultyOn) || settings.wcaDiffSteps.length === 0) return;
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
            <option value="date">{tr({ zh: '日期', en: 'Date' })}</option>
            <option value="comp">{tr({ zh: '比赛', en: 'Comp' })}</option>
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
          <span className="settings-row-control wca-src-comp-inline">
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
        {hasOptimal && (
          <span className="settings-row-tight-group">
            <span className="settings-row-label">{tr({ zh: '最优', en: 'Optimal' })}</span>
            <PillToggle
              value={settings.wcaUseOptimal}
              onChange={(v) => updateSettings({ wcaUseOptimal: v })}
            />
          </span>
        )}
        {canDifficulty && (
          <span className="settings-row-tight-group">
            <span className="settings-row-label">{tr({ zh: '难度', en: 'Difficulty' })}</span>
            <PillToggle
              value={settings.wcaDifficultyOn}
              onChange={(v) => updateSettings({ wcaDifficultyOn: v })}
            />
          </span>
        )}
      </div>

      {mode === 'date' ? (
        <>
          {canDifficulty && (
            <>
              {settings.wcaDifficultyOn && (
                <div className="wca-src-diff">
                  <div className="wca-src-diff-row">
                    <SubsetColorPicker sel={diffSel} isZh={isZh} />
                    <VariantSelect
                      className="settings-row-control-select"
                      value={settings.wcaDiffVariant}
                      options={variantOpts}
                      onChange={(v) => updateSettings({ wcaDiffVariant: v })}
                      isZh={isZh}
                      ariaLabel={tr({ zh: '方法', en: 'Method' })}
                    />
                    <VariantSelect
                      className="settings-row-control-select"
                      value={settings.wcaDiffStage}
                      options={stageOpts}
                      onChange={(s) => updateSettings({ wcaDiffStage: s })}
                      isZh={isZh}
                      label={stageLabel}
                      ariaLabel={tr({ zh: '阶段', en: 'Stage' })}
                    />
                  </div>
                  <div className="wca-src-steps-range">
                    <RangeSlider
                      min={stepLo}
                      max={stepHi}
                      value={[shownLo, shownHi]}
                      onChange={([a, b]) => updateSettings({ wcaDiffSteps: stepRange(a, b) })}
                      marks={stepMarks}
                      ariaLabel={tr({ zh: '步数范围', en: 'Step range' })}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {settings.wcaComp && hasEvent === false && (
            <p className="wca-src-hint wca-src-warn">
              {tr({ zh: '该比赛没有当前项目的打乱,会回退到随机生成。', en: 'This competition has no scrambles for the current event — falls back to generated.' })}
            </p>
          )}

          {settings.wcaComp && hasEvent && (
            <>
              <div className="settings-row">
                <span className="settings-row-label">{tr({ zh: '轮次', en: 'Round' })}</span>
                <span className="settings-row-control">
                  <select
                    className="settings-row-control-select"
                    value={settings.wcaRound}
                    onChange={(e) => updateSettings({ wcaRound: e.target.value, wcaGroup: '' })}
                  >
                    <option value="">{tr({ zh: '全部轮次', en: 'All rounds' })}</option>
                    {rounds.map((rt) => (
                      <option key={rt} value={rt}>{roundTypeShort(rt, isZh)}</option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">{tr({ zh: '组别', en: 'Group' })}</span>
                <span className="settings-row-control">
                  <select
                    className="settings-row-control-select"
                    value={settings.wcaGroup}
                    onChange={(e) => updateSettings({ wcaGroup: e.target.value })}
                    disabled={groups.length === 0}
                  >
                    <option value="">{tr({ zh: '全部组别', en: 'All groups' })}</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>{isZh ? `${g} 组` : `Group ${g}`}</option>
                    ))}
                  </select>
                </span>
              </div>
            </>
          )}
        </>
      )}

      {showAutoMark && (
        <>
          <div className="settings-row wca-src-automark">
            <span className="settings-row-label">{tr({ zh: '自动打卡', en: 'Auto-mark done'
            })}</span>
            <span className="settings-row-control">
              <PillToggle
                value={settings.autoMarkWcaScramble}
                onChange={(v) => updateSettings({ autoMarkWcaScramble: v })}
              />
            </span>
          </div>
          <p className="wca-src-hint">
            {tr({ zh: '做完一把后自动把这条真实打乱标记为「做过」(公开,带成绩),省去每把手动点击。需登录。', en: 'After each solve, auto-mark this real scramble as done (public, with your time) — no manual click per solve. Sign-in required.'
            })}
          </p>
        </>
      )}
    </div>
  );
}
