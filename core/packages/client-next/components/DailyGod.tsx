'use client';

// Landing "今日神打" (Today's Easiest) — the fewest-move scrambles of the latest
// export batch, sliceable by variant (std/eo/pseudo/...) × metric (cross/xc/...) ×
// bottom color. Data: stats/scramble/daily_god.json (built by scramble-stats-build
// build:daily-god, refreshed by the cross-stats pipeline). 1 hero card + top-5 list.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { compLinkProps } from '@/lib/comp-link';
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

const VARIANT_ORDER = ['std', 'eo', 'pseudo', 'pseudo_pair', 'pair', 'f2leo', 'pseudo_f2leo'];
const VARIANT_LABEL: Record<string, { zh: string; en: string }> = {
  std: { zh: '标准', en: 'Standard' },
  eo: { zh: 'EO十字', en: 'EOCross' },
  pseudo: { zh: '伪十字', en: 'Pseudo' },
  pseudo_pair: { zh: '伪十字+基态', en: 'Pseudo + Pair' },
  pair: { zh: '十字+基态', en: 'Cross + Pair' },
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

type Color = 'W' | 'Y' | 'R' | 'O' | 'B' | 'G';
const COLOR_ORDER: Color[] = ['W', 'Y', 'R', 'O', 'B', 'G'];
const COLOR_NAME: Record<Color, { zh: string; en: string }> = {
  W: { zh: '白', en: 'White' }, Y: { zh: '黄', en: 'Yellow' }, R: { zh: '红', en: 'Red' },
  O: { zh: '橙', en: 'Orange' }, B: { zh: '蓝', en: 'Blue' }, G: { zh: '绿', en: 'Green' },
};
// 魔方面固定色(lib/cube-colors 单一来源的颜色字母版),非主题色。
const COLOR_HEX: Record<Color, string> = {
  W: '#FFFFFF', Y: '#FEFE00', R: '#EE0000', O: '#FFA100', B: '#0000F2', G: '#00D800',
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
  const [color, setColor] = useState<Color>('W');

  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      fetch('/stats/scramble/daily_god.json')
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
  const entries: Entry[] = data?.rank?.[curVariant]?.[curMetric]?.[color] ?? [];

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
      </div>

      <div className="daily-god-colors" role="group" aria-label={isZh ? '底色' : 'Bottom color'}>
        {COLOR_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={`dg-swatch${c === color ? ' is-active' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => setColor(c)}
            title={COLOR_NAME[c][isZh ? 'zh' : 'en']}
            aria-pressed={c === color}
          />
        ))}
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
                <span className="dg-hero-dot" style={{ background: COLOR_HEX[color] }} aria-hidden="true" />
                <b>{steps}</b>
                <span className="dg-hero-unit">{isZh ? '步' : steps === 1 ? 'move' : 'moves'}</span>
              </div>
              <div className="dg-hero-scramble">{scramble}</div>
              {m && (
                <Link {...compLinkProps(m.ci, { event: m.e, round: m.r }, lang)} className="dg-hero-src">
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
        <ol className="dg-list">
          {rest.map(([id, steps], i) => {
            const m = data.meta[id];
            return (
              <li key={id} className="dg-row">
                <span className="dg-row-rank">{i + 2}</span>
                <span className="dg-row-steps">{steps}</span>
                {m ? (
                  <Link {...compLinkProps(m.ci, { event: m.e, round: m.r }, lang)} className="dg-row-comp">
                    <EventIcon event={m.e} className="dg-evt" />
                    <span className="dg-row-name">{localizeCompName(m.ci, m.cn, isZh)}</span>
                    <span className="dg-row-sub">{sourceLine(m, isZh)}</span>
                  </Link>
                ) : <span className="dg-row-comp">{id}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
