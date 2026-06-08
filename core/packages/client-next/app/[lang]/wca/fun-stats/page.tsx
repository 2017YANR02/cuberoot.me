'use client';

// /wca/fun-stats 趣味统计 — port of cubingchina /results/statistics.
// 单一聚合页:左侧按家族选榜(?stat= 深链),顶部统一 region/事件/类型/年份控件,下方表格。
// 全部 23 榜支持 world / continent / country。数据走 /v1/wca/fun/*(wca_fs_* 预计算)。
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { RegionPicker } from '@/components/RegionPicker';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import Paginator from '@/components/wca-stats/Paginator';
import { useCountries } from '@/components/wca-stats/CountrySelect';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { displayCuberName } from '@/lib/cuber-name-display';
import { countryName } from '@/lib/country-name';
import { localizeCompName } from '@/lib/comp-localize';
import { loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { formatWcaResult } from '@/lib/wca-format-result';
import { apiUrl } from '@/lib/api-base';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './fun_stats.css';

const ACTIVE_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'minx', 'pyram', 'clock', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
];
const BEST_TYPE_EVENTS = new Set(['333fm', '333bf', '444bf', '555bf', '333mbf']);
const NO_AVERAGE = new Set(['444bf', '555bf', '333mbf']);
const PAGE_SIZE_OPTIONS = [50, 100, 200];

type FamKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
type Shape =
  | 'countrySor' | 'medals' | 'countPerson' | 'countComp' | 'bestPodiums'
  | 'misser' | 'recordsPerson' | 'recordsComp' | 'oldestRecords'
  | 'solvesPerson' | 'solvesPersonComp' | 'solvesComp' | 'top100';

interface FunStat {
  id: string;
  family: FamKey;
  zh: string; en: string;
  endpoint: string;            // /v1/wca/fun/<...>
  shape: Shape;
  fixed?: Record<string, string>;  // 固定 query 参数(type/pos/...)
  eventMode?: 'select' | 'multi';
  typeToggle?: boolean;        // 显示单次/平均切换(C 家族)
  needsYear?: boolean;         // E6
  countLabelZh?: string; countLabelEn?: string;  // countPerson/countComp 计数列标题
}

const FUN_STATS: FunStat[] = [
  // A 各地综合排行
  { id: 'country-sor-single', family: 'A', zh: '各地全项目单次综合排行榜', en: 'Sum of Country Ranks (Single)', endpoint: '/v1/wca/fun/country-sor', shape: 'countrySor', fixed: { type: 'single' }, eventMode: 'multi' },
  { id: 'country-sor-average', family: 'A', zh: '各地全项目平均综合排行榜', en: 'Sum of Country Ranks (Average)', endpoint: '/v1/wca/fun/country-sor', shape: 'countrySor', fixed: { type: 'average' }, eventMode: 'multi' },
  // B 奖牌 & 名次
  { id: 'medals-all', family: 'B', zh: '全项目累计奖牌榜', en: 'Medal Collection (All Events)', endpoint: '/v1/wca/fun/medals', shape: 'medals', fixed: { type: 'all' } },
  { id: 'medals-event', family: 'B', zh: '分项目累计奖牌榜', en: 'Medal Collection (by Event)', endpoint: '/v1/wca/fun/medals', shape: 'medals', fixed: { type: 'event' }, eventMode: 'select' },
  { id: 'most-second-all', family: 'B', zh: '全项目第二名次数', en: 'Most 2nd Places (All Events)', endpoint: '/v1/wca/fun/placements', shape: 'countPerson', fixed: { pos: '2', type: 'all' }, countLabelZh: '第二名次数', countLabelEn: '2nd Places' },
  { id: 'most-second-event', family: 'B', zh: '分项目第二名次数', en: 'Most 2nd Places (by Event)', endpoint: '/v1/wca/fun/placements', shape: 'countPerson', fixed: { pos: '2', type: 'event' }, eventMode: 'select', countLabelZh: '第二名次数', countLabelEn: '2nd Places' },
  { id: 'most-fourth-all', family: 'B', zh: '全项目第四名次数', en: 'Most 4th Places (All Events)', endpoint: '/v1/wca/fun/placements', shape: 'countPerson', fixed: { pos: '4', type: 'all' }, countLabelZh: '第四名次数', countLabelEn: '4th Places' },
  { id: 'most-fourth-event', family: 'B', zh: '分项目第四名次数', en: 'Most 4th Places (by Event)', endpoint: '/v1/wca/fun/placements', shape: 'countPerson', fixed: { pos: '4', type: 'event' }, eventMode: 'select', countLabelZh: '第四名次数', countLabelEn: '4th Places' },
  { id: 'best-podiums', family: 'B', zh: '赛事领奖台成绩榜', en: 'Best Podiums', endpoint: '/v1/wca/fun/best-podiums', shape: 'bestPodiums', eventMode: 'select' },
  // C 遗憾榜
  { id: 'uncrowned-kings', family: 'C', zh: '无冕之王', en: 'Uncrowned Kings', endpoint: '/v1/wca/fun/uncrowned-kings', shape: 'misser', eventMode: 'select', typeToggle: true },
  { id: 'podium-missers', family: 'C', zh: '奖牌遗珠', en: 'Podium Missers', endpoint: '/v1/wca/fun/podium-missers', shape: 'misser', eventMode: 'select', typeToggle: true },
  { id: 'record-missers', family: 'C', zh: '纪录之憾', en: 'Record Missers', endpoint: '/v1/wca/fun/record-missers', shape: 'misser', eventMode: 'select', typeToggle: true },
  // D 纪录
  { id: 'records-person', family: 'D', zh: '选手创纪录数量排行榜', en: 'Records Set (by Person)', endpoint: '/v1/wca/fun/records-person', shape: 'recordsPerson' },
  { id: 'records-comp', family: 'D', zh: '赛事创纪录数量排行榜', en: 'Records Set (by Competition)', endpoint: '/v1/wca/fun/records-comp', shape: 'recordsComp' },
  { id: 'oldest-records', family: 'D', zh: '纪录现保持时间排行榜', en: 'Oldest Standing Records', endpoint: '/v1/wca/fun/oldest-records', shape: 'oldestRecords' },
  // E 参赛 & 复原次数
  { id: 'most-comps-person', family: 'E', zh: '选手比赛次数', en: 'Most Competitions (Person)', endpoint: '/v1/wca/fun/most-comps-person', shape: 'countPerson', countLabelZh: '比赛次数', countLabelEn: 'Competitions' },
  { id: 'most-persons-comp', family: 'E', zh: '赛事选手人数', en: 'Most Competitors (Competition)', endpoint: '/v1/wca/fun/most-persons-comp', shape: 'countComp', countLabelZh: '选手人数', countLabelEn: 'Competitors' },
  { id: 'most-solves-person-comp', family: 'E', zh: '个人单场总复原次数', en: 'Most Solves in One Competition', endpoint: '/v1/wca/fun/most-solves-person-comp', shape: 'solvesPersonComp' },
  { id: 'most-solves-comp', family: 'E', zh: '赛事总复原次数', en: 'Most Total Solves (Competition)', endpoint: '/v1/wca/fun/most-solves-comp', shape: 'solvesComp' },
  { id: 'most-solves-person', family: 'E', zh: '个人累积总复原次数', en: 'Most Career Solves (Person)', endpoint: '/v1/wca/fun/most-solves-person', shape: 'solvesPerson' },
  { id: 'most-solves-person-year', family: 'E', zh: '个人年度总复原次数', en: 'Most Solves in One Year', endpoint: '/v1/wca/fun/most-solves-person-year', shape: 'solvesPerson', needsYear: true },
  // F Top100 占席
  { id: 'top100-appearances-single', family: 'F', zh: '各项单次成绩前100占席', en: 'Top-100 Single Appearances', endpoint: '/v1/wca/fun/top100-appearances', shape: 'top100', fixed: { type: 'single' }, eventMode: 'select' },
  { id: 'top100-appearances-average', family: 'F', zh: '各项平均成绩前100占席', en: 'Top-100 Average Appearances', endpoint: '/v1/wca/fun/top100-appearances', shape: 'top100', fixed: { type: 'average' }, eventMode: 'select' },
];

const FAMILIES: { key: FamKey; zh: string; en: string }[] = [
  { key: 'A', zh: '各地综合排行', en: 'Country Rankings' },
  { key: 'B', zh: '奖牌与名次', en: 'Medals & Placements' },
  { key: 'C', zh: '遗憾榜', en: 'Best Without' },
  { key: 'D', zh: '纪录', en: 'Records' },
  { key: 'E', zh: '参赛与复原', en: 'Participation & Solves' },
  { key: 'F', zh: 'Top100 占席', en: 'Top-100 Appearances' },
];

const STAT_BY_ID = new Map(FUN_STATS.map(s => [s.id, s]));

function defaultRankType(event: string): 'single' | 'average' {
  return BEST_TYPE_EVENTS.has(event) ? 'single' : 'average';
}

interface ApiResp { total?: number; rows?: Record<string, unknown>[]; years?: number[]; events?: string[]; penalties?: number[]; self?: Record<string, unknown> | null }

function FunStatsInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const lang = isZh ? 'zh' : 'en';
  useDocumentTitle('趣味统计', 'Fun Statistics');
  // 榜单选择(左侧导航)持久化到 ?stat=,沿用原 replace 语义(不堆历史)
  const [statParam, setStatParam] = useQueryState(
    'stat',
    parseAsString.withOptions({ history: 'replace', scroll: false }),
  );

  const statId = statParam || 'medals-all';
  const stat = STAT_BY_ID.get(statId) ?? FUN_STATS[0];

  const [region, setRegion] = useState('world');
  const [event, setEvent] = useState('333');
  const [typeAvg, setTypeAvg] = useState(false);   // C 家族单次/平均
  const [year, setYear] = useState(0);
  const [years, setYears] = useState<number[]>([]);
  const [selEvents, setSelEvents] = useState<Set<string>>(new Set());  // A 子集多选
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(100);

  const [resp, setResp] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 加载比赛中文名映射(comp_names_zh.json + cn-comp-names 兜底),完成后重渲染应用 zh 名
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { void loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); }); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const countries = useCountries();
  const restrictTo = useMemo(() => countries.map(c => c.iso2).filter((x): x is string => !!x), [countries]);

  const personHref = (id: string) => `/${lang}/wca/persons/${id}`;

  // F 平均变体排除无平均的项目(444bf/555bf/333mbf)
  const availableEvents = useMemo(() => {
    const base = ACTIVE_EVENTS.filter(e => !(stat.fixed?.type === 'average' && NO_AVERAGE.has(e)));
    return new Set(base);
  }, [stat.fixed?.type]);

  // 切榜重置分页 + 默认类型 + 清多选(避免上一个榜的子集泄漏到新榜)
  useEffect(() => { setPage(1); }, [statId, region, event, typeAvg, year, size]);
  useEffect(() => { setSelEvents(new Set()); }, [statId]);
  useEffect(() => {
    if (stat.typeToggle) setTypeAvg(defaultRankType(event) === 'average');
  }, [statId, event, stat.typeToggle]);

  // E6 年份列表
  useEffect(() => {
    if (!stat.needsYear) return;
    let alive = true;
    fetch(apiUrl(`/v1/wca/fun/most-solves-person-year/years?scope=${encodeURIComponent(region)}`))
      .then(r => r.json()).then((d: { years?: number[] }) => {
        if (!alive) return;
        const ys = d.years ?? [];
        setYears(ys);
        if (!ys.includes(year)) setYear(ys[0] ?? 0);
      }).catch(() => { if (alive) setYears([]); });
    return () => { alive = false; };
  }, [stat.needsYear, region]);

  // 主查询
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (stat.fixed) for (const [k, v] of Object.entries(stat.fixed)) qs.set(k, v);
    qs.set('scope', region);
    if (stat.eventMode === 'select') qs.set('event', event);
    if (stat.eventMode === 'multi') {
      const sel = [...selEvents].filter(e => availableEvents.has(e));
      if (sel.length > 0 && sel.length < availableEvents.size) qs.set('events', sel.join(','));
    }
    if (stat.typeToggle) qs.set('type', typeAvg ? 'average' : 'single');
    if (stat.needsYear && year) qs.set('year', String(year));
    qs.set('page', String(page));
    qs.set('size', String(size));
    setLoading(true); setErr(null);
    fetch(apiUrl(`${stat.endpoint}?${qs.toString()}`))
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ApiResp & { error?: string }) => { if (!alive) return; if (d.error) { setErr(d.error); setResp(null); } else setResp(d); })
      .catch(e => { if (alive) { setErr(String(e.message ?? e)); setResp(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [stat, region, event, typeAvg, year, page, size, selEvents, availableEvents]);

  const selectStat = (id: string) => {
    void setStatParam(id);
  };

  const rows = resp?.rows ?? [];
  const total = resp?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const kind = typeAvg ? 'average' : 'single';

  return (
    <div className="fun-stats">
      <h1 className="fun-stats-title">{isZh ? '趣味统计' : 'Fun Statistics'}</h1>
      <p className="fun-stats-intro">
        {isZh
          ? '基于 WCA 官方成绩的趣味排行,可选世界 / 洲际 / 国家。'
          : 'Fun leaderboards from official WCA results — pick World, a continent, or a country.'}
      </p>

      <div className="fun-stats-layout">
        {/* 榜单导航 */}
        <nav className="fun-stats-nav">
          {FAMILIES.map(fam => (
            <div key={fam.key} className="fun-stats-nav-group">
              <div className="fun-stats-nav-head">{isZh ? fam.zh : fam.en}</div>
              {FUN_STATS.filter(s => s.family === fam.key).map(s => (
                <button
                  key={s.id}
                  className={`fun-stats-nav-item${s.id === statId ? ' active' : ''}`}
                  onClick={() => selectStat(s.id)}
                >{isZh ? s.zh : s.en}</button>
              ))}
            </div>
          ))}
        </nav>

        <div className="fun-stats-main">
          <h2 className="fun-stats-stat-title">{isZh ? stat.zh : stat.en}</h2>

          {/* 控件 */}
          <div className="fun-stats-controls">
            <RegionPicker isZh={isZh} value={region} onChange={setRegion} restrictTo={restrictTo} />
            {stat.typeToggle && !NO_AVERAGE.has(event) && (
              <PillToggle
                value={typeAvg} onChange={setTypeAvg}
                onLabel={isZh ? '平均' : 'Average'} offLabel={isZh ? '单次' : 'Single'}
              />
            )}
            {stat.needsYear && years.length > 0 && (
              <select className="fun-stats-year" value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>

          {stat.eventMode === 'select' && (
            <WcaEventSelector
              availableEvents={availableEvents}
              isZh={isZh}
              selectedEvent={event}
              onSelect={setEvent}
            />
          )}
          {stat.eventMode === 'multi' && (
            <WcaEventSelector
              availableEvents={availableEvents}
              isZh={isZh}
              selectedEvents={selEvents.size ? selEvents : availableEvents}
              onToggle={(id) => setSelEvents(prev => {
                const base = prev.size ? new Set(prev) : new Set(availableEvents);
                if (base.has(id)) base.delete(id); else base.add(id);
                return base;
              })}
            />
          )}

          {err && <div className="fun-stats-error">{isZh ? '加载失败:' : 'Error: '}{err}</div>}
          {loading && !resp && <div className="fun-stats-loading">{isZh ? '加载中…' : 'Loading…'}</div>}

          {resp && (
            <FunStatTable
              stat={stat} rows={rows} resp={resp} isZh={isZh} kind={kind} event={event}
              personHref={personHref}
            />
          )}

          {total > 0 && (
            <Paginator
              page={page} totalPages={totalPages} size={size} pageSizeOptions={PAGE_SIZE_OPTIONS}
              isZh={isZh} onPageChange={setPage} onSizeChange={setSize}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── 表格渲染(按 shape 分流)──
function FunStatTable({ stat, rows, resp, isZh, kind, event, personHref }: {
  stat: FunStat; rows: Record<string, unknown>[]; resp: ApiResp; isZh: boolean;
  kind: 'single' | 'average'; event: string; personHref: (id: string) => string;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const personCell = (r: any) => (
    <span className="fun-cell-person">
      <Flag iso2={r.iso2 ?? ''} spanClassName="country-flag" imgClassName="country-flag-ct" />
      <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name ?? '', isZh)}</Link>
    </span>
  );
  const compCell = (r: any) => (
    <span className="fun-cell-comp">
      <Flag iso2={r.iso2 ?? r.compIso2 ?? ''} spanClassName="country-flag" imgClassName="country-flag-ct" />
      <span>{localizeCompName(r.compId, r.compName ?? '', isZh)}</span>
    </span>
  );
  const regionCell = (r: any) => (
    <span className="fun-cell-region">
      <Flag iso2={r.iso2 ?? ''} spanClassName="country-flag" imgClassName="country-flag-ct" />
      <span>{r.iso2 ? countryName(r.iso2, isZh) : (r.name ?? r.countryId)}</span>
    </span>
  );
  const solveCell = (r: any) => <span>{r.solve}<span className="fun-cell-sub"> / {r.attempt}</span></span>;

  if (rows.length === 0) {
    return <div className="fun-stats-empty">{t('暂无数据', 'No data')}</div>;
  }

  // A 各地综合排行(矩阵)
  if (stat.shape === 'countrySor') {
    const penalties = resp.penalties ?? [];
    const hideEv = (ev: string) => stat.fixed?.type === 'average' && NO_AVERAGE.has(ev);  // 平均榜下无平均项目不成列
    return (
      <div className="fun-stats-table-scroll">
        <table className="fun-stats-table fun-stats-matrix">
          <thead>
            <tr>
              <th>{t('名次', 'Rank')}</th>
              <th>{t('地区', 'Region')}</th>
              <th>{t('名次和', 'Sum')}</th>
              {ACTIVE_EVENTS.map(ev => hideEv(ev) ? null : <th key={ev}><EventIcon event={ev} className="fun-evt-icon" /></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={`${r.countryId ?? ''}-${i}`}>
                <td>{r.rank}</td>
                <td>{regionCell(r)}</td>
                <td className="fun-cell-strong">{r.sum}</td>
                {ACTIVE_EVENTS.map((ev, i) => {
                  if (hideEv(ev)) return null;
                  const v = r.perEventRank?.[i] ?? 0;
                  const isPenalty = v > 0 && penalties[i] !== undefined && v === penalties[i];
                  return <td key={ev} className={isPenalty ? 'fun-cell-penalty' : (v > 0 && v <= 10 ? 'fun-cell-top' : '')}>{v > 0 ? v : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 通用表头 + 行
  type Col = { h: string; cell: (r: any) => ReactNode; cls?: string };
  let cols: Col[] = [];
  switch (stat.shape) {
    case 'medals':
      cols = [
        { h: '#', cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('金', 'Gold'), cell: r => r.gold },
        { h: t('银', 'Silver'), cell: r => r.silver },
        { h: t('铜', 'Bronze'), cell: r => r.bronze },
        { h: t('合计', 'Sum'), cell: r => r.sum, cls: 'fun-cell-strong' },
      ];
      break;
    case 'countPerson':
      cols = [
        { h: '#', cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t(stat.countLabelZh ?? '次数', stat.countLabelEn ?? 'Count'), cell: r => r.count, cls: 'fun-cell-strong' },
      ];
      break;
    case 'countComp':
      cols = [
        { h: '#', cell: r => r.rank },
        { h: t('比赛', 'Competition'), cell: compCell },
        { h: t(stat.countLabelZh ?? '人数', stat.countLabelEn ?? 'Count'), cell: r => r.count, cls: 'fun-cell-strong' },
      ];
      break;
    case 'misser':
      cols = [
        { h: t('名次', 'Rank'), cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('地区', 'Region'), cell: regionCell },
        { h: t('个人最佳', 'Personal Record'), cell: r => formatWcaResult(r.value, event, kind), cls: 'fun-cell-strong' },
      ];
      break;
    case 'recordsPerson':
      cols = [
        { h: '#', cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('分数', 'Score'), cell: r => r.score, cls: 'fun-cell-strong' },
        { h: 'WR', cell: r => r.wr }, { h: 'CR', cell: r => r.cr }, { h: 'NR', cell: r => r.nr },
      ];
      break;
    case 'recordsComp':
      cols = [
        { h: '#', cell: r => r.rank },
        { h: t('比赛', 'Competition'), cell: compCell },
        { h: t('日期', 'Date'), cell: r => r.startDate },
        { h: t('分数', 'Score'), cell: r => r.score, cls: 'fun-cell-strong' },
        { h: 'WR', cell: r => r.wr }, { h: 'CR', cell: r => r.cr }, { h: 'NR', cell: r => r.nr },
      ];
      break;
    case 'oldestRecords':
      cols = [
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('天数', 'Days'), cell: r => r.standingDays, cls: 'fun-cell-strong' },
        { h: t('项目', 'Event'), cell: r => <span className="fun-cell-evt"><EventIcon event={r.eventId} className="fun-evt-icon" /></span> },
        { h: t('类型', 'Type'), cell: r => r.type === 'average' ? t('平均', 'Average') : t('单次', 'Single') },
        { h: t('成绩', 'Result'), cell: r => formatWcaResult(r.value, r.eventId, r.type) },
        { h: t('纪录', 'Record'), cell: r => <RecordBadge record={r.record} variant="inline" /> },
        { h: t('比赛', 'Competition'), cell: r => r.compName ? localizeCompName(r.compId, r.compName, isZh) : '—' },
      ];
      break;
    case 'solvesPerson':
      cols = [
        { h: t('名次', 'Rank'), cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('复原 / 尝试', 'Solves / Attempts'), cell: solveCell, cls: 'fun-cell-strong' },
      ];
      break;
    case 'solvesPersonComp':
      cols = [
        { h: t('名次', 'Rank'), cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('复原 / 尝试', 'Solves / Attempts'), cell: solveCell, cls: 'fun-cell-strong' },
        { h: t('比赛', 'Competition'), cell: compCell },
      ];
      break;
    case 'solvesComp':
      cols = [
        { h: t('名次', 'Rank'), cell: r => r.rank },
        { h: t('比赛', 'Competition'), cell: compCell },
        { h: t('复原 / 尝试', 'Solves / Attempts'), cell: solveCell, cls: 'fun-cell-strong' },
      ];
      break;
    case 'top100': {
      // 格式化类型取 stat 固定 type(F 无 typeToggle,全局 kind 会停在 'single' → 误格式化 333fm 平均)
      const top100Kind: 'single' | 'average' = stat.fixed?.type === 'average' ? 'average' : 'single';
      cols = [
        { h: t('名次', 'Rank'), cell: r => r.rank },
        { h: t('选手', 'Cuber'), cell: personCell },
        { h: t('占席数', 'Appearances'), cell: r => r.appearances, cls: 'fun-cell-strong' },
        { h: t('最佳成绩', 'Best Result'), cell: r => formatWcaResult(r.bestValue, event, top100Kind) },
      ];
      break;
    }
  }

  // B7 领奖台:特殊(含三人 + 合计)
  if (stat.shape === 'bestPodiums') {
    const bestType = BEST_TYPE_EVENTS.has(event);
    const fmtBP = (v: number) => {
      if (!v || v <= 0) return '—';
      if (event === '333fm') return (v / 100).toFixed(v % 100 === 0 ? 0 : 2);
      if (event === '333mbf') return String(v);
      return formatWcaResult(v, event, bestType ? 'single' : 'average');
    };
    // 平均列 = 领奖台三人成绩均值(SPEC B7.6)。333fm 合计为厘步×3 → /300;mbf 编码值不可线性平均。
    const fmtAvg = (v: number) => {
      if (!v || v <= 0) return '—';
      if (event === '333fm') return (v / 300).toFixed(2);
      if (event === '333mbf') return '—';
      return formatWcaResult(Math.round(v / 3), event, bestType ? 'single' : 'average');
    };
    return (
      <div className="fun-stats-table-scroll">
        <table className="fun-stats-table">
          <thead>
            <tr>
              <th>#</th><th>{t('比赛', 'Competition')}</th><th>{t('日期', 'Date')}</th>
              <th>{t('合计', 'Sum')}</th><th>{t('平均', 'Average')}</th><th>{t('第一', 'First')}</th><th>{t('第二', 'Second')}</th><th>{t('第三', 'Third')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={`${r.compId ?? ''}-${i}`}>
                <td>{r.rank}</td>
                <td>{compCell(r)}</td>
                <td>{r.compDate}</td>
                <td className="fun-cell-strong">{fmtBP(r.sumValue)}</td>
                <td>{fmtAvg(r.sumValue)}</td>
                {r.podium?.map((p: any) => (
                  <td key={p.pos}>
                    {p.wcaId ? <Link prefetch={false} href={personHref(p.wcaId)}>{displayCuberName(p.name ?? '', isZh)}</Link> : '—'}
                    {p.wcaId && <span className="fun-cell-sub"> {fmtBP(p.value)}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const rowKey = (r: any) => r.wcaId ?? r.compId ?? r.countryId ?? String(r.rank);
  return (
    <div className="fun-stats-table-scroll">
      <table className="fun-stats-table">
        <thead><tr>{cols.map((c, i) => <th key={i}>{c.h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r: any, ri: number) => (
            <tr key={`${rowKey(r)}-${ri}`}>{cols.map((c, i) => <td key={i} className={c.cls}>{c.cell(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FunStatsPage() {
  return (
    <Suspense fallback={<div className="fun-stats"><div className="fun-stats-loading">Loading…</div></div>}>
      <FunStatsInner />
    </Suspense>
  );
}
