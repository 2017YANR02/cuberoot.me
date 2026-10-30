'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, CalendarCheck, Loader2 } from '@app-foundation/icons/lucide';
import { useRouter } from 'next/navigation';
import { useAuthUser, nextQuery } from '@/lib/auth-store';
import { addCompetitionToCalendar, isCompetitionInCalendar, type CompetitionCalendarInput } from '@/lib/competition-calendar-event';
import { tr } from '@/i18n/tr';
import { Tooltip } from './Tooltip';
import AppLink from './AppLink';

const INTENT_KEY = 'competition-calendar-intent';

export function CompetitionCalendarButton({ competition }: { competition: CompetitionCalendarInput }) {
  const user = useAuthUser();
  const router = useRouter();
  const owner = user?.wcaId || (user?.uid ? `u${user.uid}` : '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'busy' | 'done' | 'error'>('idle');
  const running = useRef(false);
  const revision = useRef(0);
  const scope = `${owner}:${competition.id}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const trigger = useRef<HTMLButtonElement>(null);
  const calendarLink = useRef<HTMLAnchorElement>(null);
  const restoreFocus = useRef(false);
  const add = useCallback(async () => {
    if (!owner || running.current) return;
    running.current = true;
    const requestScope = scope;
    ++revision.current;
    setStatus('busy');
    try {
      await addCompetitionToCalendar(owner, competition);
      if (requestScope !== currentScope.current) return;
      restoreFocus.current = document.activeElement === trigger.current;
      setStatus('done');
    } catch {
      if (requestScope === currentScope.current) setStatus('error');
    } finally {
      running.current = false;
    }
  }, [owner, competition, scope]);

  useEffect(() => {
    const request = ++revision.current;
    if (!owner || !competition.startDate) { setStatus('idle'); return; }
    if (running.current) return;
    setStatus('checking');
    void isCompetitionInCalendar(competition).then(exists => {
      if (request === revision.current) setStatus(exists ? 'done' : 'idle');
    }).catch(() => {
      // A click retries the persisted check before any creation.
      if (request === revision.current) setStatus('idle');
    });
    return () => { revision.current++; };
  }, [owner, competition.id, competition.startDate, competition.endDate]);

  useLayoutEffect(() => {
    if (status === 'done' && restoreFocus.current) {
      restoreFocus.current = false;
      calendarLink.current?.focus({ preventScroll: true });
    }
  }, [status]);

  useEffect(() => {
    if (!owner || !competition.startDate) return;
    try {
      const raw = sessionStorage.getItem(INTENT_KEY);
      if (!raw) return;
      const intent = JSON.parse(raw) as { id?: string; expires?: number };
      if (intent.id !== competition.id) return;
      sessionStorage.removeItem(INTENT_KEY);
      if (intent.expires && intent.expires > Date.now()) void add();
    } catch { /* Storage unavailable: the visible button still allows retry. */ }
  }, [owner, competition.id, competition.startDate, add]);

  if (status === 'done') {
    const completedLabel = tr({ zh: '已添加 · 查看日历', en: 'Added · View calendar' });
    return <>
      <Tooltip content={completedLabel}>{tip => <AppLink {...tip} ref={calendarLink}
        href={`/calendar?d=${encodeURIComponent(competition.startDate.slice(0, 10))}`}
        prefetch={false} aria-label={completedLabel}
        className="comp-title-icon comp-title-icon-lucide comp-calendar-button">
        <CalendarCheck size={18} aria-hidden="true" />
      </AppLink>}</Tooltip>
      <span role="status" className="sr-only">{completedLabel}</span>
    </>;
  }

  const label = status === 'checking' ? tr({ zh: '正在检查日历', en: 'Checking calendar' }) : status === 'busy' ? tr({ zh: '正在添加到日历', en: 'Adding to calendar' })
    : tr({ zh: '添加到我的日历', en: 'Add to my calendar' });
  return <>
    <Tooltip content={label}>{tip => <button {...tip} ref={trigger} type="button"
      className="comp-title-icon comp-title-icon-lucide comp-calendar-button"
      aria-label={label} disabled={!competition.startDate || status === 'busy' || status === 'checking'}
      onClick={() => {
        if (user) { void add(); return; }
        try {
          sessionStorage.setItem(INTENT_KEY, JSON.stringify({ id: competition.id, expires: Date.now() + 60 * 60_000 }));
        } catch { setStatus('error'); return; }
        const prefix = window.location.pathname.startsWith('/zh/') ? '/zh' : '';
        router.push(`${prefix}/account${nextQuery(window.location.pathname + window.location.search + window.location.hash)}`);
      }}>
      {status === 'busy' || status === 'checking' ? <Loader2 size={18} /> : <CalendarDays size={18} />}
    </button>}</Tooltip>
    <span role="status" className={status === 'error' ? 'comp-calendar-error' : 'sr-only'}>
      {status === 'error' ? tr({ zh: '添加失败，请重试', en: 'Could not add. Please retry.' }) : ''}
    </span>
  </>;
}
