'use client';

/**
 * Simplified Calendar page port. Loads all_past_comps + all_upcoming_comps via
 * loadComps(), displays a month grid with comp dots per day, supports
 * country/event filters, opens OnThisDayModal on date click, opens a basic
 * comp detail modal on comp click.
 *
 * DEFERRED (vs Vite version): Top-cubers "Top" mode, CuberSearchInput,
 * WheelPicker year/month overlay, list view, compact view, RegionPicker
 * multi-select chips, day-list modal, registration status, WCIF rounds.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, BarChart3, HelpCircle } from 'lucide-react';
import HeaderToggles from '@/components/HeaderToggles';
import MonthGrid from '@/components/MonthGrid';
import { CountryInput } from '@/components/CountryInput';
import { EventSelect } from '@/components/EventSelect';
import { Flag } from '@/components/Flag';
import { loadComps, type Comp } from '@/lib/comp-search';
import { loadFlagData } from '@/lib/country-flags';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { countryName } from '@/lib/country-name';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { compLinkProps } from '@/lib/comp-link';
import { formatDateRangeIso } from '@/lib/wca-date';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getLangQuery } from '@/i18n/i18n-client';
import OnThisDayModal from './_components/OnThisDayModal';
import './calendar_page.css';

const EVENT_LIST = ['3x3', '2x2', '4x4', '5x5', '6x6', '7x7', '3bld', '4bld', '5bld', 'oh', 'sq1', 'pyra', 'mega', 'clock', 'skewb', 'fmc', 'mbld'];

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function dateInRange(date: Date, start: string, end: string): boolean {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end || start);
  const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return dStart >= new Date(s.getFullYear(), s.getMonth(), s.getDate())
    && dStart <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
}

function CalendarInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('比赛日历', 'Competition Calendar');
  const router = useRouter();
  const params = useSearchParams();

  const initialYear = Number(params.get('year')) || new Date().getFullYear();
  const initialMonth = Number(params.get('month')) || (new Date().getMonth() + 1);

  const [comps, setComps] = useState<Comp[] | null>(null);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 1-12
  const [country, setCountry] = useState('');
  const [event, setEvent] = useState('');
  const [selectedComp, setSelectedComp] = useState<Comp | null>(null);
  const [onThisDayDate, setOnThisDayDate] = useState<Date | null>(null);

  useEffect(() => {
    loadComps().then(setComps);
    loadFlagData();
  }, []);

  // sync URL when month/year change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    p.set('year', String(year));
    p.set('month', String(month));
    const newUrl = `${window.location.pathname}?${p.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [year, month]);

  const filtered = useMemo(() => {
    if (!comps) return [];
    const wantEvent = event ? toWcaEventId(event) : '';
    return comps.filter(c => {
      if (country && c.country.toLowerCase() !== country) return false;
      if (wantEvent && !(c.events ?? []).some(e => toWcaEventId(e) === wantEvent)) return false;
      return !!c.start_date;
    });
  }, [comps, country, event]);

  // Group comps by yyyy-mm-dd within the displayed month
  const compsByDate = useMemo(() => {
    const m = new Map<string, Comp[]>();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    for (const c of filtered) {
      const s = parseLocalDate(c.start_date);
      const e = parseLocalDate(c.end_date || c.start_date);
      if (e < monthStart || s > monthEnd) continue;
      // iterate days in [s, e] within this month
      const d = new Date(Math.max(s.getTime(), monthStart.getTime()));
      const end = new Date(Math.min(e.getTime(), monthEnd.getTime()));
      while (d <= end) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const arr = m.get(key) ?? [];
        arr.push(c);
        m.set(key, arr);
        d.setDate(d.getDate() + 1);
      }
    }
    return m;
  }, [filtered, year, month]);

  const stepMonth = useCallback((delta: number) => {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    setMonth(m); setYear(y);
  }, [month, year]);

  const goToday = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }, []);

  const weekdaysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdaysZh = ['一', '二', '三', '四', '五', '六', '日'];

  if (!comps) {
    return (
      <div className="calendar-page">
        <div className="calendar-loading">{isZh ? '加载中…' : 'Loading…'}</div>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <header className="calendar-page-header">
        <HeaderToggles />
        <h1>
          {isZh ? '比赛日历' : 'Competition Calendar'}
          <Link
            href="/wca/calendar-about"
            className="calendar-title-help"
            title={isZh ? '这页是干啥的?' : 'What is this page?'}
            aria-label={isZh ? '查看说明' : 'About this page'}
            style={{ marginLeft: 8, color: 'inherit', opacity: 0.6, display: 'inline-flex', alignItems: 'center' }}
          >
            <HelpCircle size={16} strokeWidth={1.75} />
          </Link>
        </h1>
        <Link
          href={`/wca/calendar/stats${getLangQuery()}`}
          className="calendar-stats-link"
          title={isZh ? '比赛统计' : 'Competition stats'}
        >
          <BarChart3 size={18} />
          <span>{isZh ? '统计' : 'Stats'}</span>
        </Link>
      </header>

      <div className="calendar-toolbar">
        <div className="calendar-nav-row">
          <button type="button" className="calendar-nav-btn" onClick={() => stepMonth(-1)} aria-label="prev month">
            <ChevronLeft size={16} />
          </button>
          <div className="calendar-month-label">
            <strong>{year}-{String(month).padStart(2, '0')}</strong>
          </div>
          <button type="button" className="calendar-nav-btn" onClick={() => stepMonth(1)} aria-label="next month">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="calendar-today-btn" onClick={goToday}>
            {isZh ? '今天' : 'Today'}
          </button>
        </div>

        <div className="calendar-filters">
          <CountryInput
            className="calendar-filter"
            value={country}
            onChange={setCountry}
            allLabel={isZh ? '所有国家' : 'All countries'}
          />
          <EventSelect
            events={EVENT_LIST}
            value={event}
            onChange={setEvent}
            allLabel={isZh ? '所有项目' : 'All events'}
            className="calendar-filter"
          />
        </div>
      </div>

      <MonthGrid
        year={year}
        month={month}
        weekStart="mon"
        weekdays={(isZh ? weekdaysZh : weekdaysEn).map(d => <span key={d}>{d}</span>)}
        renderDay={(date, ctx) => {
          if (!ctx.inView) return null;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const dayComps = compsByDate.get(key) ?? [];
          return (
            <div className="calendar-day-content">
              <button
                type="button"
                className="calendar-day-num"
                onClick={() => setOnThisDayDate(date)}
                title={isZh ? '历年此日' : 'On this day'}
              >
                {date.getDate()}
              </button>
              {dayComps.length > 0 && (
                <ul className="calendar-day-comps">
                  {dayComps.slice(0, 4).map(c => (
                    <li
                      key={c.id}
                      className="calendar-day-comp"
                      onClick={() => setSelectedComp(c)}
                    >
                      <Flag iso2={c.country} className="calendar-comp-flag" />
                      <span className="calendar-comp-name">{localizeCompName(c.id, c.name, isZh)}</span>
                    </li>
                  ))}
                  {dayComps.length > 4 && (
                    <li className="calendar-day-more">+{dayComps.length - 4}</li>
                  )}
                </ul>
              )}
            </div>
          );
        }}
      />

      {selectedComp && (
        <CompModal
          comp={selectedComp}
          isZh={isZh}
          onClose={() => setSelectedComp(null)}
        />
      )}

      {onThisDayDate && (
        <OnThisDayModal
          date={onThisDayDate}
          isZh={isZh}
          onClose={() => setOnThisDayDate(null)}
        />
      )}
    </div>
  );
}

function CompModal({ comp, isZh, onClose }: { comp: Comp; isZh: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date || comp.start_date);
  const displayName = localizeCompName(comp.id, comp.name, isZh);
  const displayCity = comp.city ? localizeCity(comp.city, isZh) : '';
  const displayCountry = countryName(comp.country, isZh);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">
          <Link {...compLinkProps(comp.id)}>
            <Flag iso2={comp.country} />
            <span className="modal-title-name">{displayName}</span>
          </Link>
        </h2>
        <div className="modal-meta">
          {dateStr} · {displayCity}{isZh ? '，' : ', '}{displayCountry}
        </div>
        {comp.events && comp.events.length > 0 && (
          <div className="modal-events">
            {comp.events.map((ev) => (
              <span key={ev} className="modal-event-chip">
                {eventDisplayName(ev, isZh)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="calendar-page"><div className="calendar-loading">Loading…</div></div>}>
      <CalendarInner />
    </Suspense>
  );
}
