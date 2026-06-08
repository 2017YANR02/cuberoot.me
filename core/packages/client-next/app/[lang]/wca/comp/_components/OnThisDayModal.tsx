'use client';

/**
 * 历年此日 — 点 CalendarPage 日历格子的日期数字打开。
 * Ported from packages/client/src/pages/calendar/OnThisDayModal.tsx.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { compLinkProps } from '@/lib/comp-link';
import { RecordBadge } from '@/components/RecordBadge';
import { useDayMatches, type DayMatch } from './use_calendar_data';
import './on_this_day.css';
import i18n from "@/i18n/i18n-client";

type TierKey = 'WR' | 'CR' | 'NR';
const TIER_KEYS: TierKey[] = ['WR', 'CR', 'NR'];

function shiftDay(d: Date, deltaDays: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function formatDate(d: Date, isZh: boolean): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (isZh) return `${m} 月 ${day} 日`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${day}`;
}

interface Props {
  date: Date;
  isZh: boolean;
  onClose: () => void;
}

export default function OnThisDayModal({ date: initialDate, isZh, onClose }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);

  const [date, setDate] = useState<Date>(initialDate);
  useEffect(() => { setDate(initialDate); }, [initialDate]);

  const { matches, error } = useDayMatches(date);

  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTiers, setActiveTiers] = useState<Set<TierKey>>(() => new Set());
  const toggleTier = (k: TierKey) =>
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const tierCounts = useMemo(() => {
    const counts: Record<TierKey, number> = { WR: 0, CR: 0, NR: 0 };
    if (!matches) return counts;
    for (const m of matches) {
      if (m.recordTier) counts[m.recordTier]++;
    }
    return counts;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return null;
    if (activeTiers.size === 0) return matches;
    return matches.filter((m) => m.recordTier !== null && activeTiers.has(m.recordTier));
  }, [matches, activeTiers]);

  const grouped = useMemo(() => {
    if (!filteredMatches) return null;
    const byYearsAgo = new Map<number, DayMatch[]>();
    for (const m of filteredMatches) {
      const arr = byYearsAgo.get(m.yearsAgo) ?? [];
      arr.push(m);
      byYearsAgo.set(m.yearsAgo, arr);
    }
    return [...byYearsAgo.entries()].sort((a, b) => a[0] - b[0]);
  }, [filteredMatches]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateLabel = formatDate(date, isZh);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel otd-panel" onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <header className="otd-header">
          <button
            type="button"
            className="otd-step"
            onClick={() => setDate((d) => shiftDay(d, -1))}
            aria-label="prev day"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="otd-title">
            <span className="otd-title-main">{t('魔方上的此日', 'On This Day')}</span>
            <span className="otd-title-date">{dateLabel}</span>
          </h2>
          <button
            type="button"
            className="otd-step"
            onClick={() => setDate((d) => shiftDay(d, 1))}
            aria-label="next day"
          >
            <ChevronRight size={16} />
          </button>
        </header>

        <div className="otd-body">
          {matches && matches.length > 0 && (
            <div className="otd-filters" role="group" aria-label={t('记录筛选', 'record filter', "記錄篩選")}>
              {TIER_KEYS.map((k) => {
                const active = activeTiers.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    className={`otd-filter${active ? ' is-active' : ''}`}
                    onClick={() => toggleTier(k)}
                    aria-pressed={active}
                  >
                    <RecordBadge record={k} />
                    <span className="otd-filter-count">{tierCounts[k]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="otd-error">
              {t('数据加载失败:', 'Failed to load data:', "資料載入失敗:")} {error}
            </div>
          )}

          {!matches && !error && (
            <div className="otd-loading">{t('加载中…', 'Loading…', "載入中…")}</div>
          )}

          {matches && matches.length === 0 && (
            <div className="otd-empty">
              {t(`历年 ${dateLabel} 没有 WCA 比赛举行`,
                 `No WCA competitions on record for ${dateLabel}`, `歷年 ${dateLabel} 沒有 WCA 比賽舉行`)}
            </div>
          )}

          {matches && matches.length > 0 && filteredMatches && filteredMatches.length === 0 && (
            <div className="otd-empty">
              {t('当前筛选下没有比赛', 'No competitions match the current filter', "當前篩選下沒有比賽")}
            </div>
          )}

          {grouped && grouped.length > 0 && (
            <div className="otd-summary">
              {filteredMatches!.length === matches!.length
                ? t(`共 ${matches!.length} 场 WCA 比赛在历年的此日举行`,
                    `${matches!.length} WCA competitions across the years`, `共 ${matches!.length} 場 WCA 比賽在歷年的此日舉行`)
                : t(`筛选出 ${filteredMatches!.length} / ${matches!.length} 场`,
                    `${filteredMatches!.length} of ${matches!.length} comps`, `篩選出 ${filteredMatches!.length} / ${matches!.length} 場`)}
            </div>
          )}

          {grouped && grouped.map(([yearsAgo, ms]) => {
            const year = ms[0].comp.start_date.slice(0, 4);
            return (
              <section key={year} className="otd-year-block">
                <header className="otd-year-header">
                  <span className="otd-year">{year}</span>
                  <span className="otd-year-meta">
                    {yearsAgo === 0
                      ? t('今天', 'Today')
                      : t(`${yearsAgo} 年前`, `${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago`)}
                  </span>
                  <span className="otd-year-count">{ms.length} {t('场比赛', ms.length === 1 ? 'comp' : 'comps', "場比賽")}</span>
                </header>
                <ul className="otd-list">
                  {ms.map((m) => (
                    <li key={m.comp.id} className="otd-item">
                      <Flag iso2={m.comp.country} className="otd-flag" />
                      <Link
                        className="otd-comp-name"
                        {...compLinkProps(m.comp.id)}
                      >
                        {localizeCompName(m.comp.id, m.comp.name, isZh)}
                      </Link>
                      <span className="otd-meta">
                        <MapPin size={12} className="otd-icon" />
                        <span>{localizeCity(m.comp.city, isZh)}</span>
                      </span>
                      {m.recordTier && <RecordBadge record={m.recordTier} />}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
