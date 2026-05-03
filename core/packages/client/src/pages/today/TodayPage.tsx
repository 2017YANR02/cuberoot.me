/**
 * /today — On This Day in Cubing.
 *
 * Looks up WCA competitions whose date window includes the chosen MM-DD across
 * all years. Defaults to today's date. Use ◀ ▶ buttons to step day-by-day.
 *
 * Data is fetched from /stats/all_past_comps.json (~5MB; cached at module level
 * after first fetch this session, and by the browser across sessions).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarHeart, ChevronLeft, ChevronRight, Trophy, MapPin } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { Flag } from '../../utils/flag';
import { useTodayMatches, type TodayMatch } from './use_today_data';
import './today.css';

function shiftDay(d: Date, deltaDays: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function formatDate(d: Date, lang: 'zh' | 'en'): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (lang === 'zh') return `${m} 月 ${day} 日`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${day}`;
}

export default function TodayPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [date, setDate] = useState<Date>(() => new Date());
  const { matches, error } = useTodayMatches(date);

  const grouped = useMemo(() => {
    if (!matches) return null;
    const byYearsAgo = new Map<number, TodayMatch[]>();
    for (const m of matches) {
      const arr = byYearsAgo.get(m.yearsAgo) ?? [];
      arr.push(m);
      byYearsAgo.set(m.yearsAgo, arr);
    }
    return [...byYearsAgo.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const dateLabel = formatDate(date, lang);

  return (
    <div className="today-page">
      <header className="today-header">
        <div className="today-title">
          <CalendarHeart size={20} className="today-title-icon" />
          <h1>{t('魔方上的今天', 'On This Day in Cubing')}</h1>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="today-main">
        <div className="today-date-bar">
          <button
            type="button"
            className="today-step"
            onClick={() => setDate((d) => shiftDay(d, -1))}
            aria-label="prev day"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="today-date-label">
            {dateLabel}
            <button
              type="button"
              className="today-today-btn"
              onClick={() => setDate(new Date())}
            >
              {t('回到今天', 'Today')}
            </button>
          </div>
          <button
            type="button"
            className="today-step"
            onClick={() => setDate((d) => shiftDay(d, 1))}
            aria-label="next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {error && (
          <div className="today-error">
            {t('数据加载失败:', 'Failed to load data:')} {error}
          </div>
        )}

        {!matches && !error && (
          <div className="today-loading">{t('加载中…', 'Loading…')}</div>
        )}

        {matches && matches.length === 0 && (
          <div className="today-empty">
            {t(`历年 ${dateLabel} 没有 WCA 比赛举行`,
               `No WCA competitions on record for ${dateLabel}`)}
          </div>
        )}

        {grouped && grouped.length > 0 && (
          <div className="today-summary">
            {t(`共 ${matches!.length} 场 WCA 比赛在历年的此日举行`,
               `${matches!.length} WCA competitions across the years`)}
          </div>
        )}

        {grouped && grouped.map(([yearsAgo, ms]) => {
          const year = ms[0].comp.start_date.slice(0, 4);
          return (
            <section key={year} className="today-year-block">
              <header className="today-year-header">
                <span className="today-year">{year}</span>
                <span className="today-year-meta">
                  {yearsAgo === 0
                    ? t('今天', 'Today')
                    : t(`${yearsAgo} 年前`, `${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago`)}
                </span>
                <span className="today-year-count">{ms.length} {t('场比赛', ms.length === 1 ? 'comp' : 'comps')}</span>
              </header>
              <ul className="today-list">
                {ms.map((m) => (
                  <li key={m.comp.id} className="today-item">
                    <Flag iso2={m.comp.country} className="today-flag" />
                    <a
                      className="today-comp-name"
                      href={`https://www.worldcubeassociation.org/competitions/${m.comp.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.comp.name}
                    </a>
                    <span className="today-meta">
                      <MapPin size={12} className="today-icon" />
                      <span>{m.comp.city}</span>
                    </span>
                    {m.recordTier && (
                      <span className={`today-record today-record-${m.recordTier.toLowerCase()}`}>
                        <Trophy size={11} />
                        <span>{m.recordTier}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
