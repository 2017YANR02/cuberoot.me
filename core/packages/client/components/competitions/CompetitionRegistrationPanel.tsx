'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CalendarClock, Check, Circle, Ticket } from '@app-foundation/icons/lucide';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';
import './competition-registration.css';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery } from '@/lib/auth-store';
import { competitionDateTime } from '@/lib/competition-date';
import { competitionHref } from '@/lib/competition-links';
import { createCompetitionOrder, type CompetitionProject, type CompetitionSession, type OnlineCompetition } from '@/lib/online-competition-api';
import { eventDisplayName } from '@/lib/wca-events';
import { competitionDeviceName, competitionFormatName, competitionModeName } from './CompetitionDraftForm';
import { CompetitionPreflight } from './CompetitionPreflight';
import { competitionMoney, competitionSessionTime, focusCompetitionElement, useCompetitionCountdown } from './competition-registration';

type EntryState = 'registered' | 'payment';
type RegistrationStep = 'project' | 'session' | 'consent';

export type CompetitionOrderReceipt = {
  orderId: string;
  project: CompetitionProject;
  sessionId: string;
  confirmed: boolean;
  createdAt: string;
  preflightVerified: boolean;
};

export function CompetitionRegistrationFacts({ competition, status }: { competition: OnlineCompetition; status: string }) {
  const t = useT();
  const opening = status === 'registration_upcoming';
  const deadline = opening ? competition.registrationOpensAt : competition.registrationClosesAt;
  const ticking = opening || status === 'registration_open';
  const remaining = useCompetitionCountdown(ticking ? Date.parse(deadline) : NaN);
  const countsKnown = competition.projects.length > 0 && competition.projects.every(project => project.available !== undefined);
  const available = competition.projects.reduce((sum, project) => sum + (project.available ?? 0), 0);
  const capacity = competition.projects.reduce((sum, project) => sum + project.capacity, 0);
  const totalSeconds = remaining ?? 0;
  const days = Math.floor(totalSeconds / 86_400);
  const clock = [Math.floor(totalSeconds / 3600) % 24, Math.floor(totalSeconds / 60) % 60, totalSeconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
  return <ul className="competition-registration-facts">
    <li>{competitionFormatName(competition.format ?? 'average', t)}</li>
    <li>{competitionModeName(competition.supervisionMode ?? 'supervised', t)}</li>
    {capacity > 0 && <li>{countsKnown ? t(`余 ${available} / ${capacity} 位`, `${available} / ${capacity} places left`)
      : t(`共 ${capacity} 位`, `${capacity} places total`)}</li>}
    {ticking && <li className="competition-registration-clock" data-warning={!opening && remaining !== null && remaining < 86_400 || undefined}>
      <CalendarClock size={15} aria-hidden />
      <span>{opening ? t('报名开始', 'Registration opens') : t('报名截止', 'Registration closes')}</span>
      <time dateTime={deadline}>{competitionDateTime(deadline)}</time>
      {remaining !== null && <>{' '}<strong>{days ? t(`${days} 天 ${clock}`, `${days}d ${clock}`) : clock}</strong></>}
    </li>}
  </ul>;
}

export function CompetitionRegistrationPanel({
  competition, routeId, ticketId, sessionId, onProject, onSession, entryFor, now, signedIn, preview, expanded, venue, onOrdered, onRefresh,
}: {
  competition: OnlineCompetition;
  routeId: string;
  ticketId: string;
  sessionId: string;
  onProject(id: string): void;
  onSession(id: string): void;
  entryFor(project: CompetitionProject): EntryState | undefined;
  now: number;
  signedIn: boolean;
  preview: boolean;
  expanded: boolean;
  venue?: ReactNode;
  onOrdered(receipt: CompetitionOrderReceipt): void;
  onRefresh(): void;
}) {
  const t = useT();
  const lang = useLang();
  const consentHint = useId();
  const projectHint = useId();
  const sessionHint = useId();
  const entryId = useId();
  const mode = competition.supervisionMode ?? 'supervised';
  const supervised = mode === 'supervised';
  const availableProjects = competition.projects.filter(item => item.available !== 0 && !entryFor(item));
  const project = availableProjects.find(item => item.id === ticketId) ?? (availableProjects.length === 1 ? availableProjects[0] : undefined);
  const sessionState = (item: CompetitionSession) => supervised && now >= Date.parse(item.startsAt) ? 'started'
    : supervised && !item.staffed ? 'unstaffed' : item.available <= 0 ? 'full' : 'available';
  const availableSessions = competition.sessions.filter(item => sessionState(item) === 'available');
  const session = supervised
    ? availableSessions.find(item => item.id === sessionId) ?? (availableSessions.length === 1 ? availableSessions[0] : undefined)
    : competition.sessions[0];
  const sessionReady = !!session && sessionState(session) === 'available';
  const sessionTime = session && competitionSessionTime(session);
  const fee = project && (project.amountMinor === 0 ? t('免费参赛', 'Free entry') : competitionMoney(project.amountMinor, project.currency));

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState<'free' | 'paid' | null>(null);
  const busy = submitting !== null;
  const verifiedProjects = useRef(new Set<string>());
  const [issue, setIssue] = useState<RegistrationStep>();
  const [error, setError] = useState('');
  const pending = useRef(false);
  const projectChoices = useRef<HTMLDivElement>(null);
  const sessionChoices = useRef<HTMLDivElement>(null);
  const consent = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const choices = useRef<HTMLElement>(null);
  const mobileBar = useRef<HTMLDivElement>(null);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pulsing = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIssue(undefined);
    setError('');
  }, [ticketId, sessionId]);

  useEffect(() => () => clearTimeout(pulseTimeout.current), []);
  useEffect(() => {
    const bar = mobileBar.current;
    if (!bar) return;
    const style = document.body.style;
    const property = '--competition-registration-bar-height';
    const measure = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      const value = height > 0 ? `${height}px` : '';
      if (value !== style.getPropertyValue(property)) style.setProperty(property, value);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(bar, { box: 'border-box' });
    return () => {
      observer?.disconnect();
      style.removeProperty(property);
    };
  }, [expanded]);

  const step: RegistrationStep | undefined = !project ? 'project' : !sessionReady ? 'session' : !accepted ? 'consent' : undefined;
  const guidance = {
    project: t('请选择仍有余位的参赛项目。', 'Choose an event with an available place.'),
    session: supervised ? t('请选择仍有余位的监督场次。', 'Choose a supervised session with an available place.')
      : t('当前场次暂无余位。', 'No places are currently available in this session.'),
    consent: t('请先同意参赛与退款规则。', 'Agree to the participation and refund policies first.'),
  };
  const stepLabels = {
    project: t('选择项目', 'Choose event'), session: t('选择场次', 'Choose session'), consent: t('同意规则', 'Agree to rules'),
  };
  const mobileLabels = {
    project: t('去选项目', 'Choose event'), session: t('去选场次', 'Choose session'), consent: stepLabels.consent,
  };

  function guide(missing: RegistrationStep) {
    setIssue(missing);
    const area = { project: projectChoices.current, session: sessionChoices.current ?? consent.current, consent: consent.current }[missing];
    const target = area?.querySelector<HTMLElement>(missing === 'consent' ? '[role="switch"]' : 'button:not(:disabled)') ?? area;
    if (!target) return;
    clearTimeout(pulseTimeout.current);
    pulsing.current?.removeAttribute('data-registration-focus');
    void target.offsetWidth;
    target.setAttribute('data-registration-focus', '');
    pulsing.current = target;
    pulseTimeout.current = setTimeout(() => target.removeAttribute('data-registration-focus'), 1200);
    focusCompetitionElement(target);
  }

  async function confirm() {
    if (pending.current || preview) return;
    if (step) { guide(step); return; }
    if (!project || !session) return;
    const createdAt = new Date().toISOString();
    pending.current = true;
    setSubmitting(project.amountMinor === 0 ? 'free' : 'paid');
    setIssue(undefined);
    setError('');
    try {
      const result = await createCompetitionOrder(project, session.id);
      const orderId = result.order?.id ?? result.id ?? result.resourceId;
      if (!orderId) throw new Error(t('订单已提交，请到我的订单查看付款状态。', 'Order submitted. Check My orders for payment status.'));
      const amount = result.totalAmountMinor ?? project.amountMinor;
      onOrdered({
        orderId, project: { ...project, amountMinor: amount, currency: result.currency ?? project.currency },
        sessionId: session.id, confirmed: result.status ? result.status === 'fulfilled' || result.status === 'paid' : amount === 0,
        createdAt, preflightVerified: verifiedProjects.current.has(project.id),
      });
      setAccepted(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('报名未完成，请重试。', 'Registration did not complete. Try again.'));
      onRefresh();
    } finally {
      pending.current = false;
      setSubmitting(null);
    }
  }

  const loginParams = new URLSearchParams();
  if (project) loginParams.set('project', project.id);
  if (supervised && session) loginParams.set('session', session.id);
  else if (sessionId) loginParams.set('session', sessionId);
  const returnPath = `${lang === 'zh' ? '/zh' : ''}${competitionHref(routeId)}${loginParams.size ? `?${loginParams}` : ''}`;
  const submitLabel = project?.amountMinor === 0 ? t('免费锁定席位', 'Claim free place') : t('确认报名', 'Register');
  const busyLabel = submitting === 'free' ? t('正在锁定席位…', 'Securing your place…') : t('正在创建订单…', 'Creating order…');
  const action = (mobile: boolean) => signedIn
    ? <button className="competition-primary competition-focus-action" type="button" disabled={busy} onClick={() => void confirm()}>
      {busy ? <LoadingIndicator>{busyLabel}</LoadingIndicator> : mobile && step ? mobileLabels[step] : submitLabel}
    </button>
    : <AppLink className="competition-primary competition-focus-action" href={`/account${nextQuery(returnPath)}`}>{t('登录报名', 'Sign in to register')}</AppLink>;
  const eventName = project && eventDisplayName(project.project, lang === 'zh');
  const readySteps: Array<[RegistrationStep, boolean]> = [['project', !!project]];
  if (supervised) readySteps.push(['session', sessionReady]);
  readySteps.push(['consent', accepted]);

  return <div className="competition-registration-panel" data-mobile-registration={!preview && expanded || undefined}>
    <div className="competition-registration-grid" ref={grid}>
      <section className="competition-registration-choices" ref={choices}>
        <h2>{t('选择参赛项目', 'Choose an event')}</h2>
        <div ref={projectChoices} className="competition-projects" tabIndex={-1} aria-describedby={issue === 'project' ? projectHint : undefined}>
          {competition.projects.map(item => {
            const state = entryFor(item);
            const selected = item.id === project?.id;
            const full = item.available === 0;
            const known = item.available !== undefined && item.capacity > 0;
            const low = known && !full && !state && item.available! <= item.capacity * .2;
            const taken = known ? Math.min(100, Math.max(0, 100 - item.available! / item.capacity * 100)) : 0;
            return <button type="button" key={item.id} className="competition-project" aria-pressed={selected}
              aria-describedby={issue === 'project' ? projectHint : undefined} disabled={busy || full || !!state}
              data-project-id={item.id} data-entry-state={state ?? (full ? 'full' : undefined)} data-low={low || undefined} onClick={() => onProject(item.id)}>
              <EventIcon event={item.project} />
              <span className="competition-option-copy">
                <strong>{eventDisplayName(item.project, lang === 'zh')}</strong><small>{competitionDeviceName(item.device, t)}</small>
              </span>
              <span className="competition-option-status">
                <span className="competition-option-price-row">
                  <span className="competition-option-check">{selected && <Check size={16} aria-hidden />}</span>
                  <strong className="competition-option-price">{item.amountMinor === 0 ? t('免费', 'Free') : competitionMoney(item.amountMinor, item.currency)}</strong>
                </span>
                <small>{state === 'registered' ? t('已报名', 'Registered') : state === 'payment' ? t('待付款', 'Awaiting payment')
                  : full ? t('已满', 'Full')
                  : item.available !== undefined ? t(`余 ${item.available} 位`, `${item.available} left`) : null}</small>
              </span>
              {known && <span className="competition-capacity-meter" aria-hidden style={{ '--competition-capacity-used': `${taken}%` } as CSSProperties} />}
            </button>;
          })}
        </div>
        {issue === 'project' && <p id={projectHint} className="competition-guidance" role="status">{guidance.project}</p>}
        {!competition.projects.length && <p className="competition-muted">{t('项目尚未公布。', 'Events have not been announced.')}</p>}
        {supervised ? <>
          <h3>{t('选择监督场次', 'Choose a supervised session')} <small>{t('北京时间', 'UTC+8')}</small></h3>
          <div ref={sessionChoices} className="competition-sessions" tabIndex={-1} aria-describedby={issue === 'session' ? sessionHint : undefined}>
            {competition.sessions.map(item => {
              const state = sessionState(item);
              const selected = session?.id === item.id;
              const schedule = competitionSessionTime(item);
              const availability = {
                started: t('已开始', 'Started'), unstaffed: t('待排班', 'Unassigned'), full: t('已满', 'Full'),
                available: t(`余 ${item.available} 位`, `${item.available} left`),
              };
              return <button key={item.id} className="competition-session" type="button" aria-pressed={selected}
                aria-describedby={issue === 'session' ? sessionHint : undefined} disabled={busy || state !== 'available'}
                onClick={() => onSession(item.id)}>
                <span className="competition-option-copy"><strong>{schedule.time}</strong>
                  <small>{schedule.date} · {t(`${schedule.minutes} 分钟`, `${schedule.minutes} min`)}</small></span>
                <span className="competition-option-status">
                  <span className="competition-option-check">{selected && <Check size={16} aria-hidden />}</span>
                  <small data-low={state === 'available' && item.available <= item.capacity * .2 || undefined}>{availability[state]}</small>
                </span>
              </button>;
            })}
          </div>
          {issue === 'session' && <p id={sessionHint} className="competition-guidance" role="status">{guidance.session}</p>}
          {!competition.sessions.length && <p className="competition-muted">{t('监督场次尚未公布。', 'Sessions have not been announced.')}</p>}
        </> : venue}
        {project && !preview && expanded && mode !== 'offline' && <CompetitionPreflight key={project.id} mode={mode} device={project.device}
          onReady={() => { verifiedProjects.current.add(project.id); }} />}
      </section>
      <ResizeDivider className="competition-registration-divider" label={t('调整报名栏宽度', 'Resize registration columns')}
        aria-controls={entryId} getSize={() => choices.current?.getBoundingClientRect().width ?? 0}
        onResize={(_, width) => {
          grid.current?.style.setProperty('--competition-choice-width', `${Math.round(width)}px`);
          return choices.current?.getBoundingClientRect().width;
        }} />
      <aside id={entryId} className="competition-entry" data-site-surface="panel">
        <h2>{t('报名登记', 'Registration')}</h2>
        <div className="competition-entry-summary" aria-live="polite">
          <div className="competition-entry-selection">
            {project ? <EventIcon event={project.project} /> : <Ticket size={19} aria-hidden />}
            <span><strong>{eventName || t('待选择项目', 'No event selected')}</strong>
              <small>{project ? competitionDeviceName(project.device, t) : '\u00a0'}</small></span>
          </div>
          {(supervised || session) && <div className="competition-entry-selection">
            <CalendarClock size={19} aria-hidden />
            <span><strong>{sessionTime?.time ?? t('待选择场次', 'No session selected')}</strong><small>{sessionTime?.date ?? '\u00a0'}</small></span>
          </div>}
          <p className="competition-entry-fee" data-free={project?.amountMinor === 0 || undefined}>{fee ?? '—'}</p>
        </div>
        {competition.isTest && competition.canManage && <p className="competition-muted">
          {t('报名后，你将以选手身份参赛，本场管理和立即开赛权限将关闭。', 'Once you register, you enter as a competitor and lose management and start-now access for this competition.')}
        </p>}
        {preview ? <p>{t('赛事预览', 'Competition preview')}</p> : <>
          {signedIn && <>
            <div className="competition-entry-consent" ref={consent} tabIndex={-1} aria-describedby={issue === 'consent' || (issue === 'session' && !supervised) ? consentHint : undefined}>
              <BoolToggle value={accepted} onChange={value => { setAccepted(value); setIssue(undefined); setError(''); }}
                label={t('同意参赛与退款规则', 'I agree to the participation and refund policies')} />
              <button type="button" className="competition-rules-link" aria-controls="competition-rules" onClick={() => {
                const details = document.querySelector<HTMLDetailsElement>('#competition-rules');
                if (!details) return;
                details.open = true;
                focusCompetitionElement(details.querySelector('summary'));
              }}>{t('查看规则', 'View rules')}</button>
            </div>
            {issue && (issue === 'consent' || (issue === 'session' && !supervised)) &&
              <p id={consentHint} className="competition-guidance" role="status">{guidance[issue]}</p>}
            <ul className="competition-ready-list" aria-label={t('报名进度', 'Registration progress')}>
              {readySteps.map(([name, ready]) => <li key={name} data-ready={ready || undefined}>
                {ready ? <Check size={14} aria-hidden /> : <Circle size={12} aria-hidden />}
                <span className="sr-only">{ready ? t('已完成 ', 'Complete: ') : t('待完成 ', 'Incomplete: ')}</span>
                {stepLabels[name]}
              </li>)}
            </ul>
          </>}
          {error && <p className="competition-error" role="alert">{error}</p>}
          <div className="competition-desktop-registration">{action(false)}</div>
        </>}
      </aside>
    </div>
    {!preview && expanded && <div ref={mobileBar} className="competition-mobile-registration" data-site-surface="heading">
      <span>
        <span>{eventName || t('待选择项目', 'No event selected')}{sessionTime && <> · {sessionTime.time}</>}</span>
        <strong>{fee ?? '—'}</strong>
      </span>
      {action(true)}
    </div>}
  </div>;
}
