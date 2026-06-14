'use client';

// NOTE: SOR(名次和)排名演化 — bar chart race
//   展示完全复用 wr_metric:横条/坐标轴/网格走共享 <BarRaceChart>(0 锚定 + 真实值长度),
//   scope 选择走共享 <RegionPicker>(世界/大洲/国家三态 + 国旗 + 双语)。本组件只负责
//   取数(年帧)+ 播放控制 + banner/note。数据源:stats/sor_over_time.json(索引)
//   + stats/sor_over_time/{scope}.json(per-scope lazy)。
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause } from 'lucide-react';
import Link from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/name-utils';
import { loadFlagData, compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compLinkProps } from '@/lib/comp-link';
import { wcaPersonUrl } from '@/lib/recon-utils';
import { statsUrl } from '@/lib/stats-base';
import { countryName } from '@/lib/country-name';
import { CONTINENT_HUE } from '@/lib/bar-race-colors';
import { type Continent } from '@/lib/country-continents';
import { niceAxis } from '@/lib/top10-axis';
import { RegionPicker } from '@/components/RegionPicker';
import BarRaceChart from '@/components/wca-stats/BarRaceChart';
import { tr } from '@/i18n/tr';
import './top10_history.css';
import './sor-race.css';

interface FrameRow { p: string; v: number; r: number; c?: string }
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
  comps: Record<string, string>;
  persons: Record<string, PersonInfo>;
}

type Metric = 'single' | 'average';

const SHOW_N = 10;
const DEFAULT_SPEED = 850;
const SPEEDS = [
  { ms: 1400, zh: '慢', en: 'Slow' },
  { ms: 850, zh: '标准', en: 'Normal' },
  { ms: 450, zh: '快', en: 'Fast' },
] as const;

// RegionPicker 的大洲 value 是 slug;SOR 数据/文件按大洲全名。
const CONT_SLUG_TO_NAME: Record<string, string> = {
  africa: 'Africa', asia: 'Asia', europe: 'Europe',
  northAmerica: 'North America', oceania: 'Oceania', southAmerica: 'South America',
};
const CONTINENT_LABEL: Record<string, { zh: string; en: string; }> = {
  'Asia': { zh: '亚洲', en: 'Asia' },
  'Europe': { zh: '欧洲', en: 'Europe' },
  'Africa': { zh: '非洲', en: 'Africa' },
  'North America': { zh: '北美洲', en: 'N. America' },
  'South America': { zh: '南美洲', en: 'S. America' },
  'Oceania': { zh: '大洋洲', en: 'Oceania' },
};

function rowHeightPx(): number {
  if (typeof window === 'undefined') return 44;
  if (window.matchMedia('(max-width: 480px)').matches) return 34;
  if (window.matchMedia('(max-width: 768px)').matches) return 38;
  return 44;
}

export default function SorRace() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [index, setIndex] = useState<SorIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  // region: 'world' | 大洲 slug | 国家 iso2(小写,RegionPicker 约定)
  const [region, setRegion] = useState<string>('world');
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

  useEffect(() => {
    fetch(statsUrl('/stats/sor_over_time.json'))
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j: SorIndex) => setIndex(j))
      .catch(e => setError(String(e?.message || e)));
  }, []);

  const scopeKey = useMemo(() => {
    if (region === 'world') return 'world';
    const cn = CONT_SLUG_TO_NAME[region];
    if (cn) return `continent/${cn.replace(/\s+/g, '_')}`;
    return `country/${region.toUpperCase()}`;
  }, [region]);

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
  const worstV = top.length ? top[top.length - 1]!.v : 1;
  const axis = useMemo(() => niceAxis(worstV), [worstV]);

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
    if (region === 'world') return tr({ zh: '世界', en: 'World' });
    const cn = CONT_SLUG_TO_NAME[region];
    if (cn) return CONTINENT_LABEL[cn] ? tr(CONTINENT_LABEL[cn]!) : cn;
    return countryName(region, isZh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, isZh]);

  if (error) {
    return <div className="t10h-status">{tr({ zh: '加载失败', en: 'Failed to load' })}: {error}</div>;
  }
  if (!index) {
    return <div className="t10h-status">{tr({ zh: '加载中...', en: 'Loading...' })}</div>;
  }

  const curYear = curFrame?.y ?? index.years[0];
  const metricLabel = metric === 'single'
    ? tr({ zh: '单次', en: 'Single' })
    : tr({ zh: '平均', en: 'Average' });
  const countriesIso2 = index.scopes.countries.map(c => c.iso2);

  return (
    <div className="t10h-page t10h-embedded sor-race">
      {/* ── 顶部控制条:scope(RegionPicker)+ metric ── */}
      <div className="sor-race-bar">
        <RegionPicker
          isZh={isZh}
          value={region}
          onChange={setRegion}
          restrictTo={countriesIso2}
          allLabel={tr({ zh: '世界', en: 'World' })}
          searchPlaceholder={tr({ zh: '搜索地区...', en: 'Search region...' })}
          className="sor-race-region"
        />
        <div className="t10h-metric-toggle" role="tablist" style={{ marginLeft: 'auto' }}>
          <button type="button" role="tab" aria-selected={metric === 'single'}
            className={metric === 'single' ? 'active' : ''} onClick={() => setMetric('single')}>
            {tr({ zh: '单次', en: 'Single' })}
          </button>
          <button type="button" role="tab" aria-selected={metric === 'average'}
            className={metric === 'average' ? 'active' : ''} onClick={() => setMetric('average')}>
            {tr({ zh: '平均', en: 'Average' })}
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
                {leaderInfo ? displayCuberName(leaderInfo.name, isZh) : (loading ? tr({ zh: '加载中…', en: 'Loading…' }) : '')}
              </div>
              <div className="t10h-holder-sub">
                {leader && (isZh
                  ? `${scopeLabel} SOR 第一${streak > 1 ? ` 蝉联 ${streak} 年` : ''}`
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

        <BarRaceChart
          rows={top.map(row => {
            const p = persons[row.p];
            const cid = row.c;
            const compName = cid ? localizeCompName(cid, index.comps?.[cid] ?? cid, isZh) : '';
            const compIso2 = cid ? compFlagIso2(cid) : '';
            return {
              key: row.p,
              href: wcaPersonUrl(row.p),
              name: p ? displayCuberName(p.name, isZh) : row.p,
              iso2: p?.iso2 ?? null,
              country: p?.country,
              value: row.v,
              valueLabel: row.v.toLocaleString(),
              rankLabel: row.r,
              trailing: cid ? (
                <Link className="t10h-comp" {...compLinkProps(cid)} title={compName}>
                  {compIso2 && <Flag iso2={compIso2} className="t10h-comp-flag" />}
                  <span className="t10h-comp-name">{compName}</span>
                </Link>
              ) : undefined,
            };
          })}
          axisMax={axis.max}
          ticks={axis.ticks}
          tickLabel={(v) => v.toLocaleString()}
          rowH={rowH}
          showN={SHOW_N}
          emptyText={loading
            ? tr({ zh: '加载中...', en: 'Loading...' })
            : tr({ zh: '该范围暂无数据', en: 'No data for this scope' })}
        />
      </div>

      {/* ── 控制条 ── */}
      <footer className="t10h-controls">
        <button type="button" className="t10h-play" onClick={togglePlay}
          aria-label={playing ? tr({ zh: '暂停', en: 'Pause' }) : tr({ zh: '播放', en: 'Play' })}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <input className="t10h-scrub" type="range" min={0} max={Math.max(0, frames.length - 1)} step={1}
          value={Math.min(yearIdx, Math.max(0, frames.length - 1))}
          onChange={e => { setPlaying(false); setYearIdx(Number(e.target.value)); }}
          aria-label={tr({ zh: '年份', en: 'Year' })} />
        <div className="t10h-speed" role="group" aria-label={tr({ zh: '速度', en: 'Speed' })}>
          {SPEEDS.map(s => (
            <button key={s.ms} type="button" className={s.ms === speed ? 'active' : ''} onClick={() => setSpeed(s.ms)}>
              {tr({ zh: s.zh, en: s.en })}
            </button>
          ))}
        </div>
      </footer>

      <div className="t10h-note">
        {tr({
          zh: 'SOR(名次和)= 一个人在 17 个现役项目上世界排名之和,越小越强;缺项按该项参与人数 + 1 计罚分。条形长度为真实 SOR 值(0 起),越短越强。',
          en: "SOR (Sum of Ranks) = a cuber's world ranks across the 17 active events summed; lower is stronger. Missing events count as participants + 1. Bar length is the actual SOR from 0; shorter is stronger."
        })}
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
