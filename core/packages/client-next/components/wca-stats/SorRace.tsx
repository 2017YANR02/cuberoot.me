'use client';

// NOTE: SOR(名次和)排名演化 — bar chart race
//   数据源:stats/sor_over_time.json(索引) + stats/sor_over_time/{scope}.json(per-scope lazy)
//   复用 Top10HistoryPage 的视觉系统(top10_history.css + colorForRow),但数据域不同:
//   年帧离散(2003..今)、整数 SOR 值(越小越强 → leader 最长条)、scope = 世界/大洲/国家。
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/name-utils';
import { loadFlagData } from '@/lib/country-flags';
import { wcaPersonUrl } from '@/lib/recon-utils';
import { statsUrl } from '@/lib/stats-base';
import { colorForRow, CONTINENT_HUE } from '@/lib/bar-race-colors';
import { type Continent } from '@/lib/country-continents';
import { tr } from '@/i18n/tr';
import './top10_history.css';
import './sor-race.css';

interface FrameRow { p: string; v: number; r: number }
interface YearFrame { y: number; rows: FrameRow[] }
interface ScopeData { single: YearFrame[]; average: YearFrame[] }
interface PersonInfo { name: string; country: string; iso2: string | null }
interface SorIndex {
  years: number[];
  storeK: number;
  showN: number;
  scopes: {
    world: boolean;
    continents: string[];
    countries: Array<{ iso2: string; id: string; name: string }>;
  };
  persons: Record<string, PersonInfo>;
}

type Metric = 'single' | 'average';
type ScopeKind = 'world' | 'continent' | 'country';

const SHOW_N = 10;
const MIN_BAR = 6;   // 最差可见条宽 %
const MAX_BAR = 62;  // leader 条宽 %
const SPEEDS = [
  { ms: 1400, labelZh: '慢', labelEn: 'Slow' },
  { ms: 850, labelZh: '标准', labelEn: 'Normal' },
  { ms: 450, labelZh: '快', labelEn: 'Fast' },
] as const;
const DEFAULT_SPEED = 850;

const CONTINENT_LABEL: Record<string, { zh: string; en: string; zhHant: string }> = {
  'Asia': { zh: '亚洲', en: 'Asia', zhHant: '亞洲' },
  'Europe': { zh: '欧洲', en: 'Europe', zhHant: '歐洲' },
  'Africa': { zh: '非洲', en: 'Africa', zhHant: '非洲' },
  'North America': { zh: '北美洲', en: 'N. America', zhHant: '北美洲' },
  'South America': { zh: '南美洲', en: 'S. America', zhHant: '南美洲' },
  'Oceania': { zh: '大洋洲', en: 'Oceania', zhHant: '大洋洲' },
};

function rowHeightPx(): number {
  if (typeof window === 'undefined') return 44;
  if (window.matchMedia('(max-width: 480px)').matches) return 34;
  if (window.matchMedia('(max-width: 768px)').matches) return 38;
  return 44;
}

function flagEmoji(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return '';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function SorRace() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [index, setIndex] = useState<SorIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scopeKind, setScopeKind] = useState<ScopeKind>('world');
  const [continentId, setContinentId] = useState<string>('Asia');
  const [countryIso, setCountryIso] = useState<string>('US');
  const [metric, setMetric] = useState<Metric>('single');
  const [cache] = useState<Map<string, ScopeData>>(() => new Map());
  const [, setCacheTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [yearIdx, setYearIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [rowH, setRowH] = useState(() => rowHeightPx());
  const [, setFlagBust] = useState(0);

  useEffect(() => { loadFlagData().then(() => setFlagBust(v => v + 1)); }, []);
  useEffect(() => {
    const onResize = () => setRowH(rowHeightPx());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 加载索引
  useEffect(() => {
    fetch(statsUrl('/stats/sor_over_time.json'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j: SorIndex) => setIndex(j))
      .catch(e => setError(String(e?.message || e)));
  }, []);

  const scopeKey = useMemo(() => {
    if (scopeKind === 'world') return 'world';
    if (scopeKind === 'continent') return `continent/${continentId.replace(/\s+/g, '_')}`;
    return `country/${countryIso}`;
  }, [scopeKind, continentId, countryIso]);

  // lazy fetch scope 文件
  useEffect(() => {
    if (!index) return;
    if (cache.has(scopeKey)) return;
    setLoading(true);
    fetch(statsUrl(`/stats/sor_over_time/${scopeKey}.json`))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: ScopeData) => { cache.set(scopeKey, d); setLoading(false); setCacheTick(t => t + 1); })
      .catch(e => { setLoading(false); console.error('sor scope fetch failed:', e); });
  }, [scopeKey, index, cache]);

  const data = cache.get(scopeKey);
  const frames: YearFrame[] = useMemo(() => data?.[metric] ?? [], [data, metric]);

  // frames 变化时:钳制 yearIdx 到末帧(默认看最新)
  const prevKeyRef = useRef('');
  useEffect(() => {
    if (frames.length === 0) return;
    const key = `${scopeKey}:${metric}`;
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      setYearIdx(frames.length - 1);
      setPlaying(false);
    } else {
      setYearIdx(i => Math.min(i, frames.length - 1));
    }
  }, [frames.length, scopeKey, metric]);

  // 播放:每 speed ms 推进一年
  const playingRef = useRef(playing); playingRef.current = playing;
  const speedRef = useRef(speed); speedRef.current = speed;
  const lenRef = useRef(frames.length); lenRef.current = frames.length;
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (cancelled) return;
      setYearIdx(i => {
        if (i >= lenRef.current - 1) { setPlaying(false); return i; }
        return i + 1;
      });
      timer = setTimeout(tick, speedRef.current);
    };
    timer = setTimeout(tick, speedRef.current);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playing, speed]);

  const curFrame = frames[Math.min(yearIdx, Math.max(0, frames.length - 1))];
  const top = useMemo(() => curFrame?.rows.slice(0, SHOW_N) ?? [], [curFrame]);
  const vmin = top.length ? top[0]!.v : 0;
  const vmax = top.length ? top[top.length - 1]!.v : 1;
  const barPct = useCallback((v: number) => {
    if (vmax === vmin) return MAX_BAR;
    return MIN_BAR + (MAX_BAR - MIN_BAR) * (vmax - v) / (vmax - vmin);
  }, [vmin, vmax]);

  const persons = index?.persons ?? {};
  const leader = top[0];
  const leaderInfo = leader ? persons[leader.p] : undefined;

  // 当前 #1 蝉联年数
  const streak = useMemo(() => {
    if (!leader || !frames.length) return 0;
    let n = 1;
    for (let i = yearIdx - 1; i >= 0; i--) {
      if (frames[i]?.rows[0]?.p === leader.p) n++; else break;
    }
    return n;
  }, [leader, frames, yearIdx]);

  const togglePlay = useCallback(() => {
    setPlaying(p => {
      if (!p && yearIdx >= frames.length - 1) setYearIdx(0);
      return !p;
    });
  }, [yearIdx, frames.length]);

  const scopeLabel = useMemo(() => {
    if (scopeKind === 'world') return tr({ zh: '世界', en: 'World', zhHant: '世界' });
    if (scopeKind === 'continent') {
      const l = CONTINENT_LABEL[continentId];
      return l ? tr(l) : continentId;
    }
    const c = index?.scopes.countries.find(x => x.iso2 === countryIso);
    return c?.name ?? countryIso;
  }, [scopeKind, continentId, countryIso, index]);

  if (error) {
    return <div className="t10h-status">{tr({ zh: '加载失败', en: 'Failed to load', zhHant: '載入失敗' })}: {error}</div>;
  }
  if (!index) {
    return <div className="t10h-status">{tr({ zh: '加载中...', en: 'Loading...', zhHant: '載入中...' })}</div>;
  }

  const curYear = curFrame?.y ?? index.years[0];
  const metricLabel = metric === 'single'
    ? tr({ zh: '单次', en: 'Single', zhHant: '單次' })
    : tr({ zh: '平均', en: 'Average', zhHant: '平均' });

  return (
    <div className="t10h-page t10h-embedded sor-race">
      {/* ── 顶部控制条:scope + metric ── */}
      <div className="sor-race-bar">
        <div className="t10h-speed" role="tablist">
          {(['world', 'continent', 'country'] as ScopeKind[]).map(k => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={scopeKind === k}
              className={scopeKind === k ? 'active' : ''}
              onClick={() => setScopeKind(k)}
            >
              {k === 'world' ? tr({ zh: '世界', en: 'World', zhHant: '世界' })
                : k === 'continent' ? tr({ zh: '大洲', en: 'Continent', zhHant: '大洲' })
                  : tr({ zh: '国家', en: 'Country', zhHant: '國家' })}
            </button>
          ))}
        </div>

        {scopeKind === 'continent' && (
          <select className="sor-race-select" value={continentId} onChange={e => setContinentId(e.target.value)}>
            {index.scopes.continents.map(c => (
              <option key={c} value={c}>{CONTINENT_LABEL[c] ? tr(CONTINENT_LABEL[c]!) : c}</option>
            ))}
          </select>
        )}
        {scopeKind === 'country' && (
          <select className="sor-race-select" value={countryIso} onChange={e => setCountryIso(e.target.value)}>
            {index.scopes.countries.map(c => (
              <option key={c.iso2} value={c.iso2}>{flagEmoji(c.iso2)} {c.name}</option>
            ))}
          </select>
        )}

        <div className="t10h-metric-toggle" role="tablist" style={{ marginLeft: 'auto' }}>
          <button type="button" role="tab" aria-selected={metric === 'single'}
            className={metric === 'single' ? 'active' : ''} onClick={() => setMetric('single')}>
            {tr({ zh: '单次', en: 'Single', zhHant: '單次' })}
          </button>
          <button type="button" role="tab" aria-selected={metric === 'average'}
            className={metric === 'average' ? 'active' : ''} onClick={() => setMetric('average')}>
            {tr({ zh: '平均', en: 'Average', zhHant: '平均' })}
          </button>
        </div>
      </div>

      {/* ── 黑色舞台 ── */}
      <div className="t10h-stage">
        <div className="t10h-banner">
          <div className="t10h-holder">
            {leaderInfo?.iso2 && <Flag iso2={leaderInfo.iso2} className="t10h-holder-flag" />}
            <div className="t10h-holder-text">
              <div className="t10h-holder-name">
                {leaderInfo ? displayCuberName(leaderInfo.name, isZh) : (loading ? tr({ zh: '加载中…', en: 'Loading…', zhHant: '載入中…' }) : '')}
              </div>
              <div className="t10h-holder-sub">
                {leader && (isZh
                  ? `${scopeLabel} SOR 第一${streak > 1 ? ` · 蝉联 ${streak} 年` : ''}`
                  : `${scopeLabel} SOR #1${streak > 1 ? ` · ${streak} yrs` : ''}`)}
              </div>
            </div>
          </div>
          <div className="t10h-bigtitle">
            <div className="t10h-bigtitle-pre">
              <span>{scopeLabel} {metricLabel} SOR</span>
            </div>
            <div className="t10h-bigdate">{curYear}</div>
          </div>
        </div>

        <div className="t10h-bars" style={{ height: `${SHOW_N * rowH}px` }}>
          {top.map((row, i) => {
            const p = persons[row.p];
            const name = p ? displayCuberName(p.name, isZh) : row.p;
            const color = colorForRow(row.p, p?.country);
            return (
              <div key={row.p} className="t10h-row" style={{ transform: `translateY(${i * rowH}px)` }}>
                <div className="t10h-rank">{row.r}</div>
                <a className="t10h-bar" href={wcaPersonUrl(row.p)} target="_blank" rel="noopener"
                  style={{ width: `${barPct(row.v)}%`, background: color }} title={name}>
                  {p?.iso2 && <Flag iso2={p.iso2} className="t10h-bar-flag" />}
                  <span className="t10h-bar-name">{name}</span>
                </a>
                <span className="t10h-value">{row.v.toLocaleString()}</span>
              </div>
            );
          })}
          {top.length === 0 && (
            <div className="t10h-status" style={{ padding: '40px 0' }}>
              {loading ? tr({ zh: '加载中...', en: 'Loading...', zhHant: '載入中...' }) : tr({ zh: '该范围暂无数据', en: 'No data for this scope', zhHant: '該範圍暫無資料' })}
            </div>
          )}
        </div>
      </div>

      {/* ── 控制条 ── */}
      <footer className="t10h-controls">
        <button type="button" className="t10h-play" onClick={togglePlay}
          aria-label={playing ? tr({ zh: '暂停', en: 'Pause', zhHant: '暫停' }) : tr({ zh: '播放', en: 'Play', zhHant: '播放' })}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input className="t10h-scrub" type="range" min={0} max={Math.max(0, frames.length - 1)} step={1}
          value={Math.min(yearIdx, Math.max(0, frames.length - 1))}
          onChange={e => { setPlaying(false); setYearIdx(Number(e.target.value)); }}
          aria-label={tr({ zh: '年份', en: 'Year', zhHant: '年份' })} />
        <div className="t10h-speed" role="group" aria-label={tr({ zh: '速度', en: 'Speed', zhHant: '速度' })}>
          {SPEEDS.map(s => (
            <button key={s.ms} type="button" className={s.ms === speed ? 'active' : ''} onClick={() => setSpeed(s.ms)}>
              {isZh ? s.labelZh : s.labelEn}
            </button>
          ))}
        </div>
      </footer>

      <div className="t10h-note">
        {isZh
          ? `SOR(名次和)= 一个人在 17 个现役项目上世界排名之和,越小越强;缺项按该项参与人数 + 1 计罚分。条形长度为同年相对强度,数字为真实 SOR 值。`
          : `SOR (Sum of Ranks) = a cuber's world ranks across the 17 active events summed; lower is stronger. Missing events count as participants + 1. Bar length is relative within the year; the number is the actual SOR.`}
        <div className="t10h-legend">
          {(Object.keys(CONTINENT_LABEL) as Continent[]).map(c => (
            <span key={c} className="t10h-legend-item">
              <span className="t10h-legend-swatch" style={{ background: `hsl(${CONTINENT_HUE[c]} 65% 50%)` }} />
              {tr(CONTINENT_LABEL[c]!)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
