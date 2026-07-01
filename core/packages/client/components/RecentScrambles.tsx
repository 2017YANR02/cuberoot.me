'use client';

// Landing "近期打乱" (Recent Scrambles). An event picker on top:
//  - 333 → the rich variant(std/eo/pseudo/...) × metric(cross/xc/...) × bottom-color × move
//    widget, fed by stats/scramble/recent_scrambles.json (Recent333Body).
//  - every other event → simplest scrambles of the latest batch, bucketed by scramble length;
//    222 / pyraminx / skewb also offer a difficulty (whole-solve optimal step) mode. Fed by
//    stats/scramble/recent_scrambles_events.json (RecentEventBody).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { SubsetColorPicker, SubsetSwatch, useSubsetSelection, type ColorLetter, type ColorMode, type SubsetSelection } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import { statsUrl } from '@/lib/stats-base';
import { VARIANT_ORDER, stageLabel, variantLabel, BLOCK_DATA_VARIANTS, BLOCK_STAGE_VARIANT, isBlockVariant, VARIANT_STAGES } from '@/lib/scramble-variants';
import { VariantSelect } from '@/components/VariantSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { fetchRecentScramblesEvents, type RecentScramblesEventsJson, type RecentScrMeta } from '@/lib/recent-scrambles-events';
import './recent_scrambles.css';
import './scroll_panel.css';
import { tr } from '@/i18n/tr';

interface Props { lang: 'zh' | 'en' }

interface ScrMeta { ci: string; cn: string; cd: string; r: string; g: string; n: number; e: string; x?: 0 | 1 }
interface RecentScramblesJson {
  export_date: string;
  new_count: number;
  scr: Record<string, string>;
  meta: Record<string, ScrMeta>;
  // variant -> metric -> subsetKey -> step(字符串) -> [id, 取最少步的底色字母][]（每桶 ≤12 条）
  rank: Record<string, Record<string, Record<string, Record<string, [string, ColorLetter][]>>>>;
}

// 概率提示数据源 = /scramble/stats 的 distribution.json('wca' 合并池:全部 WCA 三阶打乱)。
interface DistHist { counts: Record<string, number> }
interface DistributionJson {
  sets: Record<string, { variants: Record<string, { data: Record<string, Record<string, DistHist>> }> }>;
}

const METRIC_ORDER = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc', 'fbsquare', 'rouxs1', 'block222', 'block223', 'f2b', 'eo', 'eoline', 'dr'];

// 难度模式的项目(整解最优步数);其余项目只按打乱长度。
const DIFFICULTY_EVENTS = new Set(['222', 'pyram', 'skewb']);

// 紧凑数字(960000→960k)。
function compactNum(n: number): string {
  if (n >= 1e6) { const m = n / 1e6; return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`; }
  if (n >= 1e3) { const k = n / 1e3; return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`; }
  return n.toLocaleString();
}
function formatProb(p: number): string | null {
  if (!(p > 0)) return null;
  if (p < 0.01) {
    const n = 1 / p;
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
    return `1/${compactNum(Math.round(n / mag) * mag)}`;
  }
  return `${(p * 100).toFixed(1)}%`;
}

// 全局最稀有:在本批 rank 的所有 (变体 × 类型 × 底色 × 步数) 桶里,挑 distribution 概率最低的那一格,
// 作为 333 hero 的默认选择(首屏一次性定位,用户手动改过即不再覆盖)。返回 UI 层的 variant/metric。
function findRarestSelection(
  data: RecentScramblesJson,
  dist: DistributionJson,
): { variant: string; metric: string; subsetKey: string; step: number } | null {
  const wcaVars = dist.sets?.wca?.variants;
  if (!wcaVars || !data.rank) return null;
  let best: { variant: string; metric: string; subsetKey: string; step: number; p: number } | null = null;
  for (const dataVariant in data.rank) {
    const distVar = wcaVars[dataVariant];
    if (!distVar) continue;
    const byMetric = data.rank[dataVariant];
    for (const metric in byMetric) {
      const target = stageLabel(metric, false);
      const distStageKey = Object.keys(distVar.data).find((s) => stageLabel(s, false) === target);
      if (!distStageKey) continue;
      const stageData = distVar.data[distStageKey];
      const bySubset = byMetric[metric];
      for (const subsetKey in bySubset) {
        const counts = stageData?.[subsetKey]?.counts;
        if (!counts) continue;
        let total = 0;
        for (const k in counts) total += counts[k];
        if (total <= 0) continue;
        const byStep = bySubset[subsetKey];
        for (const stepStr in byStep) {
          if (!byStep[stepStr]?.length) continue;   // 该步数必须本批真有样例
          const c = counts[stepStr] ?? 0;
          if (c <= 0) continue;
          const p = c / total;
          if (best === null || p < best.p) {
            best = { variant: isBlockVariant(dataVariant) ? 'block' : dataVariant, metric, subsetKey, step: Number(stepStr), p };
          }
        }
      }
    }
  }
  return best ? { variant: best.variant, metric: best.metric, subsetKey: best.subsetKey, step: best.step } : null;
}

// 稀有汇总:概率阈值下拉的候选(p < 选中值)。默认 1/10k。
const RARE_THRESHOLDS = [
  { v: 1e-3, label: '1/1k' },
  { v: 1e-4, label: '1/10k' },
  { v: 1e-5, label: '1/100k' },
];
const RARE_DEFAULT = 1e-4;
const RARE_CAP = 60; // 渲染上限(每张卡含 SVG 预览 + ObjectURL,过多伤性能);超出给提示

interface RareEntry { id: string; uiVariant: string; metric: string; step: number; color: ColorLetter; p: number }

// 横扫本批 rank 的每个 (变体 × 类型 × 底色子集 × 步数) 桶,用 distribution 算概率,收集 p < threshold
// 的全部样例。同一打乱(id)可在多个桶里稀有,按 id 去重,只保留概率最低(最稀有)的那次,
// 结果按概率升序(最稀有在前)。返回 UI 层的 variant(块族归并为 'block')。
function collectRareScrambles(data: RecentScramblesJson, dist: DistributionJson, threshold: number): RareEntry[] {
  const wcaVars = dist.sets?.wca?.variants;
  if (!wcaVars || !data.rank) return [];
  const best = new Map<string, RareEntry>();
  for (const dataVariant in data.rank) {
    const distVar = wcaVars[dataVariant];
    if (!distVar) continue;
    const uiVariant = isBlockVariant(dataVariant) ? 'block' : dataVariant;
    const byMetric = data.rank[dataVariant];
    for (const metric in byMetric) {
      const target = stageLabel(metric, false);
      const distStageKey = Object.keys(distVar.data).find((s) => stageLabel(s, false) === target);
      if (!distStageKey) continue;
      const stageData = distVar.data[distStageKey];
      const bySubset = byMetric[metric];
      for (const subsetKey in bySubset) {
        const counts = stageData?.[subsetKey]?.counts;
        if (!counts) continue;
        let total = 0;
        for (const k in counts) total += counts[k];
        if (total <= 0) continue;
        const byStep = bySubset[subsetKey];
        for (const stepStr in byStep) {
          const entries = byStep[stepStr];
          if (!entries?.length) continue;
          const c = counts[stepStr] ?? 0;
          if (c <= 0) continue;
          const p = c / total;
          if (p >= threshold) continue;
          const step = Number(stepStr);
          for (const [id, color] of entries) {
            const prev = best.get(id);
            if (!prev || p < prev.p) best.set(id, { id, uiVariant, metric, step, color, p });
          }
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => a.p - b.p);
}

// 稀有卡顶标签:变体 + 类型(相同则合一)+ 步数,与下钻视图两个下拉口径一致。
function rarityTag(uiVariant: string, metric: string, step: number, isZh: boolean): string {
  const vl = variantLabel(uiVariant, isZh);
  const sl = stageLabel(metric, isZh);
  const head = vl === sl ? vl : `${vl} ${sl}`;
  return `${head} ${tr({ zh: `${step}步`, en: `${step}f` })}`;
}

// 步数下拉选项标签(zh「N 步」/ en「N」)。tr 包住避免内联 isZh 文案三元。
const stepOptionLabel = (n: number) => tr({ zh: `${n} 步`, en: String(n) });

// Pattern B: English is bare; only Chinese is /zh-prefixed.
const langPrefix = (lang: 'zh' | 'en') => (lang === 'zh' ? '/zh' : '');
const genHref = (lp: string, ci: string) => `${lp}/scramble/gen?comp=${encodeURIComponent(ci)}`;
// (变体, 类型) → analyzer StageSolver 的 method + 阶段索引(深链直达「砖 / F2B」这类视图)。
// 333(整解)无 StageSolver 方法 → null,不附加参数。metric 短键(xc)与阶段全名(xcross)经
// stageLabel 归一后按位匹配。
function stageSolverTarget(uiVariant: string, metric: string): { method: string; stage: number } | null {
  if (uiVariant === '333') return null;
  const stages = VARIANT_STAGES[uiVariant as keyof typeof VARIANT_STAGES];
  if (!stages) return null;
  const target = stageLabel(metric, false);
  const stage = stages.findIndex((s) => stageLabel(s, false) === target);
  return stage >= 0 ? { method: uiVariant, stage } : null;
}
// 底色字母 → StageSolver 6 视角(FACES=[D,U,L,R,F,B])索引。标准配色 U=白 D=黄 F=绿 B=蓝 R=红 L=橙
// (lib/cube-colors),故 Y→0(D) W→1(U) O→2(L) R→3(R) G→4(F) B→5(B)。锁定底色对应的视角用。
const COLOR_FACE_INDEX: Record<ColorLetter, number> = { Y: 0, W: 1, O: 2, R: 3, G: 4, B: 5 };
const analyzerHref = (
  lp: string,
  scramble: string,
  target?: { method: string; stage: number } | null,
  color?: ColorLetter,
) => {
  const p = new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') });
  if (target) {
    if (target.method !== 'std') p.set('method', target.method); // std 是默认 method,省略
    if (target.stage !== 0) p.set('mstage', String(target.stage)); // 0 是默认阶段,省略
    if (color) p.set('face', String(COLOR_FACE_INDEX[color])); // 锁定该底色对应视角(精确展示这条的稀有步数)
  }
  return `${lp}/scramble/analyzer?${p.toString()}`;
};

// 比赛来源行(hero / list 行尾):国旗 + 比赛名 + 项目图标 + 轮次/组别。
function CompSource({ m, lp, isZh, row }: { m: RecentScrMeta | ScrMeta; lp: string; isZh: boolean; row?: boolean }) {
  const iso2 = compFlagIso2(m.ci);
  return (
    <Link href={genHref(lp, m.ci)} prefetch={false} className={row ? 'rs-row-comp' : 'rs-hero-src'}>
      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      <span className={row ? 'rs-row-name' : 'rs-src-comp'}>{localizeCompName(m.ci, m.cn, isZh)}</span>
      <EventIcon event={m.e} className="rs-evt" />
      <span className={row ? 'rs-row-sub' : 'rs-src-meta'}>{compSourceLine(m.r, m.g, m.n, isZh, !!m.x)}</span>
      {m.cd && <span className={row ? 'rs-row-date' : 'rs-src-date'}>{m.cd}</span>}
    </Link>
  );
}

// 统一打乱小卡(2 列网格单元):魔方图 + 打乱记号 + 比赛来源,可选左上角底色点。
// 整卡非单一 <a>(内部「大图 / analyzer / gen」三个并列链接,禁嵌套),与原 hero 同结构。
function ScrambleCard({ event, scramble, m, lp, isZh, ssTarget, color, rarity }: {
  event: string;
  scramble: string;
  m?: RecentScrMeta | ScrMeta;
  lp: string;
  isZh: boolean;
  ssTarget?: { method: string; stage: number } | null;
  color?: ColorLetter;
  // 稀有汇总卡专用:顶部「变体 类型 步数」标签 + 概率徽章(下钻视图不传,概率在头部统一显示)。
  rarity?: { tag: string; prob: string };
}) {
  return (
    <div className="rs-scard">
      <div className="rs-scard-cube">
        <ScramblePreview2D event={event} scramble={scramble} size={58} fullSizeLink linkTitle={tr({ zh: '查看大图', en: 'View full size' })} />
        {color && <span className="rs-scard-dot" aria-hidden="true"><SubsetSwatch colors={[color]} /></span>}
      </div>
      <div className="rs-scard-body">
        {rarity && (
          <div className="rs-scard-rarity">
            <span className="rs-scard-rtag">{rarity.tag}</span>
            <span className="rs-scard-rprob">≈ {rarity.prob}</span>
          </div>
        )}
        <Link href={analyzerHref(lp, scramble, ssTarget, color)} prefetch={false} className="rs-scard-scramble">{scramble}</Link>
        {m && <CompSource m={m} lp={lp} isZh={isZh} row />}
      </div>
    </div>
  );
}

export default function RecentScrambles({ lang }: Props) {
  const isZh = lang === 'zh';
  const lp = langPrefix(lang);
  const [data, setData] = useState<RecentScramblesJson | null>(null);
  const [dist, setDist] = useState<DistributionJson | null>(null);
  const [eventsJson, setEventsJson] = useState<RecentScramblesEventsJson | null>(null);
  const [event, setEvent] = useState('333');

  // 异步加载 comp-country 索引,完成后 bump version 触发重渲染拿比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      fetch(statsUrl('/stats/scramble/recent_scrambles.json'), { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: RecentScramblesJson | null) => { if (on) setData(j); })
        .catch(() => { if (on) setData(null); });
      fetch(statsUrl('/stats/scramble/distribution.json') + '?v=20260614opt')
        .then((r) => (r.ok ? r.json() : null))
        .then((j: DistributionJson | null) => { if (on) setDist(j); })
        .catch(() => { if (on) setDist(null); });
      void fetchRecentScramblesEvents().then((j) => { if (on) setEventsJson(j); });
    };
    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: (id: number) => void };
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(kick, { timeout: 2000 });
    else timeoutId = setTimeout(kick, 200);
    return () => {
      on = false;
      if (idleId !== null) w.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  // 333 是否有数据(本批含可展示的变体)。
  const has333 = useMemo(() => {
    if (!data || data.new_count === 0) return false;
    return VARIANT_ORDER.some((v) => {
      if (v === '333') return true; // 占位恒列
      const vars = v === 'block' ? BLOCK_DATA_VARIANTS : [v];
      return vars.some((dv) => {
        const r = data.rank?.[dv];
        return r && Object.values(r).some((byColor) => Object.values(byColor).some((byStep) => Object.keys(byStep).length > 0));
      });
    });
  }, [data]);

  // 可选项目 = 有数据的非 333 项目 ∪ (333 有数据则含 333)。
  const availableEvents = useMemo(() => {
    const s = new Set<string>();
    if (has333) s.add('333');
    if (eventsJson) for (const [ev, b] of Object.entries(eventsJson.events)) {
      if (Object.keys(b.length).length > 0 || (b.difficulty && Object.keys(b.difficulty.byStep).length > 0)) s.add(ev);
    }
    return s;
  }, [has333, eventsJson]);

  // 数据未到齐 / 无任何可展示项目时不渲染(保持原行为)。
  if (data === null && eventsJson === null) return null;
  if (availableEvents.size === 0) return null;

  const curEvent = availableEvents.has(event) ? event : (availableEvents.has('333') ? '333' : [...availableEvents][0]);

  return (
    <div className="recent-scrambles">
      <div className="rs-topbar">
        <span className="rs-title">{tr({ zh: '近期打乱', en: 'Recent Scrambles' })}</span>
      </div>
      <WcaEventSelector
        availableEvents={availableEvents}
        selectedEvent={curEvent}
        onSelect={setEvent}
        isZh={isZh}
        onlyAvailable
      />
      {curEvent === '333'
        ? <Recent333Body data={data} dist={dist} isZh={isZh} lp={lp} />
        : <RecentEventBody event={curEvent} json={eventsJson} isZh={isZh} lp={lp} />}
    </div>
  );
}

// ============================ 333:富控件(变体 × 类型 × 底色 × 步数)============================
function Recent333Body({ data, dist, isZh, lp }: { data: RecentScramblesJson | null; dist: DistributionJson | null; isZh: boolean; lp: string }) {
  const [variant, setVariant] = useState('std');
  const [metric, setMetric] = useState('cross');
  const [step, setStep] = useState<number | null>(null);
  const sel = useSubsetSelection('dual');
  // 视图:'type' 按 变体/类型/底色/步数 下钻单桶;'rare' 横扫全部组合,列出概率 < threshold 的稀有打乱。
  const [mode, setMode] = useState<'type' | 'rare'>('type');
  const [threshold, setThreshold] = useState(RARE_DEFAULT);

  // 首屏一次性把默认选择定位到本批全局概率最低(最稀有)的那一格;用户手动改过任一选择器即不再覆盖。
  const pickedRef = useRef(false);
  const touchedRef = useRef(false);
  useEffect(() => {
    if (pickedRef.current || touchedRef.current || !data || !dist) return;
    const best = findRarestSelection(data, dist);
    if (!best) return;
    pickedRef.current = true;
    setVariant(best.variant);
    setMetric(best.metric);
    setStep(best.step);
    sel.selectByKey(best.subsetKey);
  }, [data, dist, sel]);

  // 包一层选择器,记录用户是否手动交互过(防 auto-pick 在数据迟到时覆盖用户已改的选择)。
  const markTouched = () => { touchedRef.current = true; };
  const pickerSel: SubsetSelection = {
    ...sel,
    setColorMode: (m: ColorMode) => { markTouched(); sel.setColorMode(m); },
    selectOption: (id: string) => { markTouched(); sel.selectOption(id); },
  };

  const hasData = (v: string) => {
    const r = data?.rank?.[v];
    if (!r) return false;
    return Object.values(r).some((byColor) => Object.values(byColor).some((byStep) => Object.keys(byStep).length > 0));
  };
  const variants = useMemo(() => VARIANT_ORDER.filter((v) =>
    v === '333' ? true : v === 'block' ? BLOCK_DATA_VARIANTS.some(hasData) : hasData(v),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [data]);

  const curVariant = (variants as string[]).includes(variant) ? variant : (variants[0] ?? 'std');
  const metrics = useMemo(() => {
    if (curVariant === 'block') {
      return METRIC_ORDER.filter((m) => {
        const dv = BLOCK_STAGE_VARIANT[m];
        return dv !== undefined && m in (data?.rank?.[dv] ?? {});
      });
    }
    const r = data?.rank?.[curVariant];
    return r ? METRIC_ORDER.filter((m) => m in r) : [];
  }, [data, curVariant]);
  const curMetric = metrics.includes(metric) ? metric : (metrics[0] ?? 'cross');
  const dataVariant = curVariant === 'block' ? (BLOCK_STAGE_VARIANT[curMetric] ?? '123') : curVariant;
  const byStep = data?.rank?.[dataVariant]?.[curMetric]?.[sel.subsetKey];
  const steps = useMemo(() => Object.keys(byStep ?? {}).map(Number).sort((a, b) => a - b), [byStep]);
  const curStep = (step != null && steps.includes(step)) ? step : (steps[0] ?? null);
  const entries = (curStep != null ? byStep?.[String(curStep)] : undefined) ?? [];
  // 当前桶的所有条目同属一个 (变体, 类型),共享同一个 StageSolver 深链目标。
  const ssTarget = stageSolverTarget(curVariant, curMetric);

  const distVar = dist?.sets?.wca?.variants?.[dataVariant];
  const distStageKey = useMemo(() => {
    if (!distVar) return null;
    const target = stageLabel(curMetric, false);
    return Object.keys(distVar.data).find((s) => stageLabel(s, false) === target) ?? null;
  }, [distVar, curMetric]);
  const prob = useMemo(() => {
    if (curStep == null || !distVar || !distStageKey) return null;
    const counts = distVar.data[distStageKey]?.[sel.subsetKey]?.counts;
    if (!counts) return null;
    let total = 0;
    for (const k in counts) total += counts[k];
    const c = counts[String(curStep)] ?? 0;
    if (total <= 0 || c <= 0) return null;
    const text = formatProb(c / total);
    return text ? { text, stageKey: distStageKey } : null;
  }, [curStep, distVar, distStageKey, sel.subsetKey]);

  const probHref = useMemo(() => {
    if (!prob) return null;
    const p = new URLSearchParams();
    if (dataVariant !== 'std') p.set('variant', dataVariant);
    if (prob.stageKey !== 'cross') p.set('stage', prob.stageKey);
    if (sel.subsetKey !== 'BGORWY') p.set('colors', sel.subsetKey);
    const qs = p.toString();
    return `${lp}/scramble/stats${qs ? `?${qs}` : ''}`;
  }, [prob, dataVariant, sel.subsetKey, lp]);

  // 稀有汇总:横扫全部组合,概率 < threshold 的去重打乱(最稀有在前)。仅 rare 模式计算。
  const rare = useMemo(
    () => (mode === 'rare' && data && dist ? collectRareScrambles(data, dist, threshold) : []),
    [mode, data, dist, threshold],
  );

  if (!data || variants.length === 0) return null;

  return (
    <>
      <div className="rs-head">
        <PillToggle
          value={mode === 'rare'}
          onChange={(v) => setMode(v ? 'rare' : 'type')}
          offLabel={tr({ zh: '按类型', en: 'By type' })}
          onLabel={tr({ zh: '稀有', en: 'Rare' })}
          ariaLabel={tr({ zh: '视图', en: 'View' })}
        />
        {mode === 'rare' ? (
          <select
            className="rs-select"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label={tr({ zh: '概率阈值', en: 'Probability threshold' })}
            title={tr({ zh: '列出概率低于此值的近期打乱', en: 'List recent scrambles rarer than this' })}
          >
            {RARE_THRESHOLDS.map((t) => (
              <option key={t.label} value={t.v}>{`< ${t.label}`}</option>
            ))}
          </select>
        ) : (<>
        <SubsetColorPicker sel={pickerSel} isZh={isZh} />
        <VariantSelect className="rs-select" value={curVariant} options={variants} onChange={(v) => { markTouched(); setVariant(v); }} isZh={isZh} ariaLabel={tr({ zh: '变体', en: 'Variant' })} />
        {metrics.length > 0 && (
          <VariantSelect className="rs-select" value={curMetric} options={metrics} onChange={(v) => { markTouched(); setMetric(v); }} isZh={isZh} label={stageLabel} ariaLabel={tr({ zh: '类型', en: 'Type' })} />
        )}
        {steps.length > 0 && (
          <select className="rs-select" value={curStep ?? ''} onChange={(e) => { markTouched(); setStep(Number(e.target.value)); }} aria-label={tr({ zh: '步数', en: 'Moves' })}>
            {steps.map((s) => (<option key={s} value={s}>{stepOptionLabel(s)}</option>))}
          </select>
        )}
        {prob && probHref && (
          <Link href={probHref} prefetch={false} className="rs-prob" title={tr({ zh: '随机打乱出现此难度的概率,点查看完整分布', en: 'How often a random scramble is this easy — click for the full distribution' })}>
            ≈ {prob.text}
          </Link>
        )}
        </>)}
      </div>

      {mode === 'rare' ? (
        rare.length > 0 ? (
          <>
            <div className="rs-cards scroll-panel">
              {rare.slice(0, RARE_CAP).map((r) => (
                <ScrambleCard
                  key={r.id}
                  event="333"
                  scramble={data.scr[r.id] ?? ''}
                  m={data.meta[r.id]}
                  lp={lp}
                  isZh={isZh}
                  ssTarget={stageSolverTarget(r.uiVariant, r.metric)}
                  color={r.color}
                  rarity={{ tag: rarityTag(r.uiVariant, r.metric, r.step, isZh), prob: formatProb(r.p) ?? '' }}
                />
              ))}
            </div>
            {rare.length > RARE_CAP && (
              <div className="rs-rare-more">{tr({ zh: `仅显示最稀有的 ${RARE_CAP} 条(共 ${rare.length} 条)`, en: `Showing the ${RARE_CAP} rarest of ${rare.length}` })}</div>
            )}
          </>
        ) : (
          <div className="rs-empty">{tr({ zh: '本批暂无低于该概率的打乱', en: 'No scrambles below this probability in this batch' })}</div>
        )
      ) : entries.length > 0 ? (
        <div className="rs-cards scroll-panel">
          {entries.slice(0, 12).map(([id, color]) => (
            <ScrambleCard key={id} event="333" scramble={data.scr[id] ?? ''} m={data.meta[id]} lp={lp} isZh={isZh} ssTarget={ssTarget} color={color} />
          ))}
        </div>
      ) : (
        <div className="rs-empty">{tr({ zh: '该组合本批暂无数据', en: 'No data for this combination' })}</div>
      )}
    </>
  );
}

// ============================ 其他项目:长度(全项目)+ 难度(222/金字塔/斜转)============================
function RecentEventBody({ event, json, isZh, lp }: { event: string; json: RecentScramblesEventsJson | null; isZh: boolean; lp: string }) {
  const buckets = json?.events?.[event];
  const hasDifficulty = !!(buckets?.difficulty && DIFFICULTY_EVENTS.has(event) && Object.keys(buckets.difficulty.byStep).length > 0);
  const [mode, setMode] = useState<'difficulty' | 'length'>('difficulty');
  const [value, setValue] = useState<number | null>(null);

  const curMode: 'difficulty' | 'length' = hasDifficulty ? mode : 'length';
  const bucketMap = curMode === 'difficulty' ? (buckets?.difficulty?.byStep ?? {}) : (buckets?.length ?? {});
  const values = useMemo(() => Object.keys(bucketMap).map(Number).sort((a, b) => a - b), [bucketMap]);
  const curValue = (value != null && values.includes(value)) ? value : (values[0] ?? null);
  const ids = (curValue != null ? bucketMap[String(curValue)] : undefined) ?? [];

  if (!buckets || values.length === 0) {
    return <div className="rs-empty">{tr({ zh: '该项目本批暂无数据', en: 'No recent scrambles for this event' })}</div>;
  }

  const scrOf = (id: string) => json?.scr?.[id] ?? '';
  const metaOf = (id: string) => json?.meta?.[id];

  return (
    <>
      <div className="rs-head">
        {hasDifficulty && (
          <PillToggle
            value={curMode === 'length'}
            onChange={(v) => { setMode(v ? 'length' : 'difficulty'); setValue(null); }}
            offLabel={tr({ zh: '难度', en: 'Difficulty' })}
            onLabel={tr({ zh: '打乱长度', en: 'Length' })}
            ariaLabel={tr({ zh: '维度', en: 'Dimension' })}
          />
        )}
        <select className="rs-select" value={curValue ?? ''} onChange={(e) => setValue(Number(e.target.value))} aria-label={curMode === 'difficulty' ? tr({ zh: '难度', en: 'Difficulty' }) : tr({ zh: '长度', en: 'Length' })}>
          {values.map((v) => (<option key={v} value={v}>{stepOptionLabel(v)}</option>))}
        </select>
      </div>

      {ids.length > 0 ? (
        <div className="rs-cards scroll-panel">
          {ids.slice(0, 12).map((id) => (
            <ScrambleCard key={id} event={event} scramble={scrOf(id)} m={metaOf(id)} lp={lp} isZh={isZh} />
          ))}
        </div>
      ) : null}
    </>
  );
}
