'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CalendarDays, PieChart } from '@app-foundation/icons/lucide';
import { EventIcon } from '@/components/EventIcon';
import { SortArrow } from '@/components/SortArrow';
import { tr } from '@/i18n/tr';
import { useAuthUser } from '@/lib/auth-store';
import { fetchCubingRegistrations, isBeforeRegistrationOpen, type CubingRegistrations } from '@/lib/comp-registration';
import { competitionCalendarHref, loadCalendarManifest } from '@/lib/competition-calendar';
import { competitionCountryOptions, defaultCancelledCutoffIso, loadComps, searchComps, type Comp } from '@/lib/comp-search';
import { expandCountrySelection } from '@/lib/continent';
import { personFlagIso2 } from '@/lib/country-flags';
import { loadIpCountry } from '@/lib/ip-country';
import { compLocalDate } from '@/lib/wca-date';
import { getPerson, WCA_ID_REGEX } from '@/lib/wca-api';
import { eventDisplayName } from '@/lib/wca-events';
import { CompetitionList, competitionEventColumns, parseLocalDate, type Competition, type ListSort, type SortCol } from './CompetitionList';
import { CompetitionSearchFilters } from './CompetitionSearchFilters';
import { CompetitionViewToggle } from './CompetitionViewToggle';
import './home-country-competitions.css';

type HomeSort = NonNullable<ListSort>;
const REGISTRATION_ASCENDING: HomeSort = { col: 'reg', dir: 'asc' };
const HOME_COMPETITION_VIEW = 'list';
const NO_COUNTRIES: string[] = [];
const EMPTY_COMPS: Comp[] = [];

export function HomeCountryCompetitions({ comps, followedIds, isZh }: {
  comps: Comp[] | null;
  followedIds: ReadonlySet<string>;
  isZh: boolean;
}) {
  const wcaId = useAuthUser()?.wcaId?.trim().toUpperCase() ?? '';
  const [location, setLocation] = useState<{ wcaId: string; countries: string[] }>();
  const [query, setQuery] = useState('');
  const [selectedSort, setListSort] = useState<HomeSort>(REGISTRATION_ASCENDING);
  const [allCountryOptions, setAllCountryOptions] = useState<string[]>();
  const [now, setNow] = useState<number | null>(null);
  const [cubingRegistrations, setCubingRegistrations] = useState<CubingRegistrations | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const knownCountry = wcaId && personFlagIso2(wcaId);
    const country = wcaId
      ? (knownCountry ? Promise.resolve(knownCountry) : getPerson(wcaId).then(person => person?.country_iso2 ?? ''))
      : loadIpCountry();
    country.then(iso2 => {
      if (active) setLocation({ wcaId, countries: iso2 ? [iso2.toLowerCase()] : NO_COUNTRIES });
    });
    return () => { active = false; };
  }, [wcaId]);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    void loadCalendarManifest().then(manifest => manifest.countryOptions)
      .catch(() => loadComps().then(competitionCountryOptions))
      .then(options => { if (active) setAllCountryOptions(options); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const selection = location?.wcaId === wcaId ? location : null;
  const countries = selection?.countries ?? NO_COUNTRIES;
  const country = countries[0];
  const fallbackCountryOptions = useMemo(() => competitionCountryOptions(comps ?? EMPTY_COMPS), [comps]);
  const countryOptions = allCountryOptions ?? fallbackCountryOptions;
  const todayForComp = useCallback(
    (comp: Pick<Competition, 'country' | 'longitude_degrees'>) => compLocalDate(now ?? 0, comp.longitude_degrees, comp.country),
    [now],
  );
  const rows = useMemo<Competition[]>(() => {
    if (!comps || !country || now === null) return [];
    return comps.filter(c => c.country === country && (c.end_date || c.start_date) >= todayForComp(c))
      .map(c => ({
        ...c,
        city: c.city ?? '',
        country: c.country.toUpperCase(),
        events: c.events ?? [],
        competitor_limit: c.competitor_limit ?? 0,
        roundMeta: c.round_meta,
        top_cubers: [],
      }));
  }, [comps, country, now, todayForComp]);
  const eventColumns = useMemo(() => competitionEventColumns(rows), [rows]);
  const listSort = selectedSort.col === 'event' && !eventColumns.includes(selectedSort.event ?? '')
    ? REGISTRATION_ASCENDING
    : selectedSort;

  const countsBeforeOpening = useMemo(() => now === null ? [] : rows.filter(comp =>
    comp.competitors == null && (comp.registered ?? 0) > 0 && isBeforeRegistrationOpen(comp.registration_open, now),
  ), [rows, now]);
  const needsCubingSource = countsBeforeOpening.some(comp => comp.country === 'CN');

  useEffect(() => {
    if (!needsCubingSource || cubingRegistrations !== null) return;
    const controller = new AbortController();
    void fetchCubingRegistrations(controller.signal).then(registrations => {
      if (!controller.signal.aborted) setCubingRegistrations(registrations);
    }).catch(() => {});
    return () => controller.abort();
  }, [needsCubingSource, cubingRegistrations]);

  const registrationCountNotes = useMemo(() => {
    const notes = new Map<string, string>();
    if (now === null) return notes;
    for (const comp of countsBeforeOpening) {
      const cubing = comp.country === 'CN' ? cubingRegistrations?.[comp.id] : undefined;
      if (cubing && (cubing.tba || !isBeforeRegistrationOpen(cubing.registrationStartTime, now))) continue;
      notes.set(comp.id, cubing
        ? tr({
          zh: '公开报名尚未开始。人数来自粗饼赛事网的已接受报名数（acceptedCount）。',
          en: 'Public registration has not opened. The count comes from the acceptedCount field on cubing.com.',
        })
        : tr({ zh: '公开报名尚未开始。', en: 'Public registration has not opened.' }));
    }
    return notes;
  }, [countsBeforeOpening, cubingRegistrations, isZh, now]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [country]);

  const hasRows = rows.length > 0;
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !hasRows) return;

    // Trackpad swipes often carry deltas on both axes. Route predominantly
    // horizontal gestures to the columns even when there are more rows below.
    const panColumns = (event: WheelEvent) => {
      if (event.ctrlKey || !event.cancelable || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      if (viewport.scrollWidth <= viewport.clientWidth) return;
      let distance = event.deltaX;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) distance *= 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) distance *= viewport.clientWidth;
      event.preventDefault();
      viewport.scrollLeft += distance;
    };

    viewport.addEventListener('wheel', panColumns, { passive: false });
    return () => viewport.removeEventListener('wheel', panColumns);
  }, [hasRows]);

  const sortHeader = (
    col: SortCol,
    label: string,
    { icon, event, className = 'cl-text-sort' }: { icon?: ReactNode; event?: string; className?: string } = {},
  ) => {
    const active = listSort.col === col && listSort.event === event;
    const firstDirection = col === 'name' || col === 'date' || col === 'reg' ? 'asc' : 'desc';
    const oppositeDirection = listSort.dir === 'asc' ? 'desc' : 'asc';
    const currentDirection = listSort.dir === 'asc'
      ? tr({ zh: '升序', en: 'Ascending' })
      : tr({ zh: '降序', en: 'Descending' });
    return (
      <button
        key={event}
        type="button"
        className={`cl-col-icon cl-col-sort ${className}${active ? ' is-active' : ''}`}
        aria-label={active ? `${label} · ${currentDirection}` : label}
        aria-pressed={active}
        title={label}
        onClick={() => {
          setListSort({ col, event, dir: active ? oppositeDirection : firstDirection });
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }}
      >
        {icon ?? label}
        <SortArrow active={active} dir={listSort.dir} size={icon ? 9 : 11} />
      </button>
    );
  };

  if (!selection || comps === null || now === null) return null;

  const roundsLabel = tr({ zh: '轮次', en: 'Rounds' });
  const currentMonth = new Date(now);
  const homeCompetitionHref = (target: Partial<Parameters<typeof competitionCalendarHref>[0]>) =>
    competitionCalendarHref({ month: currentMonth, view: HOME_COMPETITION_VIEW, ...target });
  const localizedCompetitionHref = (target: Parameters<typeof homeCompetitionHref>[0]) =>
    (isZh ? '/zh' : '') + homeCompetitionHref(target);
  const openCompetitions = (target: Parameters<typeof homeCompetitionHref>[0]) =>
    window.open(localizedCompetitionHref(target), '_blank', 'noopener');
  const pickedCompetition = (comp: Comp) => ({
    month: parseLocalDate(comp.start_date),
    countries: comp.country ? [comp.country] : [],
    query: comp.id,
  });
  const submitSearch = async (
    text: string,
    target: Omit<Parameters<typeof competitionCalendarHref>[0], 'month' | 'query' | 'cuber'> = {},
  ) => {
    if (WCA_ID_REGEX.test(text.toUpperCase())) {
      openCompetitions({ ...target, cuber: text.toUpperCase() });
      return;
    }
    // Open during the click or key event, before loading the competition index.
    const tab = window.open('about:blank', '_blank');
    if (!tab) return;
    tab.opener = null;
    const catalog = await loadComps().catch(() => EMPTY_COMPS);
    const regions = expandCountrySelection(target.countries ?? []);
    const eligible = regions.size ? catalog.filter(comp => regions.has(comp.country)) : catalog;
    const [match] = searchComps(text, eligible, 1);
    tab.location.replace(localizedCompetitionHref({
      ...target, query: text, ...(match ? { month: parseLocalDate(match.start_date) } : {}),
    }));
  };

  return (
    <section className="home-country-competitions" aria-label={tr({ zh: '近期比赛', en: 'Upcoming competitions' })}>
      <div className="competition-search-toolbar home-competition-search">
        <CompetitionSearchFilters
          isZh={isZh}
          search={{
            query,
            onQueryChange: setQuery,
            onQuerySubmit: text => void submitSearch(text),
            onUrlPaste: id => void submitSearch(id),
            competitionHref: comp => homeCompetitionHref(pickedCompetition(comp)),
            competitionNewTab: true,
            cuber: null,
            onCuberChange: cuber => { if (cuber) openCompetitions({ cuber: cuber.id }); },
            preloadPersons: false,
          }}
          countries={countries}
          countryOptions={countryOptions}
          onCountriesChange={next => {
            if (query.trim()) void submitSearch(query.trim(), { countries: next });
            else openCompetitions({ countries: next });
          }}
        />
        <div className="home-competition-views">
          <CompetitionViewToggle view={HOME_COMPETITION_VIEW} onViewChange={view => {
            if (query.trim() && view !== 'globe') void submitSearch(query.trim(), { countries, view });
            else openCompetitions({ countries, view });
          }} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="landing-slot-message">{!country
          ? tr({ zh: '暂时无法识别所在国家或地区', en: 'Country or region unavailable' })
          : tr({ zh: '暂无匹配的近期比赛', en: 'No matching upcoming competitions' })}</p>
      ) : (
        <div
          className="competition-list-layout"
          ref={listRef}
          style={{ '--cl-event-count': eventColumns.length } as CSSProperties}
          data-no-events={eventColumns.length === 0 ? '' : undefined}
          data-hide-country=""
          data-hide-city=""
        >
          <div className="home-country-competitions-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label={tr({ zh: '近期比赛列表', en: 'Upcoming competition list' })}>
            <div className="event-chips-grid">
              {sortHeader('reg', tr({ zh: '报名', en: 'Reg' }), { className: 'cl-reg-head' })}
              {sortHeader('date', tr({ zh: '日期', en: 'Date' }))}
              <span aria-hidden="true" />
              {sortHeader('name', tr({ zh: '比赛', en: 'Competition' }))}
              {sortHeader('days', tr({ zh: '天数', en: 'Days' }), { icon: <CalendarDays size={15} />, className: 'home-competition-icon-sort' })}
              {sortHeader('comp', tr({ zh: '报名占比', en: 'Registration fill' }), { icon: <PieChart size={15} />, className: 'home-competition-icon-sort' })}
              {eventColumns.map(event => sortHeader('event', `${eventDisplayName(event, isZh)} · ${roundsLabel}`, {
                event, icon: <EventIcon event={event} />, className: 'home-competition-icon-sort',
              }))}
            </div>
            <CompetitionList
              comps={rows}
              isZh={isZh}
              followedIds={followedIds}
              eventMetric="rounds"
              eventColumns={eventColumns}
              pastMeta={null}
              compMetric="ratio"
              listSort={listSort}
              cancelledCutoffIso={defaultCancelledCutoffIso()}
              pageRef={listRef}
              viewportRef={scrollRef}
              todayForComp={todayForComp}
              hideCountry
              hideCity
              ratioAsPie
              registrationCountNotes={registrationCountNotes}
            />
          </div>
        </div>
      )}
    </section>
  );
}
