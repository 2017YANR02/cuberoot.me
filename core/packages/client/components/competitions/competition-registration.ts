import { useEffect, useState } from 'react';
import { competitionDateTime } from '@/lib/competition-date';
import type { CompetitionRegistration, CompetitionSession } from '@/lib/online-competition-api';

export const COMPETITION_RESERVATION_MS = 30 * 60 * 1000;

export const competitionMoney = (minor: number, currency = 'CNY') =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(minor / 100);

export function isCompetitionPaymentPending(status: string) {
  return status === 'reserved' || status === 'pending_payment';
}

export function competitionReservationDeadline(entry: Pick<CompetitionRegistration, 'reservationExpiresAt' | 'createdAt'>) {
  if (entry.reservationExpiresAt) return Date.parse(entry.reservationExpiresAt);
  return Date.parse(entry.createdAt ?? '') + COMPETITION_RESERVATION_MS;
}

export function competitionReservationExpired(entry: CompetitionRegistration, now: number) {
  if (entry.status === 'expired') return true;
  // Order expiry releases the seat as cancelled and retains its reservation deadline.
  if (entry.status === 'cancelled') return Date.parse(entry.reservationExpiresAt ?? '') <= now;
  return isCompetitionPaymentPending(entry.status) && competitionReservationDeadline(entry) <= now;
}

export function competitionCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function useCompetitionCountdown(deadline: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current < deadline) timeout = setTimeout(tick, Math.min(1000, deadline - current));
    };
    tick();
    return () => clearTimeout(timeout);
  }, [deadline]);
  return now && Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
}

export function competitionSessionTime(session: Pick<CompetitionSession, 'startsAt' | 'endsAt'>) {
  const [startDate, startTime = '—'] = competitionDateTime(session.startsAt).split(' ');
  const [endDate, endTime = '—'] = competitionDateTime(session.endsAt).split(' ');
  return {
    time: `${startTime} – ${endTime}`,
    date: startDate === endDate ? startDate : `${startDate} – ${endDate}`,
    minutes: Math.max(0, Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000)),
  };
}

export function focusCompetitionElement(element: HTMLElement | null | undefined) {
  if (!element) return;
  element.scrollIntoView?.({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'center',
  });
  element.focus({ preventScroll: true });
}
