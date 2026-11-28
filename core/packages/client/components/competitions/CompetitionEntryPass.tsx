'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, Check, Ticket } from '@app-foundation/icons/lucide';
import { COMPETITION_CHECK_IN_LEAD_MS } from '@cuberoot/shared/timer';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { competitionDateTime } from '@/lib/competition-date';
import type { CompetitionMode, CompetitionProject, CompetitionRegistration, CompetitionSession } from '@/lib/online-competition-api';
import { eventDisplayName } from '@/lib/wca-events';
import { competitionDeviceName } from './CompetitionDraftForm';
import { CompetitionPreflight } from './CompetitionPreflight';
import {
  competitionCountdown, competitionMoney, competitionReservationDeadline, competitionSessionTime, focusCompetitionElement,
  competitionReservationExpired, isCompetitionPaymentPending, useCompetitionCountdown,
} from './competition-registration';

export function CompetitionEntryPass({
  entry, project, session, mode, fresh, verified, busy, now, canEnter, onEnter, onCheckIn, onRetry,
}: {
  entry: CompetitionRegistration;
  project?: CompetitionProject;
  session?: CompetitionSession;
  mode: CompetitionMode;
  fresh: boolean;
  verified?: boolean;
  busy: boolean;
  now: number;
  canEnter: boolean;
  onEnter(): void;
  onCheckIn(): void;
  onRetry?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const headingId = useId();
  const preflightId = useId();
  const successId = useId();
  const card = useRef<HTMLElement>(null);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightDone, setPreflightDone] = useState(false);
  const onReady = useCallback(() => setPreflightDone(true), []);
  const pending = isCompetitionPaymentPending(entry.status);
  const deadline = pending ? competitionReservationDeadline(entry) : NaN;
  const seconds = useCompetitionCountdown(deadline);
  const expired = seconds === 0 || competitionReservationExpired(entry, now);
  const confirmed = entry.status === 'confirmed' || entry.status === 'attended';
  const online = mode !== 'offline';
  const checkIn = online && entry.canCheckIn && !entry.checkedInAt && entry.status === 'confirmed';
  const checkInAt = session && Date.parse(session.startsAt) - COMPETITION_CHECK_IN_LEAD_MS;
  const upcoming = confirmed && !entry.checkedInAt && !checkIn && online && checkInAt !== undefined && now < checkInAt;
  const checkInTime = upcoming ? new Date(checkInAt).toISOString() : null;
  const preflightAvailable = upcoming || (confirmed && online && !checkIn && !entry.checkedInAt
    && entry.status !== 'attended' && !!session && now < Date.parse(session.endsAt));
  const currentStep = entry.resultRecordedAt || entry.status === 'attended' ? 4
    : entry.checkedInAt ? 3 : checkIn || preflightDone || verified ? 2 : 1;
  const orderHref = entry.orderId ? `/platform/orders/${encodeURIComponent(entry.orderId)}` : undefined;
  const amount = project && competitionMoney(project.amountMinor, project.currency);
  const schedule = session && competitionSessionTime(session);

  useEffect(() => {
    if (fresh) focusCompetitionElement(card.current);
  }, [fresh]);

  const title = expired ? t('锁位已到期', 'Reservation expired') : pending
    ? t('席位已锁定 · 待完成付款', 'Place held · Payment due')
    : t('参赛通行证', 'Entry pass');

  return <section ref={card} tabIndex={-1} aria-labelledby={headingId} aria-describedby={fresh && confirmed ? successId : undefined}
    className="competition-passport competition-entry-pass" data-site-surface="panel"
    data-tone={expired ? 'lost' : pending ? 'waiting' : 'done'}>
    <header className="competition-entry-pass-heading">
      <h2 id={headingId}><Ticket size={18} aria-hidden /><span role="status">{title}</span></h2>
      {!pending && orderHref && <AppLink href={orderHref} prefetch={false}>{t('订单', 'Order')}</AppLink>}
    </header>
    {fresh && confirmed && <p id={successId} className="competition-entry-success" role="status"><Check size={16} aria-hidden />
      {t('报名成功 · 席位已锁定', 'Registered · Your place is secured')}</p>}
    <div className="competition-entry-pass-main">
      <div className="competition-entry-pass-identity"><EventIcon event={entry.project} />
        <span><strong>{eventDisplayName(entry.project, lang === 'zh')}</strong><small>{competitionDeviceName(entry.device, t)}</small></span>
      </div>
      {session && schedule && <div className="competition-entry-pass-schedule">
        <CalendarClock size={16} aria-hidden />
        <span><strong>{schedule.time}</strong><small>{schedule.date} · {t('北京时间', 'UTC+8')}</small></span>
      </div>}
      {pending && !expired && seconds !== null && <div className="competition-entry-reservation" data-warning={seconds <= 300 || undefined}>
        <span>{t('锁位剩余', 'Time to pay')}</span>
        <strong role="timer">{competitionCountdown(seconds)}</strong>
      </div>}
    </div>
    {entry.reviewRequired && <p className="competition-muted">{t('待抽检', 'Review flagged')}</p>}
    {confirmed && online && <ol className="competition-entry-path" aria-label={t('参赛步骤', 'Competition steps')}>
      {[t('已报名', 'Registered'), t('赛前自检', 'Equipment check'), t('开放检录', 'Check-in'), t('进入赛场', 'Enter arena')]
        .map((label, index) => <li key={index} data-complete={index < currentStep || undefined} aria-current={index === currentStep ? 'step' : undefined}>
          <span aria-hidden>{index < currentStep ? <Check size={14} /> : index + 1}</span>{label}
        </li>)}
    </ol>}
    <div className="competition-entry-pass-actions">
      {checkInTime && <p className="competition-muted">
        {t('检录开放', 'Check-in opens')} <time dateTime={checkInTime}>{competitionDateTime(checkInTime)}</time> {t('北京时间', 'UTC+8')}
      </p>}
      {expired ? onRetry && <button type="button" className="competition-primary competition-focus-action" onClick={onRetry}>
          {t('重新报名', 'Register again')}</button>
        : pending ? orderHref && <AppLink className="competition-primary competition-focus-action" href={orderHref} prefetch={false}>
          {amount && Number.isFinite(deadline) ? t(`立即前往付款（${amount}）`, `Pay now (${amount})`) : t('继续付款', 'Continue to payment')}
        </AppLink>
        : checkIn ? <button type="button" className="competition-primary competition-focus-action" disabled={busy}
          onClick={entry.device === 'smart' ? onEnter : onCheckIn}>
          {busy ? <LoadingIndicator>{t('正在检录…', 'Checking in…')}</LoadingIndicator> : entry.device === 'smart'
            ? t('连接魔方检录', 'Connect cube to check in') : t('立即检录', 'Check in now')}
        </button>
        : canEnter && (online || entry.resultRecordedAt) ? <button type="button" className="competition-primary competition-focus-action" onClick={onEnter}>
          {entry.resultRecordedAt ? t('查看成绩', 'View result') : t('进入赛场', 'Enter arena')} <ArrowRight size={16} aria-hidden />
        </button>
        : preflightAvailable ? <MoreToggle className="competition-secondary" aria-controls={preflightId}
          expanded={preflightOpen} onClick={() => setPreflightOpen(open => !open)}>
          {t('赛前设备自检', 'Equipment check')}
        </MoreToggle> : null}
    </div>
    <MoreTogglePanel id={preflightId} expanded={preflightAvailable && preflightOpen}>
      {preflightAvailable && preflightOpen && <CompetitionPreflight mode={mode} device={entry.device} onReady={onReady} />}
    </MoreTogglePanel>
  </section>;
}
