'use client';

// Landing "今日神打" (Today's Easiest) — the fewest-move scrambles of the latest
// export batch, sliceable by variant (std/eo/pseudo/...) × metric (cross/xc/...) ×
// bottom color. Data: stats/scramble/daily_god.json (built by scramble-stats-build
// build:daily-god, refreshed by the cross-stats pipeline). 1 hero card + top-5 list.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { SubsetColorPicker, SubsetSwatch, useSubsetSelection } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { localizeCompName } from '@/lib/comp-localize';
import { roundTypeName } from '@/lib/comp-schedule';
import './daily_god.css';

interface Props { lang: 'zh' | 'en' }

type Entry = [string, number]; // [scrambleId, steps]
interface ScrMeta { ci: string; cn: string; cd: string; r: string; g: string; n: number; e: string }
interface DailyGodJson {
  export_date: string;
  new_count: number;
  scr: Record<string, string>;
  meta: Record<string, ScrMeta>;
  rank: Record<string, Record<string, Record<string, Entry[]>>>;
}

const VARIANT_ORDER = ['std', 'pseudo', 'pair', 'pseudo_pair', 'eo', 'f2leo', 'pseudo_f2leo'];
const VARIANT_LABEL: Record<string, { zh: string; en: string }> = {
  std: { zh: '标准', en: 'Standard' },
  eo: { zh: 'EO', en: 'EO' },
  pseudo: { zh: '伪', en: 'Pseudo' },
  pseudo_pair: { zh: '伪基态', en: 'Pseudo Pair' },
  pair: { zh: '基态', en: 'Pair' },
  f2leo: { zh: 'F2LEO', en: 'F2LEO' },
  pseudo_f2leo: { zh: '伪 F2LEO', en: 'Pseudo F2LEO' },
};

const METRIC_ORDER = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc'];
const METRIC_LABEL: Record<string, { zh: string; en: string }> = {
  cross: { zh: '十字', en: 'Cross' },
  xc: { zh: 'XCross', en: 'XCross' },
  xxc: { zh: 'XXCross', en: 'XXCross' },
  xxxc: { zh: 'XXXCross', en: 'XXXCross' },
  xxxxc: { zh: 'XXXXCross', en: 'XXXXCross' },
};

function sourceLine(m: ScrMeta, isZh: boolean): string {
  const round = roundTypeName(m.r, isZh);
  const group = isZh ? `${m.g} 组` : `Group ${m.g}`;
  const attempt = isZh ? `第 ${m.n} 把` : `Solve ${m.n}`;
  return `${round}  ${group}  ${attempt}`;
}

export default function DailyGod({ lang }: Props) {
  const isZh = lang === 'zh';
  const [data, setData] = useState<DailyGodJson | null>(null);
  const [variant, setVariant] = useState('std');
  const [metric, setMetric] = useState('cross');
  const sel = useSubsetSelection('cn');
  const [expanded, setExpanded] = useState(false);

  // 点比赛名跳 /scramble/gen?comp=<id>(comp tab 直链加载该比赛打乱),不是 /wca/comp。
  const genHref = (ci: string) => `/${lang}/scramble/gen?comp=${encodeURIComponent(ci)}`;

  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      fetch('/stats/scramble/daily_god.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: DailyGodJson | null) => { if (on) setData(j); })
        .catch(() => { if (on) setData(null); });
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

  // variants that actually carry data this batch (a variant with all-empty rows is hidden)
  const variants = useMemo(() => VARIANT_ORDER.filter((v) => {
    const r = data?.rank?.[v];
    if (!r) return false;
    return Object.values(r).some((byColor) => Object.values(byColor).some((arr) => arr.length > 0));
  }), [data]);

  // clamp selections to what's available (variant switch may drop a metric, etc.)
  const curVariant = variants.includes(variant) ? variant : (variants[0] ?? 'std');
  const metrics = useMemo(() => {
    const r = data?.rank?.[curVariant];
    return r ? METRIC_ORDER.filter((m) => m in r) : [];
  }, [data, curVariant]);
  const curMetric = metrics.includes(metric) ? metric : (metrics[0] ?? 'cross');
  const entries: Entry[] = data?.rank?.[curVariant]?.[curMetric]?.[sel.subsetKey] ?? [];

  if (!data || data.new_count === 0 || variants.length === 0) return null;

  const hero = entries[0];
  const rest = entries.slice(1);

  return (
    <div className="daily-god">
      <div className="daily-god-head">
        <span className="daily-god-title">{isZh ? '今日神打' : "Today's Easiest"}</span>
        <span className="daily-god-date">{data.export_date}</span>
        <select
          className="daily-god-select"
          value={curVariant}
          onChange={(e) => setVariant(e.target.value)}
          aria-label={isZh ? '变体' : 'Variant'}
        >
          {variants.map((v) => (
            <option key={v} value={v}>{VARIANT_LABEL[v]?.[isZh ? 'zh' : 'en'] ?? v}</option>
          ))}
        </select>
        <select
          className="daily-god-select"
          value={curMetric}
          onChange={(e) => setMetric(e.target.value)}
          aria-label={isZh ? '类型' : 'Type'}
        >
          {metrics.map((m) => (
            <option key={m} value={m}>{METRIC_LABEL[m]?.[isZh ? 'zh' : 'en'] ?? m}</option>
          ))}
        </select>
        <SubsetColorPicker sel={sel} isZh={isZh} />
      </div>

      {hero ? (() => {
        const [id, steps] = hero;
        const scramble = data.scr[id] ?? '';
        const m = data.meta[id];
        return (
          <div className="dg-hero">
            <div className="dg-hero-cube">
              <ScramblePreview2D event="333" scramble={scramble} size={78} fullSizeLink linkTitle={isZh ? '查看大图' : 'View full size'} />
            </div>
            <div className="dg-hero-body">
              <div className="dg-hero-steps">
                <span className="dg-hero-dot" aria-hidden="true"><SubsetSwatch colors={sel.selectedColors} /></span>
                <b>{steps}</b>
                <span className="dg-hero-unit">{isZh ? '步' : steps === 1 ? 'move' : 'moves'}</span>
              </div>
              <div className="dg-hero-scramble">{scramble}</div>
              {m && (
                <Link href={genHref(m.ci)} prefetch={false} className="dg-hero-src">
                  <EventIcon event={m.e} className="dg-evt" />
                  <span className="dg-src-comp">{localizeCompName(m.ci, m.cn, isZh)}</span>
                  <span className="dg-src-meta">{sourceLine(m, isZh)}</span>
                </Link>
              )}
            </div>
          </div>
        );
      })() : (
        <div className="dg-empty">{isZh ? '该组合本批暂无数据' : 'No data for this combination'}</div>
      )}

      {rest.length > 0 && (
        <>
          <ol className="dg-list">
            {(expanded ? rest : rest.slice(0, 4)).map(([id, steps], i) => {
              const m = data.meta[id];
              const scramble = data.scr[id] ?? '';
              return (
                <li key={id} className="dg-row">
                  <span className="dg-row-rank">{i + 2}</span>
                  <span className="dg-row-steps">{steps}</span>
                  <div className="dg-row-main">
                    <div className="dg-row-scramble">{scramble}</div>
                    {m && (
                      <Link href={genHref(m.ci)} prefetch={false} className="dg-row-comp">
                        <EventIcon event={m.e} className="dg-evt" />
                        <span className="dg-row-name">{localizeCompName(m.ci, m.cn, isZh)}</span>
                        <span className="dg-row-sub">{sourceLine(m, isZh)}</span>
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {rest.length > 4 && (
            <button type="button" className="dg-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? (isZh ? '收起' : 'Show less') : (isZh ? '更多' : 'More')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
