'use client';

/**
 * /wca/calendar/stats — WCA 比赛随时间分布的可视化。
 * 数据源:loadComps()(all_past + all_upcoming, 按 id 去重)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { CountryInput } from '@/components/CountryInput';
import { EventSelect } from '@/components/EventSelect';
import { Flag } from '@/components/Flag';
import { loadComps, type Comp } from '@/lib/comp-search';
import { countryName } from '@/lib/country-name';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './calendar_stats.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

const EVENT_LIST = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];

function bucketColor(count: number, max: number): string {
  if (count <= 0) return '#1a1a1d';
  const r = max <= 0 ? 0 : count / max;
  if (r < 0.15) return '#1f3a55';
  if (r < 0.3) return '#2f5d87';
  if (r < 0.5) return '#5b9dd9';
  if (r < 0.75) return '#8bbde8';
  return '#bbdaf3';
}

export default function CalendarStatsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('日历统计', 'Calendar Stats');
  const router = useRouter();
  const navigate = (to: string) => router.push(to);
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [country, setCountry] = useState('');
  const [event, setEvent] = useState('');
  const [granularity, setGranularity] = useState<'month' | 'year'>('month');
  const [view, setView] = useState({ start: 0, end: 1 });

  useEffect(() => { loadComps().then(setComps); }, []);

  const filtered = useMemo(() => {
    if (!comps) return [];
    const wantEvent = event ? toWcaEventId(event) : '';
    return comps.filter(c => {
      if (country && c.country.toLowerCase() !== country) return false;
      if (wantEvent && !(c.events ?? []).some(e => toWcaEventId(e) === wantEvent)) return false;
      return c.start_date && /^\d{4}-\d{2}/.test(c.start_date);
    });
  }, [comps, country, event]);

  const { yearMonthGrid, years, monthMax } = useMemo(() => {
    const grid = new Map<string, number>();
    const yearSet = new Set<number>();
    for (const c of filtered) {
      const y = c.start_date.slice(0, 4);
      const m = c.start_date.slice(5, 7);
      grid.set(`${y}-${m}`, (grid.get(`${y}-${m}`) ?? 0) + 1);
      yearSet.add(Number(y));
    }
    let max = 0;
    for (const v of grid.values()) if (v > max) max = v;
    return { yearMonthGrid: grid, years: [...yearSet].sort((a, b) => b - a), monthMax: max };
  }, [filtered]);

  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsZh = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const monthLabels = (isZh ? monthsZh : monthsEn);

  const series = useMemo(() => {
    if (years.length === 0) return [] as { year: number; month: number; count: number }[];
    const maxY = Math.max(...years);
    const out: { year: number; month: number; count: number }[] = [];
    if (granularity === 'month') {
      for (let y = 2003; y <= maxY; y++) {
        for (let m = (y === 2003 ? 8 : 1); m <= 12; m++) {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          out.push({ year: y, month: m, count: yearMonthGrid.get(key) ?? 0 });
        }
      }
    } else {
      for (let y = 2003; y <= maxY; y++) {
        let total = 0;
        for (let m = 1; m <= 12; m++) {
          total += yearMonthGrid.get(`${y}-${String(m).padStart(2, '0')}`) ?? 0;
        }
        out.push({ year: y, month: 0, count: total });
      }
    }
    return out;
  }, [yearMonthGrid, years, granularity]);

  const barRange = useMemo(
    () => ({ i0: 0, i1: Math.max(0, series.length - 1) }),
    [series.length]
  );
  const countryAnim = useAnimator(barRange, granularity);
  const eventAnim = useAnimator(barRange, granularity);

  useEffect(() => {
    countryAnim.stop(); eventAnim.stop();
    setView({ start: 0, end: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, event, granularity, series]);

  const computeScope = useCallback((animIdx: number | null) => {
    if (series.length === 0) return null;
    if (animIdx === null) return null;
    const a = series[0];
    const b = series[animIdx] ?? series[series.length - 1];
    const fromM = granularity === 'month' ? a.month : 1;
    const toM = granularity === 'month' ? b.month : 12;
    const fromKey = `${a.year}-${String(fromM).padStart(2, '0')}-01`;
    const toKey = `${b.year}-${String(toM).padStart(2, '0')}-31`;
    return { fromKey, toKey, fromY: a.year, fromM, toY: b.year, toM, isFull: false };
  }, [series, granularity]);

  const countryScope = useMemo(() => computeScope(countryAnim.idx), [computeScope, countryAnim.idx]);
  const eventScope = useMemo(() => computeScope(eventAnim.idx), [computeScope, eventAnim.idx]);

  const { byCountry, countryTotal } = useMemo(() => {
    const m = new Map<string, number>();
    let total = 0;
    const inScope = countryScope
      ? (d: string) => d >= countryScope.fromKey && d <= countryScope.toKey
      : () => true;
    for (const c of filtered) {
      if (!inScope(c.start_date)) continue;
      m.set(c.country, (m.get(c.country) ?? 0) + 1);
      total++;
    }
    return { byCountry: [...m].sort((a, b) => b[1] - a[1]).slice(0, 15), countryTotal: total };
  }, [filtered, countryScope]);

  const byEvent = useMemo(() => {
    const m = new Map<string, number>();
    const inScope = eventScope
      ? (d: string) => d >= eventScope.fromKey && d <= eventScope.toKey
      : () => true;
    for (const c of filtered) {
      if (!inScope(c.start_date)) continue;
      for (const ev of c.events ?? []) {
        const wid = toWcaEventId(ev);
        m.set(wid, (m.get(wid) ?? 0) + 1);
      }
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [filtered, eventScope]);

  const totalComps = filtered.length;

  const scopeLabelOf = useCallback((scope: ReturnType<typeof computeScope>) => {
    if (!scope || scope.isFull) return tr({ zh: '全部时间', en: 'All time'
    });
    const fmt = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
    if (scope.fromY === scope.toY && scope.fromM === scope.toM) return fmt(scope.fromY, scope.fromM);
    return `${fmt(scope.fromY, scope.fromM)} ~ ${fmt(scope.toY, scope.toM)}`;
  }, [isZh]);

  const cellSize = 22;
  const cellGap = 3;
  const yearLabelW = 44;
  const monthLabelH = 18;
  const gridW = 12 * (cellSize + cellGap);
  const gridH = years.length * (cellSize + cellGap);
  const svgW = yearLabelW + gridW + 4;
  const svgH = monthLabelH + gridH + 4;

  const countryByCount = byCountry.length > 0 ? byCountry[0][1] : 1;
  const eventByCount = byEvent.length > 0 ? byEvent[0][1] : 1;

  if (!comps) {
    return <div className="cs-page"><div className="cs-loading">{t('common.loading')}</div></div>;
  }

  return (
    <div className="cs-page">
      <header className="cs-header">
        <div className="cs-header-left">
          <Link href="/wca/comp" className="cs-back" aria-label={tr({ zh: '返回比赛', en: 'Back to competitions'
        })}>
            <ArrowLeft size={18} />
          </Link>
          <h1 className="cs-title">{tr({ zh: '比赛统计', en: 'Competition stats'
        })}</h1>
        </div>
      </header>

      <div className="cs-toolbar">
        <CountryInput
          className="cs-filter"
          value={country}
          onChange={setCountry}
          allLabel={tr({ zh: '所有国家', en: 'All countries'
        })}
        />
        <EventSelect
          events={EVENT_LIST}
          value={event}
          onChange={setEvent}
          allLabel={tr({ zh: '所有项目', en: 'All events'
        })}
          className="cs-filter"
        />
        <div className="cs-summary">
          {(isZh
                              ? `共 ${totalComps.toLocaleString()} 场比赛 · ${years.length} 年 · ${byCountry.length >= 15 ? '15+' : byCountry.length} 个国家`
                              : `${totalComps.toLocaleString()} comps · ${years.length} yrs · ${byCountry.length >= 15 ? '15+' : byCountry.length} countries`)}
        </div>
      </div>

      <section className="cs-section">
        <h2 className="cs-section-title">{tr({ zh: '月度分布', en: 'Monthly distribution'
        })}</h2>
        {totalComps === 0 ? (
          <div className="cs-empty">{tr({ zh: '没有匹配的比赛。', en: 'No competitions match.'
        })}</div>
        ) : (
          <div className="cs-heatmap-wrap">
            <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="cs-heatmap">
              {monthLabels.map((lbl, i) => (
                <text
                  key={`m${i}`}
                  className="cs-axis"
                  x={yearLabelW + i * (cellSize + cellGap) + cellSize / 2}
                  y={monthLabelH - 5}
                  textAnchor="middle"
                >{lbl}</text>
              ))}
              {years.map((y, row) => (
                <text
                  key={`y${y}`}
                  className="cs-axis"
                  x={yearLabelW - 6}
                  y={monthLabelH + row * (cellSize + cellGap) + cellSize / 2 + 4}
                  textAnchor="end"
                >{y}</text>
              ))}
              {years.map((y, row) =>
                monthLabels.map((_, col) => {
                  const month = col + 1;
                  const key = `${y}-${String(month).padStart(2, '0')}`;
                  const count = yearMonthGrid.get(key) ?? 0;
                  const clickable = count > 0;
                  const onClick = clickable
                    ? () => navigate(`/wca/comp?year=${y}&month=${month}`)
                    : undefined;
                  return (
                    <rect
                      key={key}
                      x={yearLabelW + col * (cellSize + cellGap)}
                      y={monthLabelH + row * (cellSize + cellGap)}
                      width={cellSize}
                      height={cellSize}
                      rx={3}
                      fill={bucketColor(count, monthMax)}
                      className={clickable ? 'cs-cell cs-cell-clickable' : 'cs-cell'}
                      onClick={onClick}
                    >
                      <title>{`${key} · ${count}`}</title>
                    </rect>
                  );
                })
              )}
            </svg>
          </div>
        )}
      </section>

      {series.length > 0 && (
        <section className="cs-section">
          <div className="cs-line-header">
            <h2 className="cs-section-title">{tr({ zh: '时间趋势', en: 'Time trend'
            })}</h2>
            <div className="cs-granularity-toggle">
              <button
                type="button"
                className={`cs-gran-btn${granularity === 'month' ? ' cs-gran-btn--active' : ''}`}
                onClick={() => setGranularity('month')}
              >{tr({ zh: '月', en: 'Month' })}</button>
              <button
                type="button"
                className={`cs-gran-btn${granularity === 'year' ? ' cs-gran-btn--active' : ''}`}
                onClick={() => setGranularity('year')}
              >{tr({ zh: '年', en: 'Year' })}</button>
            </div>
          </div>
          <LineChart
            series={series}
            granularity={granularity}
            isZh={isZh}
            view={view}
            onViewChange={setView}
            onPointClick={(year, month) => {
              if (granularity === 'month') navigate(`/wca/comp?year=${year}&month=${month}`);
              else navigate(`/wca/comp?year=${year}&month=1`);
            }}
          />
        </section>
      )}

      {totalComps > 0 && (
        <section className="cs-section">
          <h2 className="cs-section-title">
            {tr({ zh: '比赛数 · 国家排名', en: 'Top countries'
            })}
            <SectionPlayControls anim={countryAnim} isZh={isZh} />
            <span className="cs-scope-tag">{scopeLabelOf(countryScope)} · {countryTotal.toLocaleString()}</span>
          </h2>
          <SectionScrubber anim={countryAnim} viewIdx={barRange} series={series} granularity={granularity} />
          {byCountry.length === 0 ? (
            <div className="cs-empty">{tr({ zh: '该时段没有比赛', en: 'No comps in this window'
            })}</div>
          ) : (
            <div className="cs-bars">
              {byCountry.map(([iso, n]) => {
                const pct = (n / countryByCount) * 100;
                return (
                  <div key={iso} className="cs-bar-row">
                    <span className="cs-bar-label">
                      <Flag iso2={iso.toLowerCase()} />
                      <span className="cs-bar-name">{countryName(iso, isZh)}</span>
                    </span>
                    <div className="cs-bar-track">
                      <div className="cs-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="cs-bar-count">{n.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!event && totalComps > 0 && (
        <section className="cs-section">
          <h2 className="cs-section-title">
            {tr({ zh: '项目场次', en: 'Events offered'
            })}
            <SectionPlayControls anim={eventAnim} isZh={isZh} />
            <span className="cs-scope-tag">{scopeLabelOf(eventScope)}</span>
          </h2>
          <SectionScrubber anim={eventAnim} viewIdx={barRange} series={series} granularity={granularity} />
          {byEvent.length === 0 ? (
            <div className="cs-empty">{tr({ zh: '该时段没有比赛', en: 'No comps in this window'
            })}</div>
          ) : (
          <div className="cs-bars cs-bars-compact">
            {byEvent.map(([ev, n]) => {
              const pct = (n / eventByCount) * 100;
              return (
                <div key={ev} className="cs-bar-row">
                  <span className="cs-bar-label">
                    <EventIcon event={ev} />
                    <span className="cs-bar-name">{eventDisplayName(ev, isZh)}</span>
                  </span>
                  <div className="cs-bar-track">
                    <div className="cs-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="cs-bar-count">{n.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          )}
        </section>
      )}
    </div>
  );
}

interface Animator {
  idx: number | null;
  playing: boolean;
  toggle: () => void;
  stop: () => void;
  seek: (i: number) => void;
}

function useAnimator(viewIdx: { i0: number; i1: number }, granularity: 'month' | 'year'): Animator {
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const stepMs = granularity === 'month' ? 400 : 700;
    const id = setInterval(() => {
      setIdx(cur => {
        const next = cur === null ? viewIdx.i0 : cur + 1;
        return next > viewIdx.i1 ? viewIdx.i0 : next;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, granularity, viewIdx.i0, viewIdx.i1]);

  return {
    idx, playing,
    toggle: () => {
      if (!playing && idx === null) setIdx(viewIdx.i0);
      setPlaying(p => !p);
    },
    stop: () => { setPlaying(false); setIdx(null); },
    seek: (i: number) => setIdx(i),
  };
}

function SectionPlayControls({ anim, isZh }: { anim: Animator; isZh: boolean }) {
  return (
    <span className="cs-sec-controls">
      <button
        type="button"
        className="cs-sec-play"
        onClick={anim.toggle}
        title={anim.playing ? (tr({ zh: '暂停', en: 'Pause'
        })) : (tr({ zh: '播放', en: 'Play' }))}
        aria-label={anim.playing ? 'pause' : 'play'}
      >{anim.playing ? '⏸' : '▶'}</button>
      {anim.idx !== null && (
        <button
          type="button"
          className="cs-sec-stop"
          onClick={anim.stop}
          title={tr({ zh: '停止', en: 'Stop' })}
          aria-label="stop"
        >■</button>
      )}
    </span>
  );
}

interface ScrubberProps {
  anim: Animator;
  viewIdx: { i0: number; i1: number };
  series: { year: number; month: number; count: number }[];
  granularity: 'month' | 'year';
}
function SectionScrubber({ anim, viewIdx, series, granularity }: ScrubberProps) {
  const span = Math.max(0, viewIdx.i1 - viewIdx.i0);
  const cur = Math.max(0, Math.min(span, (anim.idx ?? viewIdx.i0) - viewIdx.i0));
  const pct = span === 0 ? 0 : (cur / span) * 100;
  const headPoint = series[viewIdx.i0 + cur];
  const headLabel = headPoint
    ? (granularity === 'month'
      ? `${headPoint.year}-${String(headPoint.month).padStart(2, '0')}`
      : String(headPoint.year))
    : '';
  return (
    <div className="cs-scrubber">
      <input
        type="range"
        min={0}
        max={span}
        step={1}
        value={cur}
        onChange={e => anim.seek(viewIdx.i0 + Number(e.target.value))}
        style={{ ['--cs-scrubber-pct' as string]: `${pct}%` } as React.CSSProperties}
        aria-label="seek"
      />
      <span className="cs-scrubber-label">{headLabel}</span>
    </div>
  );
}

interface LineChartProps {
  series: { year: number; month: number; count: number }[];
  granularity: 'month' | 'year';
  isZh: boolean;
  view: { start: number; end: number };
  onViewChange: (v: { start: number; end: number }) => void;
  onPointClick: (year: number, month: number) => void;
}

function LineChart({ series, granularity, isZh, view, onViewChange, onPointClick }: LineChartProps) {
  const W = 880;
  const H = 280;
  const PAD_L = 40;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 32;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const setView = onViewChange;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; vStart: number; vEnd: number } | null>(null);
  const pinchRef = useRef<Map<number, number>>(new Map());
  const pinchAnchorRef = useRef<{ midFrac: number; widthAtStart: number; distAtStart: number; vStart: number; vEnd: number } | null>(null);
  const clampView = (s: number, e: number): { start: number; end: number } => {
    const minW = series.length > 1 ? 2 / series.length : 0.05;
    const width = Math.max(minW, Math.min(1, e - s));
    const start = Math.max(0, Math.min(1 - width, s));
    return { start, end: start + width };
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const xInChart = (e.clientX - rect.left - (PAD_L * rect.width / W)) / (rect.width * innerW / W);
      const focusFrac = Math.max(0, Math.min(1, view.start + xInChart * (view.end - view.start)));
      const zoom = e.deltaY > 0 ? 1.25 : 1 / 1.25;
      const newWidth = (view.end - view.start) * zoom;
      const newStart = focusFrac - (focusFrac - view.start) * (newWidth / (view.end - view.start));
      setView(clampView(newStart, newStart + newWidth));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, series.length]);

  if (series.length === 0) return null;

  const N = series.length;
  const startIdx = Math.max(0, Math.floor(view.start * (N - 1)));
  const endIdx = Math.min(N - 1, Math.ceil(view.end * (N - 1)));
  const visible = series.slice(startIdx, endIdx + 1);
  const visibleSpan = endIdx - startIdx;

  const maxCount = Math.max(1, ...visible.map(s => s.count));
  const niceStep = (max: number, ticks: number): number => {
    const raw = max / ticks;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / pow;
    const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
    return step * pow;
  };
  const yStep = niceStep(maxCount, 5);
  const yMax = Math.ceil(maxCount / yStep) * yStep;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);

  const xAt = (i: number) => visibleSpan === 0 ? PAD_L + innerW / 2 : PAD_L + ((i - startIdx) / visibleSpan) * innerW;
  const yAt = (count: number) => PAD_T + innerH - (count / yMax) * innerH;

  const xTicks: { i: number; label: string }[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const s = series[i];
    if (granularity === 'month') {
      if (s.month === 1) xTicks.push({ i, label: String(s.year) });
    } else {
      xTicks.push({ i, label: String(s.year) });
    }
  }
  const minSpacing = 50;
  const tickPxSpan = xTicks.length > 1 ? (xAt(xTicks[1].i) - xAt(xTicks[0].i)) : minSpacing + 1;
  const tickStride = Math.max(1, Math.ceil(minSpacing / Math.max(1, tickPxSpan)));
  const visibleXTicks = xTicks.filter((_, idx) => idx % tickStride === 0);

  const path = visible.map((s, k) => `${k === 0 ? 'M' : 'L'}${xAt(startIdx + k).toFixed(1)},${yAt(s.count).toFixed(1)}`).join(' ');

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    pinchRef.current.set(e.pointerId, e.clientX);
    if (pinchRef.current.size === 2) {
      const xs = [...pinchRef.current.values()];
      const dist = Math.abs(xs[0] - xs[1]);
      const mid = (xs[0] + xs[1]) / 2;
      const rect = svgRef.current!.getBoundingClientRect();
      const midInChart = (mid - rect.left - (PAD_L * rect.width / W)) / (rect.width * innerW / W);
      const midFrac = view.start + midInChart * (view.end - view.start);
      pinchAnchorRef.current = { midFrac, widthAtStart: view.end - view.start, distAtStart: dist, vStart: view.start, vEnd: view.end };
      dragRef.current = null;
    } else if (pinchRef.current.size === 1) {
      dragRef.current = { pointerId: e.pointerId, clientX: e.clientX, vStart: view.start, vEnd: view.end };
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pinchRef.current.has(e.pointerId)) return;
    pinchRef.current.set(e.pointerId, e.clientX);
    if (pinchRef.current.size === 2 && pinchAnchorRef.current) {
      const xs = [...pinchRef.current.values()];
      const dist = Math.abs(xs[0] - xs[1]);
      const a = pinchAnchorRef.current;
      const newWidth = a.widthAtStart * (a.distAtStart / Math.max(1, dist));
      const newStart = a.midFrac - (a.midFrac - a.vStart) * (newWidth / a.widthAtStart);
      setView(clampView(newStart, newStart + newWidth));
    } else if (pinchRef.current.size === 1 && dragRef.current && dragRef.current.pointerId === e.pointerId) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dxFrac = -((e.clientX - dragRef.current.clientX) / (rect.width * innerW / W)) * (dragRef.current.vEnd - dragRef.current.vStart);
      setView(clampView(dragRef.current.vStart + dxFrac, dragRef.current.vEnd + dxFrac));
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pinchRef.current.delete(e.pointerId);
    if (pinchRef.current.size < 2) pinchAnchorRef.current = null;
    if (pinchRef.current.size === 0) dragRef.current = null;
  };

  const pointLabel = (s: { year: number; month: number; count: number }): string => {
    if (granularity === 'month') {
      const mm = String(s.month).padStart(2, '0');
      return (isZh ? `${s.year}-${mm} · ${s.count} 场` : `${s.year}-${mm} · ${s.count}`);
    }
    return (isZh ? `${s.year} · ${s.count} 场` : `${s.year} · ${s.count}`);
  };

  const zoomed = view.start > 0 || view.end < 1;

  return (
    <div className="cs-line-wrap">
      {zoomed && (
        <div className="cs-line-tools">
          <button
            type="button"
            className="cs-line-reset"
            onClick={() => setView({ start: 0, end: 1 })}
          >{tr({ zh: '重置', en: 'Reset' })}</button>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="cs-line-svg"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} fill="transparent" />
        {yTicks.map(v => {
          const y = yAt(v);
          return (
            <g key={`y${v}`}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} className="cs-line-grid" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" className="cs-line-axis">{v}</text>
            </g>
          );
        })}
        {visibleXTicks.map(({ i, label }) => (
          <text key={`x${label}`} x={xAt(i)} y={H - PAD_B + 16} textAnchor="middle" className="cs-line-axis">{label}</text>
        ))}
        <path d={path} className="cs-line-path" fill="none" />
        {visible.map((s, k) => {
          const idx = startIdx + k;
          return (
            <circle
              key={idx}
              cx={xAt(idx)}
              cy={yAt(s.count)}
              r={granularity === 'year' || visibleSpan < 36 ? 4 : 2.5}
              className={s.count > 0 ? 'cs-line-dot cs-line-dot-clickable' : 'cs-line-dot'}
              onClick={s.count > 0 ? () => onPointClick(s.year, s.month) : undefined}
            >
              <title>{pointLabel(s)}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
