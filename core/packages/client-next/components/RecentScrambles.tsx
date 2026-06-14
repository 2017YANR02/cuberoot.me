'use client';

// Landing "近期打乱" (Recent Scrambles) — the easiest scrambles of the latest export
// batch, sliceable by variant (std/eo/pseudo/...) × metric (cross/xc/...) × bottom color
// × move count. Data: stats/scramble/recent_scrambles.json (built by scramble-stats-build
// build:recent-scrambles, refreshed by the cross-stats pipeline). 1 hero card + example list.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { SubsetColorPicker, SubsetSwatch, useSubsetSelection, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion, compFlagIso2 } from '@/lib/country-flags';
import { compSourceLine } from '@/lib/comp-schedule';
import { statsUrl } from '@/lib/stats-base';
import { VARIANT_ORDER, stageLabel, BLOCK_DATA_VARIANTS, BLOCK_STAGE_VARIANT } from '@/lib/scramble-variants';
import { VariantSelect } from '@/components/VariantSelect';
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

// 指标显示名走 lib/scramble-variants 的 stageLabel(xc/xxc 等短键已在表内别名)。
const METRIC_ORDER = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc', 'fbsquare', 'rouxs1', 'block222', 'block223', 'f2b', 'eo', 'eoline', 'dr'];

export default function RecentScrambles({ lang }: Props) {
  const isZh = lang === 'zh';
  const [data, setData] = useState<RecentScramblesJson | null>(null);
  const [variant, setVariant] = useState('std');
  const [metric, setMetric] = useState('cross');
  const [step, setStep] = useState<number | null>(null); // null = 跟随当前切片最少步
  const sel = useSubsetSelection('dual');
  const [expanded, setExpanded] = useState(false);

  // 异步加载 comp-country 索引,完成后 bump version 触发重渲染拿比赛国旗 + 中文名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pattern B: English is bare; only Chinese is /zh-prefixed.
  const lp = lang === 'zh' ? '/zh' : '';
  // 点比赛名跳 /scramble/gen?comp=<id>(comp tab 直链加载该比赛打乱),不是 /wca/comp。
  const genHref = (ci: string) => `${lp}/scramble/gen?comp=${encodeURIComponent(ci)}`;
  // 点打乱跳 /scramble/analyzer?scramble=<moves>(空格→_,与 analyzer 自身 URL 同格式)。
  const analyzerHref = (scramble: string) =>
    `${lp}/scramble/analyzer?${new URLSearchParams({ scramble: scramble.trim().replace(/ /g, '_') })}`;

  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      fetch(statsUrl('/stats/scramble/recent_scrambles.json'), { cache: 'no-cache' })
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
  // 数据层块变体(123/123x2/222/223)在 UI 聚合为一个方法 'block';metric 经
  // BLOCK_STAGE_VARIANT 映射回各自数据变体取数。
  const hasData = (v: string) => {
    const r = data?.rank?.[v];
    if (!r) return false;
    return Object.values(r).some((byColor) => Object.values(byColor).some((byStep) => Object.keys(byStep).length > 0));
  };
  // 333 整解首页无数据(无法对近期打乱算整解最优),但仍恒列出占位 —— 与 stats 方法下拉一致;
  // 选中后下方走空状态。其余变体仍按「本批有数据」过滤。
  const variants = useMemo(() => VARIANT_ORDER.filter((v) =>
    v === '333' ? true : v === 'block' ? BLOCK_DATA_VARIANTS.some(hasData) : hasData(v),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [data]);

  // clamp selections to what's available (variant switch may drop a metric, etc.)
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
  // block 方法按当前 metric 取底层数据变体;其余变体即数据键本身。
  const dataVariant = curVariant === 'block' ? (BLOCK_STAGE_VARIANT[curMetric] ?? '123') : curVariant;
  // 当前切片的步数分桶；步数选择器列出可选步数,默认跟随最少步
  const byStep = data?.rank?.[dataVariant]?.[curMetric]?.[sel.subsetKey];
  const steps = useMemo(() => Object.keys(byStep ?? {}).map(Number).sort((a, b) => a - b), [byStep]);
  const curStep = (step != null && steps.includes(step)) ? step : (steps[0] ?? null);
  const entries = (curStep != null ? byStep?.[String(curStep)] : undefined) ?? [];

  if (!data || data.new_count === 0 || variants.length === 0) return null;

  const hero = entries[0];
  const rest = entries.slice(1);

  return (
    <div className="recent-scrambles">
      <div className="rs-head">
        <span className="rs-title">{tr({ zh: '近期打乱', en: 'Recent Scrambles'
        })}</span>
        <SubsetColorPicker sel={sel} isZh={isZh} />
        <VariantSelect
          className="rs-select"
          value={curVariant}
          options={variants}
          onChange={setVariant}
          isZh={isZh}
          ariaLabel={tr({ zh: '变体', en: 'Variant'
        })}
        />
        {metrics.length > 0 && (
          <VariantSelect
            className="rs-select"
            value={curMetric}
            options={metrics}
            onChange={setMetric}
            isZh={isZh}
            label={stageLabel}
            ariaLabel={tr({ zh: '类型', en: 'Type'
          })}
          />
        )}
        {steps.length > 0 && (
          <select
            className="rs-select"
            value={curStep ?? ''}
            onChange={(e) => setStep(Number(e.target.value))}
            aria-label={tr({ zh: '步数', en: 'Moves'
          })}
          >
            {steps.map((s) => (
              <option key={s} value={s}>{isZh ? `${s} 步` : `${s}`}</option>
            ))}
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
              <ScramblePreview2D event="333" scramble={scramble} size={78} fullSizeLink linkTitle={tr({ zh: '查看大图', en: 'View full size'
            })} />
            </div>
            <div className="rs-hero-body">
              <div className="rs-hero-steps">
                <span className="rs-hero-dot" aria-hidden="true"><SubsetSwatch colors={[color]} /></span>
                <b>{curStep}</b>
                <span className="rs-hero-unit">{isZh ? '步' : curStep === 1 ? 'move' : 'moves'}</span>
              </div>
              <Link href={analyzerHref(scramble)} prefetch={false} className="rs-hero-scramble">{scramble}</Link>
              {m && (() => {
                const iso2 = compFlagIso2(m.ci);
                return (
                  <Link href={genHref(m.ci)} prefetch={false} className="rs-hero-src">
                    {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                    <span className="rs-src-comp">{localizeCompName(m.ci, m.cn, isZh)}</span>
                    <EventIcon event={m.e} className="rs-evt" />
                    <span className="rs-src-meta">{compSourceLine(m.r, m.g, m.n, isZh, !!m.x)}</span>
                  </Link>
                );
              })()}
            </div>
          </div>
        );
      })() : (
        <div className="rs-empty">{tr({ zh: '该组合本批暂无数据', en: 'No data for this combination'
        })}</div>
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
                    {m && (() => {
                      const iso2 = compFlagIso2(m.ci);
                      return (
                        <Link href={genHref(m.ci)} prefetch={false} className="rs-row-comp">
                          {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                          <span className="rs-row-name">{localizeCompName(m.ci, m.cn, isZh)}</span>
                          <EventIcon event={m.e} className="rs-evt" />
                          <span className="rs-row-sub">{compSourceLine(m.r, m.g, m.n, isZh, !!m.x)}</span>
                        </Link>
                      );
                    })()}
                  </div>
                </li>
              );
            })}
          </ol>
          {rest.length > 4 && (
            <button type="button" className="rs-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? (tr({ zh: '收起', en: 'Show less' })) : (tr({ zh: '更多', en: 'More' }))}
            </button>
          )}
        </>
      )}
    </div>
  );
}
