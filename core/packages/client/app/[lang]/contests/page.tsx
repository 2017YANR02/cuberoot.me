'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import Markdown from 'react-markdown';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { eventIconClass } from '@/components/EventIcon/EventIcon';
import { RegionPicker } from '@/components/RegionPicker';
import { Flag } from '@/components/Flag';
import { SearchInput } from '@/components/SearchInput';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { countryName } from '@/lib/country-name';
import { displayCuberName } from '@/lib/cuber-name-display';
import { formatDateRangeIso } from '@/lib/wca-date';
import { contestsHref, getContestsData, ContestsError, type ContestCatalog, type ContestDetail, type ContestEvent,
  type ContestPerson, type ContestPersonDetail, type ContestResult, type ContestSummary } from '@/lib/contests-api';
import { CONTEST_GROUPS, CONTEST_TYPES, contestEventName } from './catalog';
import '@/components/sticky-table.css';
import './contests.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const VIEWS = ['home', 'competitions', 'contest', 'rankings', 'records', 'persons', 'person'] as const;
const REGION_CODES: Record<string, string> = { asia: 'XA', africa: 'XF', europe: 'XE', northAmerica: 'XN', southAmerica: 'XS', oceania: 'XO' };
const FORMATS: Record<string, string> = { a: 'Ao5', m: 'Mo3', '5': 'Bo5', '3': 'Bo3', '2': 'Bo2', '1': 'Bo1' };

function useData<T>(params: Record<string, string | number | undefined> | null) {
  const key = params ? JSON.stringify(params) : '';
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: number }>({ key: '' });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    setState({ key });
    getContestsData<T>(JSON.parse(key), controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, error: error instanceof ContestsError ? error.status : 502 });
    });
    return () => controller.abort();
  }, [key, revision]);
  const current = state.key === key ? state : { key };
  return { ...current, loading: !!key && !current.data && !current.error, retry: () => setRevision(v => v + 1) };
}

function External({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>;
}

function PersonLink({ person, isZh }: { person: ContestPerson; isZh: boolean }) {
  const name = person.localizedName && !person.name.includes(person.localizedName) ? `${person.name} (${person.localizedName})` : person.name;
  return <AppLink href={contestsHref({ view: 'person', id: person.id })} prefetch={false} className="contests-person">
    <Flag iso2={person.regionCode} /> {displayCuberName(name, isZh)}
  </AppLink>;
}

function ContestLink({ contest }: { contest: ContestSummary }) {
  return <AppLink href={contestsHref({ view: 'contest', id: contest.competitionId })} prefetch={false}>
    <Flag iso2={contest.regionCode} /> {contest.shortName}
  </AppLink>;
}

function localizeResult(text: string) {
  return text.replaceAll('Unknown time', tr({ zh: '用时未知', en: 'Unknown time' })).replaceAll('Unknown', tr({ zh: '未知', en: 'Unknown' }));
}

function ResultTable({ rows, events, persons = [], contests = [], isZh, rankings = false, records = false, positions = false }: {
  rows: ContestResult[]; events: ContestEvent[]; persons?: ContestPerson[]; contests?: ContestSummary[]; isZh: boolean; rankings?: boolean; records?: boolean; positions?: boolean;
}) {
  const t = useT();
  if (!rows.length) return <p className="contests-empty">{t('没有符合条件的公开成绩。', 'No public results match these filters.')}</p>;
  return <div className="sticky-scroll contests-table-scroll"><table className="sticky-thead contests-table">
    <thead><tr><th>{rankings || positions ? t('排名', 'Rank') : t('项目', 'Event')}</th>
      {records && <th>{t('类型', 'Type')}</th>}<th>{t('选手', 'Competitor')}</th>
      <th>{rankings ? t('成绩', 'Result') : t('单次', 'Single')}</th>{!rankings && <th>{t('平均', 'Average')}</th>}
      <th>{t('日期', 'Date')}</th><th>{t('比赛 / 来源', 'Contest / source')}</th><th>{t('各次成绩', 'Attempts')}</th></tr></thead>
    <tbody>{rows.map((row, index) => {
      const event = events.find(e => e.eventId === row.eventId);
      const people = row.persons ?? (row.personIds ?? []).flatMap(id => { const p = persons.find(p => p.id === id); return p ? [p] : []; });
      const contest = row.contest ?? contests.find(c => c.competitionId === row.competitionId);
      return <tr key={row.rankingId ?? row.id ?? index}>
        <td>{rankings || positions ? row.ranking : <AppLink prefetch={false} href={contestsHref({ view: 'rankings', event: row.eventId })}>{event ? contestEventName(event, isZh) : row.eventId}</AppLink>}</td>
        {records && <td>{row.type === 'single' ? t('单次', 'Single') : row.type === 'average' ? t('平均', 'Average') : t('单次与平均', 'Single & average')}</td>}
        <td><div className="contests-people">{people.map(p => <PersonLink key={p.id} person={p} isZh={isZh} />)}</div></td>
        <td className="contests-result">{localizeResult((rankings ? row.resultText : row.bestText) ?? '—')}</td>{!rankings && <td className="contests-result">{localizeResult(row.averageText ?? '—')}</td>}
        <td className="contests-date">{row.date?.slice(0, 10)}</td>
        <td>{contest?.competitionId ? <ContestLink contest={contest} /> : <External href={row.videoLink}>{t('视频', 'Video')}</External>}
          {row.discussionLink && <div><External href={row.discussionLink}>{t('讨论', 'Discussion')}</External></div>}</td>
        <td><details><summary>{t('展开', 'Show')}</summary><ol className="contests-attempts">{row.attemptsText.map((attempt, i) => <li key={i}>
          {localizeResult(attempt)}{row.memoText?.[i] && <> · {t('记忆', 'Memo')}: {localizeResult(row.memoText[i]!)}</>}
        </li>)}</ol></details></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function CompetitionList({ rows, isZh }: { rows: ContestSummary[]; isZh: boolean }) {
  const t = useT();
  if (!rows.length) return <p className="contests-empty">{t('没有符合条件的比赛。', 'No contests match these filters.')}</p>;
  return <div className="sticky-scroll contests-table-scroll"><table className="sticky-thead contests-table">
    <thead><tr><th>{t('比赛', 'Contest')}</th><th>{t('日期', 'Date')}</th><th>{t('地点', 'Location')}</th><th>{t('类型', 'Type')}</th><th>{t('人数', 'Competitors')}</th></tr></thead>
    <tbody>{rows.map(c => <tr key={c.competitionId}><td><ContestLink contest={c} /></td>
      <td className="contests-date">{formatDateRangeIso(c.startDate?.slice(0, 10) ?? '', c.endDate?.slice(0, 10))}</td>
      <td>{countryName(c.regionCode, isZh)}{c.city && ` · ${c.city}`}</td><td>{CONTEST_TYPES[c.type] ? tr(CONTEST_TYPES[c.type]) : c.type}</td><td>{c.participants ?? '—'}</td></tr>)}</tbody>
  </table></div>;
}

type Activity = { id: number; activityCode: string; name?: string; startTime: string; endTime: string; childActivities?: Activity[] };
type Schedule = { venues?: { id: number; name: string; timezone: string; rooms: { id: number; name: string; activities: Activity[] }[] }[] };
function ScheduleView({ schedule, events, isZh }: { schedule: Schedule; events: ContestEvent[]; isZh: boolean }) {
  const t = useT();
  function time(value: string, zone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  }
  function activities(items: Activity[], zone: string): ReactNode {
    return <ul>{items.map(a => {
      const event = events.find(e => a.activityCode.startsWith(`${e.eventId}-r`));
      return <li key={a.id}><span className="contests-date">{time(a.startTime, zone)} – {time(a.endTime, zone)}</span>{' '}
        {event ? `${contestEventName(event, isZh)} ${a.activityCode.slice(event.eventId.length + 1)}` : a.name ?? a.activityCode}
        {a.childActivities?.length ? activities(a.childActivities, zone) : null}</li>;
    })}</ul>;
  }
  return <details className="contests-section"><summary>{t('赛程（举办地时间）', 'Schedule (venue local time)')}</summary>
    {schedule.venues?.map(v => <section key={v.id}><h3>{v.name} · {v.timezone}</h3>{v.rooms.map(room => <div key={room.id}>
      <h4>{room.name}</h4>{activities(room.activities, v.timezone)}
    </div>)}</section>)}
  </details>;
}

export default function ContestsPage() {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [params, setParams] = useQueryStates({
    view: parseAsStringEnum([...VIEWS]).withDefault('home'), event: parseAsString.withDefault(''),
    id: parseAsString.withDefault(''), region: parseAsString.withDefault(''), group: parseAsString.withDefault('main'),
    category: parseAsStringEnum(['competitions', 'meetups', 'online']).withDefault('competitions'),
    type: parseAsStringEnum(['single', 'average', 'all-avg-formats']).withDefault('single'), q: parseAsString.withDefault(''),
    offset: parseAsInteger.withDefault(0), history: parseAsStringEnum(['current', 'all']).withDefault('current'),
  }, { history: 'replace', scroll: false });
  const { view } = params;
  const catalog = useData<ContestCatalog>({ view: 'catalog' });
  const events = catalog.data?.events ?? [];
  const eventId = params.event || (view === 'rankings' ? 'fto' : '');
  const selectedEvent = events.find(e => e.eventId === eventId);
  const recordCategory = selectedEvent?.category.videoBased || (view === 'records' && events.some(e => e.category.categoryId === params.group && e.category.videoBased)) ? 'online' : params.category;
  const request = useMemo(() => {
    if (view === 'home') return { view: 'competitions' };
    const p: Record<string, string | number | undefined> = { view };
    if (['rankings', 'records', 'competitions', 'persons'].includes(view)) p.region = params.region;
    if (['rankings', 'records', 'competitions', 'contest', 'person'].includes(view)) p.event = eventId;
    if (['rankings', 'records'].includes(view)) p.category = recordCategory;
    if (view === 'rankings') p.type = params.type;
    if (view === 'records') { p.group = params.group; p.history = params.history; }
    if (view === 'contest' || view === 'person') p.id = params.id;
    if (view === 'persons') p.q = params.q;
    if (view === 'person' || view === 'persons') p.offset = Math.max(0, params.offset);
    return p;
  }, [view, params.region, params.type, params.group, params.history, params.id, params.q, params.offset, eventId, recordCategory]);
  const response = useData<ContestSummary[] | ContestResult[] | ContestPerson[] | ContestDetail | ContestPersonDetail>(catalog.data ? request : null);
  const detail = view === 'contest' ? response.data as ContestDetail | undefined : undefined;
  const profile = view === 'person' ? response.data as ContestPersonDetail | undefined : undefined;
  const update = (next: Partial<typeof params>) => void setParams({ offset: 0, ...next });
  const groups = Array.from(new Set(events.map(e => e.category.categoryId)));
  const pickerEvents = detail?.events ?? (view === 'records' ? events.filter(e => e.category.categoryId === params.group) : events);
  const pickerGroups: PuzzlePickerGroup[] = groups.map(group => ({ id: group, label: CONTEST_GROUPS[group] ? tr(CONTEST_GROUPS[group]) : group,
    items: pickerEvents.filter(e => e.category.categoryId === group).map(e => ({
      id: e.eventId, label: contestEventName(e, isZh), searchText: `${e.name} ${e.eventId}`,
      iconClass: eventIconClass(e.eventId), textLabel: contestEventName(e, isZh),
    })),
  }));
  if (view !== 'rankings' && view !== 'contest') pickerGroups.unshift({ id: 'all', label: '', items: [{ id: '', label: t('全部项目', 'All events'), searchText: '' }] });
  const regionValue = Object.entries(REGION_CODES).find(([, value]) => value === params.region)?.[0] ?? (params.region.toLowerCase() || 'world');
  const nav = [
    ['home', t('概览', 'Overview')], ['competitions', t('比赛', 'Contests')], ['rankings', t('排名', 'Rankings')],
    ['records', t('纪录', 'Records')], ['persons', t('选手', 'Competitors')],
  ] as const;
  const active = view === 'contest' ? 'competitions' : view === 'person' ? 'persons' : view;
  const competitionRows = (view === 'competitions' || view === 'home') && Array.isArray(response.data)
    ? (response.data as ContestSummary[]).filter(c => `${c.shortName} ${c.city} ${c.competitionId}`.toLowerCase().includes(params.q.toLowerCase())) : [];
  const error = catalog.error ?? response.error;
  const loading = catalog.loading || response.loading;

  return <main className="contests-page">
    <header className="contests-header"><BackHome /><HeaderToggles /><h1>{t('非官方比赛与纪录', 'Unofficial contests & records')}</h1>
      <p>{t('来自 Cubing Contests 的比赛、排名与纪录，每天同步。这里的成绩与 WCA 官方成绩分开展示。', 'Contests, rankings and records from Cubing Contests, synced daily and displayed separately from official WCA results.')}</p>
    </header>
    <nav className="contests-nav" aria-label={t('Contests 导航', 'Contests navigation')}>{nav.map(([key, label]) =>
      <AppLink key={key} href={contestsHref({ view: key })} prefetch={false} aria-current={active === key ? 'page' : undefined}>{label}</AppLink>)}</nav>
    {view === 'home' && <section className="contests-intro" data-site-surface="panel">
      <h2>CubeRoot Contests</h2><p>{t('探索镜面、转面八面体、团队接力与极限盲拧等项目，也可查询非官方比赛中的 WCA 项目成绩。', 'Explore mirror blocks, FTO, team relays, extreme blindfolded events and WCA events held at unofficial contests.')}</p>
      <div className="contests-actions">
        <AppLink href={contestsHref({ view: 'rankings', event: 'fto', region: 'CN' })} prefetch={false}>{t('中国选手排名', 'Chinese competitor rankings')}</AppLink>
        <AppLink href={contestsHref({ view: 'competitions', region: 'CN' })} prefetch={false}>{t('中国比赛', 'Contests in China')}</AppLink>
        <AppLink href={contestsHref({ view: 'records', group: 'main' })} prefetch={false}>{t('非官方项目纪录', 'Unofficial event records')}</AppLink>
      </div>
    </section>}
    {view !== 'home' && <div className="contests-filters">
      {view === 'records' && <label>{t('项目分类', 'Event category')}<select className="contests-filter-select" value={params.group} onChange={e => update({ group: e.target.value, event: '' })}>
        {groups.map(group => <option key={group} value={group}>{CONTEST_GROUPS[group] ? tr(CONTEST_GROUPS[group]) : group}</option>)}</select></label>}
      {view !== 'persons' && <div><span className="contests-label">{t('项目', 'Event')}</span><PuzzlePicker groups={pickerGroups} selectedEvent={eventId || detail?.events[0]?.eventId}
        onSelect={event => update({ event })} isZh={isZh} /></div>}
      {!['contest', 'person'].includes(view) && <div><span className="contests-label">{view === 'competitions' ? t('举办地区', 'Contest region') : t('选手地区', 'Competitor region')}</span>
        <RegionPicker isZh={isZh} value={regionValue} onChange={region => update({ region: REGION_CODES[region] ?? (region === 'world' ? '' : region.toUpperCase()) })}
          restrictTo={catalog.data?.regions.filter(r => r.type !== 'super-region').map(r => r.code)} allLabel={t('全球', 'Worldwide')} />
      </div>}
      {['rankings', 'records'].includes(view) && <label>{t('成绩来源', 'Result category')}<select className="contests-filter-select" value={recordCategory} disabled={recordCategory === 'online' && (selectedEvent?.category.videoBased || params.group === 'extreme-bld')} onChange={e => update({ category: e.target.value as typeof params.category })}>
        <option value="competitions">{t('比赛', 'Competitions')}</option><option value="meetups">{t('聚会', 'Meetups')}</option><option value="online">{t('线上', 'Online')}</option>
      </select></label>}
      {view === 'rankings' && <label>{t('成绩类型', 'Result type')}<select className="contests-filter-select" value={params.type} onChange={e => update({ type: e.target.value as typeof params.type })}>
        <option value="single">{t('单次', 'Single')}</option><option value="average">{t('平均（标准赛制）', 'Average (standard format)')}</option><option value="all-avg-formats">{t('平均（全部赛制）', 'Average (all formats)')}</option>
      </select></label>}
      {view === 'records' && <label>{t('纪录范围', 'Record view')}<select className="contests-filter-select" value={params.history} onChange={e => update({ history: e.target.value as typeof params.history })}>
        <option value="current">{t('当前纪录', 'Current records')}</option><option value="all">{t('纪录历史', 'Record history')}</option></select></label>}
      {['persons', 'competitions'].includes(view) && <SearchInput value={params.q} onChange={q => update({ q })} debounceMs={300} maxLength={100}
        ariaLabel={t('搜索', 'Search')} placeholder={view === 'persons' ? t('姓名或 WCA ID', 'Name or WCA ID') : t('比赛名称或城市', 'Contest name or city')} />}
    </div>}
    {selectedEvent && ['rankings', 'records'].includes(view) && <details className="contests-section"><summary>{contestEventName(selectedEvent, isZh)} · {t('项目说明与规则', 'Description & rules')}</summary>
      <p>{t('以下为来源网站的原文。', 'The following is the original source text.')}</p><Markdown>{selectedEvent.description || selectedEvent.rule || t('暂无项目说明。', 'No description available.')}</Markdown>
      {selectedEvent.description && selectedEvent.rule && <Markdown>{selectedEvent.rule}</Markdown>}
    </details>}
    {error ? <div role="alert" className="contests-empty"><p>{error === 404 && view === 'person'
      ? t('未找到该选手的 Contests 公开档案。有 WCA ID 不代表已参加 Cubing Contests 收录的比赛。', 'No public Contests profile was found. Having a WCA ID does not imply participation in a contest listed here.')
      : error === 404 ? t('未找到这项公开内容。', 'This public entry was not found.') : t('数据暂时无法加载，请重试。', 'Data could not be loaded. Please retry.')}</p>
      <button className="contests-action-button" type="button" onClick={() => { catalog.retry(); response.retry(); }}>{t('重试', 'Retry')}</button></div>
      : loading ? <p role="status" className="contests-empty"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p> : null}
    {!loading && !error && response.data && <>
      {(view === 'home' || view === 'competitions') && <><h2>{t('比赛', 'Contests')} <small>{competitionRows.length}</small></h2>
        <CompetitionList rows={competitionRows.slice(view === 'home' ? 0 : Math.max(0, params.offset), view === 'home' ? 8 : Math.max(0, params.offset) + 50)} isZh={isZh} />
        {view === 'home' ? <AppLink href={contestsHref({ view: 'competitions' })} prefetch={false}>{t('查看全部比赛', 'View all contests')}</AppLink>
          : <Pagination offset={params.offset} size={50} more={params.offset + 50 < competitionRows.length} change={offset => update({ offset })} />}</>}
      {view === 'rankings' && <><p className="contests-note">{t('每名选手的最佳成绩，最多展示前 100 名；团队项目按原始成员顺序展示。', 'Best results per competitor, up to the top 100. Team members retain their source order.')}</p>
        <ResultTable rows={response.data as ContestResult[]} events={events} isZh={isZh} rankings /></>}
      {view === 'records' && <ResultTable rows={response.data as ContestResult[]} events={events} isZh={isZh} records />}
      {view === 'persons' && <><div className="contests-person-list">{(response.data as ContestPerson[]).slice(0, 50).map(p => <div key={p.id}>
        <PersonLink person={p} isZh={isZh} /> <small>{p.wcaId}</small></div>)}</div>
        {!(response.data as ContestPerson[]).length && <p className="contests-empty">{t('未找到选手。', 'No competitors found.')}</p>}
        <Pagination offset={params.offset} size={50} more={(response.data as ContestPerson[]).length > 50} change={offset => update({ offset })} /></>}
      {profile && <><h2><PersonLink person={profile.person} isZh={isZh} /></h2>
        {profile.person.wcaId && <AppLink href={`/wca/persons/${profile.person.wcaId}`} prefetch={false}>{t('本站 WCA 选手档案', 'WCA profile on CubeRoot')} · {profile.person.wcaId}</AppLink>}
        <ResultTable rows={profile.results} events={events} persons={profile.persons} contests={profile.contests} isZh={isZh} />
        <Pagination offset={params.offset} size={100} more={profile.hasMore} change={offset => update({ offset })} /></>}
      {detail && <><h2><Flag iso2={detail.contest.regionCode} /> {detail.contest.name}</h2>
        <p className="contests-date">{formatDateRangeIso(detail.contest.startDate?.slice(0, 10) ?? '', detail.contest.endDate?.slice(0, 10))} · {countryName(detail.contest.regionCode, isZh)} · {detail.contest.city}</p>
        <p>{detail.contest.venue} {detail.contest.address}</p>
        <p>{CONTEST_TYPES[detail.contest.type] ? tr(CONTEST_TYPES[detail.contest.type]) : detail.contest.type} · {detail.contest.participants ?? 0} {t('人', 'competitors')}</p>
        {detail.contest.description && <details className="contests-section"><summary>{t('比赛说明（来源原文）', 'Contest description (source text)')}</summary><Markdown>{detail.contest.description}</Markdown></details>}
        {(detail.contest.schedule as Schedule | null)?.venues?.length ? <ScheduleView schedule={detail.contest.schedule as Schedule} events={detail.events} isZh={isZh} /> : null}
        <External href={`https://cubingcontests.com/competitions/${encodeURIComponent(detail.contest.competitionId)}`}>{t('来源比赛页', 'Source contest page')}</External>
        {detail.rounds.map(round => <section key={round.id} className="contests-section"><h3>{round.roundTypeId === 'f' ? t('决赛', 'Final') : `${t('轮次', 'Round')} ${round.roundNumber}`} · {FORMATS[round.format] ?? round.format}</h3>
          <ResultTable rows={detail.results.filter(r => r.roundId === round.id)} events={events} persons={detail.persons} isZh={isZh} positions />
        </section>)}
        {!detail.rounds.length && <p className="contests-empty">{t('尚无公开轮次或成绩。', 'No public rounds or results yet.')}</p>}
      </>}
    </>}
    <footer className="contests-footer"><span>{t('数据来源', 'Data source')}: <External href="https://cubingcontests.com/">Cubing Contests</External></span>
      <span>{t('数据服务', 'Data service')}: <External href="https://github.com/2017YANR02/RecordRanks">RecordRanks</External></span>
      <AppLink href="/wca/comp" prefetch={false}>{t('WCA 比赛中心', 'WCA competitions')}</AppLink>
      <External href="https://contests.cuberoot.me/default/mod">{t('赛事管理', 'Contest management')}</External>
      <AppLink href="/about" prefetch={false}>{t('关于与联系', 'About & contact')}</AppLink>
    </footer>
  </main>;
}

function Pagination({ offset, size, more, change }: { offset: number; size: number; more: boolean; change: (offset: number) => void }) {
  const t = useT();
  if (!offset && !more) return null;
  return <div className="contests-pagination"><button className="contests-action-button" type="button" disabled={offset <= 0} onClick={() => change(Math.max(0, offset - size))}>{t('上一页', 'Previous')}</button>
    <span>{Math.floor(Math.max(0, offset) / size) + 1}</span><button className="contests-action-button" type="button" disabled={!more} onClick={() => change(offset + size)}>{t('下一页', 'Next')}</button></div>;
}
