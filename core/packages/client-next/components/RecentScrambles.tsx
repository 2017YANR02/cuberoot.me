'use client';

// Landing "近期打乱" (Recent Scrambles) — the easiest scrambles of the latest export
// batch, sliceable by variant (std/eo/pseudo/...) × metric (cross/xc/...) × bottom color
// × move count. Data: stats/scramble/recent_scrambles.json (built by scramble-stats-build
// build:recent-scrambles, refreshed by the cross-stats pipeline). 1 hero card + example list.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { SubsetColorPicker, SubsetSwatch, useSubsetSelection, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { localizeCompName } from '@/lib/comp-localize';
import { roundTypeShort } from '@/lib/comp-schedule';
import './recent_scrambles.css';

interface Props { lang: 'zh' | 'en' }

interface ScrMeta { ci: string; cn: string; cd: string; r: string; g: string; n: number; e: string }
interface RecentScramblesJson {
  export_date: string;
  new_count: number;
  scr: Record<string, string>;
  meta: Record<string, ScrMeta>;
  // variant -> metric -> subsetKey -> step(字符串) -> [id, 取最少步的底色字母][]（每桶 ≤12 条）
  rank: Record<string, Record<string, Record<string, Record<string, [string, ColorLetter][]>>>>;
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
  const round = roundTypeShort(m.r, isZh);
  const grp = m.g ? (isZh ? `${m.g}组` : ` ${m.g}`) : '';
  return isZh ? `${round}${grp}#${m.n}` : `${round}${grp} #${m.n}`;
}

export default function RecentScrambles({ lang }: Props) {
  const isZh = lang === 'zh';
  const [data, setData] = useState<RecentScramblesJson | null>(null);
  const [variant, setVariant] = useState('std');
  const [metric, setMetric] = useState('cross');
  const [step, setStep] = useState<number | null>(null); // null = 跟随当前切片最少步
  const sel = useSubsetSelection('cn');
  const [expanded, setExpanded] = useState(false);

  // 点比赛名跳 /scramble/gen?comp=<id>(comp tab 直链加载该比赛打乱),不是 /wca/comp。
  const genHref = (ci: string) => `/${lang}/scramble/gen?comp=${encodeURIComponent(ci)}`;
  // 点打乱跳 /scramble/analyzer?scramble=<moves>(空格→_,与 analyzer 自身 URL 同格式)。
  const analyzerHref = (scramble: string) =>
    `/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') })}`;

  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      fetch('/stats/scramble/recent_scrambles.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: RecentScramblesJson | null) => { if (on) setData(j); })
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
    return Object.values(r).some((byColor) => Object.values(byColor).some((byStep) => Object.keys(byStep).length > 0));
  }), [data]);

  // clamp selections to what's available (variant switch may drop a metric, etc.)
  const curVariant = variants.includes(variant) ? variant : (variants[0] ?? 'std');
  const metrics = useMemo(() => {
    const r = data?.rank?.[curVariant];
    return r ? METRIC_ORDER.filter((m) => m in r) : [];
  }, [data, curVariant]);
  const curMetric = metrics.includes(metric) ? metric : (metrics[0] ?? 'cross');
  // 当前切片的步数分桶；步数选择器列出可选步数,默认跟随最少步
  const byStep = data?.rank?.[curVariant]?.[curMetric]?.[sel.subsetKey];
  const steps = useMemo(() => Object.keys(byStep ?? {}).map(Number).sort((a, b) => a - b), [byStep]);
  const curStep = (step != null && steps.includes(step)) ? step : (steps[0] ?? null);
  const entries = (curStep != null ? byStep?.[String(curStep)] : undefined) ?? [];

  if (!data || data.new_count === 0 || variants.length === 0) return null;

  const hero = entries[0];
  const rest = entries.slice(1);

  return (
    <div className="recent-scrambles">
      <div className="rs-head">
        <span className="rs-title">{isZh ? '近期打乱' : 'Recent Scrambles'}</span>
        <span className="rs-date">{data.export_date}</span>
        <SubsetColorPicker sel={sel} isZh={isZh} />
        <select
          className="rs-select"
          value={curVariant}
          onChange={(e) => setVariant(e.target.value)}
          aria-label={isZh ? '变体' : 'Variant'}
        >
          {variants.map((v) => (
            <option key={v} value={v}>{VARIANT_LABEL[v]?.[isZh ? 'zh' : 'en'] ?? v}</option>
          ))}
        </select>
        <select
          className="rs-select"
          value={curMetric}
          onChange={(e) => setMetric(e.target.value)}
          aria-label={isZh ? '类型' : 'Type'}
        >
          {metrics.map((m) => (
            <option key={m} value={m}>{METRIC_LABEL[m]?.[isZh ? 'zh' : 'en'] ?? m}</option>
          ))}
        </select>
        <select
          className="rs-select"
          value={curStep ?? ''}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-label={isZh ? '步数' : 'Moves'}
        >
          {steps.map((s) => (
            <option key={s} value={s}>{isZh ? `${s} 步` : `${s}`}</option>
          ))}
        </select>
      </div>

      {hero ? (() => {
        const [id, color] = hero;
        const scramble = data.scr[id] ?? '';
        const m = data.meta[id];
        return (
          <div className="rs-hero">
            <div className="rs-hero-cube">
              <ScramblePreview2D event="333" scramble={scramble} size={78} fullSizeLink linkTitle={isZh ? '查看大图' : 'View full size'} />
            </div>
            <div className="rs-hero-body">
              <div className="rs-hero-steps">
                <span className="rs-hero-dot" aria-hidden="true"><SubsetSwatch colors={[color]} /></span>
                <b>{curStep}</b>
                <span className="rs-hero-unit">{isZh ? '步' : curStep === 1 ? 'move' : 'moves'}</span>
              </div>
              <Link href={analyzerHref(scramble)} prefetch={false} className="rs-hero-scramble">{scramble}</Link>
              {m && (
                <Link href={genHref(m.ci)} prefetch={false} className="rs-hero-src">
                  <EventIcon event={m.e} className="rs-evt" />
                  <span className="rs-src-comp">{localizeCompName(m.ci, m.cn, isZh)}</span>
                  <span className="rs-src-meta">{sourceLine(m, isZh)}</span>
                </Link>
              )}
            </div>
          </div>
        );
      })() : (
        <div className="rs-empty">{isZh ? '该组合本批暂无数据' : 'No data for this combination'}</div>
      )}

      {rest.length > 0 && (
        <>
          <ol className="rs-list">
            {(expanded ? rest : rest.slice(0, 4)).map(([id, color], i) => {
              const m = data.meta[id];
              const scramble = data.scr[id] ?? '';
              return (
                <li key={id} className="rs-row">
                  <span className="rs-row-rank">{i + 2}</span>
                  <span className="rs-row-dot" aria-hidden="true"><SubsetSwatch colors={[color]} /></span>
                  <div className="rs-row-main">
                    <Link href={analyzerHref(scramble)} prefetch={false} className="rs-row-scramble">{scramble}</Link>
                    {m && (
                      <Link href={genHref(m.ci)} prefetch={false} className="rs-row-comp">
                        <EventIcon event={m.e} className="rs-evt" />
                        <span className="rs-row-name">{localizeCompName(m.ci, m.cn, isZh)}</span>
                        <span className="rs-row-sub">{sourceLine(m, isZh)}</span>
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {rest.length > 4 && (
            <button type="button" className="rs-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? (isZh ? '收起' : 'Show less') : (isZh ? '更多' : 'More')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
