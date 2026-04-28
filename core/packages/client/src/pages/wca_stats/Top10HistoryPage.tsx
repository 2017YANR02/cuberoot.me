// NOTE: Top 10 History — bar chart race(对齐参考视频的视觉:黑底 + X 轴刻度 + 横条)
// 数据源:stats/data/top10_history.json(自定义 schema:panels.{single,average}.events[])
// 路由:/wca-stats/top10_history
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause } from 'lucide-react';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { loadFlagData, compFlagIso2 } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';
import { EventIcon } from '../../components/EventIcon/EventIcon';
import LangToggle from '../../components/LangToggle';
import './top10_history.css';

interface PbEvent { d: string; p: string; v: number; c: string }
interface PersonInfo { name: string; country: string; iso2: string | null }
interface CompInfo { name: string }
interface PanelData {
  event: string;
  topK: number;
  persons: Record<string, PersonInfo>;
  comps: Record<string, CompInfo>;
  events: PbEvent[];
}
interface Top10Json {
  panels: { single: PanelData; average: PanelData };
}

type Metric = 'single' | 'average';

const VIEW_START = '2003-08-01';
const SPEEDS = [5, 30, 100, 365] as const;
const DEFAULT_SPEED = 30;
const SHOW_N = 10;
const DAY_MS = 86400000;
// NOTE: 柱子区在行宽里占的比例(0..100),剩余给 value+比赛名;
//   柱子和刻度/网格线都基于这个 fraction 定位,保证视觉对齐
const BAR_FRAC = 60;

function fmtTime(cs: number): string {
  if (cs < 6000) return (cs / 100).toFixed(2);
  const totalSec = cs / 100;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
function isoToMs(iso: string): number { return new Date(iso + 'T00:00:00Z').getTime(); }
function msToIso(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

// NOTE: 选手稳定颜色——personId 哈希出 HSL
function colorForPerson(pid: string): string {
  let h = 0;
  for (let i = 0; i < pid.length; i++) h = (h * 31 + pid.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue} 65% 48%)`;
}

// NOTE: 二分 events[i].d <= dateIso 的最大下标;-1 表示全在未来
function findEventIdxByDate(events: PbEvent[], dateIso: string): number {
  let lo = 0, hi = events.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].d <= dateIso) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

// NOTE: 重放至 idxInclusive,顺便记录 #1 选手 + #1 起始日期
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
      // NOTE: 仅当不是同一选手再创新低时才重置 since-date
      //   "WR holder for X days" = 该选手首次坐上 #1 至今的天数
      if (e.p !== top1Pid) top1SinceDate = e.d;
      top1Pid = e.p;
      top1V = e.v;
    }
  }
  return { state, top1Pid, top1V, top1SinceDate };
}

// NOTE: X 轴尺度 — 给定最慢成绩(厘秒),返回轴最大值与刻度步长
function axisFor(maxCs: number): { max: number; step: number } {
  if (maxCs <= 1000) {
    return { max: Math.max(100, Math.ceil(maxCs / 100) * 100), step: 100 };
  }
  if (maxCs <= 2500) {
    return { max: Math.ceil(maxCs / 500) * 500, step: 500 };
  }
  if (maxCs <= 6000) {
    return { max: Math.ceil(maxCs / 1000) * 1000, step: 1000 };
  }
  return { max: Math.ceil(maxCs / 3000) * 3000, step: 3000 };
}

// NOTE: 刻度标签——根据数值大小切换 (秒 vs 分:秒)
function tickLabel(cs: number): string {
  if (cs < 6000) return String(cs / 100);
  return fmtTime(cs);
}

export default function Top10HistoryPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [data, setData] = useState<Top10Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('single');
  const [dateMs, setDateMs] = useState<number>(isoToMs(VIEW_START));
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const [, setFlagBust] = useState(0);

  useEffect(() => {
    fetch('/stats/data/top10_history.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j: Top10Json) => setData(j))
      .catch(e => setError(String(e?.message || e)));
  }, []);

  useEffect(() => {
    loadFlagData().then(() => setFlagBust(v => v + 1));
  }, []);

  const panel = data?.panels[metric];
  const events = panel?.events ?? [];

  const endMs = useMemo(() => {
    if (events.length === 0) return isoToMs(VIEW_START) + DAY_MS;
    return isoToMs(events[events.length - 1].d) + DAY_MS;
  }, [events]);
  const startMs = useMemo(() => isoToMs(VIEW_START), []);

  useEffect(() => {
    setDateMs(prev => Math.max(startMs, Math.min(endMs, prev)));
  }, [startMs, endMs]);

  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const endMsRef = useRef(endMs);
  playingRef.current = playing;
  speedRef.current = speed;
  endMsRef.current = endMs;

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastT) / 1000;
      lastT = t;
      if (playingRef.current) {
        setDateMs(prev => {
          const next = prev + speedRef.current * DAY_MS * dt;
          if (next >= endMsRef.current) {
            playingRef.current = false;
            setPlaying(false);
            return endMsRef.current;
          }
          return next;
        });
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

  // NOTE: 轴尺度 — 用当前 top-10 最慢成绩 round up
  const axisMaxCs = top10.length > 0 ? top10[top10.length - 1].v : 1000;
  const axis = useMemo(() => axisFor(axisMaxCs), [axisMaxCs]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let v = 0; v <= axis.max; v += axis.step) out.push(v);
    return out;
  }, [axis]);

  // NOTE: WR holder 信息(参考视频左上角)
  const top1Person = replay?.top1Pid ? panel?.persons[replay.top1Pid] : null;
  const top1DurationDays = replay?.top1SinceDate
    ? Math.max(0, Math.floor((isoToMs(dateIso) - isoToMs(replay.top1SinceDate)) / DAY_MS))
    : 0;

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDateMs(Number(e.target.value));
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying(p => {
      if (!p && Math.floor(dateMs) >= endMs - 1) setDateMs(startMs);
      return !p;
    });
  }, [dateMs, endMs, startMs]);

  if (error) {
    return <div className="t10h-status">{isZh ? '加载失败' : 'Failed to load'}: {error}</div>;
  }
  if (!data || !panel) {
    return <div className="t10h-status">{isZh ? '加载中...' : 'Loading...'}</div>;
  }

  const top1Name = top1Person ? displayCuberName(top1Person.name, isZh) : '';

  return (
    <div className="t10h-page">
      <div className="t10h-toolbar">
        <div className="t10h-toolbar-title">
          {isZh ? '3x3 全历史 TOP 10 演化' : 'All-time top 10 — 3x3'}
        </div>
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
              onClick={() => setMetric('average')}
            >{isZh ? '平均' : 'Average'}</button>
          </div>
          <LangToggle />
        </div>
      </div>

      <div className="t10h-stage">
        <div className="t10h-banner">
          <div className="t10h-holder">
            {top1Person?.iso2 && (
              <Flag iso2={top1Person.iso2} className="t10h-holder-flag" />
            )}
            <div className="t10h-holder-text">
              <div className="t10h-holder-name">{top1Name}</div>
              <div className="t10h-holder-sub">
                {isZh
                  ? `保持纪录 ${top1DurationDays} 天`
                  : `World record holder for ${top1DurationDays} days`}
              </div>
            </div>
          </div>
          <div className="t10h-bigtitle">
            <div className="t10h-bigtitle-pre">
              <EventIcon event="333" className="t10h-bigtitle-icon" />
              <span>
                {isZh
                  ? (metric === 'single' ? '单次' : '平均')
                  : (metric === 'single' ? 'Singles' : 'Avgs')}
              </span>
            </div>
            <div className="t10h-bigdate">{dateIso}</div>
          </div>
        </div>

        <div className="t10h-axis" aria-hidden="true">
          {ticks.map(v => (
            <span key={v} className="t10h-tick" style={{ left: `${(v / axis.max) * BAR_FRAC}%` }}>
              {tickLabel(v)}
            </span>
          ))}
        </div>

        <div
          className="t10h-bars"
          style={{ ['--rows' as string]: SHOW_N }}
        >
          <div className="t10h-grid" aria-hidden="true">
            {ticks.map(v => (
              <span
                key={v}
                className={`t10h-grid-line${v === 0 ? ' t10h-grid-line-zero' : ''}`}
                style={{ left: `${(v / axis.max) * BAR_FRAC}%` }}
              />
            ))}
          </div>

          {top10.map(row => {
            const person = panel.persons[row.pid];
            const comp = panel.comps[row.c];
            const compNameRaw = comp?.name ?? row.c;
            const compName = localizeCompName(row.c, compNameRaw, isZh);
            const personName = person ? displayCuberName(person.name, isZh) : row.pid;
            const widthPct = (row.v / axis.max) * BAR_FRAC;
            const rank = rankByPid.get(row.pid) ?? 0;
            const color = colorForPerson(row.pid);
            const compIso2 = compFlagIso2(row.c);
            return (
              <div
                key={row.pid}
                className="t10h-row"
                style={{ ['--rank' as string]: rank }}
              >
                <div className="t10h-rank">{rank + 1}</div>
                <div
                  className="t10h-bar"
                  style={{ width: `${widthPct}%`, background: color }}
                >
                  {person?.iso2 && (
                    <Flag iso2={person.iso2} className="t10h-bar-flag" />
                  )}
                  <span className="t10h-bar-name">{personName}</span>
                </div>
                <span className="t10h-value">{fmtTime(row.v)}</span>
                <div className="t10h-comp" title={`${compName} · ${row.d}`}>
                  {compIso2 && <Flag iso2={compIso2} className="t10h-comp-flag" />}
                  <span className="t10h-comp-name">{compName}</span>
                </div>
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
        <div className="t10h-speed" role="group" aria-label={isZh ? '速度' : 'Speed'}>
          {SPEEDS.map(s => (
            <button
              key={s}
              type="button"
              className={s === speed ? 'active' : ''}
              onClick={() => setSpeed(s)}
              title={isZh ? `${s} 天/秒` : `${s} days/sec`}
            >{s}d/s</button>
          ))}
        </div>
      </footer>

      {panel.events.length > 0 && (
        <div className="t10h-note">
          {isZh
            ? `数据自 1982-06(WC1982),默认视图自 2003-08。共 ${panel.events.length} 次 PB 事件,涉及 ${Object.keys(panel.persons).length} 名曾进过历史 TOP ${panel.topK} 的选手。`
            : `Data since 1982-06 (WC1982); default view starts at 2003-08. ${panel.events.length} PB events from ${Object.keys(panel.persons).length} cubers who were ever in the historical top ${panel.topK}.`}
        </div>
      )}
    </div>
  );
}
