'use client';

// Landing "近期打乱" (Recent Scrambles). An event picker on top:
//  - 333 → the rich variant(std/eo/pseudo/...) × metric(cross/xc/...) × bottom-color × move
//    widget, fed by stats/scramble/recent_scrambles.json (Recent333Body).
//  - every other event → simplest scrambles of the latest batch, bucketed by scramble length;
//    222 / pyraminx / skewb also offer a difficulty (whole-solve optimal step) mode. Fed by
//    stats/scramble/recent_scrambles_events.json (RecentEventBody).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MoreToggle from '@/components/MoreToggle';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { SubsetColorPicker, SubsetSwatch, useSubsetSelection, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import { statsUrl } from '@/lib/stats-base';
import { VARIANT_ORDER, stageLabel, BLOCK_DATA_VARIANTS, BLOCK_STAGE_VARIANT } from '@/lib/scramble-variants';
import { VariantSelect } from '@/components/VariantSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { fetchRecentScramblesEvents, type RecentScramblesEventsJson, type RecentScrMeta } from '@/lib/recent-scrambles-events';
import './recent_scrambles.css';
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

// 步数下拉选项标签(zh「N 步」/ en「N」)。tr 包住避免内联 isZh 文案三元。
const stepOptionLabel = (n: number) => tr({ zh: `${n} 步`, en: String(n) });

// Pattern B: English is bare; only Chinese is /zh-prefixed.
const langPrefix = (lang: 'zh' | 'en') => (lang === 'zh' ? '/zh' : '');
const genHref = (lp: string, ci: string) => `${lp}/scramble/gen?comp=${encodeURIComponent(ci)}`;
const analyzerHref = (lp: string, scramble: string) =>
  `${lp}/scramble/analyzer?${new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') })}`;

// 比赛来源行(hero / list 行尾):国旗 + 比赛名 + 项目图标 + 轮次/组别。
function CompSource({ m, lp, isZh, row }: { m: RecentScrMeta | ScrMeta; lp: string; isZh: boolean; row?: boolean }) {
  const iso2 = compFlagIso2(m.ci);
  return (
    <Link href={genHref(lp, m.ci)} prefetch={false} className={row ? 'rs-row-comp' : 'rs-hero-src'}>
      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      <span className={row ? 'rs-row-name' : 'rs-src-comp'}>{localizeCompName(m.ci, m.cn, isZh)}</span>
      <EventIcon event={m.e} className="rs-evt" />
      <span className={row ? 'rs-row-sub' : 'rs-src-meta'}>{compSourceLine(m.r, m.g, m.n, isZh, !!m.x)}</span>
    </Link>
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
  const [expanded, setExpanded] = useState(false);

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

  if (!data || variants.length === 0) return null;

  const hero = entries[0];
  const rest = entries.slice(1);

  return (
    <>
      <div className="rs-head">
        <SubsetColorPicker sel={sel} isZh={isZh} />
        <VariantSelect className="rs-select" value={curVariant} options={variants} onChange={setVariant} isZh={isZh} ariaLabel={tr({ zh: '变体', en: 'Variant' })} />
        {metrics.length > 0 && (
          <VariantSelect className="rs-select" value={curMetric} options={metrics} onChange={setMetric} isZh={isZh} label={stageLabel} ariaLabel={tr({ zh: '类型', en: 'Type' })} />
        )}
        {steps.length > 0 && (
          <select className="rs-select" value={curStep ?? ''} onChange={(e) => setStep(Number(e.target.value))} aria-label={tr({ zh: '步数', en: 'Moves' })}>
            {steps.map((s) => (<option key={s} value={s}>{stepOptionLabel(s)}</option>))}
          </select>
        )}
      </div>

      {hero ? (() => {
        const [id, color] = hero;
        const scramble = data.scr[id] ?? '';
        const m = data.meta[id];
        return (
          <div className="rs-hero">
            <div className="rs-hero-cube">
              <ScramblePreview2D event="333" scramble={scramble} size={78} fullSizeLink linkTitle={tr({ zh: '查看大图', en: 'View full size' })} />
            </div>
            <div className="rs-hero-body">
              <div className="rs-hero-steps">
                <span className="rs-hero-dot" aria-hidden="true"><SubsetSwatch colors={[color]} /></span>
                <b>{curStep}</b>
                <span className="rs-hero-unit">{tr({ zh: '步', en: curStep === 1 ? 'move' : 'moves' })}</span>
                {prob && probHref && (
                  <Link href={probHref} prefetch={false} className="rs-hero-prob" title={tr({ zh: '随机打乱出现此难度的概率,点查看完整分布', en: 'How often a random scramble is this easy — click for the full distribution' })}>
                    ≈ {prob.text}
                  </Link>
                )}
              </div>
              <Link href={analyzerHref(lp, scramble)} prefetch={false} className="rs-hero-scramble">{scramble}</Link>
              {m && <CompSource m={m} lp={lp} isZh={isZh} />}
            </div>
          </div>
        );
      })() : (
        <div className="rs-empty">{tr({ zh: '该组合本批暂无数据', en: 'No data for this combination' })}</div>
      )}

      {rest.length > 0 && (
        <>
          {expanded && (
            <ol className="rs-list">
              {rest.map(([id, color], i) => {
                const m = data.meta[id];
                const scramble = data.scr[id] ?? '';
                return (
                  <li key={id} className="rs-row">
                    <span className="rs-row-rank">{i + 2}</span>
                    <span className="rs-row-dot" aria-hidden="true"><SubsetSwatch colors={[color]} /></span>
                    <div className="rs-row-main">
                      <Link href={analyzerHref(lp, scramble)} prefetch={false} className="rs-row-scramble">{scramble}</Link>
                      {m && <CompSource m={m} lp={lp} isZh={isZh} row />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <MoreToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        </>
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
  const [expanded, setExpanded] = useState(false);

  const curMode: 'difficulty' | 'length' = hasDifficulty ? mode : 'length';
  const bucketMap = curMode === 'difficulty' ? (buckets?.difficulty?.byStep ?? {}) : (buckets?.length ?? {});
  const values = useMemo(() => Object.keys(bucketMap).map(Number).sort((a, b) => a - b), [bucketMap]);
  const curValue = (value != null && values.includes(value)) ? value : (values[0] ?? null);
  const ids = (curValue != null ? bucketMap[String(curValue)] : undefined) ?? [];

  if (!buckets || values.length === 0) {
    return <div className="rs-empty">{tr({ zh: '该项目本批暂无数据', en: 'No recent scrambles for this event' })}</div>;
  }

  // 单位:难度=整解步数(zh '步' / en move(s));长度=打乱长度(sq1 用 twist(s))。
  const enUnit = (v: number | null) => (curMode === 'length' && event === 'sq1')
    ? (v === 1 ? 'twist' : 'twists')
    : (v === 1 ? 'move' : 'moves');

  const hero = ids[0];
  const rest = ids.slice(1);
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

      {hero ? (() => {
        const scramble = scrOf(hero);
        const m = metaOf(hero);
        return (
          <div className="rs-hero">
            <div className="rs-hero-cube">
              <ScramblePreview2D event={event} scramble={scramble} size={78} fullSizeLink linkTitle={tr({ zh: '查看大图', en: 'View full size' })} />
            </div>
            <div className="rs-hero-body">
              <div className="rs-hero-steps">
                <b>{curValue}</b>
                <span className="rs-hero-unit">{tr({ zh: '步', en: enUnit(curValue) })}</span>
              </div>
              <Link href={analyzerHref(lp, scramble)} prefetch={false} className="rs-hero-scramble">{scramble}</Link>
              {m && <CompSource m={m} lp={lp} isZh={isZh} />}
            </div>
          </div>
        );
      })() : null}

      {rest.length > 0 && (
        <>
          {expanded && (
            <ol className="rs-list">
              {rest.slice(0, 4).map((id, i) => {
                const m = metaOf(id);
                const scramble = scrOf(id);
                return (
                  <li key={id} className="rs-row rs-row--nodot">
                    <span className="rs-row-rank">{i + 2}</span>
                    <div className="rs-row-main">
                      <Link href={analyzerHref(lp, scramble)} prefetch={false} className="rs-row-scramble">{scramble}</Link>
                      {m && <CompSource m={m} lp={lp} isZh={isZh} row />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <MoreToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        </>
      )}
    </>
  );
}
