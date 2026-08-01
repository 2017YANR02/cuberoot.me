'use client';

/**
 * /timezone —— 时区换算 + 通话时段。
 *
 * 场景是「和海外朋友约视频」:选自己的时区、填一个时刻,就能读到对方那边是几点几号;
 * 再往下是一整天的 24 小时对照条和「双方都醒着」的时段推荐,免得来回试。
 *
 * 时区数学全在 _lib/tz.ts(纯 Intl,不引日期库),城市名与搜索别名在 _lib/zones.ts。
 * 本文件只做状态与呈现。
 *
 * 状态分两层:
 *   URL(nuqs)—— home / tz / d / t / ws / we,整页可分享,发给朋友打开就是同一屏。
 *   localStorage —— 上次用的时区,只在 URL 没带时区时兜底,不写回 URL(链接保持干净)。
 *
 * 整页内容都依赖「现在几点」和本机时区,SSG 出来的 HTML 里没有真值,所以挂载前只渲染
 * 标题与骨架 —— 不是偷懒,是避开 SSR/CSR 文案错配(React #418)。
 *
 * 走时性能:秒针每秒都动,凡是「一天之内不会变」的量(24 小时网格、换时日期、选择器里的
 * 偏移列)全部按「当天」而不是按「此刻」记忆化,否则每秒要重跑几百次 Intl 格式化。
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import { Check, Copy, Plus, RotateCcw, X } from 'lucide-react';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { Flag } from '@/components/Flag';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import { useCopy } from '@/hooks/useCopy';
import { persistItem } from '@/lib/safe-storage';
import { tr, useLang } from '@/i18n/tr';
import {
  comfortWindows, dateKey, dayDelta, dstInfo, formatOffset, hourBand, hourGrid,
  isValidZone, localZone, nextTransition, parseDateTime, timeKey, wallPartsIn,
  wallToUtc, zoneAbbrev, zoneOffsetMinutes,
  type WallParts,
} from './_lib/tz';
import { isPopularZone, zoneIso2, zoneLabel, zoneOptions, zoneSearchTerms } from './_lib/zones';
import './timezone.css';

const STORE_KEY = 'cuberoot-timezone.v1';
/** 没有任何存档时的初始对方时区 —— 常见的两头:美西和英国。 */
const DEFAULT_OTHERS = ['America/Los_Angeles', 'Europe/London'];
/** 一屏最多几个对方时区(再多 24 小时条就没法读了)。 */
const MAX_ZONES = 8;
/** 换时提醒只看未来这么多天,再远和当下约通话无关。 */
const TRANSITION_HORIZON_DAYS = 120;

interface Stored { home: string; zones: string[]; }

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    const home = typeof v.home === 'string' && isValidZone(v.home) ? v.home : '';
    const zones = Array.isArray(v.zones) ? v.zones.filter((z) => typeof z === 'string' && isValidZone(z)) : [];
    if (!home && zones.length === 0) return null;
    return { home, zones };
  } catch {
    return null;
  }
}

/** 分钟差 → 「13 小时」/「5 小时 30 分」/「45 分」 */
function formatSpan(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return tr({ zh: `${h} 小时 ${m} 分`, en: `${h}h ${m}m` });
  if (h) return tr({ zh: `${h} 小时`, en: `${h}h` });
  return tr({ zh: `${m} 分`, en: `${m}m` });
}

/** 时差文案(相对「我的时区」)。 */
function offsetPhrase(diffMin: number): string {
  if (diffMin === 0) return tr({ zh: '与你同步', en: 'Same time as you' });
  const span = formatSpan(Math.abs(diffMin));
  return diffMin > 0
    ? tr({ zh: `比你早 ${span}`, en: `${span} ahead of you` })
    : tr({ zh: `比你晚 ${span}`, en: `${span} behind you` });
}

/** 「8月2日 周日」/「Sun, Aug 2」。按 UTC 格式化 —— 传进来的已是目标时区的墙上日期。 */
function formatDayLabel(p: WallParts): string {
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  return new Intl.DateTimeFormat(tr({ zh: 'zh-CN', en: 'en-US' }), {
    timeZone: 'UTC', month: 'short', day: 'numeric', weekday: 'short',
  }).format(d);
}

function dayDeltaLabel(delta: number): string {
  const n = Math.abs(delta);
  return delta > 0
    ? tr({ zh: `晚 ${n} 天`, en: `+${n}d` })
    : tr({ zh: `早 ${n} 天`, en: `−${n}d` });
}

const BAND_LABELS = {
  night: { zh: '深夜', en: 'Night' },
  early: { zh: '清早', en: 'Early' },
  day: { zh: '白天', en: 'Daytime' },
  evening: { zh: '晚上', en: 'Evening' },
} as const;

function TimezonePage() {
  const isZh = useLang() === 'zh';

  // ── 现在几点 ──────────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date(0));
  useEffect(() => {
    setMounted(true);
    // 卡片上有秒,所以不能用 setInterval(1000) —— 它的相位取决于挂载那一刻,秒数会整体
    // 偏出系统时钟最多一秒,而且 timer 节流下越走越飘。每次都对齐到下一个整秒再跳。
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      id = setTimeout(tick, 1000 - (d.getTime() % 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  // ── URL 状态 ──────────────────────────────────────────────────────────────
  const [homeParam, setHomeParam] = useQueryState('home', parseAsString.withDefault(''));
  const [zonesParam, setZonesParam] = useQueryState('tz', parseAsString.withDefault(''));
  const [dateParam, setDateParam] = useQueryState('d', parseAsString.withDefault(''));
  const [timeParam, setTimeParam] = useQueryState('t', parseAsString.withDefault(''));
  const [winStartRaw, setWinStart] = useQueryState('ws', parseAsInteger.withDefault(9));
  const [winEndRaw, setWinEnd] = useQueryState('we', parseAsInteger.withDefault(22));
  // URL 是用户能手改的,越界值钳回合法范围。
  const winStart = Math.min(23, Math.max(0, winStartRaw));
  const winEnd = Math.min(24, Math.max(1, winEndRaw));

  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => { setStored(readStored()); }, []);

  // 本机时区只在挂载后取:SSG 时服务端是 UTC,直接用会和客户端首帧对不上。
  const browserTz = useMemo(() => (mounted ? localZone() : 'UTC'), [mounted]);
  const home = (homeParam && isValidZone(homeParam) ? homeParam : '')
    || stored?.home
    || browserTz;

  const others = useMemo<string[]>(() => {
    const raw = zonesParam ? zonesParam.split(',') : (stored ? stored.zones : DEFAULT_OTHERS);
    const seen = new Set<string>([home]);
    const out: string[] = [];
    for (const s of raw) {
      const tz = s.trim();
      if (!tz || seen.has(tz) || !isValidZone(tz)) continue;
      seen.add(tz);
      out.push(tz);
      if (out.length >= MAX_ZONES) break;
    }
    return out;
  }, [zonesParam, stored, home]);

  const allTz = useMemo(() => [home, ...others], [home, others]);

  // 存档只在挂载后写,且只存本机偏好;URL 不因此变脏。
  useEffect(() => {
    if (!mounted) return;
    persistItem(STORE_KEY, JSON.stringify({ home, zones: others }));
  }, [mounted, home, others]);

  const setOthers = useCallback((next: string[]) => {
    void setZonesParam(next.length ? next.join(',') : null);
  }, [setZonesParam]);

  // ── 基准时刻 ──────────────────────────────────────────────────────────────
  // 没钉住时刻就跟着秒针走(现在模式);钉住了就固定成那一刻。
  const pinned = useMemo(() => parseDateTime(dateParam, timeParam), [dateParam, timeParam]);
  const baseAt = useMemo(() => (pinned ? wallToUtc(home, pinned) : now), [pinned, home, now]);
  const homeWall = useMemo(() => wallPartsIn(home, baseAt), [home, baseAt]);
  const homeOffset = useMemo(() => zoneOffsetMinutes(home, baseAt), [home, baseAt]);
  const isLive = !pinned;

  // 「当天」:一天之内不变的量都挂在它上面,秒针走动不会让它们重算。
  const day = useMemo(
    () => ({ y: homeWall.y, mo: homeWall.mo, d: homeWall.d }),
    [homeWall.y, homeWall.mo, homeWall.d],
  );
  // 当天的一个稳定锚点(UTC 正午,避开任何时区的日界),给换时查询与选择器偏移列用。
  const dayAnchor = useMemo(() => new Date(Date.UTC(day.y, day.mo - 1, day.d, 12)), [day]);

  const pinAt = useCallback((p: WallParts) => {
    void setDateParam(dateKey(p));
    void setTimeParam(timeKey(p));
  }, [setDateParam, setTimeParam]);

  const backToNow = useCallback(() => {
    void setDateParam(null);
    void setTimeParam(null);
  }, [setDateParam, setTimeParam]);

  // ── 时区选择器的候选项 ────────────────────────────────────────────────────
  // 偏移列只给常用表里的城市算:全量 IANA 有 400+ 条,每条都建一个 Intl 格式化器会卡住首帧。
  const zoneItems = useMemo<ListSelectItem[]>(() => zoneOptions().map((z) => ({
    value: z.tz,
    label: isZh ? z.zh : z.en,
    hint: isPopularZone(z.tz) ? formatOffset(zoneOffsetMinutes(z.tz, dayAnchor)) : undefined,
    searchTerms: zoneSearchTerms(z),
    country: z.iso2 ? z.iso2.toLowerCase() : undefined,
  })), [isZh, dayAnchor]);

  // ── 24 小时对照 ──────────────────────────────────────────────────────────
  const grid = useMemo(() => hourGrid(home, day, allTz), [home, day, allTz]);
  const windows = useMemo(() => comfortWindows(grid, winStart, winEnd), [grid, winStart, winEnd]);

  // ── 复制 ─────────────────────────────────────────────────────────────────
  const { copied, copy } = useCopy();
  const copyText = useCallback(() => {
    const lines = allTz.map((tz) => {
      const w = wallPartsIn(tz, baseAt);
      const off = formatOffset(zoneOffsetMinutes(tz, baseAt));
      return `${dateKey(w)} ${timeKey(w)}  ${zoneLabel(tz, isZh)} (${off})`;
    });
    copy(lines.join('\n'));
  }, [allTz, baseAt, isZh, copy]);

  const title = tr({ zh: '时区', en: 'Time Zones' });
  const searchPlaceholder = tr({ zh: '搜城市 / 国家 / 时区', en: 'Search city, country or zone' });

  if (!mounted) {
    return (
      <div className="tz-page">
        <div className="tz-topbar"><BackHome /><HeaderToggles /></div>
        <h1>{title}</h1>
        <div className="tz-skeleton" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="tz-page">
      <div className="tz-topbar">
        <BackHome />
        <HeaderToggles />
      </div>

      <header className="tz-header">
        <h1>{title}</h1>
        <p>{tr({
          zh: '选好自己的时区和时间,下面就是朋友那边的时间;再往下是一整天的对照条和双方都方便的通话时段。',
          en: 'Pick your zone and a time — see what it is where your friends are, then scan the whole day for hours that work for everyone.',
        })}</p>
      </header>

      {/* ── 基准:我的时区 + 时刻 ── */}
      <section className="tz-base">
        <div className="tz-field">
          <span className="tz-field-label">{tr({ zh: '我的时区', en: 'My time zone' })}</span>
          <ListSelect
            className="tz-picker"
            items={zoneItems}
            value={home}
            onChange={(next) => { if (next) void setHomeParam(next); }}
            allLabel={tr({ zh: '选择时区', en: 'Pick a zone' })}
            searchPlaceholder={searchPlaceholder}
            searchable
            clearable={false}
            maxVisible={60}
          />
        </div>

        <label className="tz-field">
          <span className="tz-field-label">{tr({ zh: '日期', en: 'Date' })}</span>
          <input
            type="date"
            className="tz-input"
            value={dateKey(homeWall)}
            onChange={(e) => {
              const p = parseDateTime(e.target.value, timeKey(homeWall));
              if (p) pinAt(p);
            }}
          />
        </label>

        <label className="tz-field">
          <span className="tz-field-label">{tr({ zh: '时间', en: 'Time' })}</span>
          <input
            type="time"
            className="tz-input"
            value={timeKey(homeWall)}
            onChange={(e) => {
              const p = parseDateTime(dateKey(homeWall), e.target.value);
              if (p) pinAt(p);
            }}
          />
        </label>

        <button
          type="button"
          className={`tz-now-btn${isLive ? ' is-live' : ''}`}
          onClick={backToNow}
          disabled={isLive}
        >
          <RotateCcw size={14} aria-hidden="true" />
          {isLive ? tr({ zh: '正在走时', en: 'Live' }) : tr({ zh: '回到现在', en: 'Now' })}
        </button>
      </section>

      {/* ── 各时区的这一刻 ── */}
      <section className="tz-cards">
        {allTz.map((tz, i) => (
          <ZoneCard
            key={tz}
            tz={tz}
            isHome={i === 0}
            at={baseAt}
            dayAnchor={dayAnchor}
            homeWall={homeWall}
            homeOffset={homeOffset}
            isZh={isZh}
            onRemove={i === 0 ? undefined : () => setOthers(others.filter((z) => z !== tz))}
          />
        ))}
      </section>

      <div className="tz-actions">
        {others.length < MAX_ZONES && (
          <div className="tz-add">
            <Plus size={16} aria-hidden="true" />
            <ListSelect
              className="tz-picker"
              items={zoneItems}
              value=""
              onChange={(next) => { if (next) setOthers([...others, next]); }}
              allLabel={tr({ zh: '添加对方的时区', en: 'Add a time zone' })}
              searchPlaceholder={searchPlaceholder}
              searchable
              clearable={false}
              maxVisible={60}
            />
          </div>
        )}
        <button type="button" className="tz-copy-btn" onClick={copyText}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制各地时间', en: 'Copy all times' })}
        </button>
      </div>

      {/* ── 一整天的对照条 ── */}
      <section className="tz-strip-section">
        <h2>{tr({ zh: '一整天', en: 'The whole day' })}</h2>
        <p className="tz-note">{tr({
          zh: `列是 ${zoneLabel(home, true)} 在 ${dateKey(homeWall)} 的每个整点,点任一格就把上面的时刻钉到那里。`,
          en: `Columns are the hours of ${dateKey(homeWall)} in ${zoneLabel(home, false)}. Click any cell to jump to that hour.`,
        })}</p>
        <div className="tz-strip-scroll">
          <table className="tz-strip">
            <thead>
              <tr>
                <th className="tz-strip-rowhead" scope="col">{tr({ zh: '时区', en: 'Zone' })}</th>
                {grid.map((col) => (
                  <th key={col.baseHour} scope="col" className="tz-strip-hour">{col.baseHour}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTz.map((tz, zi) => {
                // 印度 / 尼泊尔这类半点时区,整行的分钟是同一个值 —— 标在行首,格子里只放整点,
                // 否则每格都写 "18:30" 会把 24 列撑到必须横滚。极少数时区(如豪勋爵岛)换时会
                // 连分钟一起改,那一行退回逐格显示。
                const minutes = new Set(grid.map((col) => col.cells[zi].minute));
                const rowMinute = minutes.size === 1 ? grid[0].cells[zi].minute : -1;
                return (
                  <tr key={tz}>
                    <th className="tz-strip-rowhead" scope="row">
                      <span className="tz-strip-zone">{zoneLabel(tz, isZh)}</span>
                      {rowMinute > 0 && <span className="tz-strip-min">:{String(rowMinute).padStart(2, '0')}</span>}
                    </th>
                    {grid.map((col) => {
                      const cell = col.cells[zi];
                      const selected = col.baseHour === homeWall.h;
                      return (
                        <td key={col.baseHour} className="tz-strip-cellwrap">
                          <button
                            type="button"
                            className={`tz-strip-cell band-${cell.band}${selected ? ' is-selected' : ''}`}
                            onClick={() => pinAt({ y: day.y, mo: day.mo, d: day.d, h: col.baseHour, mi: 0, s: 0 })}
                            title={`${zoneLabel(tz, isZh)} ${String(cell.hour).padStart(2, '0')}:${String(cell.minute).padStart(2, '0')}`}
                          >
                            <span className="tz-strip-num">
                              {rowMinute < 0 && cell.minute
                                ? `${cell.hour}:${String(cell.minute).padStart(2, '0')}`
                                : cell.hour}
                            </span>
                            {cell.dayDelta !== 0 && (
                              <span className="tz-strip-delta">{cell.dayDelta > 0 ? '+1' : '−1'}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tz-legend">
          {(['night', 'early', 'day', 'evening'] as const).map((b) => (
            <span key={b} className="tz-legend-item">
              <i className={`tz-legend-swatch band-${b}`} aria-hidden="true" />
              {tr(BAND_LABELS[b])}
            </span>
          ))}
        </div>
      </section>

      {/* ── 通话时段推荐 ── */}
      <section className="tz-meet">
        <h2>{tr({ zh: '都方便的时段', en: 'When everyone is up' })}</h2>
        <div className="tz-meet-controls">
          <span className="tz-field-label">{tr({ zh: '可接受时段', en: 'Acceptable hours' })}</span>
          <HourSelect value={winStart} onChange={(v) => void setWinStart(v)} />
          <span className="tz-dash">–</span>
          <HourSelect value={winEnd} onChange={(v) => void setWinEnd(v)} max={24} />
        </div>
        <p className="tz-note">{tr({
          zh: '每个人的本地时间都要落在这一区间才算数;起点晚于终点则视为跨夜(如 22 – 6)。',
          en: 'Every local time has to fall inside the range; a start later than the end means overnight (e.g. 22 – 6).',
        })}</p>

        {windows.length === 0 ? (
          <p className="tz-empty">{tr({
            zh: '这一天没有所有人都在该区间的整点 —— 把区间放宽,或者接受一方早起 / 晚睡。',
            en: 'No hour of this day works for everyone — widen the range, or accept an early morning for one side.',
          })}</p>
        ) : (
          <ul className="tz-window-list">
            {windows.map((w) => (
              <li key={w.startHour} className="tz-window">
                <div className="tz-window-head">
                  <span className="tz-window-range">
                    {`${String(w.startHour).padStart(2, '0')}:00 – ${String(w.endHour).padStart(2, '0')}:00`}
                    <em>{zoneLabel(home, isZh)}</em>
                  </span>
                  <button
                    type="button"
                    className="tz-window-pick"
                    onClick={() => pinAt({ y: day.y, mo: day.mo, d: day.d, h: w.startHour, mi: 0, s: 0 })}
                  >
                    {tr({ zh: '试这个时段', en: 'Try it' })}
                  </button>
                </div>
                <div className="tz-window-zones">
                  {others.map((tz) => {
                    const a = wallPartsIn(tz, w.start);
                    const b = wallPartsIn(tz, w.end);
                    const delta = dayDelta(day, a);
                    return (
                      <span key={tz} className="tz-window-zone">
                        <span className="tz-window-zone-name">{zoneLabel(tz, isZh)}</span>
                        {timeKey(a)}–{timeKey(b)}
                        {delta !== 0 && <em className="tz-window-day">{dayDeltaLabel(delta)}</em>}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="tz-foot">{tr({
        zh: '换算走浏览器自带的 IANA 时区库,夏令时规则随系统更新,页面不缓存任何偏移表。',
        en: 'Conversions use the browser’s built-in IANA time zone data, so daylight-saving rules stay current with your system.',
      })}</p>
    </div>
  );
}

/** 时区卡片:大字时间 + 日期 + 偏移 / 缩写 / 夏令时 / 与我的时差 / 下次换时。 */
function ZoneCard({ tz, isHome, at, dayAnchor, homeWall, homeOffset, isZh, onRemove }: {
  tz: string;
  isHome: boolean;
  at: Date;
  /** 当天的稳定锚点 —— 换时查询要扫 120 天,不能每秒重跑 */
  dayAnchor: Date;
  homeWall: WallParts;
  homeOffset: number;
  isZh: boolean;
  onRemove?: () => void;
}) {
  const w = wallPartsIn(tz, at);
  const offset = zoneOffsetMinutes(tz, at);
  const abbrev = zoneAbbrev(tz, at);
  const dst = dstInfo(tz, at);
  const delta = dayDelta(homeWall, w);
  const iso2 = zoneIso2(tz);
  const band = hourBand(w.h);

  const transition = useMemo(
    () => nextTransition(tz, dayAnchor, TRANSITION_HORIZON_DAYS),
    [tz, dayAnchor],
  );

  return (
    <article className={`tz-card band-${band}${isHome ? ' is-home' : ''}`}>
      <div className="tz-card-top">
        {iso2 && <Flag iso2={iso2.toLowerCase()} className="tz-card-flag" />}
        <span className="tz-card-city">{zoneLabel(tz, isZh)}</span>
        {isHome && <span className="tz-card-mine">{tr({ zh: '我', en: 'Me' })}</span>}
        {onRemove && (
          <button
            type="button"
            className="tz-card-remove"
            onClick={onRemove}
            aria-label={tr({ zh: '移除该时区', en: 'Remove zone' })}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="tz-card-time">
        {/* 秒是次要读数,压小一号:钉住时刻时它恒为 :00,别让它抢走分钟的位置 */}
        <span className="tz-card-clock">
          {timeKey(w)}<span className="tz-card-sec">:{String(w.s).padStart(2, '0')}</span>
        </span>
        <span className="tz-card-date">
          {formatDayLabel(w)}
          {delta !== 0 && <em className="tz-card-daydelta">{dayDeltaLabel(delta)}</em>}
        </span>
      </div>

      <div className="tz-card-meta">
        <span>{formatOffset(offset)}</span>
        {abbrev && <span>{abbrev}</span>}
        {dst.active && <span className="tz-card-dst">{tr({ zh: '夏令时', en: 'DST' })}</span>}
        {!isHome && <span className="tz-card-diff">{offsetPhrase(offset - homeOffset)}</span>}
      </div>

      {transition && (
        <div className="tz-card-transition">
          {tr({
            zh: `${dateKey(wallPartsIn(tz, transition.at))} 换时 → ${formatOffset(transition.after)}`,
            en: `Clocks change ${dateKey(wallPartsIn(tz, transition.at))} → ${formatOffset(transition.after)}`,
          })}
        </div>
      )}

      <div className="tz-card-tz">{tz}</div>
    </article>
  );
}

function HourSelect({ value, onChange, max = 23 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <select
      className="tz-hour-select"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={tr({ zh: '小时', en: 'Hour' })}
    >
      {Array.from({ length: max + 1 }, (_, h) => (
        <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
      ))}
    </select>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="tz-page" />}>
      <TimezonePage />
    </Suspense>
  );
}
