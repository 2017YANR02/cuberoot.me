'use client';

// Ported from packages/client/src/pages/wca_stats/SumOfRanksPage.tsx.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';

// echarts-for-react 仅客户端(无 SSR),历史名人堂的时间线图用.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
import Paginator from '@/components/wca-stats/Paginator';
import { EventIcon } from '@/components/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import type { WcaPersonLite } from '@/lib/wca-api';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
];
// 默认榜单 = 17 活跃项;另追加 4 个废止项(脚拧/八板/十二板/旧多盲)作可勾选额外项,默认不选.
// 顺序须与 server RANK_EVENTS 一致(ranks 数组按此对齐).
const CANCELLED_EVENTS = ['333ft', 'magic', 'mmagic', '333mbo'];
const RANK_EVENTS = [...ACTIVE_EVENTS, ...CANCELLED_EVENTS];
const RANK_EVENT_SET = new Set(RANK_EVENTS);
const ACTIVE_EVENT_SET = new Set(ACTIVE_EVENTS);
const CANCELLED_SET = new Set(CANCELLED_EVENTS);
const PAGE_SIZE_OPTIONS = [50, 100, 200];

// 项目快速分类(对齐 cubing.pro):点一个 = 直接替换当前选中项
const EVENT_CATEGORIES: { key: string; zh: string; en: string; events: string[] }[] = [
  { key: 'speed', zh: '速拧', en: 'Speed', events: ['333','222','444','555','666','777','333oh','clock','minx','pyram','skewb','sq1']
},
  { key: 'quiet', zh: '安静', en: 'Quiet', events: ['333bf','333fm','444bf','555bf','333mbf']
},
  { key: 'blind', zh: '盲拧', en: 'Blind', events: ['333bf','444bf','555bf','333mbf']
},
  { key: 'cubic', zh: '正阶', en: 'Cubic', events: ['333','222','444','555','666','777','333oh']
},
  { key: 'sub25', zh: '二至五阶', en: '2-5', events: ['222','333','444','555']
},
  { key: 'shape', zh: '异形', en: 'Other', events: ['clock','minx','pyram','skewb','sq1']
},
];

interface Row {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  eventsDone: number;
  totalWorldRank?: number;
  totalCountryRank?: number;
  subsetTotal?: number;
  ranks: number[];
}

// combos = all subsets tied at `rank` (fewest events first, capped server-side); comboCount = full tied count.
// `events` is the legacy single-combo shape — kept so the client renders before the server/data upgrade lands.
interface ComboBest { rank: number; combos?: string[][]; events?: string[]; comboCount?: number; }
interface PlayerBest {
  wcaId: string; name: string; countryId: string; iso2: string | null;
  best: { single?: ComboBest; average?: ComboBest };
}
interface CensusRow { rank: number; wcaId: string; name: string; iso2: string | null; subsetsWon: number; }
interface Census { type: string; inclCancelled: boolean; noPodium?: boolean; year: number | null; years: number[]; distinct: number; totalSubsets: number; rows: CensusRow[]; }
interface TimelinePoint { year: number; distinct: number; }

function SumOfRanksPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const personHref = (id: string) => `/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${id}`;
  useDocumentTitle('名次和', 'Sum of Ranks');
  // 全部筛选状态走 nuqs(replace,不堆历史);多键改动用 setQ 批量提交一次 URL
  const [q, setQ] = useQueryStates(
    {
      type: parseAsString,
      country: parseAsString,
      events: parseAsString,
      hidePodium: parseAsString,
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const type = (q.type ?? 'single') as 'single' | 'average';
  const country = q.country ?? '';
  const eventsParam = q.events ?? '';
  const hidePodium = q.hidePodium === '1';
  const page = parseInt(q.page ?? '1', 10);
  const size = parseInt(q.size ?? '100', 10);

  const selectedSet = new Set(eventsParam ? eventsParam.split(',').filter(Boolean) : ACTIVE_EVENTS);
  const selectedCount = RANK_EVENTS.filter(e => selectedSet.has(e)).length;
  // 废止项(脚拧/八板/十二板/旧多盲)"开"= 选中里含任一废止项 (取消其一只要还剩一个就仍算开,不误关).
  // 控制三处: PillToggle 显隐 + selector 是否展示废止项 (否则一个不选时也不渲染 ▾ 三角) + 名人堂/选手
  // 最优的"含废止项"口径 (21 项全集). 主榜单走精确选中子集, 不受此布尔影响.
  const includeCancelled = CANCELLED_EVENTS.some(e => selectedSet.has(e));
  const update = (k: string, v: string, resetPage = true) => {
    setQ({ [k]: v || null, ...(resetPage ? { page: null } : {}) } as Parameters<typeof setQ>[0]);
  };
  const toggleEvent = (ev: string) => {
    const cur = new Set(selectedSet);
    if (cur.has(ev)) cur.delete(ev); else cur.add(ev);
    // 恰好选中 17 活跃项 → 折叠成默认(空 param,走快路径);否则按 RANK_EVENTS 顺序序列化
    if (cur.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => cur.has(e))) update('events', '');
    else update('events', RANK_EVENTS.filter(e => cur.has(e)).join(','));
  };
  // 替换选中项为给定集合(全选 / 分类快速筛选);恰好 17 活跃项则折叠成默认空 param
  const setEvents = (events: string[]) => {
    const set = new Set(events);
    if (set.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => set.has(e))) update('events', '');
    else update('events', RANK_EVENTS.filter(e => set.has(e)).join(','));
  };
  const selectAll = () => setEvents(ACTIVE_EVENTS);
  const clearAll = () => update('events', '__none__');
  // 含废止项:勾上=把 4 个废止项加进当前选择,取消=移除
  const onToggleCancelled = (on: boolean) => {
    if (on) setEvents([...selectedSet, ...CANCELLED_EVENTS]);
    else setEvents([...selectedSet].filter(e => !CANCELLED_SET.has(e)));
  };
  const activeCategory = EVENT_CATEGORIES.find(
    c => c.events.length === selectedSet.size && c.events.every(e => selectedSet.has(e)),
  )?.key;
  // 把"最优组合"应用到主榜单(组合是世界口径 → 清掉国家筛选 + 切到对应 type)
  const applyCombo = (events: string[], comboType: 'single' | 'average') => {
    const set = new Set(events);
    const eventsVal = (set.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => set.has(e)))
      ? null
      : RANK_EVENTS.filter(e => set.has(e)).join(',');
    setQ({ type: comboType, country: null, page: null, events: eventsVal });
  };

  const [data, setData] = useState<{ rows: Row[]; total: number; events: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useCountries();

  // Q1: 指定选手最优组合
  const [picked, setPicked] = useState<WcaPersonLite | null>(null);
  const [pb, setPb] = useState<PlayerBest | null>(null);
  const [pbLoading, setPbLoading] = useState(false);
  const [pbError, setPbError] = useState(false);
  // Q2: 名人堂(懒加载,展开才拉)
  const [census, setCensus] = useState<Census | null>(null);
  const [censusOpen, setCensusOpen] = useState(false);
  const [censusExpanded, setCensusExpanded] = useState(false);
  const [censusYear, setCensusYear] = useState<number | null>(null); // null = 最新年
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);

  useEffect(() => {
    if (eventsParam === '__none__') { setData(null); setError(tr({ zh: '请至少选择一个项目', en: 'Select at least one event',
        zhHant: "請至少選擇一個專案"
    })); return; }
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (eventsParam && eventsParam !== '__none__') qs.set('events', eventsParam);
    if (hidePodium) qs.set('hidePodium', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [type, country, eventsParam, hidePodium, page, size, isZh]);

  // 选手最优组合(15s 超时, 防 dev proxy / 后端 stall 时永远转圈)
  // 跟随"废止项"开关: 含废止时搜索 21 项, 否则仅 17 活跃项(与名人堂/主榜单同口径).
  useEffect(() => {
    if (!picked) { setPb(null); setPbError(false); return; }
    setPbLoading(true); setPbError(false);
    let done = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    // v=4: bust 24h 缓存(浏览器 + nginx)里旧响应 — 现按 cancelled 分二态(17活跃/21含废止)
    const qs = new URLSearchParams({ wcaId: picked.id, v: '4' });
    if (includeCancelled) qs.set('cancelled', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks/player-best?${qs.toString()}`), { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!done) { setPb(d); setPbError(d == null); } })
      .catch(() => { if (!done) { setPb(null); setPbError(true); } })
      .finally(() => { clearTimeout(timer); if (!done) setPbLoading(false); });
    return () => { done = true; clearTimeout(timer); ctrl.abort(); };
  }, [picked, includeCancelled]);

  // 名人堂某年名单(展开时 + type/含废止/未登台/年份变化时拉)
  useEffect(() => {
    if (!censusOpen) return;
    setCensus(null); setCensusExpanded(false);
    const qs = new URLSearchParams({ type, v: '3' }); // v: bust 缓存(新增 no_podium 维度)
    if (includeCancelled) qs.set('cancelled', '1');
    if (hidePodium) qs.set('no_podium', '1');
    if (censusYear != null) qs.set('year', String(censusYear));
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?${qs.toString()}`))
      .then(r => (r.ok ? r.json() : null)).then(setCensus).catch(() => {});
  }, [censusOpen, type, includeCancelled, hidePodium, censusYear]);

  // 名人堂历年人数时间线(年份变化不重拉,只随 type/含废止变).
  // v1: 未登台口径只有最新年一个点, 不画时间线.
  useEffect(() => {
    if (!censusOpen || hidePodium) { setTimeline(null); return; }
    const qs = new URLSearchParams({ type, timeline: '1' });
    if (includeCancelled) qs.set('cancelled', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?${qs.toString()}`))
      .then(r => (r.ok ? r.json() : null)).then(d => setTimeline(d?.points ?? null)).catch(() => {});
  }, [censusOpen, type, includeCancelled, hidePodium]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const isCountryMode = !!country;

  // 时间线图 option(本页 dark-locked,echarts 不解析 CSS var → 运行时取 token 值)
  const selYear = census?.year ?? null;
  // 显示年份: 优先 census.year, 回退到 years 末项(防 stale 缓存里旧响应缺 year 时显示 undefined)
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
          `${ps[0]!.axisValue}<br/>${tr({ zh: '人数', en: 'cubers',
              zhHant: "人數"
        })}: <b>${ps[0]!.data}</b>`,
      },
      xAxis: {
        type: 'category' as const,
        data: timeline.map(p => p.year),
        axisLabel: { color: fg, fontSize: 10 },
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        minInterval: 1,
        axisLabel: { color: fg, fontSize: 10 },
        splitLine: { lineStyle: { color: grid, opacity: 0.4 } },
      },
      series: [{
        type: 'line' as const,
        data: timeline.map(p => p.distinct),
        smooth: true,
        symbol: 'circle' as const,
        symbolSize: (_v: number, p: { dataIndex: number }) => (timeline[p.dataIndex]!.year === selYear ? 10 : 4),
        itemStyle: { color: accent },
        lineStyle: { color: accent, width: 2 },
        areaStyle: { color: accent, opacity: 0.12 },
      }],
    };
  }, [timeline, selYear, isZh]);
  const onChartEvents = useMemo(() => ({
    click: (p: { dataIndex?: number }) => {
      if (timeline && p.dataIndex != null) setCensusYear(timeline[p.dataIndex]!.year);
    },
  }), [timeline]);

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}</Link>
        </div>
        <h1 className="wse-title-row">
          {tr({ zh: '全项目排名', en: 'Sum of Ranks',
              zhHant: "全專案排名"
        })}
          <Link
            href="/wca/about/sum-of-ranks"
            className="wse-title-help"
            title={tr({ zh: '这页是干啥的?', en: 'What is this page?',
                zhHant: "這頁是幹啥的?"
            })}
            aria-label={tr({ zh: '查看说明', en: 'About this page',
                zhHant: "檢視說明"
            })}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{tr({ zh: '把所选项目的(世界 / 国家)排名相加,缺项以该项目"参赛人数+1"(比倒数第一再差一名)计入。"未登领奖台" 按比赛决赛(final round)实际名次过滤', en: 'Sum of (world / country) ranks across selected events; missing events default to "participants+1" (one worse than last). "No podium" filters by actual final-round position',
            zhHant: "把所選專案的(世界 / 國家)排名相加,缺項以該專案\"參賽人數+1\"(比倒數第一再差一名)計入。\"未登領獎臺\" 按比賽決賽(final round)實際名次過濾"
        })}</p>
      </header>

      <div className="wse-filters">
        <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
        <div className="wse-filter">
          <label>{tr({ zh: '类型', en: 'Type',
              zhHant: "型別"
        })}</label>
          <select value={type} onChange={e => update('type', e.target.value)}>
            <option value="single">{tr({ zh: '单次', en: 'Single',
                zhHant: "單次"
            })}</option>
            <option value="average">{tr({ zh: '平均', en: 'Average' })}</option>
          </select>
        </div>
        <div className="wse-filter">
          <label>{tr({ zh: '过滤', en: 'Filter',
              zhHant: "過濾"
        })}</label>
          <PillToggle
            className="wse-pill"
            value={hidePodium}
            onChange={v => {
              setQ({ hidePodium: v ? '1' : null, page: null });
            }}
            onLabel={tr({ zh: '未登领奖台', en: 'No podium',
                zhHant: "未登領獎臺"
            })}
            offLabel={tr({ zh: '未登领奖台', en: 'No podium',
                zhHant: "未登領獎臺"
            })}
          />
        </div>
        <div className="wse-filter" style={{ minWidth: '100%' }}>
          <label>{isZh ? `项目(已选 ${selectedCount} / ${RANK_EVENTS.length})` : `Events (${selectedCount}/${RANK_EVENTS.length} selected)`}</label>
          <div className="wse-events-bar">
            <button type="button" onClick={selectAll}>{tr({ zh: '全选', en: 'All',
                zhHant: "全選"
            })}</button>
            <button type="button" onClick={clearAll}>{tr({ zh: '清除', en: 'None' })}</button>
            {EVENT_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setEvents(cat.events)}
                className={activeCategory === cat.key ? 'wse-cat-on' : undefined}
              >
                {(i18n.language.startsWith('zh') ? cat.zh : cat.en)}
              </button>
            ))}
            <PillToggle
              className="wse-pill"
              value={includeCancelled}
              onChange={onToggleCancelled}
              onLabel={tr({ zh: '废止项', en: 'Cancelled',
                  zhHant: "廢止項"
            })}
              offLabel={tr({ zh: '废止项', en: 'Cancelled',
                  zhHant: "廢止項"
            })}
            />
          </div>
          <WcaEventSelector
            availableEvents={includeCancelled ? RANK_EVENT_SET : ACTIVE_EVENT_SET}
            selectedEvents={selectedSet}
            onToggle={toggleEvent}
            isZh={isZh}
            onlyAvailable
          />
        </div>
      </div>

      {/* Q1: 指定选手最优项目组合 */}
      <div className="sor-tool">
        <label className="sor-tool-label">{tr({ zh: '查选手的最优项目组合', en: "A cuber's best event combination",
            zhHant: "查選手的最優專案組合"
        })}</label>
        <WcaPersonPicker
          value={picked}
          onChange={setPicked}
          isZh={isZh}
          placeholder={tr({ zh: '搜索选手名 / WCA ID', en: 'Search name / WCA ID',
              zhHant: "搜尋選手名 / WCA ID"
        })}
          className="sor-tool-picker"
        />
        {pbLoading && <div className="sor-tool-hint">{tr({ zh: '计算中…', en: 'Loading…',
            zhHant: "計算中…"
        })}</div>}
        {pbError && !pbLoading && <div className="sor-tool-hint">{tr({ zh: '加载超时,请重试', en: 'Timed out, try again',
            zhHant: "載入超時,請重試"
        })}</div>}
        {pb && !pbLoading && (
          <div className="sor-pb">
            <div className="sor-pb-head">
              {pb.iso2 && <Flag iso2={pb.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
              <Link prefetch={false} href={personHref(pb.wcaId)}>{displayCuberName(pb.name, isZh)}</Link>
            </div>
            {(() => {
              // 跟随顶部类型选择器: 选平均就看平均最优组合, 没有则提示(不再同时堆单次+平均).
              const b = pb.best[type];
              if (!b) {
                const typeZh = type === 'average' ? '平均' : '单次';
                const other = type === 'average' ? 'single' : 'average';
                const hasOther = !!pb.best[other];
                return (
                  <div className="sor-tool-hint">
                    {isZh
                      ? `该选手在全部 21 个项目里都没有有效${typeZh}成绩(${type === 'average' ? '比如只打过多盲等无平均的项目,或平均全 DNF' : '单次记录缺失'})${hasOther ? `;但有${other === 'average' ? '平均' : '单次'}最优组合,切上方“类型”查看` : ''}`
                      : `No valid ${type} result in any of the 21 events${hasOther ? ` — but a ${other} combo exists, switch "Type" above` : ''}`}
                  </div>
                );
              }
              const typeLabel = type === 'single' ? (tr({ zh: '单次', en: 'Single',
                  zhHant: "單次"
            })) : (tr({ zh: '平均', en: 'Average' }));
              const combos = b.combos ?? (b.events ? [b.events] : []);
              const comboCount = b.comboCount ?? combos.length;
              return (
                <>
                  <div className="sor-pb-rank-line">
                    <span className="sor-pb-type">{typeLabel}</span>
                    <span className="sor-pb-rank">{isZh ? `世界第 ${b.rank}` : `World #${b.rank}`}</span>
                    {comboCount > 1 && (
                      <span className="sor-pb-count">{isZh ? `${comboCount} 种组合并列` : `${comboCount} tied combos`}</span>
                    )}
                  </div>
                  <ul className="sor-pb-combos">
                    {combos.map((evs, i) => (
                      <li key={i} className="sor-pb-combo">
                        <span className="sor-pb-events">{evs.map(ev => <EventIcon key={ev} event={ev} />)}</span>
                        <button type="button" className="sor-pb-apply" onClick={() => applyCombo(evs, type)}>{tr({ zh: '应用到榜单', en: 'Apply',
                            zhHant: "應用到榜單"
                        })}</button>
                      </li>
                    ))}
                  </ul>
                  {comboCount > combos.length && (
                    <div className="sor-pb-note">{isZh ? `仅列出项目数最少的 ${combos.length} 种` : `Showing the ${combos.length} with fewest events`}</div>
                  )}
                </>
              );
            })()}
            {pb.best[type] && <div className="sor-pb-note">{isZh ? `上面每个组合都能让 TA 的名次和排到该名次(世界口径,${includeCancelled ? '含废止项' : '仅活跃项'})` : `Each combination ties them at that sum-of-ranks position (world, ${includeCancelled ? 'incl. cancelled' : 'active only'})`}</div>}
          </div>
        )}
      </div>

      {/* Q2: 名人堂 — 谁当过名次和第一 */}
      <div className="sor-census">
        <button type="button" className="sor-census-toggle" onClick={() => setCensusOpen(o => !o)} aria-expanded={censusOpen}>
          {censusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {tr({ zh: '名人堂:谁当过名次和第一?', en: 'Hall of fame: who has ever been #1?',
              zhHant: "名人堂:誰當過名次和第一?"
        })}
        </button>
        {censusOpen && (
          <div className="sor-census-body">
            <div className="sor-census-controls">
              {census && (census.years?.length ?? 0) > 1 && census.year != null && (
                <label className="sor-census-year">
                  {tr({ zh: '截至', en: 'As of' })}
                  <select value={census.year} onChange={e => setCensusYear(parseInt(e.target.value, 10))}>
                    {[...census.years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              )}
            </div>
            {chartOption && (
              <div className="sor-census-chart">
                <ReactECharts option={chartOption} style={{ height: 190, width: '100%' }} opts={{ renderer: 'canvas' }} onEvents={onChartEvents} />
                <div className="sor-census-chart-hint">{tr({ zh: '历年“名次和第一”不同人数 — 点某年看名单', en: 'Distinct #1-holders by year — click a year',
                    zhHant: "歷年“名次和第一”不同人數 — 點某年看名單"
                })}</div>
              </div>
            )}
            {!census && <div className="sor-tool-hint">{tr({ zh: '加载中…', en: 'Loading…',
                zhHant: "載入中…"
            })}</div>}
            {census && (
              <>
                <p className="sor-census-lead">{isZh
                  ? `${censusYearLabel != null ? `截至 ${censusYearLabel} 年末,` : ''}${hidePodium ? '在从未登上比赛领奖台的选手中,' : ''}有 ${census.distinct} 名选手曾在 ${census.totalSubsets.toLocaleString()} 种项目组合的至少一种里排到“名次和第一”(${type === 'average' ? '平均' : '单次'}${includeCancelled ? ',含废止项' : ''},世界口径)。`
                  : `${censusYearLabel != null ? `As of end of ${censusYearLabel}, ` : ''}${hidePodium ? 'among cubers who have never reached a competition podium, ' : ''}${census.distinct} cubers have ranked #1 in at least one of ${census.totalSubsets.toLocaleString()} event combinations (${type}${includeCancelled ? ', incl. cancelled' : ''}, world).`}</p>
                <ol className="sor-census-list">
                  {(censusExpanded ? census.rows : census.rows.slice(0, 12)).map(r => {
                    const share = r.subsetsWon / census.totalSubsets * 100;
                    return (
                      <li key={r.wcaId}>
                        <span className="sor-census-rank">{r.rank}</span>
                        {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                        <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                        <span className="sor-census-share">{share < 0.1 ? share.toFixed(3) : share.toFixed(1)}%</span>
                      </li>
                    );
                  })}
                </ol>
                {census.rows.length > 12 && (
                  <button type="button" className="sor-census-more" onClick={() => setCensusExpanded(e => !e)}>
                    {censusExpanded ? (tr({ zh: '收起', en: 'Show less' })) : (isZh ? `展开全部 ${census.distinct} 人` : `Show all ${census.distinct}`)}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...',
            zhHant: "載入中..."
        })}</div>}
        {error && <div className="wse-state wse-state-error">{error}</div>}
        {data && !loading && (
          <>
            <div className="wse-result-meta">{isZh ? `共 ${data.total.toLocaleString()} 人` : `${data.total.toLocaleString()} cubers`}</div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{tr({ zh: '选手', en: 'Person',
                      zhHant: "選手"
                })}</th>
                  {RANK_EVENTS.map(ev => (
                    <th key={ev} className="wse-sor-evcell" style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}>
                      <EventIcon event={ev} />
                    </th>
                  ))}
                  <th className="wse-value-col">{tr({ zh: '名次总和', en: 'Total',
                      zhHant: "名次總和"
                })}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.wcaId}>
                    <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                    <td>
                      <span className="wse-person-cell">
                        {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                        <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                      </span>
                    </td>
                    {RANK_EVENTS.map((ev, j) => {
                      const rk = r.ranks[j] ?? 0;
                      const cls = rk > 0 && rk <= 3 ? `wse-sor-evcell podium-${rk}` :
                                  rk === 0 ? 'wse-sor-evcell empty' : 'wse-sor-evcell';
                      return (
                        <td key={ev} className={cls} style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}>
                          {rk > 0 ? rk : ''}
                        </td>
                      );
                    })}
                    <td className="wse-value-col">{
                      r.subsetTotal != null ? r.subsetTotal :
                      isCountryMode ? r.totalCountryRank :
                      r.totalWorldRank
                    }</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.total > size && (
              <Paginator
                page={page}
                totalPages={totalPages}
                size={size}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                isZh={isZh}
                onPageChange={(p) => update('page', String(p), false)}
                onSizeChange={(s) => update('size', String(s))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SumOfRanksPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <SumOfRanksPageInner />
    </Suspense>
  );
}
