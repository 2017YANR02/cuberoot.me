'use client';

import MoreToggle from '@/components/MoreToggle';
import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { Check, ChevronRight, Plus, RefreshCw } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { COMPETITIONS_PATH as ROOT, COMPETITION_WORKSPACES, competitionHref as href, competitionWorkspaceHref as workspaceHref, type CompetitionWorkspaceMode } from '@/lib/competition-links';
import { competitionDateTime as dateText, competitionDateIso as isoDate } from '@/lib/competition-date';
import { CompetitionDraftForm, competitionDeviceName, competitionFormatName, competitionModeName } from './CompetitionDraftForm';
import { createCompetitionSlug } from './competition-slug';
import { CompetitionReviewQueue } from './CompetitionReviewQueue';
import { CompetitionBracket } from './CompetitionBracket';
import { CompetitionPreflight } from './CompetitionPreflight';
import { formatDateRangeIso } from '@cuberoot/shared/iso-date';
import { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import PersonLink from '@/components/PersonLink';
import { Flag } from '@/components/Flag';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { CompetitionHostAccessContext, useCompetitionRole } from '@/hooks/useCompetitionRole';
import { hasAdminAccess, nextQuery, useAuthUser } from '@/lib/auth-store';
import { useLang } from '@/i18n/tr';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { CompetitionScramble } from './CompetitionScramble';
import { CompetitionSelfTimer } from './CompetitionSelfTimer';
import { CompetitionSupervisionDesk } from './CompetitionSupervisionDesk';
import { CompetitionRank, CompetitionReport, CompetitionReportShare, type ReportData } from './CompetitionReport';
import { attemptValue, competitionAo5 } from './competition-results';
import { listTeachingOrganizations, type TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import {
  checkInCompetition, createCompetitionOrder, completeCompetitionSelfAttempt, reviewCompetitionSelfAttempt, nextCompetitionSelfAttempt, recordOfflineCompetitionResults,
  getOnlineCompetition, listCompetitionRegistrations, listOnlineCompetitions, listSupervisedCompetitions,
  getCompetitionAttempts, nextCompetitionAttempt, recordCompetitionAttempt, finalizeCompetitionRegistration, listCompetitionResults, raiseCompetitionDispute, type CompetitionAttempt, type CompetitionSelfResult, type CompetitionResult, type CompetitionProject, type CompetitionRegistration, type OnlineCompetition,
  listCompetitionDisputes, resolveCompetitionDispute, finalizeCompetition, closeCompetitionSessions, getCompetitionSettlement, recordCompetitionSettlement, type CompetitionDispute, type CompetitionSettlement,
  listCompetitionEvidence, uploadCompetitionEvidence, downloadCompetitionEvidence, competitionEvidencePlayback, getCompetitionAttemptReplay, type CompetitionEvidence,
  listOrganizerApplications, listOrganizerReviewQueue, submitOrganizerApplication, reviewOrganizerApplication, type OrganizerAccess, type OrganizerApplication,
  type OnlineCompetitionSummary,
} from '@/lib/online-competition-api';
import dynamic from 'next/dynamic';
import { PlatformState } from '@/components/platform/PlatformState';

const CompetitionVideoRoom = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionVideoRoom),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const CompetitionSelfRecording = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionSelfRecording),
  { ssr: false, loading: () => <PlatformState kind="loading" /> });
const AlgPlayer = dynamic(() => import('@/components/AlgPlayer').then(module => module.default), { ssr: false });
import './online-competitions.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const money = (minor: number, currency = 'CNY') => new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(minor / 100);
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

export function OnlineCompetitions({ id, mode = 'browse', initialReview = 'events' }: {
  id?: string; mode?: CompetitionMode; initialReview?: 'events' | 'organizers';
}) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const admin = hasAdminAccess(user);
  const insideHost = useContext(CompetitionHostAccessContext);
  const requiredRole = mode === 'supervise' ? 'supervisor' : mode === 'manage' && !admin && !insideHost ? 'organizer' : null;
  const access = useCompetitionRole(requiredRole);
  if (mode !== 'browse' && !user) {
    return <PlatformState kind="permission" permissionHref={`/account${nextQuery((lang === 'zh' ? '/zh' : '') + workspaceHref(mode, id))}`} />;
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
  if (mode === 'create') return <div className="competitions"><CompetitionOrganizerEditor key={user?.uid ?? user?.wcaId} mode={mode} /></div>;
  return id ? <CompetitionDetail key={`${mode}:${id}:${user?.uid ?? user?.wcaId ?? "guest"}`} id={id} view={mode === 'manage' || mode === 'supervise' ? mode : 'entry'} />
    : <CompetitionList mode={mode} initialReview={initialReview} />;
}

function CompetitionList({ mode: view, initialReview }: { mode: Exclude<CompetitionMode, 'create'>; initialReview: 'events' | 'organizers' }) {
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
    return (
      <AppLink prefetch={false} className="competition-list-row" data-public={browsing || undefined} key={item.id} href={target}>
        <div>
          <div className="competition-labels">
            <span className="competition-state" data-status={status}>{statusLabel(status, t)}</span>
            <span className="competition-meta">{competitionModeName(item.supervisionMode ?? 'supervised', t)} · {competitionFormatName(item.format ?? item.setup?.format ?? 'average', t)}</span>
          </div>
          <h2>{t(item.titleZh || item.titleEn, item.titleEn || item.titleZh)}</h2>
          <p>{formatDateRangeIso(dateText(item.startsAt).slice(0, 10), dateText(item.endsAt).slice(0, 10))} · {item.organizationName}</p>
          {item.projects.length > 0 && <div className="competition-list-events">
            {item.projects.map(project => <span key={project.id}><EventIcon event={project.project} />
              {eventDisplayName(project.project, lang === 'zh')} · {competitionDeviceName(project.device, t)}
            </span>)}
            <span className="competition-list-fee">{item.projects.every(project => project.amountMinor === 0) ? t('免费参赛', 'Free entry') : <>{money(Math.min(...item.projects.map(project => project.amountMinor)), item.projects[0].currency)} {t('起', 'and up')}</>}</span>
          </div>}
        </div>
        {browsing ? <span className="competition-list-action">{action} <ChevronRight size={16} aria-hidden /></span> : <ChevronRight size={20} aria-hidden />}
      </AppLink>
    );
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
      <AppLink href={workspaceHref('create')} className="competition-primary" prefetch={false}><Plus size={16} aria-hidden />{t('创建比赛', 'Create a competition')}</AppLink>
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

function CompetitionDetail({ id, view }: { id: string; view: 'entry' | 'manage' | 'supervise' }) {
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
  const selection = JSON.stringify([ticketId, sessionId]);
  type RegistrationForm = { selection: string; accepted: boolean; orderId: string; error: string };
  const [form, setForm] = useState<RegistrationForm | null>(null);
  const currentForm = form?.selection === selection ? form : null;
  const accepted = currentForm?.accepted ?? false;
  const orderId = currentForm?.orderId ?? '';
  const registrationError = currentForm?.error ?? '';
  function updateForm(patch: Partial<Omit<RegistrationForm, 'selection'>>) {
    setForm(current => ({
      ...(current?.selection === selection ? current : { selection, accepted: false, orderId: '', error: '' }),
      ...patch,
    }));
  }
  const registerPending = useRef(false);
  const projectChoices = useRef<HTMLDivElement>(null);
  const sessionChoices = useRef<HTMLDivElement>(null);
  const rulesConsent = useRef<HTMLDivElement>(null);
  const [mobileBar, setMobileBar] = useState<HTMLDivElement | null>(null);
  const [mobileBarHeight, setMobileBarHeight] = useState(0);
  useEffect(() => {
    if (!mobileBar || typeof ResizeObserver === 'undefined') return;
    const measure = () => setMobileBarHeight(Math.ceil(mobileBar.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(mobileBar);
    measure();
    return () => observer.disconnect();
  }, [mobileBar]);
  const [autoJoinVideo, setAutoJoinVideo] = useState(false);
  const [activeRegistration, setActiveRegistration] = useQueryState('entry', parseAsString.withDefault('').withOptions({ history: 'push' }));
  const [now, setNow] = useState(0);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { setForm(current => current?.selection === selection ? current : null); }, [selection]);
  useEffect(() => { setRegistrations([]); setForm(null); }, [id, user?.uid]);
  useEffect(() => { setCompetition(null); }, [id]);
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
  async function register(project: CompetitionProject, selectedSessionId: string) {
    if (registerPending.current || busy || !accepted || !selectedSessionId) return;
    registerPending.current = true;
    setBusy(true); updateForm({ error: '' });
    try {
      const result = await createCompetitionOrder(project, selectedSessionId);
      const createdId = result.order?.id ?? result.id ?? result.resourceId;
      if (!createdId) throw new Error(t('订单已提交，请到我的订单查看付款状态。', 'Order submitted. Check My orders for payment status.'));
      updateForm({ orderId: createdId }); refresh();
    } catch (error) { updateForm({ error: message(error, t('报名未完成，请重试。', 'Registration did not complete. Try again.')) }); }
    finally { registerPending.current = false; setBusy(false); }
  }
  async function checkIn(registrationId: string) {
    setBusy(true); updateForm({ error: '' });
    try {
      await checkInCompetition(registrationId);
      if (competition?.format !== 'advancement') void setActiveRegistration(registrationId);
      refresh();
    }
    catch (error) { updateForm({ error: message(error, t('检录未完成，请重试。', 'Check-in did not complete. Try again.')) }); }
    finally { setBusy(false); }
  }
  if (loading && !competition) return <div className="competitions"><p role="status"><LoadingIndicator>{t('正在加载比赛…', 'Loading competition…')}</LoadingIndicator></p></div>;
  if (!competition) return <div className="competitions"><p role="alert">{error || t('没有找到这场比赛。', 'Competition not found.')}</p><button className="competition-secondary" type="button" onClick={refresh}>{t('重试', 'Retry')}</button></div>;
  if ((view === 'manage' && !competition.canManage) || (view === 'supervise' && !competition.canSupervise)) return <PlatformState kind="permission" message={t('当前账号没有此赛事的管理权限。', 'This account does not have access to manage this competition.')} permissionHref={ROOT} permissionLabel={t('查看公开比赛', 'View public competitions')} />;
  const project = competition.projects.find(item => item.id === ticketId) ?? (competition.projects.length === 1 ? competition.projects[0] : undefined);
  const supervision = competition.supervisionMode ?? 'supervised';
  const supervised = supervision === 'supervised';
  const session = supervised ? competition.sessions.find(item => item.id === sessionId) : competition.sessions[0];
  const reservationExpired = (entry: CompetitionRegistration) => ['reserved', 'pending_payment'].includes(entry.status)
    && !!entry.reservationExpiresAt && Date.parse(entry.reservationExpiresAt) <= now;
  const registrationFor = (ticket: CompetitionProject) => registrations.find(item => item.userId === user?.uid
    && item.project === ticket.project && item.device === ticket.device
    && ['reserved', 'pending_payment', 'confirmed', 'attended'].includes(item.status) && !reservationExpired(item));
  const existingRegistration = project && registrationFor(project);
  const status = publicCompetitionStatus(competition, now);
  const registrationOpen = status === 'registration_open';
  const draftPreview = view === 'entry' && competition.status === 'draft' && competition.canManage;
  const reviewState = view === 'manage' && status === 'draft' ? competition.reviewStatus ?? status : status;
  const sessionAvailable = !!session && session.available > 0 && (!supervised || (session.staffed && now < Date.parse(session.startsAt)));
  const canRegister = registrationOpen && !existingRegistration && project && project.available !== 0 && sessionAvailable && accepted && !busy && !orderId;
  const participant = view === 'entry';
  const selectedRegistration = competition.format === 'advancement' && participant ? undefined : registrations.find(item =>
    item.id === activeRegistration && (item.checkedInAt || item.resultRecordedAt) &&
    (item.userId === user?.uid || item.canRecordResult || (!participant && item.canJoinVideo)));
  const settingUp = view === 'manage' && ['draft', 'pending_approval'].includes(competition.status);
  const showRegistration = participant && (registrationOpen || draftPreview) && !selectedRegistration && (!user || registrationsLoaded)
    && competition.projects.some(ticket => !registrationFor(ticket));
  const assignedSessions = new Set(competition.sessions.filter(item => item.supervisorUserId === user?.uid).map(item => item.id));
  const entries = user && (!participant || registrations.length > 0) ? <section className="competition-registrations">
    <h2>{participant ? t('参赛安排', 'Your entries') : t('参赛名单', 'Competitors')}</h2>
    {!registrations.length ? <p className="competition-muted">{t('还没有报名记录。', 'No registrations yet.')}</p> : registrations.map(item => {
      const own = item.userId === user.uid;
      const expired = reservationExpired(item);
      const pendingPayment = ['reserved', 'pending_payment'].includes(item.status) && !expired;
      const assignedSession = competition.sessions.find(session => session.id === item.sessionId);
      return <div className="competition-registration" key={item.id}>
        <div>
          {!participant && <strong>{item.displayName}</strong>}
          {item.reviewRequired && <p>{t('待抽检', 'Review flagged')}</p>}
          <p>{eventDisplayName(item.project, lang === 'zh')} {item.device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube')}</p>
          {assignedSession && <p>{dateText(assignedSession.startsAt)} {t('北京时间', 'UTC+8')}</p>}
        </div>
        <span>{statusLabel(expired ? 'expired' : item.status, t)}</span>
        <div className="competition-toolbar">
          {item.orderId && own && (
            <AppLink className={participant && pendingPayment ? 'competition-primary' : undefined} href={`/platform/orders/${encodeURIComponent(item.orderId)}`} prefetch={false}>
              {participant && pendingPayment ? t('继续付款', 'Continue to payment') : t('订单', 'Order')}
            </AppLink>
          )}
          {item.canCheckIn && !item.checkedInAt && <button type="button" className={participant ? 'competition-primary' : 'competition-secondary'} disabled={busy} onClick={() => { void checkIn(item.id); }}>{t('检录', 'Check in')}</button>}
          {competition.format !== 'advancement' && (item.checkedInAt || item.resultRecordedAt) && (own || item.canRecordResult) && (!participant || item.resultRecordedAt || (assignedSession && now < Date.parse(assignedSession.endsAt))) && <button type="button" className={participant ? 'competition-primary' : 'competition-secondary'} onClick={() => { void setActiveRegistration(item.id); }}>{item.resultRecordedAt ? t('查看成绩', 'View result') : t('进入赛场', 'Enter session')}</button>}
          {competition.format === 'advancement' && !participant && item.canJoinVideo && <button type="button" className="competition-secondary"
            onClick={() => { void setActiveRegistration(item.id); }}>{t('进入监督视频', 'Join supervision video')}</button>}
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
      ? entry.canJoinVideo
        ? <CompetitionVideoRoom key={entry.id} registrationId={entry.id} {...video} />
        : <p className="competition-muted">{t('监督视频在场次开放后可用。', 'Supervision video is available during the session.')}</p>
      : <CompetitionParticipation key={entry.id} competition={event} registration={entry}
          endsAt={event.sessions.find(item => item.id === entry.sessionId)?.endsAt} onSaved={refresh}
          resultRevision={revision} supervising={supervising} video={video} />;
  }
  const participation = selectedRegistration && renderParticipation(selectedRegistration);

  function focusRegistration(target: HTMLDivElement | null, issue: string, selector = 'button:not(:disabled)') {
    updateForm({ error: issue });
    target?.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    (target?.querySelector<HTMLElement>(selector) ?? target)?.focus({ preventScroll: true });
  }

  function confirmRegistration(mobile: boolean) {
    if (project && session && canRegister) {
      void register(project, session.id);
      return;
    }
    if (!mobile || busy) return;
    if (!project || project.available === 0) {
      focusRegistration(projectChoices.current, t('请选择仍有余位的参赛项目。', 'Choose an event with an available place.'), '[data-ticket-available]');
    } else if (!sessionAvailable) {
      focusRegistration(sessionChoices.current ?? rulesConsent.current,
        supervised ? t('请选择仍有余位的监督场次。', 'Choose a supervised session with an available place.')
          : t('当前场次已满，请稍后查看。', 'This session is full. Check again later.'));
    } else if (!accepted) {
      focusRegistration(rulesConsent.current, t('请先同意参赛与退款规则。', 'Agree to the participation and refund policies first.'), '[role="switch"]');
    }
  }

  const loginHref = `/account${nextQuery(`${lang === 'zh' ? '/zh' : ''}${href(id)}${ticketId || sessionId ? `?${new URLSearchParams({ ...(ticketId ? { project: ticketId } : {}), ...(sessionId ? { session: sessionId } : {}) })}` : ''}`)}`;
  const registrationAction = (mobile: boolean) => !user
    ? <AppLink className="competition-primary" href={loginHref}>{t('登录报名', 'Sign in to register')}</AppLink>
    : (orderId || existingRegistration?.orderId)
      ? <AppLink className="competition-primary" prefetch={false} href={`/platform/orders/${encodeURIComponent(orderId || existingRegistration!.orderId)}`}>{existingRegistration && !['reserved', 'pending_payment'].includes(existingRegistration.status) ? t('查看报名订单', 'View order') : t('查看订单与付款', 'View order and pay')}</AppLink>
      : <button type="button" className="competition-primary" disabled={mobile ? busy : !canRegister} onClick={() => confirmRegistration(mobile)}>
          {busy ? t('正在提交…', 'Submitting…') : t('确认报名', 'Register')}
        </button>;

  const rules = <details className="competition-rules"><MoreToggle as="summary">{t('参赛与退款规则', 'Participation and refund policies')}</MoreToggle><p>{t('普通魔方与智能魔方分别排名。', 'Standard and smart cubes are ranked separately.')}</p><h3>{t('退款政策', 'Refund policy')}</h3><p>{competition.refundPolicy || t('尚未公布', 'Not yet published')}</p><h3>{t('录像与争议处理', 'Recording and disputes')}</h3><p>{competition.recordingPolicy || t('尚未公布', 'Not yet published')}</p></details>;
  return <div className="competitions" data-mobile-registration={showRegistration && registrationOpen || undefined}
    style={showRegistration && registrationOpen && mobileBarHeight ? { paddingBlockEnd: mobileBarHeight } : undefined}>
    {error ? <p role="alert" className="competition-error">{error}</p> : null}
    <header className="competition-heading competition-detail-heading"><span className="competition-state" data-status={reviewState}>{statusLabel(reviewState, t)}</span><span className="competition-meta">{competitionModeName(supervision, t)} · {competitionFormatName(competition.format ?? 'average', t)}</span><h1>{t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh)}</h1><p>{dateText(competition.startsAt)} — {dateText(competition.endsAt)} {t('北京时间', 'UTC+8')}</p><p>{competition.organizationName}</p>
      {participant && status === 'registration_upcoming' && <>
        {competition.projects.length > 0 && <p>{competitionProjectSummary(competition.projects, lang, t)}</p>}
        <p>{t('报名开始', 'Registration opens')} {dateText(competition.registrationOpensAt)} {t('北京时间', 'UTC+8')}</p>
      </>}
    </header>
    {!participant && <div className="competition-toolbar"><AppLink href={workspaceHref(view)} prefetch={false}>{t(COMPETITION_WORKSPACES[view].title.zh, COMPETITION_WORKSPACES[view].title.en)}</AppLink>{view === 'manage' && <AppLink className="competition-secondary" href={href(id)} prefetch={false}>{t('查看报名页', 'View registration')}</AppLink>}{view === 'supervise' && <AppLink className="competition-secondary" href={href(id)} prefetch={false}>{t('公开赛事页', 'Public competition page')}</AppLink>}<button type="button" className="competition-icon-button" aria-label={t('刷新赛事', 'Refresh competition')} onClick={refresh}><RefreshCw size={17} /></button></div>}
    {participant && (participation ? <>
      <button type="button" className="competition-secondary" onClick={() => { void setActiveRegistration(null); }}>{t('参赛安排', 'Your entries')}</button>
      {participation}
    </> : entries)}
    {registrationError && !showRegistration && <p className="competition-error" role="alert">{registrationError}</p>}
    {registrationLoadError && <div className="competition-error" role="alert">
      <p>{registrationLoadError}</p>
      <button type="button" onClick={refresh} className="competition-secondary">{t('重试', 'Retry')}</button>
    </div>}
    {settingUp && competition.canManage ? <CompetitionDraftForm key={competition.id} competition={competition} onSaved={refresh} />
    : showRegistration ? <div className="competition-detail-grid">
      <section>
        <h2>{t('选择参赛项目', 'Choose an event')}</h2>
        <div ref={projectChoices} className="competition-projects" tabIndex={-1}>{competition.projects.map(item =>
          <button type="button" key={item.id} className="competition-project" aria-pressed={project?.id === item.id}
            data-ticket-available={item.available !== 0 || undefined} disabled={busy} onClick={() => { void setTicketId(item.id); }}>
            <EventIcon event={item.project} />
            <span>{eventDisplayName(item.project, lang === 'zh')}<small>{competitionDeviceName(item.device, t)}</small></span>
            <strong>{money(item.amountMinor, item.currency)}
              {item.available !== undefined && <small data-low={item.available <= item.capacity * .2 || undefined}>{item.available
                ? t(`余 ${item.available} 位`, `${item.available} places left`) : t('已满', 'Full')}</small>}
            </strong>
          </button>)}</div>
        {!competition.projects.length && <p className="competition-muted">{t('项目尚未公布。', 'Events have not been announced.')}</p>}
        {supervised ? <>
        <h3>{t('选择监督场次', 'Choose a supervised session')}</h3>
        <div ref={sessionChoices} className="competition-sessions" tabIndex={-1}>{competition.sessions.map(item => <button className="competition-session" type="button" key={item.id} aria-pressed={session?.id === item.id} disabled={busy || item.available <= 0 || !item.staffed || now >= Date.parse(item.startsAt)} onClick={() => { void setSessionId(item.id); }}><span><strong>{dateText(item.startsAt)}</strong><small>{t('至', 'Until')} {dateText(item.endsAt)}</small></span><span className="competition-session-availability" data-low={item.staffed && now < Date.parse(item.startsAt) && item.available <= item.capacity * .2 || undefined}>{now >= Date.parse(item.startsAt) ? t('已开始', 'Started') : !item.staffed ? t('待排班', 'Unassigned') : item.available <= 0 ? t('已满', 'Full') : t(`余 ${item.available} 位`, `${item.available} places`)}{session?.id === item.id ? <Check size={17} /> : null}</span></button>)}</div>
        {!competition.sessions.length ? <p className="competition-muted">{t('监督场次尚未公布。', 'Sessions have not been announced.')}</p> : null}
        </> : supervision === 'self_service'
          ? <p className="competition-muted">{t('赛期内可随时检录并完成比赛。', 'Check in and compete any time during the competition window.')}</p>
          : competition.offlineVenue && <CompetitionVenue venue={competition.offlineVenue} />}
        {rules}
      </section>
      <aside className="competition-entry" data-site-surface="panel"><h2>{t('确认报名', 'Registration')}</h2>
        {project ? <p className="competition-fee">{money(project.amountMinor, project.currency)}<small>{project.amountMinor === 0 ? t('免费参赛', 'Free entry') : t('CubeRoot 统一收款', 'Collected by CubeRoot')}</small></p> : <p>{supervised ? t('请先选择项目和场次。', 'Choose an event and session first.') : t('请先选择参赛项目。', 'Choose an event first.')}</p>}

        {project && !draftPreview && <CompetitionPreflight mode={supervision} device={project.device} />}
        {draftPreview ? <p>{t('赛事预览', 'Competition preview')}</p> : <>
          {user && !orderId && !existingRegistration?.orderId && <div ref={rulesConsent} tabIndex={-1}>
            <BoolToggle value={accepted} onChange={value => updateForm({ accepted: value, error: '' })} label={t('同意参赛与退款规则', 'I agree to the participation and refund policies')} />
          </div>}
          <div className="competition-desktop-registration">{registrationAction(false)}</div>
        </>}
        {registrationError && <p className="competition-error competition-desktop-registration" role="alert">{registrationError}</p>}
        <p className="competition-muted competition-deadline">{t('报名截止', 'Registration closes')} {dateText(competition.registrationClosesAt)}</p>
      </aside>
    </div> : null}
    {showRegistration && registrationOpen && <div ref={setMobileBar} className="competition-mobile-registration" data-site-surface="panel">
      {registrationError && <p className="competition-error competition-mobile-registration-error" role="alert">{registrationError}</p>}
      <span>{project ? <><span>{eventDisplayName(project.project, lang === 'zh')}</span><strong>{money(project.amountMinor, project.currency)}</strong></>
        : t('选择参赛项目', 'Choose an event')}</span>
      {registrationAction(true)}
    </div>}
    {participant && !showRegistration && !selectedRegistration && competition.offlineVenue && <CompetitionVenue venue={competition.offlineVenue} />}
    {participant && !selectedRegistration && !showRegistration && rules}
    {view === 'manage' && !settingUp && <>{entries}{participation}</>}
    {view === 'supervise' && <CompetitionSupervisionDesk
      entries={registrations.filter(item => assignedSessions.has(item.sessionId) && ['confirmed', 'attended'].includes(item.status))}
      activeId={activeRegistration} onSelect={id => { void setActiveRegistration(id); }}
      renderSeat={entry => renderParticipation(entry, true)} />}
    {competition.format === 'advancement' && ['published', 'completed'].includes(competition.status) && !selectedRegistration && view !== 'supervise' &&
      <CompetitionBracket competition={competition} registrations={participant ? registrations : []} manage={view === 'manage'}
        allowGeneration={competition.status === 'published' && now >= Date.parse(competition.registrationClosesAt)} />}
    {participant && competition.format === 'advancement' && status === 'provisional_results' && !competition.finalizedAt &&
      registrations.filter(item => ['confirmed', 'attended'].includes(item.status)).map(item => <div key={item.id} className="competition-bracket-dispute">
        <h3>{eventDisplayName(item.project, lang === 'zh')} · {competitionDeviceName(item.device, t)}</h3>
        <CompetitionDisputeForm registrationId={item.id} onSaved={refresh} />
        <CompetitionEvidenceFiles registrationId={item.id} canUpload />
      </div>)}
    {competition.format !== 'advancement' && view !== 'supervise' && ['published', 'completed'].includes(competition.status) && (!participant || (!selectedRegistration && (['completed', 'provisional_results'].includes(status) || now >= Date.parse(competition.startsAt))))
      ? <CompetitionResults competition={competition} revision={revision} ownEntries={participant ? registrations : []} /> : null}
    {view === 'manage' && !settingUp && competition.canManage ? <CompetitionManagement competition={competition} registrations={registrations} revision={revision} onSaved={refresh} /> : null}
  </div>;
}

function CompetitionVenue({ venue }: { venue: NonNullable<OnlineCompetition['offlineVenue']> }) {
  const t = useT();
  return <section className="competition-venue" data-site-surface="panel">
    <h3>{t('场馆与签到', 'Venue and check-in')}</h3><p>{venue.city} · {venue.address}</p>
    {venue.contact && <p>{venue.contact}</p>}{venue.checkinGuide && <p>{venue.checkinGuide}</p>}
  </section>;
}

function CompetitionOrganizerEditor({ mode }: { mode: 'create' | 'apply' | 'review' }) {
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
  if (mode === 'create' && approved.length) return <CompetitionDraftForm organizers={approved} />;
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
  const ownSmartEntry = registration.userId === user?.uid && registration.device === 'smart' && registration.project === '333' && registration.checkedInAt && !registration.resultRecordedAt;
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
    try { localStorage.setItem(retryStorage, JSON.stringify(queued)); } catch { /* Current tab retains the pending result. */ }
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
    {!completed && registration.sessionKind !== 'offline' && (selfService
      ? ordinarySelf && <CompetitionSelfRecording onRecordingChange={setRecording} />
      : video || ownEntry || registration.canJoinVideo || registration.canRecordResult
        ? <CompetitionVideoRoom registrationId={registration.id} {...video} />
        : <p className="competition-muted">{t('监督视频在场次开放后可用。', 'Supervision video is available during the session.')}</p>)}
    {ownSmartEntry && current && <AppLink className="competition-primary" prefetch={false} href={`/timer?event=333&competition=${encodeURIComponent(competitionId)}&entry=${encodeURIComponent(registration.id)}`}>{t('进入智能魔方赛场', 'Enter smart cube session')}</AppLink>}
    {!registration.resultRecordedAt && <p className="competition-muted">
      {selfService ? ordinarySelf ? t('先开始本地录像，再领取打乱。完赛后保存录像以备抽检。', 'Start a local recording before requesting a scramble. Save the recording for spot checks.')
        : t('连接智能魔方后，系统会根据正式打乱与动作记录计分。', 'Connect your smart cube to score using the issued scramble and recorded moves.')
        : supervising ? t('确认选手的双手、魔方和计时器都在画面内，再发放打乱。', 'Check that the entrant’s hands, cube and timer are visible before releasing the scramble.')
          : t('保持双手、魔方与计时器可见，等待监督员发放打乱。', 'Keep your hands, cube and timer visible. Wait for the supervisor to release the scramble.')}
    </p>}
    {!completed && (current ? <div className="competition-current-attempt" data-site-surface="panel">
      <h3>{t(`第 ${current.attemptNumber} 把打乱`, `Attempt ${current.attemptNumber} scramble`)}</h3>
      <CompetitionScramble project={registration.project} scramble={current.scramble} />
    </div> : <p className="competition-muted">{complete ? t('五次尝试已记录。', 'All five attempts are recorded.') : t('等待下一次打乱。', 'Waiting for the next scramble.')}</p>)}
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
      {builtIn && !retrying && <CompetitionSelfTimer key={current.attemptNumber} disabled={busy}
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
    {!current && !registration.resultRecordedAt && (registration.canRecordResult || ownSelf) && (
      complete ? registration.canRecordResult && <button type="button" className="competition-primary" disabled={busy} onClick={() => { void act(() => finalizeCompetitionRegistration(registration.id)); }}>{t('确认完赛', 'Confirm completed result')}</button>
        : <button type="button" className="competition-primary" disabled={busy || (ordinarySelf && !recording)} onClick={() => { void act(() => selfService ? nextCompetitionSelfAttempt(registration.id) : nextCompetitionAttempt(registration.id)); }}>{selfService ? t('领取下一把打乱', 'Get next scramble') : t('发放下一次打乱', 'Release next scramble')}</button>
    )}
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

function CompetitionAttemptReplay({ registrationId, attemptNumbers, publiclyAvailable = false }: {
  registrationId: string; attemptNumbers: number[]; publiclyAvailable?: boolean;
}) {
  const t = useT();
  const [replay, setReplay] = useState<{ number: number; setup: string; alg: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function open(number: number) {
    setBusy(true); setError('');
    try {
      const { report } = await getCompetitionAttemptReplay(registrationId, number, publiclyAvailable);
      if (!report?.moves.length) { setError(t('这把没有复盘数据。', 'No replay data for this attempt.')); return; }
      setReplay({ number, setup: report.scramble, alg: report.moves.map(item => item.move).join(' ') });
    } catch (cause) { setError(message(cause, t('读取复盘失败。', 'Could not load the replay.'))); }
    finally { setBusy(false); }
  }
  return <details className="competition-rules">
    <MoreToggle as="summary">{t('智能魔方复盘', 'Smart-cube replay')}</MoreToggle>
    <div className="competition-toolbar">{attemptNumbers.map(number =>
      <button className="competition-secondary" key={number} type="button" disabled={busy}
        aria-pressed={replay?.number === number} onClick={() => void open(number)}>{t(`第 ${number} 把`, `Attempt ${number}`)}</button>)}</div>
    {replay && <div className="competition-replay"><AlgPlayer key={replay.number} setup={replay.setup} alg={replay.alg} puzzle="3x3" set="" fillPane /></div>}
    {error && <p role="alert" className="competition-error">{error}</p>}
  </details>;
}

function ao5ReportData(competition: OnlineCompetition, row: CompetitionResult, t: ReturnType<typeof useT>, lang: 'zh' | 'en'): ReportData {
  const score = competitionAo5(row.attempts, row.project);
  return {
    competition: t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh),
    organizer: competition.organizationName,
    division: `${eventDisplayName(row.project, lang === 'zh')} · ${competitionDeviceName(row.device, t)}`,
    name: displayCuberName(row.displayName, lang === 'zh'),
    date: dateText(row.recordedAt ?? competition.endsAt).slice(0, 10),
    rank: row.rank, final: !!row.finalizedAt, attempts: score.times,
    metrics: [
      { label: t('Ao5 平均', 'Ao5 average'), value: formatWcaResult(score.average, row.project, 'average') },
      { label: t('最佳单次', 'Best single'), value: formatWcaResult(score.best, row.project, 'single') },
    ],
  };
}

function useCompetitionResults(id: string, revision: number, enabled = true) {
  const t = useT();
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void listCompetitionResults(id).then(result => { if (active) { setResults(result.results); setError(''); } })
      .catch(error => { if (active) setError(message(error, t('成绩加载失败。', 'Could not load results.'))); });
    return () => { active = false; };
  }, [enabled, id, revision, t]);
  return { results, error };
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
  return <section className="competition-results">
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
              <th scope="col">Ao5</th><th scope="col">{t('最佳单次', 'Best')}</th>
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
                <tr className="competition-result-details"><td /><td colSpan={3}>
                  <details className="competition-result-attempts"><MoreToggle as="summary">{t('五次成绩', 'All attempts')}</MoreToggle>
                    <span>{row.times.join(' / ')}</span>
                  </details>
                  {device === 'smart' && row.finalizedAt && !!row.replayAttempts?.length &&
                    <CompetitionAttemptReplay registrationId={row.id} attemptNumbers={row.replayAttempts} publiclyAvailable />}
                  {ownIds.has(row.id) && <CompetitionReportShare data={ao5ReportData(competition, { ...row, rank }, t, lang)} />}
                </td></tr>
              </tbody>;
            })}
          </table>
        </div>;
      })}
  </section>;
}

function CompetitionManagement({ competition, registrations, revision, onSaved }: { competition: OnlineCompetition; registrations: CompetitionRegistration[]; revision: number; onSaved: () => void }) {
  const t = useT();
  const [disputes, setDisputes] = useState<CompetitionDispute[]>([]);
  const [settlement, setSettlement] = useState<CompetitionSettlement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [providerReference, setProviderReference] = useState('');
  const [transferredAt, setTransferredAt] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const outstanding = Number(settlement?.outstandingMinor ?? settlement?.organizerAmountMinor ?? 0);
  const recovery = outstanding < 0;
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const ended = now >= Date.parse(competition.endsAt);
  useEffect(() => {
    let active = true;
    void Promise.all([listCompetitionDisputes(competition.id), getCompetitionSettlement(competition.id)])
      .then(([issues, statement]) => { if (active) { setDisputes(issues.disputes); setSettlement(statement.settlement); } })
      .catch(error => { if (active) setError(message(error, t('管理信息加载失败。', 'Could not load management information.'))); });
    return () => { active = false; };
  }, [competition.id, revision, t]);
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
    {!disputes.length ? <p className="competition-muted">{t('暂无异议。', 'No disputes.')}</p> : disputes.map(issue => <div className="competition-dispute" key={issue.id}>
      <strong>{registrations.find(item => item.id === issue.registrationId)?.displayName ?? t('参赛选手', 'Competitor')}</strong><p className="competition-muted">{dateText(issue.createdAt)}</p><p>{issue.reason}</p>
      {competition.canPublish ? <CompetitionEvidenceFiles registrationId={issue.registrationId} canUpload={false} /> : null}
      {issue.resolvedAt ? <p>{t('处理结果：', 'Resolution: ')}{issue.resolution}</p> : competition.canPublish ? <DisputeResolutionForm canCorrect={competition.format !== 'advancement'} busy={busy} onResolve={(resolution, attempts) => act(() => resolveCompetitionDispute(issue.id, resolution, attempts))} /> : <p className="competition-muted">{t('等待 CubeRoot 处理。', 'Awaiting CubeRoot review.')}</p>}
    </div>)}
    {competition.status === 'published' && !settlement?.finalizedAt ? <div className="competition-toolbar"><button type="button" className="competition-secondary" disabled={busy || !ended} onClick={() => { void act(() => closeCompetitionSessions(competition.id)); }}>{t('处理缺赛成绩', 'Close unfinished entries')}</button>{competition.canPublish ? <button type="button" className="competition-secondary" disabled={busy || !ended || disputes.some(issue => !issue.resolvedAt)} onClick={() => { void act(() => finalizeCompetition(competition.id)); }}>{t('定稿比赛成绩', 'Finalize results')}</button> : null}<span className="competition-muted">{competition.format === 'advancement'
      ? t('赛期结束后，平分先比较对局内最佳单次，再比较种子顺序。双方均无有效成绩时不晋级。',
        'At the deadline, tied matches use best single, then seed order. If neither entrant has a valid solve, neither advances.')
      : t('已结束场次中，未完成的已发打乱记 DNF，未发打乱记 DNS。比赛结束且异议处理后可定稿。', 'For ended sessions, unfinished issued attempts receive DNF and unissued attempts receive DNS. Finalize after the competition and dispute review end.')}</span></div> : null}
    <h3>{t('结算账单', 'Settlement statement')}</h3>
    {settlement ? <><dl className="competition-statement"><div><dt>{t('净收款', 'Net collected')}</dt><dd>{money(Number(settlement.netCollectedMinor), settlement.currency)}</dd></div><div><dt>{t('已退款', 'Refunded')}</dt><dd>{money(Number(settlement.refundedMinor), settlement.currency)}</dd></div><div><dt>{t('平台费用', 'Platform fee')}</dt><dd>{settlement.commissionBps == null ? t('未配置', 'Not configured') : money(Number(settlement.platformFeeMinor), settlement.currency)}</dd></div><div><dt>{t('主办方应收', 'Organizer proceeds')}</dt><dd>{settlement.commissionBps == null ? t('未配置', 'Not configured') : money(Number(settlement.organizerAmountMinor), settlement.currency)}</dd></div><div><dt>{t('预计可结算时间', 'Eligible from')}</dt><dd>{settlement.eligibleAt ? dateText(settlement.eligibleAt) : t('待确认条款与成绩', 'Pending terms and final results')}</dd></div></dl><p className="competition-muted">{recovery ? t('退款后存在应追回款项，请完成对账。', 'Refunds require a recovery payment and reconciliation.') : outstanding === 0 && settlement.transferStatus === 'recorded' ? t('当前款项已登记结清。', 'The current balance has been settled and recorded.') : settlement.eligible ? t('已满足结算条件，等待 CubeRoot 确认付款。', 'Eligible for settlement; awaiting CubeRoot payment confirmation.') : t('达到约定结算时间且成绩定稿后，方可结算。', 'Settlement requires finalized results and the agreed settlement date.')} {settlement.transferStatus === 'recorded' ? t('转账已登记。', 'Transfer recorded.') : t('此账单不代表已经转账。', 'This statement does not confirm a transfer.')}</p></> : null}
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
  const active = registrations.filter(r => ['confirmed', 'attended'].includes(r.status));
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
