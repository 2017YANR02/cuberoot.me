'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsType } from 'echarts';
import { useTranslation } from 'react-i18next';
import { parseAsString, useQueryStates } from 'nuqs';
import BoolToggle from '@/components/BoolToggle';
import Link from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import { tr } from '@/i18n/tr';
interface CensusRow { rank: number; wcaId: string; name: string; iso2: string | null; subsetsWon: number; }
interface Census { type: string; inclCancelled: boolean; noPodium?: boolean; year: number | null; years: number[]; distinct: number; totalSubsets: number; rows: CensusRow[]; }
interface TimelinePoint { year: number; distinct: number; }

/** Annual snapshot census, not a cumulative or tie-complete record history. */
export default function SorCensus({ type }: { type: 'single' | 'average' }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [q, setQ] = useQueryStates({ scancelled: parseAsString, hidePodium: parseAsString }, { history: 'replace', scroll: false });
  const includeCancelled = q.scancelled === '1';
  const hidePodium = q.hidePodium === '1';
  const [census, setCensus] = useState<Census | null>(null);
  const [censusYear, setCensusYear] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setCensus(null); setError(false);
    const qs = new URLSearchParams({ type, v: '3', limit: '200' });
    if (includeCancelled) qs.set('cancelled', '1');
    if (hidePodium) qs.set('no_podium', '1');
    if (censusYear != null && !hidePodium) qs.set('year', String(censusYear));
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?${qs}`), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { if (!controller.signal.aborted) setCensus(d); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [type, includeCancelled, hidePodium, censusYear]);
  useEffect(() => {
    setTimeline(null);
    if (hidePodium) return;
    const controller = new AbortController();
    const qs = new URLSearchParams({ type, timeline: '1' });
    if (includeCancelled) qs.set('cancelled', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?${qs}`), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { if (!controller.signal.aborted) setTimeline(d?.points ?? null); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [type, includeCancelled, hidePodium]);
  const selYear = census?.year ?? null;
  const censusYearLabel = census ? (census.year ?? census.years?.[census.years.length - 1] ?? null) : null;
  const chartOption = useMemo(() => {
    if (!timeline || timeline.length === 0) return null;
    const css = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const tok = (name: string, fallback: string) => (css?.getPropertyValue(name).trim() || fallback);
    const accent = tok('--accent', '#d97757');
    const fg = tok('--muted-foreground', '#a8a29e');
    const grid = tok('--border-default', '#44403c');
    return {
      grid: { left: 6, right: 14, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis' as const,
        formatter: (ps: Array<{ axisValue: string; data: number }>) =>
          `${ps[0]!.axisValue}<br/>${tr({ zh: '人数', en: 'cubers' })}: <b>${ps[0]!.data}</b>`,
      },
      xAxis: {
        type: 'category' as const,
        data: timeline.map(p => p.year),
        axisLabel: { color: fg, fontSize: 10 },
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const, minInterval: 1,
        axisLabel: { color: fg, fontSize: 10 },
        splitLine: { lineStyle: { color: grid, opacity: 0.4 } },
      },
      series: [{
        type: 'line' as const,
        data: timeline.map(p => p.distinct),
        smooth: false, symbol: 'circle' as const,
        symbolSize: (_v: number, p: { dataIndex: number }) => (timeline[p.dataIndex]!.year === selYear ? 10 : 4),
        itemStyle: { color: accent },
        lineStyle: { color: accent, width: 2 },
        areaStyle: { color: accent, opacity: 0.12 },
      }],
    };
  }, [timeline, selYear]);
  // 折线图的 symbol 点太小、精确点击命中率低 → 用 zrender 原始 click + convertFromPixel
  // 把整根 grid 竖列都算作"点这一年"(跟 tooltip 的 axis trigger 手感一致),而非只认小圆点本身。
  const onChartReady = useCallback((chart: EChartsType) => {
    chart.getZr().on('click', (p: { offsetX: number; offsetY: number }) => {
      if (!chart.containPixel('grid', [p.offsetX, p.offsetY])) return;
      const idx = Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, p.offsetX));
      const years = (chart.getOption().xAxis as Array<{ data: number[] }>)[0]!.data;
      const year = years[idx];
      if (year != null) setCensusYear(year);
    });
  }, []);

  return (
    <div className="sor-census">
      <h2 className="wse-section-title">
        {tr({ zh: `项目组合名次和第一（年度快照 · ${type === 'average' ? '平均' : '单次'}）`, en: `Event-combination SOR leaders (annual snapshots · ${type})` })}
      </h2>
        <div className="sor-census-body">
          <p className="sor-census-lead">{tr({
            zh: '全球、不限性别；按各年排名快照分别计算，不是完整历任纪录。默认枚举 17 个现役项目的组合；含废止项时为 21 项。每个组合若并列，仅计 WCA ID 字典序最前的一人。',
            en: 'Worldwide, all genders; computed separately from annual rank snapshots, not a complete record-holder history. All combinations of 17 active events are counted, or 21 with discontinued events. Each tied combination credits only the first WCA ID in lexicographic order.',
          })}</p>
          <div className="sor-census-controls">
            <BoolToggle value={includeCancelled} onChange={v => setQ({ scancelled: v ? '1' : null })} label={tr({ zh: '含废止项（21 项）', en: 'Include discontinued events (21 events)' })} />
            <BoolToggle value={hidePodium} onChange={v => setQ({ hidePodium: v ? '1' : null })} label={tr({ zh: '仅未登领奖台选手', en: 'Only cubers without a podium' })} />
            {census && (census.years?.length ?? 0) > 1 && census.year != null && (
              <label className="sor-census-year">
                {tr({ zh: '快照年份', en: 'Snapshot year' })}
                <select className="sor-census-year-select" value={census.year} onChange={e => setCensusYear(parseInt(e.target.value, 10))}>
                  {[...census.years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            )}
          </div>
          {hidePodium && <p className="sor-census-lead">{tr({ zh: '按当前未登领奖台资格筛选候选人，名次仍使用全球排名；仅有最新快照。', en: 'Eligibility uses current podium status; scores retain global ranks. Only the latest snapshot is available.' })}</p>}
          {chartOption && (
            <div className="sor-census-chart">
              <ReactECharts option={chartOption} style={{ height: 190, width: '100%', cursor: 'pointer' }} opts={{ renderer: 'canvas' }} onChartReady={onChartReady} />
              <div className="sor-census-chart-hint">{tr({ zh: '各年快照中获计第一的不同选手人数（非历年累计）', en: 'Distinct credited leaders in each annual snapshot (not cumulative)' })}</div>
            </div>
          )}
          {error && <p role="alert">{tr({ zh: '统计加载失败，请刷新页面重试。', en: 'Could not load statistics. Refresh the page to retry.' })}</p>}
          {!census && !error && <div className="sor-tool-hint"><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator></div>}
          {census && (
            <>
              <p className="sor-census-lead">{tr({
                zh: `${censusYearLabel ?? '—'} 年快照：${census.distinct} 名选手在 ${census.totalSubsets.toLocaleString()} 种非空项目组合中获计第一。百分比为该选手获计第一的组合数占比。`,
                en: `${censusYearLabel ?? '—'} snapshot: ${census.distinct} cubers credited with first place across ${census.totalSubsets.toLocaleString()} non-empty event combinations. Percentages show each cuber's share of combinations.`,
              })}</p>
              {census.rows.length < census.distinct && <p>{tr({ zh: `当前展示前 ${census.rows.length} 人，共 ${census.distinct} 人。`, en: `Showing the first ${census.rows.length} of ${census.distinct} cubers.` })}</p>}
              <ol className="sor-census-list">
                {census.rows.map(r => {
                  const share = r.subsetsWon / census.totalSubsets * 100;
                  return (
                    <li key={r.wcaId}>
                      <span className="sor-census-rank">{r.rank}</span>
                      <WcaPersonTeamBadge wcaId={r.wcaId} />{r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                      <Link prefetch={false} href={`/wca/persons/${r.wcaId}`}>{displayCuberName(r.name, isZh)}</Link>
                      <span className="sor-census-share">{share < 0.1 ? share.toFixed(3) : share.toFixed(1)}%</span>
                    </li>
                  );
                })}
              </ol>

            </>
          )}
        </div>
    </div>
  );
}
