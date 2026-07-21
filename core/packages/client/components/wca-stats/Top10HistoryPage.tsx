'use client';

// NOTE: Top 10 History — bar chart race(对齐参考视频的视觉:黑底 + X 轴刻度 + 横条)
// 数据源:stats/top10_history.json(主索引) + stats/top10_history/{eventId}.json(per-event lazy)
// 当前仅作 wr_metric ranking 面板的嵌入(embedded)使用。
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Download } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { wcaPersonUrl } from '@/lib/recon-utils';
import { compLinkProps } from '@/lib/comp-link';
import { formatWcaResult, type ResultKind } from '@/lib/wca-format-result';
import { axisFor, tickLabel, type Metric } from '@/lib/top10-axis';
import { statsUrl } from '@/lib/stats-base';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import LangToggle from '@/components/LangToggle';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { type Continent } from '@/lib/country-continents';
import { CONTINENT_HUE } from '@/lib/bar-race-colors';
import BarRaceChart from '@/components/wca-stats/BarRaceChart';
import { exportTop10Video, type ExportProgress } from '@/lib/top10-export';
import './top10_history.css';
import { tr } from '@/i18n/tr';

interface PbEvent { d: string; p: string; v: number; c: string }
interface PersonInfo { name: string; country: string; iso2: string | null }
interface CompInfo { name: string }

interface EventInfo {
  hasAverage: boolean;
  hasAo5?: boolean;
  metrics?: Metric[];
  hasResultsAverage?: boolean;  // 「成绩」流是否有 average_r(333mbf 用非官方 Mo3)
}
interface Top10Index {
  events: string[];
  eventInfo: Record<string, EventInfo>;
  topK: number;
  persons: Record<string, PersonInfo>;
  comps: Record<string, CompInfo>;
}
// 「按人」指标(single/average/bao5...)与「按成绩」流(single_r/average_r);故 string key
type EventData = Record<string, PbEvent[]>;
// 「按国家」文件:streams + 自包含 persons/comps 字典(全局 index 不再汇各国引用)
interface CountryFileData {
  persons?: Record<string, PersonInfo>;
  comps?: Record<string, CompInfo>;
  [stream: string]: PbEvent[] | Record<string, PersonInfo> | Record<string, CompInfo> | undefined;
}

const FALLBACK_START = '2003-08-22';
const SPEEDS = [5, 30, 100, 365] as const;
const DEFAULT_SPEED = 30;
const SHOW_N = 10;
const DAY_MS = 86400000;
// NOTE: 行高(px) — 必须和 CSS .t10h-stage 的 --row-h 保持一致;
//   响应式断点用 matchMedia 切换
function rowHeightPx(): number {
  if (typeof window === 'undefined') return 44;
  if (window.matchMedia('(max-width: 480px)').matches) return 34;
  if (window.matchMedia('(max-width: 768px)').matches) return 38;
  return 44;
}

function isoToMs(iso: string): number { return new Date(iso + 'T00:00:00Z').getTime(); }
function msToIso(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

function findEventIdxByDate(events: PbEvent[], dateIso: string): number {
  let lo = 0, hi = events.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].d <= dateIso) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

interface PersonState { pid: string; v: number; c: string; d: string }
interface ReplayResult {
  // key:选手模式 = pid(去重);成绩模式 = `i${序号}`(唯一,允许同一选手出现多条)
  state: Map<string, PersonState>;
  top1Pid: string | null;
  top1V: number;
  top1SinceDate: string | null;
}
type RaceMode = 'persons' | 'results';
function replayState(events: PbEvent[], idxInclusive: number, mode: RaceMode): ReplayResult {
  const state = new Map<string, PersonState>();
  let top1Pid: string | null = null;
  let top1V = Infinity;
  let top1SinceDate: string | null = null;
  for (let i = 0; i <= idxInclusive; i++) {
    const e = events[i];
    // 选手模式按 pid 去重(同人后出现的更优 PB 覆盖);成绩模式每条独立(按序号),同人可多条
    const key = mode === 'results' ? `i${i}` : e.p;
    state.set(key, { pid: e.p, v: e.v, c: e.c, d: e.d });
    // top1 永远按「人」追踪(横幅 = WR 保持者);同人破自己纪录不重置保持天数
    if (e.v < top1V) {
      if (e.p !== top1Pid) top1SinceDate = e.d;
      top1Pid = e.p;
      top1V = e.v;
    }
  }
  return { state, top1Pid, top1V, top1SinceDate };
}

export default function Top10HistoryPage({
  controlledEventId,
  controlledMetric,
  controlledMetricLabelZh,
  controlledMetricLabelEn,
  controlledMode,
  controlledCountry,
  controlledCountryName,
}: {
  controlledEventId?: string;
  controlledMetric?: Metric;
  controlledMetricLabelZh?: string;
  controlledMetricLabelEn?: string;
  controlledMode?: RaceMode;   // 'persons'(默认,按人)| 'results'(按成绩,同人可多条)
  controlledCountry?: string;       // 国家 id(results.country_id);设了 = 该国 race,空 = 全球
  controlledCountryName?: string;   // 国家显示名(随语言,由父级算好)
} = {}) {
  const embedded = !!controlledEventId;
  const mode: RaceMode = controlledMode ?? 'persons';
  const country = controlledCountry || '';
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [index, setIndex] = useState<Top10Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>(controlledEventId || '333');
  const [eventDataCache] = useState<Map<string, EventData>>(() => new Map());
  // 「按国家」数据缓存:`${eventId}:${iso2}` -> CountryFileData(懒加载 country/{event}/{ISO2}.json)
  const [countryDataCache] = useState<Map<string, CountryFileData>>(() => new Map());
  const [, setCacheTick] = useState(0); // 触发缓存写入后的 rerender
  const [eventLoading, setEventLoading] = useState<boolean>(false);
  const [countryLoading, setCountryLoading] = useState<boolean>(false);
  const [metric, setMetric] = useState<Metric>('single');
  const [dateMs, setDateMs] = useState<number>(isoToMs(FALLBACK_START));
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const [playMode, setPlayMode] = useState<'time' | 'pb'>('time');
  const [, setFlagBust] = useState(0);
  const [rowH, setRowH] = useState<number>(() => rowHeightPx());

  const [exporting, setExporting] = useState(false);
  const [exportProg, setExportProg] = useState<ExportProgress | null>(null);
  const exportAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // NOTE: 监听窗口尺寸变化,更新行高
  useEffect(() => {
    const onResize = () => setRowH(rowHeightPx());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 加载主索引
  useEffect(() => {
    fetch(statsUrl('/stats/top10_history.json'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j: Top10Index) => setIndex(j))
      .catch(e => setError(String(e?.message || e)));
  }, []);

  useEffect(() => {
    loadFlagData().then(() => setFlagBust(v => v + 1));
  }, []);

  // 外部控制 eventId / metric 同步
  useEffect(() => {
    if (controlledEventId && index?.events.includes(controlledEventId)) {
      setEventId(controlledEventId);
    }
  }, [controlledEventId, index]);

  useEffect(() => {
    if (controlledMetric) setMetric(controlledMetric);
  }, [controlledMetric]);

  // 切换 event 时:lazy fetch
  useEffect(() => {
    if (!index) return;
    if (eventDataCache.has(eventId)) return;
    setEventLoading(true);
    fetch(statsUrl(`/stats/top10_history/${eventId}.json`))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: EventData) => {
        eventDataCache.set(eventId, d);
        setEventLoading(false);
        setCacheTick(t => t + 1);
      })
      .catch(e => {
        setEventLoading(false);
        console.error('top10_history event fetch failed:', e);
      });
  }, [eventId, index, eventDataCache]);

  // 选了国家时:lazy fetch country/{event}/{ISO2}.json(单国家小文件,缓存后切回即时)
  useEffect(() => {
    if (!index || !country) return;
    const ckey = `${eventId}:${country}`;
    if (countryDataCache.has(ckey)) return;
    setCountryLoading(true);
    fetch(statsUrl(`/stats/top10_history/country/${eventId}/${country.toUpperCase()}.json`))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: CountryFileData) => {
        countryDataCache.set(ckey, d);
        setCountryLoading(false);
        setCacheTick(t => t + 1);
      })
      .catch(() => {
        // 该国无数据文件(404 等)→ 存空,前端显示「数据不足」,不再重试
        countryDataCache.set(ckey, {});
        setCountryLoading(false);
        setCacheTick(t => t + 1);
      });
  }, [eventId, country, index, countryDataCache]);

  // metric 是否可用(MBLD 只 single);成绩模式看 average_r 是否存在
  const eventInfo = index?.eventInfo[eventId];
  const hasAverage = mode === 'results'
    ? (eventInfo?.hasResultsAverage ?? eventInfo?.hasAverage ?? true)
    : (eventInfo?.hasAverage ?? true);
  useEffect(() => {
    if (!hasAverage && metric === 'average') setMetric('single');
  }, [hasAverage, metric]);

  // 成绩模式读 `${metric}_r` 流(不按人去重);选手模式读 `${metric}`
  const dataKey = mode === 'results' ? `${metric}_r` : metric;
  // 选了国家 → country/{event}/{ISO2}.json(自包含 streams + persons + comps);否则全球 per-event 流 + index 字典
  const countryFile = country ? countryDataCache.get(`${eventId}:${country}`) : undefined;
  const events: PbEvent[] = country
    ? ((countryFile?.[dataKey] as PbEvent[] | undefined) ?? [])
    : (eventDataCache.get(eventId)?.[dataKey] ?? []);
  const activePersons: Record<string, PersonInfo> = country ? (countryFile?.persons ?? {}) : (index?.persons ?? {});
  const activeComps: Record<string, CompInfo> = country ? (countryFile?.comps ?? {}) : (index?.comps ?? {});

  const endMs = useMemo(() => {
    if (events.length === 0) return isoToMs(FALLBACK_START) + DAY_MS;
    return isoToMs(events[events.length - 1].d) + DAY_MS;
  }, [events]);
  const startMs = useMemo(
    () => Math.max(
      events.length > 0 ? isoToMs(events[0].d) : isoToMs(FALLBACK_START),
      isoToMs(FALLBACK_START),
    ),
    [events],
  );

  const prevEventMetricRef = useRef('');
  useEffect(() => {
    if (events.length === 0) return;
    const key = `${eventId}:${metric}:${mode}:${country}`;
    if (key !== prevEventMetricRef.current) {
      prevEventMetricRef.current = key;
      setDateMs(endMs);
      setPlaying(false);
    } else {
      setDateMs(prev => Math.max(startMs, Math.min(endMs, prev)));
    }
  }, [startMs, endMs, eventId, metric, mode, country, events.length]);

  // NOTE: PB 模式专用 — 只保留"top-10 顺序变化"的日期
  //   纯个人成绩提升(同人同名次)/ 不进 top-10 的 PB 都跳过
  //   增量维护 top-N:O(events × N) 总开销,3000 PB × 10 ≈ 30K op
  const rankChangeDates = useMemo(() => {
    const datesSet = new Set<string>();
    const top: Array<{ key: string; v: number }> = [];
    let prevOrder: string[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      // 选手模式 key=pid(同人更优 PB 替换旧条);成绩模式 key 唯一(每条独立,不替换)
      const ekey = mode === 'results' ? `i${i}` : e.p;
      const oldIdx = top.findIndex(x => x.key === ekey);
      if (oldIdx >= 0) {
        top.splice(oldIdx, 1);
      } else if (top.length >= SHOW_N && e.v >= top[top.length - 1].v) {
        // 不在 top 内且新值进不了 top-10 → 必然不影响排序
        continue;
      }
      let lo = 0, hi = top.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (top[mid].v < e.v) lo = mid + 1; else hi = mid;
      }
      top.splice(lo, 0, { key: ekey, v: e.v });
      if (top.length > SHOW_N) top.length = SHOW_N;
      const newOrder = top.map(x => x.key);
      const changed = newOrder.length !== prevOrder.length
        || newOrder.some((p, i) => p !== prevOrder[i]);
      if (changed) {
        datesSet.add(e.d);
        prevOrder = newOrder.slice();
      }
    }
    return [...datesSet].sort();
  }, [events, mode]);

  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const endMsRef = useRef(endMs);
  const eventsRef = useRef(events);
  const playModeRef = useRef(playMode);
  const rankChangeDatesRef = useRef(rankChangeDates);
  const pbFracRef = useRef(0);
  playingRef.current = playing;
  speedRef.current = speed;
  endMsRef.current = endMs;
  eventsRef.current = events;
  playModeRef.current = playMode;
  rankChangeDatesRef.current = rankChangeDates;

  useEffect(() => {
    let raf = 0;
    // NOTE: 用 -1 哨兵跳过首帧推进 — 避免 effect mount 到第一次 rAF 之间被
    //   页面初始化堵住的几十/几百 ms 直接吃掉好几天(30 d/s × 100ms ≈ 3 天)。
    //   后续帧 dt 也做上限,防 tab 切到后台再回来时一次性蹦走一大段。
    let lastT = -1;
    const tick = (t: number) => {
      if (lastT < 0) {
        lastT = t;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min((t - lastT) / 1000, 0.1);
      lastT = t;
      if (playingRef.current) {
        if (playModeRef.current === 'time') {
          pbFracRef.current = 0;
          setDateMs(prev => {
            const next = prev + speedRef.current * DAY_MS * dt;
            if (next >= endMsRef.current) {
              playingRef.current = false;
              setPlaying(false);
              return endMsRef.current;
            }
            return next;
          });
        } else {
          // NOTE: PB 模式 — 每秒推进 speed 个"有 PB 发生的日期"
          //   (replay 按日期聚合,跳过空日;同日多 PB 算一步,视觉上才有变化)
          pbFracRef.current += speedRef.current * dt;
          if (pbFracRef.current >= 1) {
            const steps = Math.floor(pbFracRef.current);
            pbFracRef.current -= steps;
            const uds = rankChangeDatesRef.current;
            if (uds.length === 0) return;
            setDateMs(prev => {
              const prevIso = msToIso(prev);
              // 二分:找最后一个 <= prevIso 的索引
              let lo = 0, hi = uds.length - 1, curIdx = -1;
              while (lo <= hi) {
                const mid = (lo + hi) >>> 1;
                if (uds[mid] <= prevIso) { curIdx = mid; lo = mid + 1; } else { hi = mid - 1; }
              }
              const targetIdx = Math.min(uds.length - 1, Math.max(0, curIdx) + steps);
              if (targetIdx >= uds.length - 1) {
                playingRef.current = false;
                setPlaying(false);
              }
              return isoToMs(uds[targetIdx]);
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dateIso = msToIso(Math.floor(dateMs));

  const replay = useMemo(() => {
    if (events.length === 0) return null;
    const idx = findEventIdxByDate(events, dateIso);
    if (idx < 0) return null;
    return replayState(events, idx, mode);
  }, [events, dateIso, mode]);

  const top10 = useMemo(() => {
    if (!replay) return [];
    return [...replay.state.entries()]
      .map(([key, st]) => ({ key, ...st }))
      .sort((a, b) => a.v - b.v || a.d.localeCompare(b.d))
      .slice(0, SHOW_N);
  }, [replay]);

  const axisMaxV = top10.length > 0 ? top10[top10.length - 1].v : 1000;
  const axis = useMemo(() => axisFor(eventId, metric, axisMaxV), [eventId, metric, axisMaxV]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    if (axis.hideAxis) {
      // NOTE: MBLD 等隐藏文字刻度的项目,仍在 0/25/50/75/100% 画 grid 让用户参考
      for (let i = 0; i <= 4; i++) out.push((i * axis.max) / 4);
      return out;
    }
    for (let v = 0; v <= axis.max; v += axis.step) out.push(v);
    return out;
  }, [axis]);

  const top1Person = replay?.top1Pid ? (activePersons[replay.top1Pid] ?? null) : null;
  const top1DurationDays = replay?.top1SinceDate
    ? Math.max(0, Math.floor((isoToMs(dateIso) - isoToMs(replay.top1SinceDate)) / DAY_MS))
    : 0;

  // NOTE: 优先用父级 metric label(与左侧 metric 选择器一致),fallback 到本地 single/average 短词
  const metricLabel = (isZh
      ? (controlledMetricLabelZh ?? (metric === 'single' ? '单次' : '平均'))
      : (controlledMetricLabelEn ?? (metric === 'single' ? 'Singles' : 'Avgs')));

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDateMs(Number(e.target.value));
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying(p => {
      if (!p && Math.floor(dateMs) >= endMs - 1) setDateMs(startMs);
      return !p;
    });
  }, [dateMs, endMs, startMs]);

  const handleExport = useCallback(async () => {
    if (exporting || events.length === 0 || !index) return;
    setPlaying(false);
    setExporting(true);
    exportAbortRef.current = { aborted: false };
    setExportProg({
      phase: tr({ zh: '准备...', en: 'Preparing...'
    }),
      pct: 0, framesDone: 0, framesTotal: 0,
    });
    // 等 React 提交 overlay,让 previewCanvasRef.current 就位
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    try {
      await exportTop10Video({
        events, eventId, metric, raceMode: mode,
        persons: activePersons, comps: activeComps,
        startMs, endMs, mode: playMode, speed,
        rankChangeDates, isZh,
        abortRef: exportAbortRef.current,
        onProgress: setExportProg,
        previewCanvas: previewCanvasRef.current,
        metricLabel,
        countryName: controlledCountryName,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'aborted') {
        console.error('[Top10 Export] failed:', e);
        // eslint-disable-next-line no-alert
        alert(tr({ zh: '导出失败:', en: 'Export failed: '
                    }) + msg);
      }
    } finally {
      setExporting(false);
      setExportProg(null);
    }
  }, [exporting, events, index, activePersons, activeComps, eventId, metric, mode, metricLabel, controlledCountryName, startMs, endMs, playMode, speed, rankChangeDates, isZh]);

  const cancelExport = useCallback(() => {
    exportAbortRef.current.aborted = true;
  }, []);

  const availableEvents = useMemo(
    () => new Set<string>(index?.events ?? []),
    [index?.events],
  );

  if (error) {
    return <div className="t10h-status">{tr({ zh: '加载失败', en: 'Failed to load'
    })}: {error}</div>;
  }
  if (!index) {
    return <div className="t10h-status">{tr({ zh: '加载中...', en: 'Loading...'
    })}</div>;
  }

  const top1Name = top1Person ? displayCuberName(top1Person.name, isZh) : '';
  const eventNameZh = EVENT_ZH[eventId] || eventId;
  const eventNameEn = EVENT_EN[eventId] || eventId;
  const fmtKind: ResultKind = metric === 'single' ? 'single' : 'average';

  return (
    <div className={`t10h-page${embedded ? ' t10h-embedded' : ''}`}>
      <div className="t10h-toolbar">
        {!embedded && (
          <div className="t10h-toolbar-title">
            {tr({ zh: '全历史 TOP 10 演化', en: 'All-time top 10'
            })}
          </div>
        )}
        {!embedded && (
          <div className="t10h-toolbar-right">
            <div className="t10h-metric-toggle" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={metric === 'single'}
                className={`t10h-metric-btn${metric === 'single' ? ' active' : ''}`}
                onClick={() => setMetric('single')}
              >{tr({ zh: '单次', en: 'Single'
            })}</button>
              <button
                type="button"
                role="tab"
                aria-selected={metric === 'average'}
                className={`t10h-metric-btn${metric === 'average' ? ' active' : ''}`}
                onClick={() => hasAverage && setMetric('average')}
                disabled={!hasAverage}
                title={!hasAverage ? tr({ zh: '该项目没有平均成绩', en: 'No average for this event'
                                }) : undefined}
              >{tr({ zh: '平均', en: 'Average' })}</button>
            </div>
            <LangToggle />
          </div>
        )}
      </div>

      {!embedded && (
        <div className="t10h-event-bar">
          <WcaEventSelector
            availableEvents={availableEvents}
            selectedEvent={eventId}
            onSelect={setEventId}
            isZh={isZh}
          />
        </div>
      )}

      <div className="t10h-stage" style={{ position: 'relative' }}>
        {exporting && exportProg && (
          <div className="t10h-export-overlay">
            <div className="t10h-export-card">
              <div className="t10h-export-title">
                {tr({ zh: '导出视频中', en: 'Exporting video'
                })}
              </div>
              <canvas ref={previewCanvasRef} className="t10h-export-preview" />
              <div className="t10h-export-bar">
                <div
                  className="t10h-export-bar-fill"
                  style={{ width: `${(exportProg.pct * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="t10h-export-msg">{exportProg.phase}</div>
              <button type="button" className="t10h-export-cancel" onClick={cancelExport}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
            </div>
          </div>
        )}
        <div className="t10h-banner">
          <div className="t10h-holder">
            {top1Person?.iso2 && (
              <Flag iso2={top1Person.iso2} className="t10h-holder-flag" />
            )}
            <div className="t10h-holder-text">
              <div className="t10h-holder-name">{top1Name || ((eventLoading || countryLoading) ? tr({ zh: '加载中…', en: 'Loading…'
                                      }) : '')}</div>
              <div className="t10h-holder-sub">
                {top1Person && (country
                  ? tr({ zh: `保持全国纪录 ${top1DurationDays} 天`, en: `National record holder for ${top1DurationDays} days` })
                  : tr({ zh: `保持纪录 ${top1DurationDays} 天`, en: `World record holder for ${top1DurationDays} days` }))}
              </div>
            </div>
          </div>
          <div className="t10h-bigtitle">
            <div className="t10h-bigtitle-pre">
              <EventIcon event={eventId} className="t10h-bigtitle-icon" />
              <span>
                {(() => {
                  const base = tr({ zh: `${eventNameZh}${metricLabel}`, en: `${eventNameEn} ${metricLabel}` });
                  return controlledCountryName ? `${controlledCountryName} ${base}` : base;
                })()}
              </span>
            </div>
            <div className="t10h-bigdate">{dateIso}</div>
          </div>
        </div>

        <BarRaceChart
          rows={top10.map((row, idx) => {
            const person = activePersons[row.pid];
            const comp = activeComps[row.c];
            const compNameRaw = comp?.name ?? row.c;
            const compName = localizeCompName(row.c, compNameRaw, isZh);
            const compIso2 = compFlagIso2(row.c);
            return {
              key: row.key,
              colorKey: row.pid,
              href: wcaPersonUrl(row.pid),
              name: person ? displayCuberName(person.name, isZh) : row.pid,
              iso2: person?.iso2 ?? null,
              country: person?.country,
              value: row.v,
              valueLabel: formatWcaResult(row.v, eventId, fmtKind),
              rankLabel: idx + 1,
              trailing: (
                <Link
                  className="t10h-comp"
                  {...compLinkProps(row.c, { event: eventId })}
                  title={`${compName}  ${row.d}`}
                >
                  {compIso2 && <Flag iso2={compIso2} className="t10h-comp-flag" />}
                  <span className="t10h-comp-name">{compName}</span>
                </Link>
              ),
            };
          })}
          axisMax={axis.max}
          ticks={ticks}
          tickLabel={(v) => tickLabel(v, eventId, metric)}
          hideAxisLabels={axis.hideAxis}
          rowH={rowH}
          showN={SHOW_N}
          emptyText={country && !countryLoading ? tr({ zh: '该国暂无足够数据', en: 'Not enough data for this country' }) : undefined}
        />
      </div>

      <footer className="t10h-controls">
        <button
          type="button"
          className="t10h-play"
          onClick={togglePlay}
          aria-label={playing ? tr({ zh: '暂停', en: 'Pause'
                  }) : tr({ zh: '播放', en: 'Play' })}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input
          className="t10h-scrub"
          style={{ ['--pct' as string]: `${Math.max(0, Math.min(100, ((Math.floor(dateMs) - startMs) / Math.max(1, endMs - startMs)) * 100))}%` }}
          type="range"
          min={startMs}
          max={endMs}
          step={DAY_MS}
          value={Math.floor(dateMs)}
          onChange={handleScrub}
          aria-label={tr({ zh: '时间轴', en: 'Timeline'
        })}
        />
        <div className="t10h-speed" role="group" aria-label={tr({ zh: '播放模式', en: 'Play mode' })}>
          <button
            type="button"
            className={`t10h-speed-btn${playMode === 'time' ? ' active' : ''}`}
            onClick={() => { setPlayMode('time'); setSpeed(DEFAULT_SPEED); }}
            title={tr({ zh: '按时间均匀(每秒推进固定天数)', en: 'Uniform by time'
            })}
          >{tr({ zh: '按天', en: 'Time' })}</button>
          <button
            type="button"
            className={`t10h-speed-btn${playMode === 'pb' ? ' active' : ''}`}
            onClick={() => { setPlayMode('pb'); setSpeed(1); }}
            title={tr({ zh: '按 PB 事件均匀(每秒推进 1 个 PB)', en: 'Uniform by PB (1/s)'
            })}
          >{tr({ zh: '按 PB', en: 'PB' })}</button>
        </div>
        <div className="t10h-speed" role="group" aria-label={tr({ zh: '速度', en: 'Speed' })}>
          {(playMode === 'time' ? SPEEDS : [1]).map(s => (
            <button
              key={s}
              type="button"
              className={`t10h-speed-btn${s === speed ? ' active' : ''}`}
              onClick={() => setSpeed(s)}
              title={
                playMode === 'time'
                  ? (isZh ? `${s} 天/秒` : `${s} days/sec`)
                  : (isZh ? `${s} PB/秒` : `${s} PB/sec`)
              }
            >{playMode === 'time' ? `${s}d/s` : `${s}/s`}</button>
          ))}
        </div>
        <button
          type="button"
          className="t10h-export-btn"
          onClick={handleExport}
          disabled={exporting || events.length === 0}
          aria-label={tr({ zh: '导出视频', en: 'Export video'
        })}
          title={(isZh ? `导出 mp4(1080p / ${playMode === 'time' ? speed + '天/秒' : '1 PB/秒'})` : `Export mp4 (1080p / ${playMode === 'time' ? speed + 'd/s' : '1 PB/s'})`)}
        >
          <Download size={16} />
        </button>
      </footer>

      {events.length > 0 && (
        <div className="t10h-note">
          {(() => {
            const since = events[0]?.d ?? '—';
            const cubers = new Set(events.map(e => e.p)).size;
            return mode === 'results'
              ? tr({
                  zh: `数据自 ${since}。共 ${events.length} 条曾进过历史 TOP ${index.topK} 的成绩,来自 ${cubers} 名选手(同一选手可多次上榜)。`,
                  en: `Data since ${since}. ${events.length} results that were ever in the historical top ${index.topK}, from ${cubers} cubers (one cuber may hold multiple slots).`,
                })
              : tr({
                  zh: `数据自 ${since}。共 ${events.length} 次 PB 事件,涉及 ${cubers} 名曾进过历史 TOP ${index.topK} 的选手。`,
                  en: `Data since ${since}. ${events.length} PB events from ${cubers} cubers who were ever in the historical top ${index.topK}.`,
                });
          })()}
          <div className="t10h-legend">
            {([
              ['Asia', tr({ zh: '亚洲', en: 'Asia'
            })],
              ['Europe', tr({ zh: '欧洲', en: 'Europe'
            })],
              ['Africa', tr({ zh: '非洲', en: 'Africa' })],
              ['North America', tr({ zh: '北美', en: 'N. America' })],
              ['South America', tr({ zh: '南美', en: 'S. America' })],
              ['Oceania', tr({ zh: '大洋洲', en: 'Oceania' })],
            ] as Array<[Continent, string]>).map(([c, label]) => (
              <span key={c} className="t10h-legend-item">
                <span className="t10h-legend-swatch" style={{ background: `hsl(${CONTINENT_HUE[c]} 65% 50%)` }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
