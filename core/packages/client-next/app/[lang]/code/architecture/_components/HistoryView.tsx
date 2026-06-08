'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MonthGrid from '@/components/MonthGrid';
import { useLang } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import { TIMELINE } from '../_lib/arch-data';
import COMMITS_DATA from '../timeline_commits.json';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface DayEntry { date: string; zh: string; en: string; }
const DAYS = COMMITS_DATA as DayEntry[];
const CAL_MONTHS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];

function Timeline() {
  const lang = useLang();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className="timeline">
      {TIMELINE.map((e, i) => {
        const t = (i18n.language.startsWith('zh') ? e.zh : e.en);
        const isOpen = open === i;
        return (
          <li key={i} className={`tl-entry tl-${e.tag}${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="tl-trigger"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <div className="tl-date">{e.date}</div>
              <div className="tl-body">
                <div className="tl-head-line">
                  <span className={`tl-tag tl-tag-${e.tag}`}>{e.tag}</span>
                  <h4 className="tl-title">{t.title}</h4>
                  <span className={`tl-chev${isOpen ? ' open' : ''}`} aria-hidden>▸</span>
                </div>
                <p className="tl-summary">{t.body}</p>
                {isOpen && <p className="tl-expand">{t.expand}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CalMonth({ ym, byDate, lang, expanded, onToggle }: {
  ym: string;
  byDate: Record<string, DayEntry>;
  lang: Lang;
  expanded: string | null;
  onToggle: (date: string) => void;
}) {
  const [y, m] = ym.split('-').map(Number);
  const dows = lang === 'zh' ? ['一','二','三','四','五','六','日'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <div className="cal-month">
      <MonthGrid
        year={y}
        month={m}
        weekdays={dows}
        className="cal-grid"
        dayCellProps={(day, { inView }) => {
          if (!inView) return undefined;
          const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          if (!byDate[date]) return undefined;
          const isExpanded = expanded === date;
          return {
            className: `cal-cell-has-entry${isExpanded ? ' cal-cell-expanded' : ''}`,
            onClick: () => onToggle(date),
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(date); }
            },
            role: 'button',
            tabIndex: 0,
            'aria-expanded': isExpanded,
          };
        }}
        renderDay={(day, { inView }) => {
          if (!inView) return null;
          const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const entry = byDate[date];
          return (
            <>
              <div className="cal-day">{day.getDate()}</div>
              {entry && <div className="cal-note">{(i18n.language.startsWith('zh') ? entry.zh : entry.en)}</div>}
            </>
          );
        }}
      />
    </div>
  );
}

function CommitsCalendar() {
  const lang = useLang();
  const byDate = useMemo(() => {
    const m: Record<string, DayEntry> = {};
    for (const d of DAYS) m[d.date] = d;
    return m;
  }, []);
  const [idx, setIdx] = useState(CAL_MONTHS.length - 1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const gotoIdx = useCallback((delta: number) => {
    setIdx((cur) => Math.max(0, Math.min(CAL_MONTHS.length - 1, cur + delta)));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') gotoIdx(-1);
      else if (e.key === 'ArrowRight') gotoIdx(1);
      else if (e.key === 'Escape') setExpanded(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [gotoIdx]);

  const ym = CAL_MONTHS[idx];
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let activeDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (byDate[date]) activeDays++;
  }
  const monthLabel = lang === 'zh' ? `${y} 年 ${m} 月` : `${y}-${String(m).padStart(2, '0')}`;

  return (
    <div className="cal-stack">
      <div className="cal-month-nav" role="navigation" aria-label={tr({ zh: '月份切换', en: 'Month nav',
          zhHant: "月份切換"
    })}>
        <button type="button" className="cal-nav-btn" onClick={() => gotoIdx(-1)} disabled={idx === 0} aria-label={tr({ zh: '上一月', en: 'Previous month' })}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button type="button" className="cal-nav-latest" onClick={() => setIdx(CAL_MONTHS.length - 1)} disabled={idx === CAL_MONTHS.length - 1}>
          {tr({ zh: '最新', en: 'Latest' })}
        </button>
        <button type="button" className="cal-nav-btn" onClick={() => gotoIdx(1)} disabled={idx === CAL_MONTHS.length - 1} aria-label={tr({ zh: '下一月', en: 'Next month' })}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
        <span className="cal-nav-label">{monthLabel}</span>
        <span className="cal-nav-stat">{lang === 'zh' ? `${activeDays} 天有动静` : `${activeDays} active days`}</span>
        <span className="cal-nav-hint">{tr({ zh: '键盘 ← → 切换  ·  点格子展开', en: '← → keys  ·  click to expand',
            zhHant: "鍵盤 ← → 切換  ·  點格子展開"
        })}</span>
      </div>
      <CalMonth key={ym} ym={ym} byDate={byDate} lang={lang} expanded={expanded} onToggle={(d) => setExpanded((cur) => cur === d ? null : d)} />
    </div>
  );
}

export default function HistoryView() {
  const lang = useLang();
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  return (
    <>
      <div className="history-tabs" role="tablist">
        <button type="button" className={`history-tab${mode === 'list' ? ' active' : ''}`} onClick={() => setMode('list')} aria-selected={mode === 'list'}>
          {lang === 'zh' ? `列表  ·  ${TIMELINE.length} 件重大` : `List  ·  ${TIMELINE.length} majors`}
        </button>
        <button type="button" className={`history-tab${mode === 'calendar' ? ' active' : ''}`} onClick={() => setMode('calendar')} aria-selected={mode === 'calendar'}>
          {lang === 'zh' ? `日历  ·  逐日总结 (${DAYS.length} 天)` : `Calendar  ·  per-day summary (${DAYS.length} days)`}
        </button>
      </div>
      {mode === 'list' ? <Timeline /> : <CommitsCalendar />}
    </>
  );
}
