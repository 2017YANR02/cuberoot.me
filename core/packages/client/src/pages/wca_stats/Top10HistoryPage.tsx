// NOTE: Top 10 History — bar chart race(对齐参考视频的视觉:黑底 + X 轴刻度 + 横条)
// 数据源:stats/top10_history.json(主索引) + stats/top10_history/{eventId}.json(per-event lazy)
// 路由:/wca-stats/top10_history
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Download } from 'lucide-react';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { loadFlagData, compFlagIso2 } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';
import { wcaPersonUrl, wcaCompUrl } from '../../utils/recon_utils';
import { formatRecordValue } from '../../utils/comp_records';
import { EventIcon } from '../../components/EventIcon/EventIcon';
import LangToggle from '../../components/LangToggle';
import WcaEventSelector from './WcaEventSelector';
import { EVENT_ZH, EVENT_EN } from './event_constants';
import { COUNTRY_TO_CONTINENT, type Continent } from './country_continents';
import { exportTop10Video, type ExportProgress } from './top10_export';
import './top10_history.css';

interface PbEvent { d: string; p: string; v: number; c: string }
interface PersonInfo { name: string; country: string; iso2: string | null }
interface CompInfo { name: string }
type Metric =
  | 'single' | 'average'
  | 'bao5' | 'wao5' | 'mo5' | 'bpa' | 'wpa'
  | 'median' | 'best_counting' | 'worst_counting' | 'worst';

interface EventInfo {
  hasAverage: boolean;
  hasAo5?: boolean;
  metrics?: Metric[];
}
interface Top10Index {
  events: string[];
  eventInfo: Record<string, EventInfo>;
  topK: number;
  persons: Record<string, PersonInfo>;
  comps: Record<string, CompInfo>;
}
type EventData = Partial<Record<Metric, PbEvent[]>>;

const FALLBACK_START = '2003-08-22';
const SPEEDS = [5, 30, 100, 365] as const;
const DEFAULT_SPEED = 30;
const SHOW_N = 10;
const DAY_MS = 86400000;
const BAR_FRAC = 60;
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

// NOTE: 按大洲固定 hue + 选手 ID 微调亮度/饱和度（含 rank 1，不再走金色特判）
//   6 大洲 + Multiple Continents 各自一个固定色相;country → continent 走静态映射表
const CONTINENT_HUE: Record<Continent, number> = {
  'Asia': 0,                  // 红
  'Europe': 220,              // 蓝
  'Africa': 30,               // 橙
  'North America': 140,       // 绿
  'South America': 280,       // 紫
  'Oceania': 180,             // 青
  'Multiple Continents': 0,   // 灰(下方特判,降饱和)
};
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function colorForRow(pid: string, country: string | null | undefined): string {
  const ph = hashStr(pid);
  const continent = country ? COUNTRY_TO_CONTINENT[country] : undefined;
  if (!continent || continent === 'Multiple Continents') {
    return `hsl(0 0% ${42 + ((ph >>> 0) % 16)}%)`;  // 灰阶
  }
  const hue = CONTINENT_HUE[continent];
  const lightness = 42 + ((ph >>> 0) % 16);    // 42-57%
  const saturation = 55 + ((ph >>> 4) % 20);   // 55-74%
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function findEventIdxByDate(events: PbEvent[], dateIso: string): number {
  let lo = 0, hi = events.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].d <= dateIso) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

interface PersonState { v: number; c: string; d: string }
interface ReplayResult {
  state: Map<string, PersonState>;
  top1Pid: string | null;
  top1V: number;
  top1SinceDate: string | null;
}
function replayState(events: PbEvent[], idxInclusive: number): ReplayResult {
  const state = new Map<string, PersonState>();
  let top1Pid: string | null = null;
  let top1V = Infinity;
  let top1SinceDate: string | null = null;
  for (let i = 0; i <= idxInclusive; i++) {
    const e = events[i];
    state.set(e.p, { v: e.v, c: e.c, d: e.d });
    if (e.v < top1V) {
      if (e.p !== top1Pid) top1SinceDate = e.d;
      top1Pid = e.p;
      top1V = e.v;
    }
  }
  return { state, top1Pid, top1V, top1SinceDate };
}

// NOTE: X 轴尺度 — 按 event 适配
//   时间项目(333/222/...):centiseconds,nice round to seconds
//   FMC single:moves(整数),step 5/10
//   FMC average:moves × 100(同时间编码)
//   MBLD(333mbf/333mbo):raw 编码无意义 → hideAxis
function axisFor(eventId: string, metric: Metric, maxV: number): { max: number; step: number; hideAxis: boolean } {
  if (eventId === '333mbf' || eventId === '333mbo') {
    // raw 大整数,只用作 bar 比例尺,不显示刻度
    return { max: Math.max(maxV * 1.05, 1), step: maxV || 1, hideAxis: true };
  }
  if (eventId === '333fm' && metric === 'single') {
    // moves
    if (maxV <= 30) return { max: Math.max(20, Math.ceil(maxV / 5) * 5), step: 5, hideAxis: false };
    return { max: Math.ceil(maxV / 10) * 10, step: 10, hideAxis: false };
  }
  // 时间项 / FMC average(centiseconds 单位) — 每档目标 ≤7 刻度
  const TIME_BRACKETS: Array<[number, number]> = [
    [1000, 100],       // ≤10s:  1s 步长
    [2500, 500],       // ≤25s:  5s 步长
    [6000, 1000],      // ≤1min: 10s 步长
    [18000, 3000],     // ≤3min: 30s 步长
    [36000, 6000],     // ≤6min: 1min 步长
    [90000, 18000],    // ≤15min: 3min 步长
    [180000, 30000],   // ≤30min: 5min 步长
    [360000, 60000],   // ≤60min: 10min 步长
    [720000, 120000],  // ≤120min: 20min 步长
    [Infinity, 360000],// else: 60min 步长
  ];
  const step = TIME_BRACKETS.find(([limit]) => maxV <= limit)![1];
  const max = Math.max(step, Math.ceil(maxV / step) * step);
  return { max, step, hideAxis: false };
}

// NOTE: 刻度文本(简洁版,不像 formatRecordValue 总带小数)
function tickLabel(v: number, eventId: string, metric: Metric): string {
  if (eventId === '333mbf' || eventId === '333mbo') return '';
  if (eventId === '333fm') return metric === 'single' ? String(v) : Math.round(v / 100).toString();
  // time events: centiseconds
  if (v === 0) return '0';
  const sec = v / 100;
  if (sec < 60) return Number.isInteger(sec) ? String(sec) : sec.toFixed(1);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return s === 0 ? `${m}:00` : `${m}:${String(Math.round(s)).padStart(2, '0')}`;
}

export default function Top10HistoryPage({
  controlledEventId,
  controlledMetric,
  controlledMetricLabelZh,
  controlledMetricLabelEn,
}: {
  controlledEventId?: string;
  controlledMetric?: Metric;
  controlledMetricLabelZh?: string;
  controlledMetricLabelEn?: string;
} = {}) {
  const embedded = !!controlledEventId;
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [index, setIndex] = useState<Top10Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>(controlledEventId || '333');
  const [eventDataCache] = useState<Map<string, EventData>>(() => new Map());
  const [, setCacheTick] = useState(0); // 触发缓存写入后的 rerender
  const [eventLoading, setEventLoading] = useState<boolean>(false);
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
    fetch('/stats/top10_history.json')
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
    fetch(`/stats/top10_history/${eventId}.json`)
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

  // metric 是否可用(MBLD 只 single)
  const eventInfo = index?.eventInfo[eventId];
  const hasAverage = eventInfo?.hasAverage ?? true;
  useEffect(() => {
    if (!hasAverage && metric === 'average') setMetric('single');
  }, [hasAverage, metric]);

  const eventData = eventDataCache.get(eventId);
  const events: PbEvent[] = eventData?.[metric] ?? [];

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

  const prevEventMetricRef = useRef(`${eventId}:${metric}`);
  useEffect(() => {
    const key = `${eventId}:${metric}`;
    if (key !== prevEventMetricRef.current) {
      prevEventMetricRef.current = key;
      setDateMs(startMs);
      setPlaying(false);
    } else {
      setDateMs(prev => Math.max(startMs, Math.min(endMs, prev)));
    }
  }, [startMs, endMs, eventId, metric]);

  // NOTE: PB 模式专用 — 只保留"top-10 顺序变化"的日期
  //   纯个人成绩提升(同人同名次)/ 不进 top-10 的 PB 都跳过
  //   增量维护 top-N:O(events × N) 总开销,3000 PB × 10 ≈ 30K op
  const rankChangeDates = useMemo(() => {
    const datesSet = new Set<string>();
    const top: Array<{ pid: string; v: number }> = [];
    let prevOrder: string[] = [];
    for (const e of events) {
      const oldIdx = top.findIndex(x => x.pid === e.p);
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
      top.splice(lo, 0, { pid: e.p, v: e.v });
      if (top.length > SHOW_N) top.length = SHOW_N;
      const newOrder = top.map(x => x.pid);
      const changed = newOrder.length !== prevOrder.length
        || newOrder.some((p, i) => p !== prevOrder[i]);
      if (changed) {
        datesSet.add(e.d);
        prevOrder = newOrder.slice();
      }
    }
    return [...datesSet].sort();
  }, [events]);

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
    return replayState(events, idx);
  }, [events, dateIso]);

  const top10 = useMemo(() => {
    if (!replay) return [];
    return [...replay.state.entries()]
      .map(([pid, st]) => ({ pid, ...st }))
      .sort((a, b) => a.v - b.v || a.d.localeCompare(b.d))
      .slice(0, SHOW_N);
  }, [replay]);

  const rankByPid = useMemo(() => {
    const m = new Map<string, number>();
    top10.forEach((row, i) => m.set(row.pid, i));
    return m;
  }, [top10]);

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

  const top1Person = replay?.top1Pid ? index?.persons[replay.top1Pid] : null;
  const top1DurationDays = replay?.top1SinceDate
    ? Math.max(0, Math.floor((isoToMs(dateIso) - isoToMs(replay.top1SinceDate)) / DAY_MS))
    : 0;

  // NOTE: 优先用父级 metric label(与左侧 metric 选择器一致),fallback 到本地 single/average 短词
  const metricLabel = isZh
    ? (controlledMetricLabelZh ?? (metric === 'single' ? '单次' : '平均'))
    : (controlledMetricLabelEn ?? (metric === 'single' ? 'Singles' : 'Avgs'));

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
      phase: isZh ? '准备...' : 'Preparing...',
      pct: 0, framesDone: 0, framesTotal: 0,
    });
    // 等 React 提交 overlay,让 previewCanvasRef.current 就位
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    try {
      await exportTop10Video({
        events, eventId, metric,
        persons: index.persons, comps: index.comps,
        startMs, endMs, mode: playMode, speed,
        rankChangeDates, isZh,
        abortRef: exportAbortRef.current,
        onProgress: setExportProg,
        previewCanvas: previewCanvasRef.current,
        metricLabel,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'aborted') {
        console.error('[Top10 Export] failed:', e);
        // eslint-disable-next-line no-alert
        alert((isZh ? '导出失败:' : 'Export failed: ') + msg);
      }
    } finally {
      setExporting(false);
      setExportProg(null);
    }
  }, [exporting, events, index, eventId, metric, metricLabel, startMs, endMs, playMode, speed, rankChangeDates, isZh]);

  const cancelExport = useCallback(() => {
    exportAbortRef.current.aborted = true;
  }, []);

  const availableEvents = useMemo(
    () => new Set<string>(index?.events ?? []),
    [index?.events],
  );

  if (error) {
    return <div className="t10h-status">{isZh ? '加载失败' : 'Failed to load'}: {error}</div>;
  }
  if (!index) {
    return <div className="t10h-status">{isZh ? '加载中...' : 'Loading...'}</div>;
  }

  const top1Name = top1Person ? displayCuberName(top1Person.name, isZh) : '';
  const eventNameZh = EVENT_ZH[eventId] || eventId;
  const eventNameEn = EVENT_EN[eventId] || eventId;
  const fmtKind: 's' | 'a' = metric === 'single' ? 's' : 'a';

  return (
    <div className={`t10h-page${embedded ? ' t10h-embedded' : ''}`}>
      <div className="t10h-toolbar">
        {!embedded && (
          <div className="t10h-toolbar-title">
            {isZh ? '全历史 TOP 10 演化' : 'All-time top 10'}
          </div>
        )}
        {!embedded && (
          <div className="t10h-toolbar-right">
            <div className="t10h-metric-toggle" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={metric === 'single'}
                className={metric === 'single' ? 'active' : ''}
                onClick={() => setMetric('single')}
              >{isZh ? '单次' : 'Single'}</button>
              <button
                type="button"
                role="tab"
                aria-selected={metric === 'average'}
                className={metric === 'average' ? 'active' : ''}
                onClick={() => hasAverage && setMetric('average')}
                disabled={!hasAverage}
                title={!hasAverage ? (isZh ? '该项目没有平均成绩' : 'No average for this event') : undefined}
              >{isZh ? '平均' : 'Average'}</button>
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
                {isZh ? '导出视频中' : 'Exporting video'}
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
                {isZh ? '取消' : 'Cancel'}
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
              <div className="t10h-holder-name">{top1Name || (eventLoading ? (isZh ? '加载中…' : 'Loading…') : '')}</div>
              <div className="t10h-holder-sub">
                {top1Person && (isZh
                  ? `保持纪录 ${top1DurationDays} 天`
                  : `World record holder for ${top1DurationDays} days`)}
              </div>
            </div>
          </div>
          <div className="t10h-bigtitle">
            <div className="t10h-bigtitle-pre">
              <EventIcon event={eventId} className="t10h-bigtitle-icon" />
              <span>
                {isZh ? `${eventNameZh}${metricLabel}` : `${eventNameEn} ${metricLabel}`}
              </span>
            </div>
            <div className="t10h-bigdate">{dateIso}</div>
          </div>
        </div>

        {!axis.hideAxis && (
          <div className="t10h-axis" aria-hidden="true">
            {ticks.map(v => (
              <span key={v} className="t10h-tick" style={{ left: `${(v / axis.max) * BAR_FRAC}%` }}>
                {tickLabel(v, eventId, metric)}
              </span>
            ))}
          </div>
        )}

        <div
          className="t10h-bars"
          style={{ height: `${SHOW_N * rowH}px` }}
        >
          {ticks.length > 0 && (
            <div className="t10h-grid" aria-hidden="true">
              {ticks.map(v => (
                <span
                  key={v}
                  className={`t10h-grid-line${v === 0 ? ' t10h-grid-line-zero' : ''}`}
                  style={{ left: `${(v / axis.max) * BAR_FRAC}%` }}
                />
              ))}
            </div>
          )}

          {top10.map(row => {
            const person = index.persons[row.pid];
            const comp = index.comps[row.c];
            const compNameRaw = comp?.name ?? row.c;
            const compName = localizeCompName(row.c, compNameRaw, isZh);
            const personName = person ? displayCuberName(person.name, isZh) : row.pid;
            const widthPct = (row.v / axis.max) * BAR_FRAC;
            const rank = rankByPid.get(row.pid) ?? 0;
            const color = colorForRow(row.pid, person?.country);
            const compIso2 = compFlagIso2(row.c);
            return (
              <div
                key={row.pid}
                className="t10h-row"
                style={{ transform: `translateY(${rank * rowH}px)` }}
              >
                <div className="t10h-rank">{rank + 1}</div>
                <a
                  className="t10h-bar"
                  href={wcaPersonUrl(row.pid)}
                  target="_blank"
                  rel="noopener"
                  style={{ width: `${widthPct}%`, background: color }}
                  title={personName}
                >
                  {person?.iso2 && (
                    <Flag iso2={person.iso2} className="t10h-bar-flag" />
                  )}
                  <span className="t10h-bar-name">{personName}</span>
                </a>
                <span className="t10h-value">{formatRecordValue(row.v, eventId, fmtKind)}</span>
                <a
                  className="t10h-comp"
                  href={wcaCompUrl(row.c)}
                  target="_blank"
                  rel="noopener"
                  title={`${compName}  ${row.d}`}
                >
                  {compIso2 && <Flag iso2={compIso2} className="t10h-comp-flag" />}
                  <span className="t10h-comp-name">{compName}</span>
                </a>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="t10h-controls">
        <button
          type="button"
          className="t10h-play"
          onClick={togglePlay}
          aria-label={playing ? (isZh ? '暂停' : 'Pause') : (isZh ? '播放' : 'Play')}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input
          className="t10h-scrub"
          type="range"
          min={startMs}
          max={endMs}
          step={DAY_MS}
          value={Math.floor(dateMs)}
          onChange={handleScrub}
          aria-label={isZh ? '时间轴' : 'Timeline'}
        />
        <div className="t10h-speed" role="group" aria-label={isZh ? '播放模式' : 'Play mode'}>
          <button
            type="button"
            className={playMode === 'time' ? 'active' : ''}
            onClick={() => { setPlayMode('time'); setSpeed(DEFAULT_SPEED); }}
            title={isZh ? '按时间均匀(每秒推进固定天数)' : 'Uniform by time'}
          >{isZh ? '按天' : 'Time'}</button>
          <button
            type="button"
            className={playMode === 'pb' ? 'active' : ''}
            onClick={() => { setPlayMode('pb'); setSpeed(1); }}
            title={isZh ? '按 PB 事件均匀(每秒推进 1 个 PB)' : 'Uniform by PB (1/s)'}
          >{isZh ? '按 PB' : 'PB'}</button>
        </div>
        <div className="t10h-speed" role="group" aria-label={isZh ? '速度' : 'Speed'}>
          {(playMode === 'time' ? SPEEDS : [1]).map(s => (
            <button
              key={s}
              type="button"
              className={s === speed ? 'active' : ''}
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
          aria-label={isZh ? '导出视频' : 'Export video'}
          title={isZh ? `导出 mp4(1080p / ${playMode === 'time' ? speed + '天/秒' : '1 PB/秒'})` : `Export mp4 (1080p / ${playMode === 'time' ? speed + 'd/s' : '1 PB/s'})`}
        >
          <Download size={16} />
        </button>
      </footer>

      {events.length > 0 && (
        <div className="t10h-note">
          {isZh
            ? `数据自 ${events[0]?.d ?? '—'}。共 ${events.length} 次 PB 事件,涉及 ${replay ? new Set(events.map(e => e.p)).size : 0} 名曾进过历史 TOP ${index.topK} 的选手。`
            : `Data since ${events[0]?.d ?? '—'}. ${events.length} PB events from ${new Set(events.map(e => e.p)).size} cubers who were ever in the historical top ${index.topK}.`}
          <div className="t10h-legend">
            {([
              ['Asia', isZh ? '亚洲' : 'Asia'],
              ['Europe', isZh ? '欧洲' : 'Europe'],
              ['Africa', isZh ? '非洲' : 'Africa'],
              ['North America', isZh ? '北美' : 'N. America'],
              ['South America', isZh ? '南美' : 'S. America'],
              ['Oceania', isZh ? '大洋洲' : 'Oceania'],
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
