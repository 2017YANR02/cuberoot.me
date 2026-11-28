'use client';

import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { useCallback, useContext, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Plus, RefreshCw } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { COMPETITIONS_PATH as ROOT, COMPETITION_WORKSPACES, competitionHref as href, competitionWorkspaceHref as workspaceHref, isCompetitionTestSlug, type CompetitionWorkspaceMode } from '@/lib/competition-links';
import { competitionDateTime as dateText, competitionDateIso as isoDate } from '@/lib/competition-date';
import { CompetitionDraftForm, competitionDeviceName, competitionFormatName, competitionModeName, parseCompetitionSettlementTerms } from './CompetitionDraftForm';
import { createCompetitionSlug } from './competition-slug';
import { CompetitionReviewQueue } from './CompetitionReviewQueue';
import { CompetitionBracket, competitionMatchPlayable, useCompetitionBrackets } from './CompetitionBracket';
import { CompetitionMatchEnter, CompetitionMatchFeeder, CompetitionMatchPassport } from './CompetitionMatchPassport';
import { CompetitionReplayButton } from './CompetitionReconstruction';
import { CompetitionEntryPass } from './CompetitionEntryPass';
import { CompetitionRegistrationFacts, CompetitionRegistrationPanel, type CompetitionOrderReceipt } from './CompetitionRegistrationPanel';
import { competitionMoney as money, competitionReservationDeadline, competitionReservationExpired, focusCompetitionElement, isCompetitionPaymentPending } from './competition-registration';
import { downloadBlob } from '@/lib/scramble-dist/download';
import { formatDateRangeIso } from '@cuberoot/shared/iso-date';
import { COMPETITION_CHECK_IN_LEAD_MS } from '@cuberoot/shared/timer';
import { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import PersonLink from '@/components/PersonLink';
import { Flag } from '@/components/Flag';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { persistItem } from '@/lib/safe-storage';
import { CompetitionHostAccessContext, useCompetitionRole } from '@/hooks/useCompetitionRole';
import { hasAdminAccess, nextQuery, useAuthUser } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { CompetitionScramble } from './CompetitionScramble';
import { CompetitionSelfTimer } from './CompetitionSelfTimer';
import { CompetitionTestBadge, CompetitionTestControls, CompetitionTestCreateButton } from './CompetitionTestActions';
import { CompetitionDuelSupervisionDesk, CompetitionSupervisionDesk } from './CompetitionSupervisionDesk';
import { ao5ReportData, CompetitionRank, CompetitionReport, CompetitionReportShare, useCompetitionResults } from './CompetitionReport';
import { attemptValue, competitionAo5, competitionBracketSeeds, competitionMatchCode, competitionMatchFeeder } from './competition-results';
import { listTeachingOrganizations, type TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import {
  checkInCompetition, completeCompetitionSelfAttempt, reviewCompetitionSelfAttempt, nextCompetitionSelfAttempt, nextCompetitionAttempt, recordOfflineCompetitionResults,
  getOnlineCompetition, listCompetitionRegistrations, listOnlineCompetitions, listSupervisedCompetitions,
  getCompetitionAttempts, recordCompetitionAttempt, finalizeCompetitionRegistration, raiseCompetitionDispute, type CompetitionAttempt, type CompetitionSelfResult, type CompetitionResult, type CompetitionProject, type CompetitionRegistration, type OnlineCompetition,
  listCompetitionDisputes, resolveCompetitionDispute, finalizeCompetition, closeCompetitionSessions, getCompetitionSettlement, configureCompetitionSettlement, recordCompetitionSettlement, type CompetitionDispute, type CompetitionSettlement,
  listCompetitionEvidence, uploadCompetitionEvidence, downloadCompetitionEvidence, competitionEvidencePlayback, type CompetitionEvidence,
  listOrganizerApplications, listOrganizerReviewQueue, submitOrganizerApplication, reviewOrganizerApplication, type OrganizerAccess, type OrganizerApplication,
  type CompetitionDuelStatus, type CompetitionBracketMatch, type OnlineCompetitionSummary,
} from '@/lib/online-competition-api';
import dynamic from 'next/dynamic';
import { PlatformState } from '@/components/platform/PlatformState';
import { ClientLoadStatus } from '@/components/StartupStatus';

const CompetitionAo5Arena = dynamic(() => import('./CompetitionArena').then(module => module.CompetitionAo5Arena),
  { ssr: false, loading: () => <ClientLoadStatus label={{ zh: '正在打开赛场…', en: 'Opening arena…' }} /> });
const CompetitionDuelArena = dynamic(() => import('./CompetitionArena').then(module => module.CompetitionDuelArena),
  { ssr: false, loading: () => <ClientLoadStatus label={{ zh: '正在打开对战席…', en: 'Opening match…' }} /> });
const CompetitionVideoRoom = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionVideoRoom),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const CompetitionSelfRecording = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionSelfRecording),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
import './online-competitions.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function statusLabel(status: string, t: ReturnType<typeof useT>) {
  const labels: Record<string, string> = {
    draft: t('草稿', 'Draft'), pending_approval: t('待平台审核', 'Pending review'), rejected: t('已退回修改', 'Changes requested'), reserved: t('待付款', 'Awaiting payment'), attended: t('已完赛', 'Finished'), published: t('已发布', 'Published'), completed: t('已结束', 'Completed'),
    cancelled: t('已取消', 'Cancelled'), confirmed: t('报名成功', 'Registered'), pending_payment: t('待付款', 'Awaiting payment'),
    checked_in: t('已检录', 'Checked in'), ready: t('待参赛', 'Ready'), competing: t('参赛中', 'Competing'),
    finished: t('已完成', 'Finished'), refunded: t('已退款', 'Refunded'), expired: t('已过期', 'Expired'),
    registration_open: t('报名中', 'Registration open'), registration_upcoming: t('即将报名', 'Registration opens soon'),
    registration_closed: t('报名已截止', 'Registration closed'), in_progress: t('比赛进行中', 'In progress'), provisional_results: t('成绩公示', 'Provisional results'),
  };
  return labels[status] ?? status;
}

function publicCompetitionStatus(competition: OnlineCompetitionSummary, now: number) {
  if (!now || competition.status !== 'published') return competition.status;
  if (now >= Date.parse(competition.endsAt)) return competition.finalizedAt ? 'completed' : 'provisional_results';
  if (now >= Date.parse(competition.startsAt)) return 'in_progress';
  if (now >= Date.parse(competition.registrationOpensAt) && now < Date.parse(competition.registrationClosesAt)) return 'registration_open';
  return now < Date.parse(competition.registrationOpensAt) ? 'registration_upcoming' : 'registration_closed';
}

const publicStatusOrder: Record<string, number> = {
  in_progress: 0, registration_open: 1, registration_upcoming: 2, registration_closed: 3, provisional_results: 4, completed: 5,
};

function competitionProjectSummary(projects: CompetitionProject[], lang: 'zh' | 'en', t: ReturnType<typeof useT>) {
  const labels = new Set<string>();
  for (const { project, device } of projects) {
    const equipment = device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube');
    labels.add(`${eventDisplayName(project, lang === 'zh')} · ${equipment}`);
  }
  return [...labels].join(' / ');
}

type CompetitionMode = 'browse' | CompetitionWorkspaceMode;
type CompetitionNavigate = (mode: CompetitionWorkspaceMode, id?: string) => void;

export function OnlineCompetitions({ id, mode = 'browse', initialReview = 'events', onNavigate }: {
  id?: string; mode?: CompetitionMode; initialReview?: 'events' | 'organizers'; onNavigate?: CompetitionNavigate;
}) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const admin = hasAdminAccess(user);
  const insideHost = useContext(CompetitionHostAccessContext);
  const requiredRole = mode === 'supervise' && !id && !admin ? 'supervisor' : mode === 'manage' && !admin && !insideHost ? 'organizer' : null;
  const access = useCompetitionRole(requiredRole);
  if (mode !== 'browse' && !user) {
    return <PlatformState kind="permission" permissionHref={`/account${nextQuery((lang === 'zh' ? '/zh' : '') + workspaceHref(mode, id))}`} />;
  }
  if (mode === 'browse' && id && isCompetitionTestSlug(id) && !user) {
    return <PlatformState kind="permission" message={t('登录后可参加这场测试赛。', 'Sign in to join this test competition.')}
      permissionHref={'/account' + nextQuery((lang === 'zh' ? '/zh' : '') + href(id))} />;
  }
  if (!access.ready) return <PlatformState kind="loading" />;
  if (mode === 'review' && !admin) return <PlatformState kind="permission"
    message={t('只有网站管理员可以审核主办方申请。', 'Organizer applications can only be reviewed by site administrators.')}
    permissionHref={ROOT} permissionLabel={t('返回线上比赛', 'Back to online competitions')} />;
  if (requiredRole && !access.allowed) {
    const application = requiredRole === 'organizer';
    return <PlatformState kind="permission" message={t('当前账号没有此赛事工作台的权限。', 'This account does not have access to this competition workspace.')}
      permissionHref={application ? workspaceHref('apply') : ROOT}
      permissionLabel={application ? t('查看主办资格申请', 'View organizer application') : t('查看公开比赛', 'View public competitions')} />;
  }
  if (mode === 'create') return <div className="competitions"><CompetitionOrganizerEditor key={user?.uid ?? user?.wcaId} mode={mode}
    onCreated={onNavigate && (createdId => onNavigate('manage', createdId))} /></div>;
  if (!id) return <CompetitionList mode={mode} initialReview={initialReview} onNavigate={onNavigate} />;
  const view = mode === 'manage' || mode === 'supervise' ? mode : 'entry';
  return <>
    {onNavigate && view !== 'entry' && <button className="competition-secondary competition-inline-back" type="button"
      onClick={() => onNavigate(view)}>
      <ArrowLeft size={16} aria-hidden />
      {view === 'manage' ? t('返回赛事管理列表', 'Back to competition management') : t('返回执场列表', 'Back to judging assignments')}
    </button>}
    <CompetitionDetail key={`${mode}:${id}:${user?.uid ?? user?.wcaId ?? 'guest'}`} id={id} view={view} onNavigate={onNavigate} />
  </>;
}

function CompetitionList({ mode: view, initialReview, onNavigate }: {
  mode: Exclude<CompetitionMode, 'create'>; initialReview: 'events' | 'organizers'; onNavigate?: CompetitionNavigate;
}) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const application = view === 'apply' || view === 'review';
  const [reviewTab, setReviewTab] = useState(initialReview);
  const [modeFilter, setModeFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [items, setItems] = useState<OnlineCompetitionSummary[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setItems([]);
    if (application) { setLoading(false); return; }
    void (view === 'supervise' ? listSupervisedCompetitions() : listOnlineCompetitions(view === 'manage')).then(result => { if (active) setItems(result.competitions); })
      .catch(error => { if (active) setError(message(error, t('赛事加载失败，请重试。', 'Could not load competitions. Try again.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, application, user, revision, t]);
  const rows = items.filter(item => view !== 'browse' ||
    ((!modeFilter || (item.supervisionMode ?? 'supervised') === modeFilter) &&
      ((!eventFilter && !deviceFilter) || item.projects.some(p => (!eventFilter || p.project === eventFilter) && (!deviceFilter || p.device === deviceFilter)))))
    .map(item => ({ item, status: view === 'manage' && item.status === 'draft' ? item.reviewStatus ?? 'draft' : publicCompetitionStatus(item, now) }));
  const empty = view === 'manage' ? t('暂无可管理的比赛。', 'No competitions to manage yet.')
      : view === 'supervise' ? t('当前没有分配给你的执场赛事。', 'You have no assigned competitions.')
        : t('暂时没有已发布的线上比赛。', 'No online competitions have been published yet.');
  const browsing = view === 'browse';
  if (browsing) rows.sort((a, b) => {
    const byStatus = (publicStatusOrder[a.status] ?? 0) - (publicStatusOrder[b.status] ?? 0);
    if (byStatus) return byStatus;
    const byStart = Date.parse(a.item.startsAt) - Date.parse(b.item.startsAt);
    return a.status === 'completed' ? -byStart : byStart;
  });
  const finished = browsing ? rows.filter(({ status }) => ['completed', 'provisional_results'].includes(status)) : [];
  const activeRows = browsing ? rows.filter(({ status }) => !['completed', 'provisional_results'].includes(status)) : rows;
  function renderRow({ item, status }: (typeof rows)[number]) {
    const target = view === 'manage' || view === 'supervise'
      ? workspaceHref(view, item.id) : href(item.id);
    const action = status === 'registration_open' ? t('报名', 'Register')
      : ['completed', 'provisional_results'].includes(status) ? t('查看成绩', 'View results') : t('查看比赛', 'View competition');
    const inline = Boolean(onNavigate && !browsing);
    const Details = inline ? 'span' : 'div';
    const Title = inline ? 'strong' : 'h2';
    const content = <>
        <Details className="competition-list-info">
          <span className="competition-labels">
            <span className="competition-state" data-status={status}>{statusLabel(status, t)}</span>
            {item.isTest && <CompetitionTestBadge />}
            <span className="competition-meta">{competitionModeName(item.supervisionMode ?? 'supervised', t)} · {competitionFormatName(item.format ?? item.setup?.format ?? 'average', t)}</span>
          </span>
          <Title className="competition-list-title">{t(item.titleZh || item.titleEn, item.titleEn || item.titleZh)}</Title>
          <Details className="competition-list-description">{formatDateRangeIso(dateText(item.startsAt).slice(0, 10), dateText(item.endsAt).slice(0, 10))} · {item.organizationName}</Details>
          {item.projects.length > 0 && <span className="competition-list-events">
            {item.projects.map(project => <span key={project.id}><EventIcon event={project.project} />
              {eventDisplayName(project.project, lang === 'zh')} · {competitionDeviceName(project.device, t)}
            </span>)}
            <span className="competition-list-fee">{item.projects.every(project => project.amountMinor === 0) ? t('免费参赛', 'Free entry') : <>{money(Math.min(...item.projects.map(project => project.amountMinor)), item.projects[0].currency)} {t('起', 'and up')}</>}</span>
          </span>}
        </Details>
        {browsing ? <span className="competition-list-action">{action} <ChevronRight size={16} aria-hidden /></span> : <ChevronRight size={20} aria-hidden />}
    </>;
    return onNavigate && (view === 'manage' || view === 'supervise')
      ? <button type="button" className="competition-list-row" key={item.id} onClick={() => onNavigate(view, item.id)}>{content}</button>
      : <AppLink prefetch={false} className="competition-list-row" data-public={browsing || undefined} key={item.id} href={target}>{content}</AppLink>;
  }
  return <div className="competitions">
    {browsing && <div className="competition-filters">
      {[
        { name: t('全部形态', 'All modes'), value: modeFilter, set: setModeFilter,
          items: (['self_service', 'supervised', 'offline'] as const).map(value => ({ value, label: competitionModeName(value, t) })) },
        { name: t('全部项目', 'All events'), value: eventFilter, set: setEventFilter,
          items: WCA_TIMED_EVENT_ORDER.map(value => ({ value, label: eventDisplayName(value, lang === 'zh') })) },
        { name: t('全部设备', 'All equipment'), value: deviceFilter, set: setDeviceFilter,
          items: (['ordinary', 'smart'] as const).map(value => ({ value, label: competitionDeviceName(value, t) })) },
      ].map(filter => <CompactSelect key={filter.name} ariaLabel={filter.name} value={filter.value}
        label={filter.items.find(item => item.value === filter.value)?.label ?? filter.name}
        items={[{ value: '', label: filter.name }, ...filter.items]} onChange={filter.set} showArrow />)}
    </div>}
    {browsing && !loading && items.length > 0 && !rows.length && <p className="competition-muted">{t('没有符合筛选条件的比赛。', 'No competitions match these filters.')}</p>}
    {view === 'manage' && <div className="competition-toolbar">
      {onNavigate
        ? <button type="button" className="competition-primary" onClick={() => onNavigate('create')}><Plus size={16} aria-hidden />{t('创建比赛', 'Create a competition')}</button>
        : <AppLink href={workspaceHref('create')} className="competition-primary" prefetch={false}><Plus size={16} aria-hidden />{t('创建比赛', 'Create a competition')}</AppLink>}
      <CompetitionTestCreateButton onCreated={onNavigate && (id => onNavigate('manage', id))} />
    </div>}
    {error ? <div role="alert" className="competition-error"><p>{error}</p><button className="competition-secondary" type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />{t('重试', 'Retry')}</button></div> : null}
    {loading ? <p role="status" className="competition-muted"><LoadingIndicator>{t('正在加载比赛…', 'Loading competitions…')}</LoadingIndicator></p>
      : !application && !error && !items.length ? <p className="competition-empty">{empty}</p> : null}
    {activeRows.length > 0 && <div className="competition-list">{activeRows.map(renderRow)}</div>}
    {finished.length > 0 && <details className="competition-archive">
      <MoreToggle as="summary">{t('已结束的比赛', 'Past competitions')}</MoreToggle>
      <div className="competition-list">{finished.map(renderRow)}</div>
    </details>}
    {view === 'review' && <div className="competition-review-tabs" role="group" aria-label={t('审核分类', 'Review category')}>
      <button type="button" className={reviewTab === 'events' ? 'competition-primary' : 'competition-secondary'} aria-pressed={reviewTab === 'events'} onClick={() => setReviewTab('events')}>{t('待审赛事', 'Pending competitions')}</button>
      <button type="button" className={reviewTab === 'organizers' ? 'competition-primary' : 'competition-secondary'} aria-pressed={reviewTab === 'organizers'} onClick={() => setReviewTab('organizers')}>{t('主办方资质申请', 'Organizer applications')}</button>
    </div>}
    {view === 'review' && reviewTab === 'events' ? <CompetitionReviewQueue />
      : application && user ? <CompetitionOrganizerEditor key={user.uid} mode={view} /> : null}
  </div>;
}

function CompetitionDetail({ id, view, onNavigate }: {
  id: string; view: 'entry' | 'manage' | 'supervise'; onNavigate?: CompetitionNavigate;
}) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const [ticketId, setTicketId] = useQueryState('project', parseAsString.withDefault(''));
  const [sessionId, setSessionId] = useQueryState('session', parseAsString.withDefault(''));
  const [competition, setCompetition] = useState<OnlineCompetition | null>(null);
  const [loadedRegistrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [registrationsLoaded, setRegistrationsLoaded] = useState(false);
  const registrations = view === 'entry' ? loadedRegistrations.filter(item => item.userId === user?.uid).map(item => ({ ...item, canRecordResult: false })) : loadedRegistrations;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registrationLoadError, setRegistrationLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkInError, setCheckInError] = useState('');
  const [receipts, setReceipts] = useState<CompetitionOrderReceipt[]>([]);
  const recentOrderId = receipts.at(-1)?.orderId;
  const [addMore, setAddMore] = useState(false);
  const registrationRegion = useRef<HTMLDivElement>(null);
  const focusProject = useCallback((projectId: string) => {
    const options = registrationRegion.current?.querySelectorAll<HTMLButtonElement>('.competition-project:not(:disabled)');
    const target = options && [...options].find(option => option.dataset.projectId === projectId);
    focusCompetitionElement(target ?? options?.[0] ?? registrationRegion.current);
  }, []);
  const retryFocus = useRef('');
  useEffect(() => {
    if (!addMore || !retryFocus.current) return;
    focusProject(retryFocus.current);
    retryFocus.current = '';
  }, [addMore, focusProject]);

  const [autoJoinVideo, setAutoJoinVideo] = useState(false);
  const bracket = useCompetitionBrackets(competition?.format === 'advancement'
    && ['published', 'completed'].includes(competition.status) ? competition.id : null, !!competition?.finalizedAt);
  const [activeMatch, setActiveMatch] = useQueryState('match', parseAsString.withDefault('').withOptions({ history: 'push' }));
  const [hostTab, setHostTab] = useQueryState('hostTab', parseAsStringEnum(['roster', 'tables', 'results']).withDefault('roster'));
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<CompetitionDuelStatus | ''>('');
  const [activeRegistration, setActiveRegistration] = useQueryState('entry', parseAsString.withDefault('').withOptions({ history: 'push' }));
  const matchForRegistration = (registrationId: string) => bracket.brackets?.matches.find(match =>
    competitionMatchPlayable(match) && (match.playerA === registrationId || match.playerB === registrationId));
  const selectedMatchId = view === 'entry' && competition?.format === 'advancement' && activeRegistration
    && registrations.some(item => item.id === activeRegistration && item.status === 'confirmed' && (item.checkedInAt || item.canCheckIn))
    ? matchForRegistration(activeRegistration)?.id : undefined;
  useEffect(() => {
    if (!activeMatch && selectedMatchId) void setActiveMatch(selectedMatchId);
  }, [activeMatch, selectedMatchId, setActiveMatch]);
  const [now, setNow] = useState(0);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const refreshBracket = bracket.refresh;
  const refreshSeatProgress = useCallback(() => {
    refresh();
    refreshBracket();
  }, [refresh, refreshBracket]);

  useEffect(() => { setCompetition(null); }, [id]);
  const nextStatusChange = competition ? [
    Date.parse(competition.registrationOpensAt),
    Date.parse(competition.registrationClosesAt),
    Date.parse(competition.startsAt) - COMPETITION_CHECK_IN_LEAD_MS,
    Date.parse(competition.startsAt), Date.parse(competition.endsAt),
    ...competition.sessions.flatMap(session => {
      const startsAt = Date.parse(session.startsAt);
      return [startsAt - COMPETITION_CHECK_IN_LEAD_MS, startsAt, Date.parse(session.endsAt)];
    }),
    ...registrations.filter(item => isCompetitionPaymentPending(item.status)).map(competitionReservationDeadline),
    ...receipts.filter(item => !item.confirmed).map(competitionReservationDeadline),
  ].reduce((next, at) => at > now ? Math.min(next, at) : next, Infinity) : Infinity;
  const clockReady = now !== 0;
  useEffect(() => {
    if (!clockReady || !Number.isFinite(nextStatusChange)) return;
    const timer = setTimeout(() => { setNow(Date.now()); refresh(); },
      Math.min(2_147_483_647, Math.max(0, nextStatusChange - Date.now()) + 20));
    return () => clearTimeout(timer);
  }, [nextStatusChange, clockReady, refresh]);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!user) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000); return () => clearInterval(timer); }, [refresh, user]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getOnlineCompetition(id).then(async result => {
      if (active) setCompetition(result.competition);
      if (user) {
        try { const entries = await listCompetitionRegistrations(result.competition.id); if (active) { setRegistrations(entries.registrations); setRegistrationsLoaded(true); setRegistrationLoadError(''); } }
        catch (error) { if (active) setRegistrationLoadError(message(error, t('报名记录加载失败，请刷新后重试。', 'Could not load your registrations. Refresh to retry.'))); }
      }
    })
      .catch(error => { if (active) setError(message(error, t('赛事加载失败。', 'Could not load competition.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user, revision, t, view]);
  const liveRosterId = view !== 'entry' && competition?.format === 'advancement' && competition.status === 'published' && user
    ? competition.id : null;
  useEffect(() => {
    if (!liveRosterId) return;
    let active = true;
    let pending = false;
    const timer = setInterval(async () => {
      if (pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const result = await listCompetitionRegistrations(liveRosterId);
        if (active) setRegistrations(result.registrations);
      } catch { /* Keep the last roster and retry on the next refresh. */ }
      finally { pending = false; }
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [liveRosterId, id, user?.uid, revision]);

  function onOrdered(receipt: CompetitionOrderReceipt) {
    setReceipts(items => [...items, receipt]);
    setAddMore(false);
    refresh();
  }

  async function checkIn(registrationId: string) {
    setBusy(true);
    setCheckInError('');
    try {
      await checkInCompetition(registrationId);
      if (competition?.format !== 'advancement') void setActiveRegistration(registrationId);
      setRegistrations(rows => rows.map(row => row.id === registrationId ? { ...row, checkedInAt: new Date().toISOString() } : row));
      refresh();
    } catch (error) {
      setCheckInError(message(error, t('检录未完成，请重试。', 'Check-in did not complete. Try again.')));
    } finally { setBusy(false); }
  }
  if (loading && !competition) return <div className="competitions"><p role="status"><LoadingIndicator>{t('正在加载比赛…', 'Loading competition…')}</LoadingIndicator></p></div>;
  if (!competition) return <div className="competitions"><p role="alert">{error || t('没有找到这场比赛。', 'Competition not found.')}</p><button className="competition-secondary" type="button" onClick={refresh}>{t('重试', 'Retry')}</button></div>;
  const ownActiveEntry = loadedRegistrations.some(item => item.userId === user?.uid
    && (item.status === 'confirmed' || item.status === 'attended'
      || (item.status === 'reserved' && Date.parse(item.reservationExpiresAt ?? '') > now)));
  if (view !== 'entry') {
    const allowed = view === 'manage' ? competition.canManage : competition.canSupervise;
    if (!allowed || competition.isEntrant || ownActiveEntry || (competition.isEntrant === undefined && registrationLoadError)) {
      return <PlatformState kind="permission" message={t('当前账号没有此赛事的管理权限。', 'This account does not have access to manage this competition.')}
        permissionHref={onNavigate ? undefined : ROOT} permissionLabel={t('查看公开比赛', 'View public competitions')} />;
    }
    if (competition.isEntrant === undefined && !registrationsLoaded) return <PlatformState kind="loading" />;
  }
  const participant = view === 'entry';
  const supervision = competition.supervisionMode ?? 'supervised';
  const participantRegistrations = [...registrations];
  const receiptByOrder = new Map(receipts.map(receipt => [receipt.orderId, receipt]));
  for (const receipt of receipts) {
    if (user?.uid === undefined || registrations.some(item => item.orderId === receipt.orderId)) continue;
    participantRegistrations.push({
      id: '', userId: user.uid, displayName: '', project: receipt.project.project, device: receipt.project.device,
      sessionId: receipt.sessionId, orderId: receipt.orderId, status: receipt.confirmed ? 'confirmed' : 'reserved',
      createdAt: receipt.createdAt, canCheckIn: false, canRecordResult: false, resultRecordedAt: null,
    });
  }
  const registrationFor = (ticket: CompetitionProject) => participantRegistrations.find(item =>
    item.project === ticket.project && item.device === ticket.device && !competitionReservationExpired(item, now)
    && (item.status === 'confirmed' || item.status === 'attended' || isCompetitionPaymentPending(item.status)));
  const entryFor = (ticket: CompetitionProject) => {
    const entry = registrationFor(ticket);
    return entry ? isCompetitionPaymentPending(entry.status) ? 'payment' as const : 'registered' as const : undefined;
  };
  const status = publicCompetitionStatus(competition, now);
  const registrationOpen = status === 'registration_open';
  const draftPreview = participant && competition.status === 'draft' && competition.canManage;
  const reviewState = view === 'manage' && status === 'draft' ? competition.reviewStatus ?? status : status;
  const duelRoster = view === 'manage' && competition.format === 'advancement';
  if (participant && user && activeRegistration && !registrationsLoaded && !registrationLoadError) {
    return <PlatformState kind="loading" />;
  }
  const checkInEntry = competition.format === 'advancement' && participant ? registrations.find(item =>
    item.id === activeRegistration && item.userId === user?.uid && item.status === 'confirmed'
    && (item.canCheckIn || item.checkedInAt)) : undefined;
  const selectedRegistration = competition.format === 'advancement' && participant ? undefined : registrations.find(item =>
    (duelRoster && activeMatch ? item.matchId === activeMatch : item.id === activeRegistration)
    && (item.checkedInAt || item.resultRecordedAt || (participant && item.device === 'smart' && item.canCheckIn)) &&
    (item.userId === user?.uid || item.canRecordResult || (!participant && item.canJoinVideo)));
  if (participant && competition.format === 'advancement' && (activeMatch || checkInEntry)) {
    return <CompetitionDuelArena key={competition.id} id={activeMatch || selectedMatchId} checkInEntry={checkInEntry}
      competition={competition} matches={bracket.brackets?.matches} standings={bracket.brackets?.standings}
      reviewActions={registrationId => <details className="competition-rules">
        <MoreToggle as="summary">{t('成绩异议申诉', 'Dispute a result')}</MoreToggle>
        <CompetitionDisputeForm registrationId={registrationId} onSaved={refresh} />
        <CompetitionEvidenceFiles registrationId={registrationId} canUpload />
      </details>} onNextMatch={matchId => { void setActiveMatch(matchId); }} onCheckedIn={refreshSeatProgress} onMatchSettled={refreshSeatProgress} />;
  }
  if (participant && selectedRegistration && selectedRegistration.sessionKind !== 'offline') {
    return <CompetitionAo5Arena key={selectedRegistration.id} competition={competition} registration={selectedRegistration}
      onCheckedIn={refresh} onFinished={refresh} resultRevision={revision}
      legacySeat={<CompetitionParticipation competition={competition} registration={selectedRegistration}
        endsAt={competition.sessions.find(item => item.id === selectedRegistration.sessionId)?.endsAt}
        onSaved={refresh} resultRevision={revision} supervising={false} />}
      reviewActions={<>
        {selectedRegistration.resultRecordedAt && !competition.finalizedAt && <CompetitionDisputeForm registrationId={selectedRegistration.id} onSaved={refresh} />}
        <CompetitionEvidenceFiles registrationId={selectedRegistration.id} canUpload={!competition.finalizedAt} />
      </>}
      evidence={(attemptNumber, onFilesChange) => <CompetitionEvidenceFiles registrationId={selectedRegistration.id}
        canUpload attemptNumber={attemptNumber} onFilesChange={onFilesChange} />} />;
  }
  const settingUp = view === 'manage' && ['draft', 'pending_approval'].includes(competition.status);
  const showRegistration = participant && (registrationOpen || draftPreview) && !selectedRegistration && (!user || registrationsLoaded)
    && competition.projects.some(ticket => !registrationFor(ticket));
  const hasLivePass = competition.projects.some(ticket => !!entryFor(ticket));
  function retryRegistration(projectId: string) {
    void setTicketId(projectId);
    if (hasLivePass && !addMore) {
      retryFocus.current = projectId;
      setAddMore(true);
    } else focusProject(projectId);
  }
  const assignedSessions = new Set(competition.sessions.filter(item => item.supervisorUserId === user?.uid).map(item => item.id));
  const rosterLabels: Record<CompetitionDuelStatus, string> = {
    not_checked_in: t('未检录', 'Awaiting check-in'),
    checked_in: t('已检录', 'Checked in'),
    waiting_opponent: t('等待对手', 'Waiting for opponent'),
    match_ready: t('待就绪', 'Awaiting readiness'),
    in_progress: t('进行中', 'In progress'),
    eliminated: t('已淘汰', 'Eliminated'),
    champion: t('冠军', 'Champion'),
    runner_up: t('亚军', 'Runner-up'),
  };
  const ownDuelEntries = participant && competition.format === 'advancement'
    ? registrations.filter(item => ['confirmed', 'attended'].includes(item.status)) : [];
  const duelSelection = competition.projects.find(ticket => ticket.id === ticketId);
  const ownDuelEntry = ownDuelEntries.find(item => item.project === duelSelection?.project && item.device === duelSelection.device) ?? ownDuelEntries[0];
  const matches = bracket.brackets?.matches ?? [];
  const passportMatch = ownDuelEntry ? matches.find(match => (match.playerA === ownDuelEntry.id || match.playerB === ownDuelEntry.id)
    && (match.status === 'pending' || competitionMatchPlayable(match)))
    ?? matches.find(match => match.id === ownDuelEntry.matchId && match.status === 'completed') : undefined;
  const feeder = passportMatch?.status === 'pending' && ownDuelEntry
    ? competitionMatchFeeder(matches, passportMatch.id, ownDuelEntry.id) : null;
  const rival = passportMatch ? (passportMatch.playerA === ownDuelEntry?.id ? passportMatch.nameB : passportMatch.nameA) : null;
  const myDuelDone = !!ownDuelEntry && (ownDuelEntry.status === 'attended' ||
    ['champion', 'runner_up', 'eliminated'].includes(ownDuelEntry.duelStatus ?? ''));
  const passportEnter = !!ownDuelEntry?.checkedInAt && !!passportMatch && competitionMatchPlayable(passportMatch)
    && !!passportMatch.playerA && !!passportMatch.playerB && now < Date.parse(competition.endsAt);
  const ownDuelTicket = competition.projects.find(ticket => ticket.project === ownDuelEntry?.project && ticket.device === ownDuelEntry.device);
  const rosterSeeds = competitionBracketSeeds(matches);
  const rosterQuery = rosterSearch.trim().toLowerCase();
  const roster = duelRoster ? registrations.filter(item =>
    (!rosterFilter || item.duelStatus === rosterFilter) && (!rosterQuery ||
      item.displayName.toLowerCase().includes(rosterQuery) || String(rosterSeeds.get(item.id) ?? '') === rosterQuery))
    .sort((a, b) => (rosterSeeds.get(a.id) ?? Infinity) - (rosterSeeds.get(b.id) ?? Infinity)
      || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id)) : registrations;
  const tableCount = (status: CompetitionBracketMatch['status']) => bracket.brackets?.matches.filter(match => match.status === status).length ?? 0;
  const supervisorsEntries = registrations.filter(item => assignedSessions.has(item.sessionId) && ['confirmed', 'attended'].includes(item.status));
  const duelPassport = ownDuelEntry && <>
    <div className="competition-registration-status">
      {ownDuelEntries.length > 1 && <select className="platform-field-control" aria-label={t('我的参赛组别', 'My division')}
        value={ownDuelTicket?.id ?? ''} onChange={event => { void setTicketId(event.target.value); }}>
        {competition.projects.filter(ticket => ownDuelEntries.some(entry => entry.project === ticket.project && entry.device === ticket.device))
          .map(ticket => <option key={ticket.id} value={ticket.id}>{eventDisplayName(ticket.project, lang === 'zh')} · {competitionDeviceName(ticket.device, t)}</option>)}
      </select>}
      <a href="#competition-rules" onClick={() => {
        const details = document.getElementById('competition-rules');
        if (details instanceof HTMLDetailsElement) details.open = true;
      }}>{t('规则', 'Rules')}</a>
    </div>
    <CompetitionMatchPassport title={t('我的赛程', 'My match passport')} tone={myDuelDone ? 'done' : passportEnter ? 'ready' : 'waiting'}
      code={passportMatch ? `${competitionMatchCode(passportMatch)} · BO${passportMatch.bestOf}` : undefined}
      status={myDuelDone ? rosterLabels[ownDuelEntry.duelStatus ?? 'eliminated']
        : !ownDuelEntry.checkedInAt ? (rival ? t('对阵已排定', 'Match scheduled') : t('等待对阵', 'Awaiting matchup'))
          : passportEnter ? t('对手已就位', 'Opponent seated') : t('等待对手产生', 'Waiting for an opponent')}
      action={passportEnter && passportMatch ? <CompetitionMatchEnter onEnter={() => { void setActiveMatch(passportMatch.id); }} /> : undefined}>
      {rival && !myDuelDone && <p>{displayCuberName(ownDuelEntry.displayName, lang === 'zh')} · {displayCuberName(rival, lang === 'zh')}</p>}
      {feeder && <CompetitionMatchFeeder feeder={feeder} />}
    </CompetitionMatchPassport>
  </>;
  const isEntryPass = (item: CompetitionRegistration) => item.status === 'confirmed' || item.status === 'attended'
    || isCompetitionPaymentPending(item.status) || competitionReservationExpired(item, now);
  const passes = participantRegistrations.filter(isEntryPass);
  const otherEntries = participant ? registrations.filter(item => !isEntryPass(item)) : roster;
  const entries = user && (!participant || otherEntries.length > 0) ? <section className="competition-registrations">
    <h2>{participant ? t('历史报名', 'Past entries') : t('参赛名单', 'Competitors')}</h2>
    {duelRoster && <div className="competition-duel-roster-summary competition-toolbar">
      <input type="search" className="platform-field-control" placeholder={t('搜索选手或种子号', 'Search name or seed')}
        aria-label={t('搜索参赛名单', 'Search competitors')} value={rosterSearch} onChange={event => setRosterSearch(event.target.value)} />
      <span className="competition-field-select">
        <select className="platform-field-control" aria-label={t('筛选参赛状态', 'Filter competitor status')}
          value={rosterFilter} onChange={event => setRosterFilter(event.target.value as typeof rosterFilter)}>
          <option value="">{t('全部状态', 'All statuses')}</option>
          {Object.entries(rosterLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden />
      </span>
    </div>}
    {duelRoster ? <div className="competition-roster-scroll"><table className="competition-roster-table sticky-thead">
      <thead><tr>{[t('种子', 'Seed'), t('选手', 'Competitor'), t('项目', 'Event'), t('报名时间', 'Registered'), t('检录', 'Check-in'), t('操作', 'Actions')].map((label, index) =>
        <th key={label} scope="col" className={index === 1 ? 'wca-person-column' : undefined}>{label}</th>)}</tr></thead>
      <tbody>{roster.map(item => <tr key={item.id}>
        <td>{rosterSeeds.get(item.id) ?? '—'}</td>
        <th scope="row"><PersonLink wcaId={item.wcaId ?? ''} name={item.displayName} isZh={lang === 'zh'}
          flag={item.countryCode ? <Flag iso2={item.countryCode} spanClassName="country-flag" imgClassName="country-flag-ct" /> : <span className="competition-empty-flag" aria-hidden />} /></th>
        <td>{eventDisplayName(item.project, lang === 'zh')} · {competitionDeviceName(item.device, t)}</td>
        <td>{item.createdAt ? dateText(item.createdAt) : '—'}</td>
        <td><span className="competition-state" data-status={item.checkedInAt ? 'checked_in' : undefined}>
          {item.checkedInAt ? t('已检录', 'Checked in') : item.duelStatus ? rosterLabels[item.duelStatus] : statusLabel(item.status, t)}
        </span></td>
        <td>{item.canJoinVideo && item.matchId ? <button type="button" className="competition-secondary competition-roster-action" onClick={() => {
          void setHostTab('tables'); void setActiveMatch(item.matchId!);
        }}>{t('进入监督视频', 'Join supervision video')}</button> : item.matchId ? <button type="button" className="competition-secondary competition-roster-action" onClick={() => {
          void setHostTab('tables');
        }}>{t('查看桌台', 'View tables')}</button> : '—'}</td>
      </tr>)}</tbody>
    </table>{!roster.length && <p className="competition-muted">{t('没有符合条件的选手。', 'No matching competitors.')}</p>}</div>
    : !otherEntries.length ? <p className="competition-muted">{rosterFilter
      ? t('此状态下没有选手。', 'No competitors with this status.') : t('还没有报名记录。', 'No registrations yet.')}</p> : otherEntries.map(item => {
      const own = item.userId === user.uid;
      const assignedSession = competition.sessions.find(session => session.id === item.sessionId);
      return <div className="competition-registration" key={item.id}>
        <div>
          {!participant && <strong>{displayCuberName(item.displayName, lang === 'zh')}</strong>}
          {item.reviewRequired && <p>{t('待抽检', 'Review flagged')}</p>}
          <p>{eventDisplayName(item.project, lang === 'zh')} · {competitionDeviceName(item.device, t)}</p>
          {assignedSession && <p>{dateText(assignedSession.startsAt)} {t('北京时间', 'UTC+8')}</p>}
        </div>
        <span>{statusLabel(competitionReservationExpired(item, now) ? 'expired' : item.status, t)}</span>
        <div className="competition-toolbar">
          {item.orderId && own && <AppLink href={`/platform/orders/${encodeURIComponent(item.orderId)}`} prefetch={false}>{t('订单', 'Order')}</AppLink>}
          {item.canCheckIn && !item.checkedInAt && (item.device === 'smart'
            ? <AppLink className="competition-secondary" href={`${href(competition.slug || competition.id)}?entry=${encodeURIComponent(item.id)}`}>
                {t('连接魔方检录', 'Connect cube to check in')}
              </AppLink>
            : <button type="button" className="competition-secondary" disabled={busy}
              onClick={() => { void checkIn(item.id); }}>{t('检录', 'Check in')}</button>)}
          {competition.format !== 'advancement' && (item.checkedInAt || item.resultRecordedAt) && (own || item.canRecordResult)
            && (!participant || item.resultRecordedAt || (assignedSession && now < Date.parse(assignedSession.endsAt))) &&
            <button type="button" className={participant ? 'competition-primary' : 'competition-secondary'}
              onClick={() => { void setActiveRegistration(item.id); }}>
              {item.resultRecordedAt ? t('查看成绩', 'View result') : t('进入赛场', 'Enter session')}
            </button>}
        </div>
      </div>;
    })}
  </section> : null;
  const event = competition;
  function renderParticipation(entry: CompetitionRegistration, supervising = false) {
    const video = supervising && entry.canJoinVideo ? {
      autoJoin: autoJoinVideo, onJoin: () => setAutoJoinVideo(true), onLeave: () => setAutoJoinVideo(false),
    } : undefined;
    return event.format === 'advancement'
      ? entry.canJoinVideo && entry.matchId
        ? <div key={entry.matchId}>
            {supervising && <p className="competition-muted">{t('请保持摄像头开启。双方就绪后，系统自动发放打乱。', 'Keep your camera on. The scramble appears automatically when both seats are ready.')}</p>}
            <CompetitionVideoRoom matchId={entry.matchId} prominent={supervising} supervising={supervising} {...video} />
          </div>
        : <p className="competition-muted">{t('监督视频在场次开放后可用。', 'Supervision video is available during the session.')}</p>
      : <CompetitionParticipation key={entry.id} competition={event} registration={entry}
          endsAt={event.sessions.find(item => item.id === entry.sessionId)?.endsAt} onSaved={refresh}
          resultRevision={revision} supervising={supervising} video={video} />;
  }
  const participation = selectedRegistration && renderParticipation(selectedRegistration);

  const rules = <details id="competition-rules" className="competition-rules"><MoreToggle as="summary">{t('参赛与退款规则', 'Participation and refund policies')}</MoreToggle><p>{t('普通魔方与智能魔方分别排名。', 'Standard and smart cubes are ranked separately.')}</p><h3>{t('退款政策', 'Refund policy')}</h3><p>{competition.refundPolicy || t('尚未公布', 'Not yet published')}</p><h3>{t('录像与争议处理', 'Recording and disputes')}</h3><p>{competition.recordingPolicy || t('尚未公布', 'Not yet published')}</p></details>;
  return <div className="competitions" data-competition-view={view} data-duel={competition.format === 'advancement' || undefined}>
    {error ? <p role="alert" className="competition-error">{error}</p> : null}
    <header className="competition-heading competition-detail-heading">
      {!participant && <p className="competition-workspace-crumb" aria-current="page">{t(COMPETITION_WORKSPACES[view].title.zh, COMPETITION_WORKSPACES[view].title.en)}</p>}
      <span className="competition-state" data-status={reviewState}>{statusLabel(reviewState, t)}</span>{competition.isTest && <CompetitionTestBadge />}
      {!participant && <span className="competition-meta">{competitionModeName(supervision, t)} · {competitionFormatName(competition.format ?? 'average', t)}</span>}
      <h1>{t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh)}</h1>
      <p>{dateText(competition.startsAt)} — {dateText(competition.endsAt)} {t('北京时间', 'UTC+8')}</p><p>{competition.organizationName}</p>
      {participant && <CompetitionRegistrationFacts competition={competition} status={status} />}
      {participant && status === 'registration_upcoming' && competition.projects.length > 0 &&
        <p>{competitionProjectSummary(competition.projects, lang, t)}</p>}
    </header>
    {view === 'manage' && competition.isTest && hasAdminAccess(user) && <CompetitionTestControls key={competition.id} competition={competition}
      canStart={competition.status === 'published' && now > 0 && now < Date.parse(competition.startsAt)}
      onStarted={() => { setNow(Date.now()); refresh(); bracket.refresh(); }}
      onCleanedUp={onNavigate && (() => onNavigate('manage'))} />}
    {!participant && <div className="competition-toolbar">
      {!onNavigate && view !== 'supervise' && <AppLink href={workspaceHref(view)} prefetch={false}>{t(COMPETITION_WORKSPACES[view].title.zh, COMPETITION_WORKSPACES[view].title.en)}</AppLink>}
      <AppLink className="competition-secondary" href={href(competition.isTest ? competition.slug : id)} prefetch={false}>
        {t('公开赛事页', 'Public competition page')} <ArrowUpRight size={15} aria-hidden />
      </AppLink>
      <button type="button" className="competition-icon-button" aria-label={t('刷新赛事', 'Refresh competition')} onClick={refresh}><RefreshCw size={17} /></button>
    </div>}
    {participant && (participation ? <>
      <button type="button" className="competition-secondary" onClick={() => { void setActiveRegistration(null); }}>{t('参赛安排', 'Your entries')}</button>
      {participation}
    </> : <>
      {passes.length > 0 && <div className="competition-entry-passes">
        {passes.map(item => {
          const receipt = receiptByOrder.get(item.orderId);
          const project = receipt?.project
            ?? competition.projects.find(ticket => ticket.project === item.project && ticket.device === item.device);
          const session = competition.sessions.find(slot => slot.id === item.sessionId);
          const canEnter = !!item.id && competition.format !== 'advancement' && (!!item.resultRecordedAt
            || (!!item.checkedInAt && !!session && now < Date.parse(session.endsAt)));
          return <CompetitionEntryPass key={item.orderId || item.id} entry={item} project={project} session={session}
            mode={item.sessionKind ?? supervision} fresh={!!recentOrderId && recentOrderId === item.orderId} verified={receipt?.preflightVerified} busy={busy} now={now}
            canEnter={canEnter} onEnter={() => { void setActiveRegistration(item.id); }} onCheckIn={() => { void checkIn(item.id); }}
            onRetry={project && showRegistration && !entryFor(project) ? () => retryRegistration(project.id) : undefined} />;
        })}
      </div>}
      {duelPassport}
      {entries}
    </>)}
    {checkInError && <p className="competition-error" role="alert">{checkInError}</p>}
    {registrationLoadError && <div className="competition-error" role="alert">
      <p>{registrationLoadError}</p>
      <button type="button" onClick={refresh} className="competition-secondary">{t('重试', 'Retry')}</button>
    </div>}
    {settingUp && competition.canManage ? <CompetitionDraftForm key={competition.id} competition={competition} onSaved={refresh} />
    : showRegistration ? <div ref={registrationRegion} className="competition-registration-region" tabIndex={-1}>
      {hasLivePass && <MoreToggle className="competition-secondary" expanded={addMore}
        aria-controls="competition-other-registration" onClick={() => setAddMore(open => !open)}>
        {t('增报其他项目', 'Register for another event')}
      </MoreToggle>}
      <MoreTogglePanel id="competition-other-registration" expanded={!hasLivePass || addMore} animate={hasLivePass}>
        <CompetitionRegistrationPanel competition={competition} routeId={id} ticketId={ticketId} sessionId={sessionId}
          onProject={value => { void setTicketId(value); }} onSession={value => { void setSessionId(value); }}
          entryFor={entryFor} now={now} signedIn={!!user} preview={!!draftPreview} expanded={!hasLivePass || addMore}
          venue={competition.offlineVenue && <CompetitionVenue venue={competition.offlineVenue} />}
          onOrdered={onOrdered} onRefresh={refresh} />
      </MoreTogglePanel>
    </div> : null}
    {participant && !showRegistration && !selectedRegistration && competition.offlineVenue && <CompetitionVenue venue={competition.offlineVenue} />}
    {participant && !selectedRegistration && rules}
    {duelRoster && !settingUp && <>
      <dl className="competition-host-kpis">
        {[[t('已报名', 'Registered'), registrations.filter(item => ['confirmed', 'attended'].includes(item.status)).length],
          [t('已检录', 'Checked in'), registrations.filter(item => item.checkedInAt).length],
          [t('阻塞桌台', 'Blocked tables'), matches.filter(match => match.status === 'ready' && !(match.readyA && match.readyB)).length],
          [t('已完成场次', 'Matches completed'), tableCount('completed')]].map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <nav className="competition-section-tabs" aria-label={t('办赛工作台分区', 'Competition workspace sections')}>
        {([['roster', t('参赛名单', 'Competitors')], ['tables', t('桌台与签表', 'Tables and bracket')], ['results', t('赛后处理与结算', 'Results and settlement')]] as const)
          .map(([key, label]) => <button type="button" key={key} className="competition-section-tab"
            aria-pressed={hostTab === key} onClick={() => { void setHostTab(key); }}>{label}</button>)}
      </nav>
    </>}
    {view === 'manage' && !settingUp && <>{(!duelRoster || hostTab === 'roster') && entries}{(!duelRoster || hostTab === 'tables') && participation}</>}
    {view === 'supervise' && (competition.format === 'advancement'
      ? <CompetitionDuelSupervisionDesk competitionId={competition.id} onRuling={bracket.refresh} entries={supervisorsEntries} matches={bracket.brackets?.matches ?? []}
        activeId={activeMatch} onSelect={matchId => { void setActiveMatch(matchId); }}
        renderRoom={(match, cameraGrid) => <CompetitionVideoRoom key={match.id} matchId={match.id} cameraGrid={cameraGrid} prominent supervising />} />
      : <CompetitionSupervisionDesk entries={supervisorsEntries}
        activeId={activeRegistration} onSelect={id => { void setActiveRegistration(id); }}
        renderSeat={entry => renderParticipation(entry, true)} />)}
    {competition.format === 'advancement' && ['published', 'completed'].includes(competition.status) && !selectedRegistration && view !== 'supervise' && (!duelRoster || hostTab === 'tables') &&
      <CompetitionBracket competition={competition} bracket={bracket} registrations={participant ? registrations : []} manage={view === 'manage'}
        allowGeneration={competition.status === 'published' && now >= Date.parse(competition.registrationClosesAt)} />}
    {participant && competition.format === 'advancement' && status === 'provisional_results' && !competition.finalizedAt &&
      registrations.filter(item => ['confirmed', 'attended'].includes(item.status)).map(item => <div key={item.id} className="competition-bracket-dispute">
        <h3>{eventDisplayName(item.project, lang === 'zh')} · {competitionDeviceName(item.device, t)}</h3>
        <CompetitionDisputeForm registrationId={item.id} onSaved={refresh} />
        <CompetitionEvidenceFiles registrationId={item.id} canUpload />
      </div>)}
    {competition.format !== 'advancement' && view !== 'supervise' && ['published', 'completed'].includes(competition.status) && (!participant || (!selectedRegistration && (['completed', 'provisional_results'].includes(status) || now >= Date.parse(competition.startsAt))))
      ? <CompetitionResults competition={competition} revision={revision} ownEntries={participant ? registrations : []} /> : null}
    {view === 'manage' && !settingUp && competition.canManage && (!duelRoster || hostTab === 'results') ? <CompetitionManagement competition={competition} registrations={registrations} bracket={bracket.brackets} revision={revision} onSaved={refresh} /> : null}
  </div>;
}

function CompetitionVenue({ venue }: { venue: NonNullable<OnlineCompetition['offlineVenue']> }) {
  const t = useT();
  return <section className="competition-venue" data-site-surface="panel">
    <h3>{t('场馆与签到', 'Venue and check-in')}</h3><p>{venue.city} · {venue.address}</p>
    {venue.contact && <p>{venue.contact}</p>}{venue.checkinGuide && <p>{venue.checkinGuide}</p>}
  </section>;
}

function CompetitionOrganizerEditor({ mode, onCreated }: { mode: 'create' | 'apply' | 'review'; onCreated?: (id: string) => void }) {
  const t = useT();
  const [organizations, setOrganizations] = useState<TeachingOrganizationAccess[]>([]);
  const [loadError, setLoadError] = useState('');
  const [access, setAccess] = useState<OrganizerAccess | null>(null);
  const approvedCount = access?.eligibleOrganizationIds.length ?? 0;
  useEffect(() => {
    if (mode === 'review') return;
    let active = true;
    void listTeachingOrganizations().then(items => {
      if (active) {
        setOrganizations(items.filter(item => ['owner', 'admin'].includes(item.role)));
        setLoadError('');
      }
    }).catch(error => { if (active) setLoadError(message(error, t('主办组织加载失败。', 'Could not load organizations.'))); });
    return () => { active = false; };
  }, [mode, approvedCount, t]);

  const approved = access?.eligibleOrganizations ?? organizations.filter(item => access?.eligibleOrganizationIds.includes(item.id));
  if (mode === 'create' && approved.length) return <CompetitionDraftForm organizers={approved} onCreated={onCreated} />;
  if (mode !== 'create') return <section className="competition-editor">
    <OrganizerOnboarding organizations={organizations} onLoaded={setAccess} reviewOnly={mode === 'review'} />
    {loadError && <p role="alert" className="competition-error">{loadError}</p>}
  </section>;
  return <section className="competition-editor competition-setup">
    <div className="competition-setup-panel" data-site-surface="panel">
      <h2>{t('主办资格', 'Organizer access')}</h2>
      {access && !approvedCount && <p className="competition-muted">
        {access.applications.some(item => item.status === 'pending')
          ? t('审核通过后，在这里刷新主办资格即可继续。', 'Once approved, refresh organizer access here to continue.')
          : access.applications[0]?.status === 'rejected'
            ? t('可以根据审核意见补充资料并重新提交。', 'Update your details using the review note and resubmit.')
            : t('填写下方主办资料。审核通过后可在这里创建比赛。', 'Fill in the organizer details below. Once approved, you can create competitions here.')}
      </p>}
      {approvedCount > 0 && <p className="competition-muted">{t('账号已有办赛资格，暂时无法加载主办组织。请刷新主办资格后重试。', 'You have organizer access. Refresh access to retry loading your organizations.')}</p>}
      <OrganizerOnboarding organizations={organizations} onLoaded={setAccess} allowApplication={!approvedCount} />
      {loadError && <p role="alert" className="competition-error">{loadError}</p>}
    </div>
  </section>;
}

function OrganizerOnboarding({ organizations, onLoaded, reviewOnly = false, allowApplication = true }: {
  reviewOnly?: boolean; allowApplication?: boolean; organizations: TeachingOrganizationAccess[]; onLoaded: (access: OrganizerAccess) => void;
}) {
  const t = useT();
  const user = useAuthUser();
  const admin = hasAdminAccess(user);
  const [applications, setApplications] = useState<OrganizerApplication[]>([]);
  const [queue, setQueue] = useState<OrganizerApplication[]>([]);
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [formOpen, setFormOpen] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const contactField = useRef<HTMLInputElement>(null);
  const generatedSlug = useRef('');
  const applicationRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([reviewOnly ? Promise.resolve({ applications: [], eligibleOrganizationIds: [] }) : listOrganizerApplications(), admin && reviewOnly ? listOrganizerReviewQueue() : Promise.resolve({ applications: [] })])
      .then(([mine, review]) => {
        if (!active) return;
        setApplications(mine.applications);
        setQueue(review.applications);
        setEligibleIds(mine.eligibleOrganizationIds);
        setLoaded(true);
        onLoaded(mine);
      })
      .catch(error => { if (active) setError(message(error, t('主办申请加载失败。', 'Could not load organizer applications.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, reviewOnly, onLoaded, revision, t, user?.uid]);
  const pending = applications.some(item => item.status === 'pending');
  const [latest, ...history] = applications;
  const rejected = allowApplication && latest?.status === 'rejected' && (!latest.organizationId || !eligibleIds.includes(latest.organizationId)) ? latest : undefined;
  const available = organizations.filter(item => item.status === 'active' && !eligibleIds.includes(item.id));
  const applicationIssue = selectedOrganization && !available.some(item => item.id === selectedOrganization)
    ? t('请选择可用于申请的组织。', 'Choose an organization you can apply for.')
    : !selectedOrganization && !name.trim() ? t('请填写主办方名称。', 'Enter an organizer name.')
    : !contact.trim() ? t('请填写联系方式。', 'Enter your contact details.')
    : !description.trim() ? t('请说明办赛计划。', 'Describe how you plan to run the competition.') : '';
  function retryApplication(application: OrganizerApplication) {
    const linked = available.find(item => item.id === application.organizationId);
    setSelectedOrganization(linked?.id ?? '');
    setName(application.organizationId ? '' : application.name);
    generatedSlug.current = !application.organizationId && /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(application.slug) ? application.slug : '';
    applicationRequest.current = null;
    setContact(application.contact);
    setDescription(application.description);
    setRetrying(true);
    setError('');
    setFormOpen(true);
    requestAnimationFrame(() => contactField.current?.focus());
  }
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); setRevision(value => value + 1); }
    catch (error) { setError(message(error, t('操作未完成，请重试。', 'Could not complete the action. Try again.'))); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (loading || pending || !loaded || !allowApplication) return;
    if (applicationIssue) { setError(applicationIssue); return; }
    await act(async () => {
      const common = { contact: contact.trim(), description: description.trim() };
      if (!selectedOrganization) generatedSlug.current ||= createCompetitionSlug(name, 'organizer');
      const payload = selectedOrganization ? { ...common, organizationId: selectedOrganization }
        : { ...common, name: name.trim(), slug: generatedSlug.current };
      const fingerprint = JSON.stringify(payload);
      if (applicationRequest.current?.fingerprint !== fingerprint) applicationRequest.current = { fingerprint, key: crypto.randomUUID() };
      const { application } = await submitOrganizerApplication(payload, applicationRequest.current.key);
      setApplications(previous => [application, ...previous.filter(item => item.id !== application.id)]);
      setFormOpen(false);
      setRetrying(false);
    });
  }
  if (reviewOnly && admin) return <div className="competition-onboarding">
    <section><h2>{t('审核主办申请', 'Review organizer applications')}</h2>{queue.map(item => <div className="competition-policy-fields" key={item.id}><h3>{item.name}</h3><p>{item.contact}</p><p>{item.description}</p><label>{t('审核意见', 'Review note')}<textarea autoComplete="off" className="platform-field-control" rows={2} value={notes[item.id] ?? ''} maxLength={4000} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} /></label><div className="competition-toolbar"><button type="button" className="competition-secondary" disabled={busy} onClick={() => { void act(() => reviewOrganizerApplication(item.id, 'approve', notes[item.id]?.trim() ?? '')); }}>{t('通过主办申请', 'Approve organizer')}</button><button type="button" className="competition-secondary" disabled={busy || !notes[item.id]?.trim()} onClick={() => { void act(() => reviewOrganizerApplication(item.id, 'reject', notes[item.id].trim())); }}>{t('拒绝并说明原因', 'Decline with reason')}</button></div></div>)}</section>
    {error ? <p role="alert">{error}</p> : loading ? <LoadingIndicator /> : !queue.length && <p>{t('暂无待审核申请。', 'No pending applications.')}</p>}
    <button type="button" className="competition-secondary" disabled={loading || busy} onClick={() => { setError(''); setRevision(value => value + 1); }}>{t('刷新', 'Refresh')}</button>
  </div>;
  function renderApplication(item: OrganizerApplication) {
    return (
      <div key={item.id} className="competition-registration">
        <div>
          <strong>{item.name}</strong>
          <p>{item.status === 'pending' ? t('主办资格待审核', 'Organizer application pending')
            : item.status === 'approved' ? t('主办资格已通过', 'Organizer approved')
              : t('主办资格申请未通过', 'Organizer application declined')}</p>
          {item.reviewNote && <p>{t('审核意见', 'Review note')} · {item.reviewNote}</p>}
          {item.status === 'approved' && item.organizationSlug && (
            <AppLink prefetch={false} href={'/platform/org/' + encodeURIComponent(item.organizationSlug)}>{t('管理主办组织', 'Manage organization')}</AppLink>
          )}
        </div>
        {item.id === rejected?.id && !pending && <button type="button" className="competition-primary"
          disabled={loading || busy} onClick={() => retryApplication(item)}>{t('修改并重新提交', 'Edit and resubmit')}</button>}
      </div>
    );
  }
  return <div className="competition-onboarding">
    {loading && <p role="status" className="competition-muted"><LoadingIndicator>{t('正在加载主办资格…', 'Loading organizer access…')}</LoadingIndicator></p>}
    {latest && renderApplication(latest)}
    {history.length > 0 && <details className="competition-application-form">
      <MoreToggle as="summary">{t('历史申请', 'Previous applications')}</MoreToggle>
      {history.map(renderApplication)}
    </details>}
    {loaded && allowApplication && !pending && (
      <details className="competition-application-form"
        open={formOpen ?? !applications.length}
        onToggle={event => setFormOpen(event.currentTarget.open)}>
        <MoreToggle as="summary">{retrying ? t('修改主办资格申请', 'Edit organizer application') : t('申请主办资格', 'Apply for organizer access')}</MoreToggle>
        <p className="competition-muted">{retrying
          ? t('按审核意见修改下方资料，然后重新提交。', 'Update the details below using the review note, then resubmit.')
          : t('可选择已有组织，或申请新建主办组织。', 'Choose an existing organization or apply to create one.')}</p>
        <div className="competition-form-grid">
          {available.length > 0 && <div className="competition-field">
            <span>{t('使用组织', 'Organization')}</span>
            <CompactSelect value={selectedOrganization}
              label={available.find(item => item.id === selectedOrganization)?.name ?? t('新建主办组织', 'New organizer')}
              items={[{ value: '', label: t('新建主办组织', 'New organizer') }, ...available.map(item => ({ value: item.id, label: item.name }))]}
              onChange={setSelectedOrganization} ariaLabel={t('申请组织', 'Applicant organization')} />
          </div>}
          {!selectedOrganization && <label>{t('主办方名称', 'Organizer name')}<input autoComplete="off" className="platform-field-control" value={name} maxLength={160} onChange={event => setName(event.target.value)} /></label>}
          <label>{t('联系方式', 'Contact details')}<input ref={contactField} className="platform-field-control" value={contact} maxLength={500} onChange={event => setContact(event.target.value)} /><small>{t('仅本人和平台审核人员可见', 'Visible only to you and platform reviewers')}</small></label>
          <label>{t('办赛计划与经验', 'Competition plans and experience')}<textarea autoComplete="off" className="platform-field-control" rows={3} value={description} maxLength={4000} onChange={event => setDescription(event.target.value)} /></label>
        </div>
        <button className="competition-primary" type="button" disabled={loading || busy}
          onClick={() => { void submit(); }}>{retrying ? t('重新提交主办申请', 'Resubmit organizer application') : t('提交主办申请', 'Submit organizer application')}</button>
      </details>
    )}
    {error && <p role="alert" className="competition-error">{error}</p>}
    {(applications.length > 0 || (!loaded && !loading) || !allowApplication) && (
      <button type="button" className="competition-secondary" disabled={loading || busy}
        onClick={() => { setError(''); setRevision(value => value + 1); }}>{t('刷新主办资格', 'Refresh organizer access')}</button>
    )}
  </div>;
}

function CompetitionParticipation({ competition, registration, endsAt, onSaved, resultRevision, supervising, video }: {
  competition: OnlineCompetition; endsAt?: string; registration: CompetitionRegistration; onSaved: () => void;
  resultRevision: number; supervising: boolean; video?: Omit<React.ComponentProps<typeof CompetitionVideoRoom>, 'registrationId'>;
}) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const competitionId = competition.id;
  const finalized = !!competition.finalizedAt;
  const completed = !!registration.resultRecordedAt;
  const { results } = useCompetitionResults(competitionId, resultRevision, completed);
  const publicResult = results.find(result => result.id === registration.id);
  const [timerMode, setTimerMode] = useState<'built_in' | 'external'>('built_in');
  const [timedResult, setTimedResult] = useState<{ number: number; score: CompetitionResult['attempts'][number] } | null>(null);
  const saving = useRef(false);
  const selfService = registration.sessionKind === 'self_service';
  const ordinarySelf = selfService && registration.device === 'ordinary';
  const ownEntry = registration.userId === user?.uid;
  const [recording, setRecording] = useState(false);
  const [recordedAttempt, setRecordedAttempt] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<CompetitionEvidence[]>([]);
  const [clock, setClock] = useState(0);
  const retry = useRef<{ number: number; body: CompetitionSelfResult; key: string } | null>(null);
  const retryStorage = `competition-self-attempt:${registration.id}`;
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setClock(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  useEffect(() => {
    if (!ordinarySelf || !ownEntry) return;
    try {
      const stored = JSON.parse(localStorage.getItem(retryStorage) ?? 'null');
      if (stored && Number.isInteger(stored.number) && stored.number >= 1 && stored.number <= 5 && typeof stored.key === 'string'
        && (stored.body?.recordedLocally === true || typeof stored.body?.recordingEvidenceId === 'string')
        && ['none', '+2', 'DNF'].includes(stored.body?.penalty) && (stored.body.centiseconds === null || Number.isInteger(stored.body.centiseconds))) {
        retry.current = stored;
      }
    } catch { /* Private browsing can block local storage. */ }
  }, [ordinarySelf, ownEntry, retryStorage]);
  const [attempts, setAttempts] = useState<CompetitionAttempt[]>([]);
  const [seconds, setSeconds] = useState('');
  const [penalty, setPenalty] = useState<'none' | '+2' | 'DNF' | 'DNS'>('none');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function read() {
      try { const result = await getCompetitionAttempts(registration.id); if (active) setAttempts(result.attempts); }
      catch (error) { if (active) setError(message(error, t('尝试记录加载失败。', 'Could not load attempts.'))); }
    }
    void read();
    const timer = completed ? undefined : setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [completed, registration.id, revision, t]);
  const legacy = attempts.length > 0 && attempts.every(attempt => !attempt.synchronized);
  const current = attempts.find(item => !item.recordedAt);
  const currentNumber = current?.attemptNumber;
  useEffect(() => {
    if (ordinarySelf && recording && currentNumber !== undefined) setRecordedAttempt(currentNumber);
  }, [ordinarySelf, recording, currentNumber]);
  const hasLocalRecording = currentNumber !== undefined && (recording || recordedAttempt === currentNumber);
  const recordingEvidenceId = currentNumber === undefined ? undefined : recordings.find(file => file.attemptNumber === currentNumber)?.id;
  const retrying = currentNumber !== undefined && retry.current?.number === currentNumber;
  const canSubmitRecording = retrying || hasLocalRecording || !!recordingEvidenceId;
  const remaining = clock && endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - clock) / 1000)) : null;
  const ownSelf = selfService && ownEntry && !registration.resultRecordedAt && remaining !== 0;
  const recordedCount = attempts.filter(item => item.recordedAt).length;
  async function recordSelf(number: number, body: CompetitionResult['attempts'][number]) {
    if (retry.current?.number !== number) {
      if (recordingEvidenceId) retry.current = { number, body: { ...body, recordingEvidenceId }, key: crypto.randomUUID() };
      else if (hasLocalRecording) retry.current = { number, body: { ...body, recordedLocally: true }, key: crypto.randomUUID() };
      else return;
    }
    const queued = retry.current;
    persistItem(retryStorage, JSON.stringify(queued));
    await completeCompetitionSelfAttempt(registration.id, number, queued.body, queued.key);
    retry.current = null;
    try { localStorage.removeItem(retryStorage); } catch { /* Current tab is already synchronized. */ }
  }
  const complete = attempts.length === 5 && attempts.every(item => item.recordedAt);
  const reportAttempts = publicResult?.attempts ?? registration.attempts ?? (complete
    ? attempts.flatMap(item => item.penalty ? [{ centiseconds: item.centiseconds, penalty: item.penalty }] : []) : []);
  const report = completed && reportAttempts.length === 5 ? ao5ReportData(competition, {
    ...registration, attempts: reportAttempts, rank: publicResult?.rank, recordedAt: registration.resultRecordedAt ?? undefined,
    finalizedAt: competition.finalizedAt ?? null,
  }, t, lang) : null;
  const builtIn = ordinarySelf && timerMode === 'built_in';
  const timerScore = timedResult && timedResult.number === currentNumber ? timedResult.score : null;
  const failed = penalty === 'DNF' || penalty === 'DNS';
  const validSeconds = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(seconds) && Number(seconds) > 0 && Number(seconds) <= 86400;
  async function act(action: () => Promise<unknown>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError('');
    try { await action(); setSeconds(''); setPenalty('none'); setTimedResult(null); setRevision(value => value + 1); onSaved(); }
    catch (error) { setError(message(error, t('操作未完成，请重试。', 'The action did not complete. Try again.'))); }
    finally { saving.current = false; setBusy(false); }
  }
  const resumeLegacy = useEffectEvent(() => {
    void act(() => nextCompetitionSelfAttempt(registration.id));
  });
  useEffect(() => {
    if (ownSelf && ordinarySelf && recording && attempts.length > 0 && !current && !complete && !busy && !error) resumeLegacy();
  }, [ownSelf, ordinarySelf, recording, attempts.length, current, complete, busy, error]);
  const penaltyOptions = [{ value: 'none', label: t('无罚时', 'No penalty') }, { value: '+2', label: '+2' }, { value: 'DNF', label: 'DNF' }, { value: 'DNS', label: 'DNS' }];
  return <section className="competition-participation">
    <header className="competition-participation-heading">
      <div><h2>{displayCuberName(registration.displayName, lang === 'zh')} {t('的赛场', '— competition session')}</h2>
        <p><EventIcon event={registration.project} /> {eventDisplayName(registration.project, lang === 'zh')} · {competitionDeviceName(registration.device, t)}</p>
      </div>
      {!completed && <div className="competition-room-status">
        <span>{t(`已完成 ${recordedCount} / 5 把`, `${recordedCount} / 5 attempts complete`)}</span>
        {remaining !== null && <span>{t('剩余', 'Remaining')} {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
      </div>}
    </header>
    {report && <CompetitionReport data={report} share={ownEntry && (registration.status === 'attended' || finalized)} />}
    {!completed && supervising && <p className="competition-muted">{legacy
      ? t('保持摄像头开启，确认选手的双手和器材可见。', 'Keep your camera on and make sure the entrant’s hands and equipment are visible.')
      : t('请保持摄像头开启。双方开启摄像头后，选手就绪时系统会自动发放打乱。', 'Keep your camera on. Once both cameras are on and the entrant is ready, the scramble appears automatically.')}
    </p>}
    {!completed && registration.sessionKind !== 'offline' && (selfService
      ? ordinarySelf && <CompetitionSelfRecording onRecordingChange={setRecording} />
      : video || ownEntry || registration.canJoinVideo || registration.canRecordResult
        ? <CompetitionVideoRoom registrationId={registration.id} prominent={supervising} supervising={supervising} {...video} />
        : <p className="competition-muted">{t('监督视频在场次开放后可用。', 'Supervision video is available during the session.')}</p>)}
    {!completed && !supervising && <p className="competition-muted">
      {selfService ? ordinarySelf ? t('保留录像以备抽检。', 'Keep the recording for spot checks.')
        : t('连接智能魔方后，系统会根据正式打乱与动作记录计分。', 'Connect your smart cube to score using the issued scramble and recorded moves.')
        : t('保持双手、魔方与计时器可见。', 'Keep your hands, cube and timer visible.')}
    </p>}
    {!completed && (current ? <div className="competition-current-attempt" data-site-surface="panel">
      <h3>{t(`第 ${current.attemptNumber} 把打乱`, `Attempt ${current.attemptNumber} scramble`)}</h3>
      <CompetitionScramble project={registration.project} scramble={current.scramble} />
    </div> : (complete || legacy || !supervising) && <p className="competition-muted">
      {complete ? t('五次尝试已记录。', 'All five attempts are recorded.') : t('等待下一次打乱。', 'Waiting for the next scramble.')}
    </p>)}
    {ownSelf && ordinarySelf && current && !canSubmitRecording && <p role="status" className="competition-muted">
      {t('这把还没有录像记录。请打开录像补录，或在复核录像中上传这把的片段，再提交成绩。',
        'This attempt has no recording. Resume recording or upload its clip under Review recordings before submitting.')}
    </p>}
    {(registration.canRecordResult || (ownSelf && ordinarySelf)) && current && !completed && <>
      {ordinarySelf && !retrying && <div className="competition-timing-mode">
        <label htmlFor="competition-timing-mode">{t('计时方式', 'Timing mode')}</label>
        <select id="competition-timing-mode" className="platform-field-control" value={timerMode} onChange={event => {
          setTimerMode(event.target.value === 'external' ? 'external' : 'built_in');
          if (timerScore) { setSeconds(timerScore.centiseconds === null ? '' : (timerScore.centiseconds / 100).toFixed(2)); setPenalty(timerScore.penalty); }
          setTimedResult(null);
        }}>
          <option value="built_in">{t('内置空格计时', 'Built-in Space timer')}</option>
          <option value="external">{t('外接计时器 · 手填秒数', 'External timer · enter seconds')}</option>
        </select>
      </div>}
      {builtIn && !retrying && <CompetitionSelfTimer key={current.attemptNumber} project={registration.project} disabled={busy}
        onResult={score => setTimedResult({ number: current.attemptNumber, score })} />}
      <div className="competition-score-form">
        {!builtIn && !retrying && <>
          <label>{t('原始用时（秒）', 'Raw time (seconds)')}<input className="platform-field-control" type="number" inputMode="decimal" min="0.01" max={86400} step="0.01" value={seconds} disabled={failed} onChange={event => setSeconds(event.target.value)} /></label>
          <CompactSelect value={penalty} label={penaltyOptions.find(item => item.value === penalty)!.label} items={ordinarySelf ? penaltyOptions.filter(option => option.value !== 'DNS') : penaltyOptions} onChange={value => setPenalty(value as typeof penalty)} ariaLabel={t('罚时', 'Penalty')} />
        </>}
        {retrying && retry.current && <output>{formatWcaResult(attemptValue(retry.current.body), registration.project, 'single')}</output>}
        <button className="competition-primary" type="button" disabled={busy || (ordinarySelf && !canSubmitRecording) || (!retrying && (builtIn ? !timerScore : !failed && !validSeconds))} onClick={() => {
          const result = (retrying ? retry.current?.body : null) ?? (builtIn ? timerScore : { centiseconds: failed ? null : Math.round(Number(seconds) * 100), penalty });
          if (result) void act(() => ordinarySelf ? recordSelf(current.attemptNumber, result) : recordCompetitionAttempt(registration.id, current.attemptNumber, result));
        }}>{retrying ? t('重试提交成绩', 'Retry result submission') : t('确认本次成绩', 'Confirm attempt')}</button>
      </div>
    </>}
    {!current && !registration.resultRecordedAt && !complete && legacy
      && (registration.canRecordResult || (supervising && registration.device === 'smart' && registration.canJoinVideo)) &&
      <button type="button" className="competition-secondary" disabled={busy}
        onClick={() => void act(() => nextCompetitionAttempt(registration.id))}>{t('继续旧场次', 'Resume earlier session')}</button>}
    {!current && !registration.resultRecordedAt && complete && registration.canRecordResult &&
      <button type="button" className="competition-primary" disabled={busy} onClick={() => void act(() => finalizeCompetitionRegistration(registration.id))}>{t('确认完赛', 'Confirm completed result')}</button>}
    {!report && <ol className="competition-attempts" aria-label={t('五把进度', 'Five-attempt progress')}>{Array.from({ length: 5 }, (_, index) => {
      const item = registration.attempts?.[index] ?? attempts[index];
      return <li key={index} data-recorded={!!item?.penalty}><span>{t(`第 ${index + 1} 把`, `Attempt ${index + 1}`)}</span><strong>{item?.penalty ? formatWcaResult(attemptValue(item), registration.project, 'single') : '—'}</strong>
        {attempts[index]?.reviewRequired && <small>{t('待抽检', 'Review flagged')}</small>}</li>;
    })}</ol>}
    {registration.device === 'smart' && registration.resultRecordedAt && attempts.some(a => a.telemetry?.status === 'device_reported' && !!a.telemetry.moveCount) &&
      <CompetitionAttemptReplay registrationId={registration.id}
        attemptNumbers={attempts.filter(a => a.telemetry?.status === 'device_reported' && !!a.telemetry.moveCount).map(a => a.attemptNumber)} />}
    {completed && !report ? <p role="status" className="competition-muted">{t('已完赛，成绩已进入公示。', 'Result recorded and available for review.')}</p> : null}
    {registration.resultRecordedAt && ownEntry && !finalized && <CompetitionDisputeForm registrationId={registration.id} onSaved={onSaved} />}
    <CompetitionEvidenceFiles registrationId={registration.id} canUpload={!finalized}
      attemptNumber={ordinarySelf && ownSelf ? currentNumber : undefined} onFilesChange={ordinarySelf ? setRecordings : undefined} />
    {error ? <p role="alert" className="competition-error">{error}</p> : null}
  </section>;
}

function CompetitionDisputeForm({ registrationId, onSaved }: { registrationId: string; onSaved: () => void }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'ready' | 'busy' | 'saved'>('ready');
  const [error, setError] = useState('');
  async function submit() {
    if (state !== 'ready' || !reason.trim()) return;
    setState('busy'); setError('');
    try { await raiseCompetitionDispute(registrationId, reason.trim()); setState('saved'); onSaved(); }
    catch (cause) { setState('ready'); setError(message(cause, t('异议提交失败。', 'Could not submit the dispute.'))); }
  }
  return <details className="competition-rules">
    <MoreToggle as="summary">{t('对成绩有异议', 'Dispute this result')}</MoreToggle>
    <label className="competition-field">{t('说明原因', 'Explain the issue')}<textarea autoComplete="off" className="platform-field-control"
      rows={3} maxLength={4000} value={reason} disabled={state === 'saved'} onChange={event => setReason(event.target.value)} /></label>
    <button type="button" className="competition-secondary" disabled={state !== 'ready' || !reason.trim()} onClick={() => void submit()}>{t('提交异议', 'Submit dispute')}</button>
    {state === 'saved' && <p role="status">{t('异议已提交，等待处理。', 'Dispute submitted for review.')}</p>}
    {error && <p className="competition-error" role="alert">{error}</p>}
  </details>;
}

function CompetitionAttemptReplay({ registrationId, attemptNumbers, publiclyAvailable }: {
  registrationId: string; attemptNumbers: number[]; publiclyAvailable?: boolean;
}) {
  const t = useT();
  return <div className="competition-toolbar">{attemptNumbers.map(number =>
    <CompetitionReplayButton key={number} registrationId={registrationId} number={number} publicReplay={publiclyAvailable}>
      {t(`第 ${number} 把`, `Attempt ${number}`)}
    </CompetitionReplayButton>)}</div>;
}

function CompetitionResults({ competition, revision, ownEntries }: {
  competition: OnlineCompetition; revision: number; ownEntries: CompetitionRegistration[];
}) {
  const t = useT();
  const lang = useLang();
  const { results, error } = useCompetitionResults(competition.id, revision);
  const ownIds = new Set(ownEntries.map(entry => entry.id));
  const rankValue = (value: number) => value > 0 ? value : Infinity;
  const rows = results.map(result => ({ ...result, ...competitionAo5(result.attempts, result.project) }))
    .sort((a, b) => a.project.localeCompare(b.project) || a.device.localeCompare(b.device)
      || rankValue(a.average) - rankValue(b.average) || rankValue(a.best) - rankValue(b.best));
  const groups = Array.from(new Set(rows.map(row => `${row.project}:${row.device}`))).map(key => rows.filter(row => `${row.project}:${row.device}` === key));
  return <section className="competition-results" id="competition-results">
    <h2>{t('比赛成绩', 'Results')}</h2>
    {error ? <p role="alert" className="competition-error">{error}</p> : !rows.length ? <p className="competition-muted">{t('完赛后在这里查看成绩。', 'Results will appear here after competitors finish.')}</p>
      : groups.map(group => {
        const { project, device, finalizedAt } = group[0];
        const event = `${eventDisplayName(project, lang === 'zh')} · ${competitionDeviceName(device, t)}`;
        return <div className="competition-result-scroll" key={`${project}:${device}`}>
          <table className="competition-result-table">
            <caption>{event} · {finalizedAt ? t('最终成绩', 'Final') : t('公示中', 'Provisional')}</caption>
            <thead><tr>
              <th scope="col">{t('名次', 'Rank')}</th><th scope="col" className="wca-person-column">{t('选手', 'Entrant')}</th>
              <th scope="col">Ao5</th><th scope="col" aria-label={t('最佳单次', 'Best single')}>{t('最佳', 'Best')}</th>
            </tr></thead>
            {group.map(row => {
              const rank = row.rank === undefined ? group.findIndex(other => other.average === row.average && other.best === row.best) + 1 : row.rank;
              return <tbody key={row.id}>
                <tr>
                  <td><CompetitionRank rank={rank} final={!!row.finalizedAt} /></td>
                  <th scope="row"><PersonLink wcaId={row.wcaId ?? ''} name={row.displayName} isZh={lang === 'zh'}
                    flag={row.countryCode ? <Flag iso2={row.countryCode} spanClassName="country-flag" imgClassName="country-flag-ct" /> : undefined} /></th>
                  <td>{formatWcaResult(row.average, project, 'average')}</td><td>{formatWcaResult(row.best, project, 'single')}</td>
                </tr>
                <tr className="competition-result-details"><td colSpan={4}>
                  <div className="competition-result-actions">
                    <details className="competition-result-attempts"><MoreToggle as="summary">{t('五次成绩', 'All attempts')}</MoreToggle>
                      <ol className="competition-result-solves">{row.times.map((time, i) => {
                        const publicReplay = !!row.finalizedAt && !competition.isTest;
                        const canReplay = row.replayAttempts?.includes(i + 1) && (publicReplay || ownIds.has(row.id));
                        return <li key={i}><span>#{i + 1}</span>
                          {device === 'smart' && canReplay
                            ? <CompetitionReplayButton registrationId={row.id} number={i + 1} publicReplay={publicReplay}>{time}</CompetitionReplayButton>
                            : <strong>{time}</strong>}
                        </li>;
                      })}</ol>
                    </details>
                    {ownIds.has(row.id) && <CompetitionReportShare data={ao5ReportData(competition, { ...row, rank }, t, lang)} />}
                  </div>
                </td></tr>
              </tbody>;
            })}
          </table>
        </div>;
      })}
  </section>;
}

function CompetitionManagement({ competition, registrations, bracket, revision, onSaved }: {
  competition: OnlineCompetition; registrations: CompetitionRegistration[];
  bracket: ReturnType<typeof useCompetitionBrackets>['brackets']; revision: number; onSaved: () => void;
}) {
  const t = useT();
  const [disputes, setDisputes] = useState<CompetitionDispute[] | null>(null);
  const [settlement, setSettlement] = useState<CompetitionSettlement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [providerReference, setProviderReference] = useState('');
  const [transferredAt, setTransferredAt] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [terms, setTerms] = useState({ rate: '', days: '', anchor: 'finalized' });
  const missingTerms = !!settlement && (settlement.commissionBps == null || settlement.settlementDays == null || !settlement.settlementAnchor);
  const settlementTerms = parseCompetitionSettlementTerms(terms);
  const outstanding = Number(settlement?.outstandingMinor ?? settlement?.organizerAmountMinor ?? 0);
  const recovery = outstanding < 0;
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const ended = now >= Date.parse(competition.endsAt);
  const duel = competition.format === 'advancement';
  const allMatchesDecided = !!bracket?.generated && bracket.matches.every(match => ['completed', 'bye'].includes(match.status));
  const unfinishedCount = duel ? (bracket?.matches.filter(match => !['completed', 'bye'].includes(match.status)).length ?? 0)
    : registrations.filter(entry => entry.status === 'confirmed' && !entry.resultRecordedAt).length;
  const unfinished = duel ? !allMatchesDecided : unfinishedCount > 0;
  const free = competition.projects.length > 0 && competition.projects.every(project => project.amountMinor === 0);
  const finalizedAt = competition.finalizedAt ?? settlement?.finalizedAt;
  const unsettledDisputes = disputes?.filter(issue => !issue.resolvedAt).length ?? 0;
  const stillOpen = duel
    ? bracket?.generated ? t(`尚余 ${unfinishedCount} 场未结束。`, `${unfinishedCount} matches remain.`) : t('签表尚未生成。', 'The bracket has yet to be generated.')
    : t(`尚余 ${unfinishedCount} 份成绩未提交。`, `${unfinishedCount} results remain.`);
  const canFinalize = (duel ? allMatchesDecided : ended && !unfinished) && !!disputes && disputes.every(issue => !!issue.resolvedAt);
  useEffect(() => {
    let active = true;
    void Promise.all([listCompetitionDisputes(competition.id), getCompetitionSettlement(competition.id)])
      .then(([issues, statement]) => { if (active) { setDisputes(issues.disputes); setSettlement(statement.settlement); } })
      .catch(error => { if (active) setError(message(error, t('管理信息加载失败。', 'Could not load management information.'))); });
    return () => { active = false; };
  }, [competition.id, revision, t, allMatchesDecided]);
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError(''); setSaved('');
    try { await action(); setSaved(t('已保存', 'Saved')); onSaved(); }
    catch (error) { setError(message(error, t('操作未完成。', 'The action did not complete.'))); }
    finally { setBusy(false); }
  }
  return <section className="competition-management"><h2>{t('赛后处理', 'After the competition')}</h2>
    {competition.supervisionMode === 'offline' && competition.status === 'published' && now >= Date.parse(competition.startsAt) && <OfflineResults
      registrations={registrations} busy={busy} onRecord={(registrationId, attempts) => act(() => recordOfflineCompetitionResults(competition.id, [{ registrationId, attempts }]))} />}
    {competition.supervisionMode === 'self_service' && competition.status === 'published' && registrations.some(entry => entry.reviewAttempts?.length) &&
      <section className="competition-spot-checks">
        <h3>{t('自助赛抽检', 'Self-service spot checks')}</h3>
        {registrations.filter(entry => entry.reviewAttempts?.length).map(entry => <section key={entry.id} className="competition-dispute">
          <strong>{entry.displayName}</strong>
          <CompetitionEvidenceFiles registrationId={entry.id} canUpload={false} />
          {entry.reviewAttempts?.map(attempt => <div key={attempt.attemptNumber} className="competition-toolbar">
            <span>{t(`第 ${attempt.attemptNumber} 把`, `Attempt ${attempt.attemptNumber}`)} · {formatWcaResult(attemptValue(attempt), entry.project, 'single')}</span>
            <button type="button" className="competition-secondary" disabled={busy}
              onClick={() => void act(() => reviewCompetitionSelfAttempt(entry.id, attempt.attemptNumber, 'approve'))}>{t('核验通过', 'Verify attempt')}</button>
            <button type="button" className="competition-secondary" disabled={busy}
              onClick={() => void act(() => reviewCompetitionSelfAttempt(entry.id, attempt.attemptNumber, 'DNF'))}>{t('改判 DNF', 'Rule DNF')}</button>
          </div>)}
        </section>)}
      </section>}
    <h3>{t('成绩异议', 'Result disputes')}</h3>
    {!disputes?.length ? <p className="competition-muted">{t('暂无异议。', 'No disputes.')}</p> : disputes.map(issue => <div className="competition-dispute" key={issue.id}>
      <strong>{registrations.find(item => item.id === issue.registrationId)?.displayName ?? t('参赛选手', 'Competitor')}</strong><p className="competition-muted">{dateText(issue.createdAt)}</p><p>{issue.reason}</p>
      {competition.canPublish ? <CompetitionEvidenceFiles registrationId={issue.registrationId} canUpload={false} /> : null}
      {issue.resolvedAt ? <p>{t('处理结果：', 'Resolution: ')}{issue.resolution}</p> : competition.canPublish ? <DisputeResolutionForm canCorrect={competition.format !== 'advancement' && registrations.find(item => item.id === issue.registrationId)?.device === 'ordinary'} busy={busy} onResolve={(resolution, attempts) => act(() => resolveCompetitionDispute(issue.id, resolution, attempts))} /> : <p className="competition-muted">{t('等待 CubeRoot 处理。', 'Awaiting CubeRoot review.')}</p>}
    </div>)}
    {finalizedAt ? <div className="competition-finalized">
      <strong><Check size={18} aria-hidden />{t('成绩已定稿', 'Results finalized')}</strong>
      <time dateTime={finalizedAt}>{dateText(finalizedAt)}</time>
      <button type="button" className="competition-secondary" disabled={duel && !bracket?.generated} onClick={() => {
        const data = duel ? { standings: bracket?.standings, matches: bracket?.matches } : {
          results: registrations.filter(entry => entry.resultRecordedAt).map(entry => ({
            name: entry.displayName, project: entry.project, device: entry.device, attempts: entry.attempts,
          })),
        };
        downloadBlob(`competition-${competition.id}-results.json`, new Blob([JSON.stringify({ finalizedAt, ...data }, null, 2)], { type: 'application/json' }));
      }}>{t('导出成绩', 'Export results')}</button>
      <details><MoreToggle as="summary">{t('审计记录', 'Audit record')}</MoreToggle>
        <p>{t('成绩定稿', 'Results finalized')} · {dateText(finalizedAt)}</p>
        {disputes?.filter(issue => issue.resolvedAt).map(issue => <p key={issue.id}>{dateText(issue.resolvedAt!)} · {issue.resolution}</p>)}
        {settlement?.transfers?.map(transfer => <p key={transfer.id}>{dateText(transfer.transferredAt ?? transfer.createdAt)} · {money(transfer.amountMinor, settlement.currency)}</p>)}
      </details>
    </div> : competition.status === 'published' && <div className="competition-management-controls">
      <div><button type="button" className="competition-secondary" disabled={busy || !ended || !unfinished} onClick={() => { void act(() => closeCompetitionSessions(competition.id)); }}>{t('处理缺赛成绩', 'Close unfinished entries')}</button>
        <small className="competition-muted">{unfinished ? `${stillOpen} ${!ended ? t('赛期结束后解锁。', 'Available after the competition ends.') : ''}`
          : t('所有场次均已完成。', 'All sessions are complete.')}</small></div>
      {competition.canPublish && <div><button type="button" className="competition-secondary" disabled={busy || !canFinalize}
        onClick={() => { void act(() => finalizeCompetition(competition.id)); }}>{t('定稿比赛成绩', 'Finalize results')}</button>
        {!canFinalize && <small className="competition-muted">{unfinished ? stillOpen : unsettledDisputes
          ? t(`还有 ${unsettledDisputes} 项异议待处理。`, `${unsettledDisputes} disputes remain.`)
          : !disputes ? t('正在核对成绩异议。', 'Checking for result disputes.') : t('赛期结束后解锁。', 'Available after the competition ends.')}</small>}</div>}
    </div>}
    {(!competition.isTest || settlement || free) && <h3>{t('结算账单', 'Settlement statement')}</h3>}
    {free ? <div className="competition-free-statement">
      <p>{t('免费赛事 · 无需平台结算', 'Free event · no platform settlement')}</p>
      <span>{t('净收款', 'Net collected')} <strong>{money(0, settlement?.currency)}</strong></span>
    </div> : settlement && <><dl className="competition-statement"><div><dt>{t('净收款', 'Net collected')}</dt><dd>{money(Number(settlement.netCollectedMinor), settlement.currency)}</dd></div><div><dt>{t('已退款', 'Refunded')}</dt><dd>{money(Number(settlement.refundedMinor), settlement.currency)}</dd></div><div><dt>{t('平台费用', 'Platform fee')}</dt><dd>{settlement.commissionBps == null ? '—' : money(Number(settlement.platformFeeMinor), settlement.currency)}</dd></div><div><dt>{t('主办方应收', 'Organizer proceeds')}</dt><dd>{settlement.commissionBps == null ? '—' : money(Number(settlement.organizerAmountMinor), settlement.currency)}</dd></div><div><dt>{t('预计可结算时间', 'Eligible from')}</dt><dd>{settlement.eligibleAt ? dateText(settlement.eligibleAt) : '—'}</dd></div></dl>
      {missingTerms ? (competition.canPublish ? <details className="competition-rules">
        <MoreToggle as="summary">{t('配置结算条款', 'Configure settlement terms')}</MoreToggle>
        <form onSubmit={event => {
          event.preventDefault();
          if (settlementTerms) void act(() => configureCompetitionSettlement(competition.id, settlementTerms));
        }}>
          <div className="competition-form-grid">
            <label>{t('平台费率（%）', 'Platform fee (%)')}<input className="platform-field-control" type="number"
              min={0} max={100} step=".01" required value={terms.rate} onChange={event => setTerms({ ...terms, rate: event.target.value })} /></label>
            <label>{t('结算等待天数', 'Settlement delay (days)')}<input className="platform-field-control" type="number"
              min={0} max={3650} step={1} required value={terms.days} onChange={event => setTerms({ ...terms, days: event.target.value })} /></label>
            <label>{t('等待期起算时间', 'Delay starts at')}<select className="platform-field-control" value={terms.anchor} onChange={event => setTerms({ ...terms, anchor: event.target.value })}>
              <option value="finalized">{t('成绩定稿', 'Results finalized')}</option><option value="ended">{t('比赛结束', 'Event ended')}</option>
            </select></label>
          </div>
          <button type="submit" className="competition-secondary" disabled={busy || !settlementTerms}>{t('保存结算条款', 'Save settlement terms')}</button>
        </form>
      </details> : <p className="competition-muted">{t('等待 CubeRoot 配置结算条款。', 'Awaiting CubeRoot settlement configuration.')}</p>)
        : <p className="competition-muted">{recovery ? t('退款后存在应追回款项，请完成对账。', 'Refunds require a recovery payment and reconciliation.') : outstanding === 0 && settlement.transferStatus === 'recorded' ? t('当前款项已登记结清。', 'The current balance has been settled and recorded.') : settlement.eligible ? t('已满足结算条件，等待 CubeRoot 确认付款。', 'Eligible for settlement; awaiting CubeRoot payment confirmation.') : t('达到约定结算时间且成绩定稿后，方可结算。', 'Settlement requires finalized results and the agreed settlement date.')}</p>}
    </>}
    {settlement?.transfers?.length ? <><h3>{t('已登记的转账', 'Recorded transfers')}</h3>{settlement.transfers.map(transfer => <p className="competition-muted" key={transfer.id}>{dateText(transfer.transferredAt ?? transfer.createdAt)} {transfer.entryType === 'adjustment' ? t('退款调整', 'Refund adjustment') : transfer.entryType === 'recovery' ? t('已收回款项', 'Recovered funds') : t('已完成转账', 'Completed transfer')} {money(Number(transfer.amountMinor), settlement.currency)}</p>)}</> : null}
    {settlement?.reconciliationRequired ? <p role="alert" className="competition-error">{t('已登记转账与当前应结算金额不一致，请联系 CubeRoot 对账。', 'Recorded transfers differ from the current settlement amount. Contact CubeRoot for reconciliation.')}</p> : null}
    {competition.canPublish && settlement && outstanding !== 0 && (recovery || settlement.eligible) ? <details className="competition-rules"><MoreToggle as="summary">{recovery ? t('登记已收回款项', 'Record recovered funds') : t('登记已完成转账', 'Record a completed transfer')}</MoreToggle><p>{t('先在线下完成转账，再登记凭据。这项操作只记账。', 'Complete the transfer externally, then record its reference here. This action records the transfer only.')}</p><p>{recovery ? t('应收回金额：', 'Recovery amount: ') : t('应转账金额：', 'Transfer amount: ')}{money(Math.abs(outstanding), settlement.currency)}</p><div className="competition-form-grid"><label>{t('转账凭据编号', 'Transfer reference')}<input autoComplete="off" className="platform-field-control" maxLength={200} value={providerReference} onChange={event => setProviderReference(event.target.value)} /></label><label>{t('实际转账时间（北京时间）', 'Actual transfer time (UTC+8)')}<input className="platform-field-control" type="datetime-local" value={transferredAt} onChange={event => setTransferredAt(event.target.value)} /></label></div><BoolToggle value={transferConfirmed} onChange={setTransferConfirmed} label={t('我已核对收款方、金额与转账凭据', 'I verified the recipient, amount and transfer reference')} /><button type="button" className="competition-secondary" disabled={busy || !providerReference.trim() || !transferredAt || !Number.isFinite(Date.parse(`${transferredAt}:00+08:00`)) || Date.parse(`${transferredAt}:00+08:00`) > now || !transferConfirmed} onClick={() => { void act(() => recordCompetitionSettlement(competition.id, { amountMinor: Math.abs(outstanding), direction: recovery ? 'recovery' : 'payout', providerReference: providerReference.trim(), transferredAt: isoDate(transferredAt) })); }}>{t('确认登记', 'Record transfer')}</button></details> : null}
    {error ? <p className="competition-error" role="alert">{error}</p> : null}{saved ? <p role="status" className="competition-muted">{saved}</p> : null}
  </section>;
}

type AttemptInput = { seconds: string; penalty: CompetitionResult['attempts'][number]['penalty'] };
function editableAttempts(initial?: CompetitionResult['attempts'] | null): AttemptInput[] {
  return Array.from({ length: 5 }, (_, index) => {
    const recorded = initial?.[index];
    return { seconds: recorded?.centiseconds != null ? String(recorded.centiseconds / 100) : '', penalty: recorded?.penalty ?? 'none' };
  });
}
function parseAttemptInputs(rows: AttemptInput[]): CompetitionResult['attempts'] | undefined {
  if (rows.some(item => !['DNF', 'DNS'].includes(item.penalty) &&
    (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(item.seconds) || Number(item.seconds) <= 0 || Number(item.seconds) > 86400))) return undefined;
  return rows.map(item => ({ centiseconds: ['DNF', 'DNS'].includes(item.penalty) ? null : Math.round(Number(item.seconds) * 100), penalty: item.penalty }));
}
function AttemptInputs({ rows, onChange }: { rows: AttemptInput[]; onChange: (rows: AttemptInput[]) => void }) {
  const t = useT();
  const penalties = [{ value: 'none', label: t('无罚时', 'No penalty') }, { value: '+2', label: '+2' }, { value: 'DNF', label: 'DNF' }, { value: 'DNS', label: 'DNS' }];
  const update = (index: number, value: Partial<AttemptInput>) => onChange(rows.map((item, i) => i === index ? { ...item, ...value } : item));
  return <div className="competition-offline-attempts">{rows.map((item, index) => <div key={index} className="competition-score-form">
    <label>{t(`第 ${index + 1} 把（秒）`, `Attempt ${index + 1} (seconds)`)}<input className="platform-field-control" type="number" step="0.01" min="0.01" max={86400} disabled={['DNF', 'DNS'].includes(item.penalty)} value={item.seconds} onChange={event => update(index, { seconds: event.target.value })} /></label>
    <CompactSelect value={item.penalty} label={penalties.find(value => value.value === item.penalty)!.label} items={penalties}
      ariaLabel={t(`第 ${index + 1} 把罚时`, `Penalty for attempt ${index + 1}`)} onChange={value => update(index, { penalty: value as AttemptInput['penalty'] })} />
  </div>)}</div>;
}
function DisputeResolutionForm({ busy, canCorrect, onResolve }: { busy: boolean; canCorrect: boolean; onResolve: (resolution: string, attempts?: CompetitionResult['attempts']) => Promise<void> }) {
  const t = useT();
  const [resolution, setResolution] = useState('');
  const [correct, setCorrect] = useState(false);
  const [attempts, setAttempts] = useState(() => editableAttempts());
  const scores = correct ? parseAttemptInputs(attempts) : undefined;
  return <div><label className="competition-field">{t('处理说明', 'Resolution')}<textarea autoComplete="off" rows={3} className="platform-field-control" maxLength={4000} value={resolution} onChange={event => setResolution(event.target.value)} /></label>
    {canCorrect && <BoolToggle value={correct} onChange={setCorrect} label={t('根据复核结果更正成绩', 'Correct the result after review')} />}
    {correct && <AttemptInputs rows={attempts} onChange={setAttempts} />}
    <button type="button" className="competition-secondary" disabled={busy || !resolution.trim() || (correct && !scores)} onClick={() => { void onResolve(resolution.trim(), scores); }}>{t('确认处理', 'Resolve dispute')}</button>
  </div>;
}
function OfflineResults({ registrations, busy, onRecord }: {
  registrations: CompetitionRegistration[]; busy: boolean;
  onRecord: (id: string, attempts: CompetitionResult['attempts']) => Promise<void>;
}) {
  const t = useT();
  const lang = useLang();
  const competitorId = useId();
  const [id, setId] = useState('');
  const [attempts, setAttempts] = useState(() => editableAttempts());
  const active = registrations.filter(r => r.device === 'ordinary' && ['confirmed', 'attended'].includes(r.status));
  const scores = parseAttemptInputs(attempts);
  const fieldLabel = t('参赛选手', 'Competitor');
  const placeholder = t('选择参赛选手', 'Choose a competitor');
  const items = [{ value: '', label: placeholder }, ...active.map(entry => ({
    value: entry.id,
    label: `${entry.displayName} · ${eventDisplayName(entry.project, lang === 'zh')} · ${competitionDeviceName(entry.device, t)}`,
  }))];
  const selectedLabel = items.find(item => item.value === id)?.label ?? placeholder;
  return <details className="competition-rules">
    <MoreToggle as="summary">{t('录入线下成绩', 'Record in-person results')}</MoreToggle>
    <div className="competition-field">
      <label htmlFor={competitorId}>{fieldLabel}</label>
      <CompactSelect id={competitorId} ariaLabel={fieldLabel} valueText={selectedLabel}
        value={id} label={selectedLabel} items={items} showArrow onChange={selected => {
          setId(selected);
          setAttempts(editableAttempts(active.find(entry => entry.id === selected)?.attempts));
        }} />
    </div>
    {id && <><AttemptInputs rows={attempts} onChange={setAttempts} />
      <button className="competition-primary" type="button" disabled={busy || !scores} onClick={() => { if (scores) void onRecord(id, scores); }}>{t('保存五把成绩', 'Save all five attempts')}</button></>}
  </details>;
}

function CompetitionEvidenceFiles({ registrationId, canUpload, attemptNumber, onFilesChange }: {
  registrationId: string; canUpload: boolean; attemptNumber?: number; onFilesChange?: (files: CompetitionEvidence[]) => void;
}) {
  const t = useT();
  const [playback, setPlayback] = useState<string | null>(null);
  const [files, setFiles] = useState<CompetitionEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    void listCompetitionEvidence(registrationId).then(result => { if (active) { setFiles(result.evidence); onFilesChange?.(result.evidence); } })
      .catch(error => { if (active) setError(message(error, t('复核录像加载失败。', 'Could not load review recordings.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [registrationId, t, onFilesChange]);
  async function upload(file: File) {
    setError('');
    if (file.size <= 0 || file.size > 64 * 1024 * 1024 || !['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      setError(t('请选择不超过 64 MiB 的 MP4、WebM 或 MOV 录像。', 'Choose an MP4, WebM or MOV recording up to 64 MiB.')); return;
    }
    setBusy(true);
    try {
      const updated = await uploadCompetitionEvidence(registrationId, file, attemptNumber);
      setFiles(updated.evidence);
      onFilesChange?.(updated.evidence);
    }
    catch (error) { setError(message(error, t('录像上传失败。', 'Could not upload recording.'))); }
    finally { setBusy(false); }
  }
  async function play(file: CompetitionEvidence) {
    setBusy(true); setError('');
    try { setPlayback(await competitionEvidencePlayback(file.id)); }
    catch (error) { setError(message(error, t('录像播放链接不可用。', 'The recording playback link is unavailable.'))); }
    finally { setBusy(false); }
  }
  async function download(file: CompetitionEvidence) {
    setBusy(true); setError('');
    try {
      const blob = await downloadCompetitionEvidence(file.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `competition-review-${file.id}.${file.mime === 'video/webm' ? 'webm' : file.mime === 'video/quicktime' ? 'mov' : 'mp4'}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setError(message(error, t('录像下载失败。', 'Could not download recording.'))); }
    finally { setBusy(false); }
  }
  return <details className="competition-rules"><MoreToggle as="summary">{t('复核录像', 'Review recordings')}</MoreToggle><p>{t('仅参赛选手、指定监督员、获授权的主办方与 CubeRoot 审核人员可查看。通常保留 30 天，未结异议期间继续保留。', 'Visible only to the competitor, assigned supervisor, authorized organizers and CubeRoot reviewers. Retained for 30 days, or longer while a dispute remains unresolved.')}</p>
    {loading ? <p role="status"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p> : files.length ? files.map(file => <div className="competition-toolbar" key={file.id}><span>{dateText(file.createdAt)} {Math.ceil(Number(file.sizeBytes) / 1024 / 1024)} MiB{file.attemptNumber ? t(` · 第 ${file.attemptNumber} 把`, ` · Attempt ${file.attemptNumber}`) : ''}</span><button type="button" className="competition-secondary" disabled={busy} onClick={() => void play(file)}>{t('播放录像', 'Play recording')}</button><button type="button" className="competition-secondary" disabled={busy} onClick={() => { void download(file); }}>{t('下载录像', 'Download recording')}</button></div>) : <p>{t('尚未上传复核录像。', 'No review recordings uploaded.')}</p>}
    {playback && <video key={playback} className="competition-evidence-video" controls playsInline preload="metadata" src={playback}
      aria-label={t('私密复核录像', 'Private review recording')} />}
    {canUpload ? <label className="competition-field">{attemptNumber ? t(`上传第 ${attemptNumber} 把的抽检片段`, `Upload the review clip for attempt ${attemptNumber}`) : t('上传争议复核片段', 'Upload a dispute review clip')}<input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={busy || loading || files.length >= 2} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /><small>{t('最多 2 个文件，每个不超过 64 MiB。', 'Up to 2 files, 64 MiB each.')}</small></label> : null}
    {busy ? <p role="status">{t('正在处理录像…', 'Processing recording…')}</p> : null}{error ? <p role="alert" className="competition-error">{error}</p> : null}
  </details>;
}
