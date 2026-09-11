'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { Check, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { useT } from '@/hooks/useT';
import { hasAdminAccess, useAuthUser } from '@/lib/auth-store';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { computeWcaBestAverage } from '@/lib/wca-compute';
import { listTeachingMembers, listTeachingOrganizations, type TeachingMember, type TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import {
  addCompetitionSession, checkInCompetition, configureOnlineCompetition, createCompetitionOrder,
  createOnlineCompetition, getOnlineCompetition, listCompetitionRegistrations, listOnlineCompetitions,
  publishOnlineCompetition, updateCompetitionSession, getCompetitionAttempts, nextCompetitionAttempt, recordCompetitionAttempt, finalizeCompetitionRegistration, listCompetitionResults, raiseCompetitionDispute, type CompetitionAttempt, type CompetitionResult, type CompetitionProject, type CompetitionRegistration, type OnlineCompetition,
  listCompetitionDisputes, resolveCompetitionDispute, finalizeCompetition, closeCompetitionSessions, getCompetitionSettlement, recordCompetitionSettlement, type CompetitionDispute, type CompetitionSettlement,
  listCompetitionEvidence, uploadCompetitionEvidence, downloadCompetitionEvidence, type CompetitionEvidence,
  listOrganizerApplications, listOrganizerReviewQueue, submitOrganizerApplication, reviewOrganizerApplication, type OrganizerApplication,
  type OnlineCompetitionSummary,
} from '@/lib/online-competition-api';
import { CompetitionVideoRoom } from './CompetitionVideoRoom';
import './online-competitions.css';

const ROOT = '/platform/events/online';
const PROJECTS = new Set(['222', '333', '444', '555']);
const EMPTY_EVENTS = new Set<string>();
const href = (id: string) => `${ROOT}/${encodeURIComponent(id)}`;
const dateText = (value: string) => Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  : '—';
const inputDate = (value: string) => value ? dateText(value).replace(' ', 'T') : '';
const isoDate = (value: string) => new Date(`${value}:00+08:00`).toISOString();
const money = (minor: number, currency = 'CNY') => new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(minor / 100);
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function statusLabel(status: string, t: ReturnType<typeof useT>) {
  const labels: Record<string, string> = {
    draft: t('草稿', 'Draft'), pending_approval: t('待平台确认', 'Pending approval'), reserved: t('待付款', 'Awaiting payment'), attended: t('已完赛', 'Finished'), published: t('已发布', 'Published'), completed: t('已结束', 'Completed'),
    cancelled: t('已取消', 'Cancelled'), confirmed: t('报名成功', 'Registered'), pending_payment: t('待付款', 'Awaiting payment'),
    checked_in: t('已检录', 'Checked in'), ready: t('待参赛', 'Ready'), competing: t('参赛中', 'Competing'),
    finished: t('已完成', 'Finished'), refunded: t('已退款', 'Refunded'), expired: t('已过期', 'Expired'),
  };
  return labels[status] ?? status;
}

export function OnlineCompetitions({ id }: { id?: string }) {
  return id ? <CompetitionDetail key={id} id={id} /> : <CompetitionList />;
}

function CompetitionList() {
  const t = useT();
  const user = useAuthUser();
  const [view, setView] = useQueryState('view', parseAsStringEnum(['browse', 'manage']).withDefault('browse').withOptions({ history: 'push' }));
  const [items, setItems] = useState<OnlineCompetitionSummary[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setItems([]);
    if (view === 'manage' && !user) { setLoading(false); return; }
    void listOnlineCompetitions(view === 'manage').then(result => { if (active) setItems(result.competitions); })
      .catch(error => { if (active) setError(message(error, t('赛事加载失败，请重试。', 'Could not load competitions. Try again.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, user, revision, t]);
  return <div className="competitions">
    <header className="competition-heading"><h1>{t('线上比赛', 'Online competitions')}</h1><p>{t('选一个场次，在线监督参赛。', 'Choose a session and compete with live supervision.')}</p></header>
    <nav className="competition-tabs" aria-label={t('赛事视图', 'Competition view')}>
      <button type="button" className="competition-tab" aria-current={view === 'browse' ? 'page' : undefined} onClick={() => { void setView('browse'); }}>{t('全部比赛', 'Competitions')}</button>
      <button type="button" className="competition-tab" aria-current={view === 'manage' ? 'page' : undefined} onClick={() => { void setView('manage'); }}>{t('我要办赛', 'Host a competition')}</button>
    </nav>
    {view === 'manage' && !user ? <p><AppLink href="/platform/login">{t('登录后管理赛事', 'Sign in to manage competitions')}</AppLink></p> : null}
    {error ? <div role="alert" className="competition-error"><p>{error}</p><button className="competition-secondary" type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />{t('重试', 'Retry')}</button></div> : null}
    {loading ? <p role="status" className="competition-muted">{t('正在加载比赛…', 'Loading competitions…')}</p> : !error && !items.length && (view === 'browse' || user) ? <p className="competition-empty">{view === 'manage' ? t('还没有你管理的比赛。创建草稿后，可继续添加项目和监督场次。', 'You have no managed competitions yet. Create a draft, then add events and supervised sessions.') : t('暂时没有已发布的线上比赛。', 'No online competitions have been published yet.')}</p> : null}
    <div className="competition-list">{items.map(item => <AppLink prefetch={false} className="competition-list-row" key={item.id} href={`${href(item.id)}${view === 'manage' ? '?view=manage' : ''}`}>
      <div><span className="competition-state">{item.status === 'published' && now ? (now < Date.parse(item.registrationOpensAt) ? t('报名未开始', 'Registration opens soon') : now < Date.parse(item.registrationClosesAt) ? t('报名中', 'Registration open') : t('报名截止', 'Registration closed')) : statusLabel(item.status, t)}</span><h2>{t(item.titleZh, item.titleEn || item.titleZh)}</h2><p>{dateText(item.startsAt)} <span>{t('北京时间', 'UTC+8')}</span></p><p>{item.projects.map(project => eventDisplayName(project.project, t('zh', 'en') === 'zh')).filter((name, index, names) => names.indexOf(name) === index).join(' / ')}{item.projects.length ? <> — {item.projects.every(project => project.amountMinor === 0) ? t('免费参赛', 'Free entry') : <>{money(Math.min(...item.projects.map(project => project.amountMinor)))} {t('起', 'and up')}</>}</> : null}</p><p>{item.organizationName}</p></div><ChevronRight size={20} />
    </AppLink>)}</div>
    {view === 'manage' && user ? <CompetitionEditor onSaved={() => setRevision(value => value + 1)} /> : null}
  </div>;
}

function CompetitionDetail({ id }: { id: string }) {
  const t = useT();
  const user = useAuthUser();
  const [view, setView] = useQueryState('view', parseAsStringEnum(['entry', 'manage']).withDefault('entry').withOptions({ history: 'push' }));
  const [ticketId, setTicketId] = useQueryState('project', parseAsString.withDefault(''));
  const [sessionId, setSessionId] = useQueryState('session', parseAsString.withDefault(''));
  const [competition, setCompetition] = useState<OnlineCompetition | null>(null);
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [registrationLoadError, setRegistrationLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [activeRegistration, setActiveRegistration] = useQueryState('entry', parseAsString.withDefault('').withOptions({ history: 'push' }));
  const [now, setNow] = useState(0);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { setAccepted(false); setOrderId(''); }, [ticketId, sessionId]);
  useEffect(() => { setRegistrations([]); setRegistrationError(''); }, [id, user?.uid]);
  useEffect(() => { setCompetition(null); setOrderId(''); setAccepted(false); }, [id]);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!user) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000); return () => clearInterval(timer); }, [refresh, user]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getOnlineCompetition(id).then(async result => {
      if (active) setCompetition(result.competition);
      if (user) {
        try { const entries = await listCompetitionRegistrations(result.competition.id); if (active) { setRegistrations(entries.registrations); setRegistrationLoadError(''); } }
        catch (error) { if (active) setRegistrationLoadError(message(error, t('报名记录加载失败，请刷新后重试。', 'Could not load your registrations. Refresh to retry.'))); }
      }
    })
      .catch(error => { if (active) setError(message(error, t('赛事加载失败。', 'Could not load competition.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user, revision, t]);
  async function register(project: CompetitionProject) {
    if (busy || !accepted || !sessionId) return;
    setBusy(true); setRegistrationError('');
    try {
      const result = await createCompetitionOrder(project, sessionId);
      const createdId = result.order?.id ?? result.id ?? result.resourceId;
      if (!createdId) throw new Error(t('订单已提交，请到我的订单查看付款状态。', 'Order submitted. Check My orders for payment status.'));
      setOrderId(createdId); refresh();
    } catch (error) { setRegistrationError(message(error, t('报名未完成，请重试。', 'Registration did not complete. Try again.'))); }
    finally { setBusy(false); }
  }
  async function checkIn(registrationId: string) {
    setBusy(true); setRegistrationError('');
    try { await checkInCompetition(registrationId); void setActiveRegistration(registrationId); refresh(); }
    catch (error) { setRegistrationError(message(error, t('检录未完成，请重试。', 'Check-in did not complete. Try again.'))); }
    finally { setBusy(false); }
  }
  if (loading && !competition) return <div className="competitions"><p role="status">{t('正在加载比赛…', 'Loading competition…')}</p></div>;
  if (!competition) return <div className="competitions"><p role="alert">{error || t('没有找到这场比赛。', 'Competition not found.')}</p><button className="competition-secondary" type="button" onClick={refresh}>{t('重试', 'Retry')}</button></div>;
  const project = competition.projects.find(item => item.id === ticketId) ?? (competition.projects.length === 1 ? competition.projects[0] : undefined);
  const session = competition.sessions.find(item => item.id === sessionId);
  const existingRegistration = project ? registrations.find(item => item.userId === user?.uid && item.project === project.project && item.device === project.device && ['reserved', 'pending_payment', 'confirmed', 'attended'].includes(item.status)) : undefined;
  const registrationOpen = now >= Date.parse(competition.registrationOpensAt) && now < Date.parse(competition.registrationClosesAt);
  const canRegister = competition.status === 'published' && registrationOpen && !existingRegistration && project && session && now < Date.parse(session.startsAt) && session.available > 0 && session.staffed && accepted && !busy && !orderId;
  const selectedRegistration = registrations.find(item => item.id === activeRegistration && item.checkedInAt && (item.userId === user?.uid || item.canRecordResult));
  return <div className="competitions">
    {error ? <p role="alert" className="competition-error">{error}</p> : null}
    <header className="competition-heading"><span className="competition-state">{competition.status === 'published' && now ? (registrationOpen ? t('报名中', 'Registration open') : now < Date.parse(competition.registrationOpensAt) ? t('报名未开始', 'Registration opens soon') : t('报名截止', 'Registration closed')) : statusLabel(competition.status, t)}</span><h1>{t(competition.titleZh, competition.titleEn || competition.titleZh)}</h1><p>{dateText(competition.startsAt)} — {dateText(competition.endsAt)} {t('北京时间', 'UTC+8')}</p><p>{competition.organizationName}</p></header>
    <div className="competition-toolbar"><AppLink href={ROOT} prefetch={false}>{t('全部比赛', 'All competitions')}</AppLink>{competition.canManage ? <button type="button" className="competition-secondary" onClick={() => { void setView(view === 'manage' ? 'entry' : 'manage'); }}>{view === 'manage' ? t('查看报名页', 'View registration') : t('管理赛事', 'Manage competition')}</button> : null}<button type="button" className="competition-icon-button" aria-label={t('刷新赛事', 'Refresh competition')} onClick={refresh}><RefreshCw size={17} /></button></div>
    {view === 'manage' && competition.canManage ? <><CompetitionEditor key={`${id}:${competition.status}`} competition={competition} onSaved={refresh} /><SessionEditor competition={competition} onSaved={refresh} /></> : <div className="competition-detail-grid">
      <section>
        <h2>{t('选择参赛项目', 'Choose an event')}</h2>
        {competition.projects.length ? <div className="competition-projects">{competition.projects.map(item => <button type="button" key={item.id} className="competition-project" aria-pressed={project?.id === item.id} onClick={() => { void setTicketId(item.id); }}><EventIcon event={item.project} /><span>{eventDisplayName(item.project, t('zh', 'en') === 'zh')}<small>{item.device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube')}</small></span><strong>{money(item.amountMinor, item.currency)}</strong></button>)}</div> : <p className="competition-muted">{t('项目尚未公布。', 'Events have not been announced.')}</p>}
        <h3>{t('选择监督场次', 'Choose a supervised session')}</h3>
        <div className="competition-sessions">{competition.sessions.map(item => <button className="competition-session" type="button" key={item.id} aria-pressed={session?.id === item.id} disabled={item.available <= 0 || !item.staffed || now >= Date.parse(item.startsAt)} onClick={() => { void setSessionId(item.id); }}><span><strong>{dateText(item.startsAt)}</strong><small>{t('至', 'Until')} {dateText(item.endsAt)}</small></span><span className="competition-session-availability">{now >= Date.parse(item.startsAt) ? t('已开始', 'Started') : !item.staffed ? t('待排班', 'Unassigned') : item.available <= 0 ? t('已满', 'Full') : t(`余 ${item.available} 位`, `${item.available} places`)}{session?.id === item.id ? <Check size={17} /> : null}</span></button>)}</div>
        {!competition.sessions.length ? <p className="competition-muted">{t('监督场次尚未公布。', 'Sessions have not been announced.')}</p> : null}
      </section>
      <aside className="competition-entry"><h2>{t('确认报名', 'Registration')}</h2>
        {project ? <p className="competition-fee">{money(project.amountMinor, project.currency)}<small>{project.amountMinor === 0 ? t('免费参赛', 'Free entry') : t('CubeRoot 统一收款', 'Collected by CubeRoot')}</small></p> : <p>{t('请先选择项目和场次。', 'Choose an event and session first.')}</p>}

        {!user ? <AppLink className="competition-primary" href="/platform/login">{t('登录报名', 'Sign in to register')}</AppLink> : (orderId || existingRegistration?.orderId) ? <AppLink className="competition-primary" prefetch={false} href={`/platform/orders/${encodeURIComponent(orderId || existingRegistration!.orderId)}`}>{existingRegistration && !['reserved', 'pending_payment'].includes(existingRegistration.status) ? t('已报名，查看订单', 'Registered, view order') : t('查看订单与付款', 'View order and pay')}</AppLink> : <><BoolToggle value={accepted} onChange={setAccepted} label={t('同意参赛与退款规则', 'I agree to the participation and refund policies')} /><button type="button" className="competition-primary" disabled={!canRegister} onClick={() => { if (project) void register(project); }}>{busy ? t('正在提交…', 'Submitting…') : t('确认报名', 'Register')}</button></>}
        {competition.status === 'published' && !registrationOpen ? <p className="competition-muted">{now < Date.parse(competition.registrationOpensAt) ? t('报名尚未开始。', 'Registration has not started.') : t('报名已截止。', 'Registration has closed.')}</p> : null}
        {competition.status !== 'published' ? <p className="competition-muted">{t('这场比赛尚未开放报名。', 'Registration is not open for this competition.')}</p> : null}
        <p className="competition-muted competition-deadline">{t('报名截止', 'Registration closes')} {dateText(competition.registrationClosesAt)}</p>
      </aside>
    </div>}
    {!(view === 'manage' && competition.canManage) && (
<details className="competition-rules"><summary>{t('参赛与退款规则', 'Participation and refund policies')}</summary><p>{t('普通魔方与智能魔方分别排名。参赛时实时监督，录像仅用于争议复核。', 'Standard and smart cubes have separate rankings. Participation is supervised live; recordings are for dispute review.')}</p><h3>{t('退款政策', 'Refund policy')}</h3><p>{competition.refundPolicy || t('尚未公布', 'Not yet published')}</p><h3>{t('录像与争议处理', 'Recording and disputes')}</h3><p>{competition.recordingPolicy || t('尚未公布', 'Not yet published')}</p></details>
    )}
    {registrationError || registrationLoadError ? <p className="competition-error" role="alert">{registrationError || registrationLoadError}</p> : null}
    {user ? <section className="competition-registrations"><h2>{competition.canManage || competition.canSupervise ? t('参赛名单', 'Competitors') : t('参赛安排', 'Your entries')}</h2>{!registrations.length ? <p className="competition-muted">{t('还没有报名记录。', 'No registrations yet.')}</p> : registrations.map(item => <div className="competition-registration" key={item.id}><div><strong>{item.displayName}</strong><p>{eventDisplayName(item.project, t('zh', 'en') === 'zh')} {item.device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube')}</p><p>{dateText(competition.sessions.find(session => session.id === item.sessionId)?.startsAt ?? '')}</p></div><span>{statusLabel(item.status, t)}</span><div className="competition-toolbar">{item.orderId && item.userId === user.uid ? <AppLink href={`/platform/orders/${encodeURIComponent(item.orderId)}`} prefetch={false}>{t('订单', 'Order')}</AppLink> : null}{item.canCheckIn && !item.checkedInAt ? <button type="button" className="competition-secondary" disabled={busy} onClick={() => { void checkIn(item.id); }}>{t('检录', 'Check in')}</button> : null}{item.checkedInAt && (item.userId === user.uid || item.canRecordResult) ? <button type="button" className="competition-secondary" onClick={() => { void setActiveRegistration(item.id); }}>{item.resultRecordedAt ? t('查看成绩', 'View result') : t('进入赛场', 'Enter session')}</button> : null}</div></div>)}</section> : null}
    {selectedRegistration ? <CompetitionParticipation key={selectedRegistration.id} competitionId={competition.id} registration={selectedRegistration} finalized={!!competition.finalizedAt} onSaved={refresh} /> : null}
    {['published', 'completed'].includes(competition.status) ? <CompetitionResults id={competition.id} revision={revision} /> : null}
    {view === 'manage' && competition.canManage ? <CompetitionManagement competition={competition} registrations={registrations} revision={revision} onSaved={refresh} /> : null}
  </div>;
}

function CompetitionEditor({ competition, onSaved }: { competition?: OnlineCompetition; onSaved: () => void }) {
  const t = useT();
  const [organizations, setOrganizations] = useState<TeachingOrganizationAccess[]>([]);
  const [eligibleOrganizationIds, setEligibleOrganizationIds] = useState<string[]>([]);
  const [organizationRevision, setOrganizationRevision] = useState(0);
  const refreshOrganizations = useCallback((ids: string[]) => { setEligibleOrganizationIds(ids); setOrganizationRevision(value => value + 1); }, []);
  const [organizationId, setOrganizationId] = useState(competition?.organizationId ?? '');
  const [titleZh, setTitleZh] = useState(competition?.titleZh ?? '');
  const [titleEn, setTitleEn] = useState(competition?.titleEn ?? '');
  const [slug, setSlug] = useState(competition?.slug ?? '');
  const [dates, setDates] = useState({ startsAt: inputDate(competition?.startsAt ?? ''), endsAt: inputDate(competition?.endsAt ?? ''), registrationOpensAt: inputDate(competition?.registrationOpensAt ?? ''), registrationClosesAt: inputDate(competition?.registrationClosesAt ?? '') });
  const [refundPolicy, setRefundPolicy] = useState(competition?.refundPolicy ?? '');
  const [recordingPolicy, setRecordingPolicy] = useState(competition?.recordingPolicy ?? '');
  const [commission, setCommission] = useState(competition?.commissionBps == null ? '' : String(competition.commissionBps / 100));
  const [settlementDays, setSettlementDays] = useState(competition?.settlementDays == null ? '' : String(competition.settlementDays));
  const [anchor, setAnchor] = useState(competition?.settlementAnchor ?? '');
  const [projects, setProjects] = useState<Array<{ project: string; device: 'ordinary' | 'smart'; amount: string; capacity: string }>>((competition?.projects ?? []).map(item => ({ project: item.project, device: item.device, amount: String(item.amountMinor / 100), capacity: String(item.capacity) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [createdId, setCreatedId] = useState('');
  const settingsSignature = JSON.stringify({ titleZh, titleEn, dates, refundPolicy, recordingPolicy, commission, settlementDays, anchor, projects });
  const [savedSignature, setSavedSignature] = useState(settingsSignature);
  const dirty = settingsSignature !== savedSignature;
  useEffect(() => {
    if (competition) return;
    let active = true;
    void listTeachingOrganizations().then(items => { if (active) setOrganizations(items.filter(item => ['owner', 'admin'].includes(item.role))); })
      .catch(error => { if (active) setError(message(error, t('主办组织加载失败。', 'Could not load organizations.'))); });
    return () => { active = false; };
  }, [competition, t, organizationRevision]);
  const eligibleOrganizations = organizations.filter(item => eligibleOrganizationIds.includes(item.id));
  const validDates = Object.values(dates).every(value => value && Number.isFinite(Date.parse(`${value}:00+08:00`)))
    && dates.registrationOpensAt < dates.registrationClosesAt && dates.registrationClosesAt <= dates.endsAt && dates.startsAt < dates.endsAt;
  const validRate = commission === '' || (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(commission) && Number(commission) <= 100);
  const validDays = settlementDays === '' || (/^(?:0|[1-9]\d*)$/.test(settlementDays) && Number(settlementDays) <= 3650);
  const validProjects = projects.every(item => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(item.amount) && /^[1-9]\d*$/.test(item.capacity) && Number(item.capacity) <= 1000000 && Number(item.amount) <= 100000 && (item.device !== 'smart' || item.project === '333'))
    && new Set(projects.map(item => `${item.project}:${item.device}`)).size === projects.length;
  const canSave = !busy && (!competition || ['draft', 'pending_approval'].includes(competition.status)) && titleZh.trim() && titleEn.trim() && organizationId && (competition || eligibleOrganizationIds.includes(organizationId)) && validDates && validRate && validDays && validProjects;
  async function save() {
    if (!canSave) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const base = { organizationId, titleZh: titleZh.trim(), titleEn: titleEn.trim(), slug: slug.trim(), ...Object.fromEntries(Object.entries(dates).map(([key, value]) => [key, isoDate(value)])), refundPolicy: refundPolicy.trim(), recordingPolicy: recordingPolicy.trim() };
      if (competition) await configureOnlineCompetition(competition.id, { ...base, commissionBps: commission === '' ? null : Math.round(Number(commission) * 100), settlementDays: settlementDays === '' ? null : Number(settlementDays), settlementAnchor: anchor || null, projects: projects.map(item => ({ project: item.project, device: item.device, amountMinor: Math.round(Number(item.amount) * 100), capacity: Number(item.capacity) })) });
      else { const result = await createOnlineCompetition(base); setCreatedId(result.id); }
      setSavedSignature(settingsSignature); setSaved(t('已保存', 'Saved')); onSaved();
    } catch (error) { setError(message(error, t('保存失败，请重试。', 'Could not save. Try again.'))); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!competition || dirty) return;
    setBusy(true); setError(''); setSaved('');
    try { const result = await publishOnlineCompetition(competition.id); setSaved(result.status === 'published' ? t('赛事已发布', 'Competition published') : t('已提交，等待平台确认', 'Submitted for platform approval')); onSaved(); }
    catch (error) { setError(message(error, t('尚不满足发布条件。', 'Publication requirements are not met.'))); }
    finally { setBusy(false); }
  }
  const anchors = [{ value: '', label: t('未配置', 'Not configured') }, { value: 'finalized', label: t('成绩定稿后', 'After results are finalized') }, { value: 'ended', label: t('比赛结束后', 'After competition ends') }];
  return <section className="competition-editor"><h2>{competition ? t('赛事设置', 'Competition settings') : t('创建比赛', 'Create a competition')}</h2>
    {!competition ? <OrganizerOnboarding organizations={organizations} onLoaded={refreshOrganizations} /> : null}
    {createdId ? <p role="status"><AppLink className="competition-primary" prefetch={false} href={`${href(createdId)}?view=manage`}>{t('继续设置项目与场次', 'Continue to events and sessions')}</AppLink></p> : !competition && !eligibleOrganizations.length ? <p className="competition-muted">{t('主办申请通过后，即可创建比赛。', 'Create a competition once your organizer application is approved.')}</p> : <>
      <fieldset className="competition-form-fields" disabled={!!competition && !['draft', 'pending_approval'].includes(competition.status)}><div className="competition-form-grid">
        {!competition ? <div className="competition-field"><span>{t('主办组织', 'Organizer')}</span><CompactSelect value={organizationId} label={eligibleOrganizations.find(item => item.id === organizationId)?.name ?? t('选择主办组织', 'Choose an organization')} items={eligibleOrganizations.map(item => ({ value: item.id, label: item.name }))} onChange={setOrganizationId} ariaLabel={t('主办组织', 'Organizer')} /></div> : null}
        <label>{t('赛事中文名', 'Chinese title')}<input className="platform-field-control" value={titleZh} maxLength={120} onChange={event => setTitleZh(event.target.value)} /></label>
        <label>{t('赛事英文名', 'English title')}<input className="platform-field-control" value={titleEn} maxLength={160} onChange={event => setTitleEn(event.target.value)} /></label>
        {!competition ? <label>{t('网址名称', 'URL name')}<input className="platform-field-control" value={slug} pattern="[a-z0-9-]+" maxLength={100} onChange={event => setSlug(event.target.value)} /><small>{t('使用小写字母、数字和连字符', 'Lowercase letters, numbers and hyphens')}</small></label> : null}
        {(['registrationOpensAt', 'registrationClosesAt', 'startsAt', 'endsAt'] as const).map((key, index) => <label key={key}>{[t('报名开始', 'Registration opens'), t('报名截止', 'Registration closes'), t('比赛开始', 'Competition starts'), t('比赛结束', 'Competition ends')][index]}<input className="platform-field-control" type="datetime-local" value={dates[key]} onChange={event => setDates(current => ({ ...current, [key]: event.target.value }))} /><small>{t('北京时间 UTC+8', 'Beijing time UTC+8')}</small></label>)}
      </div>
      {competition ? <><h3>{t('比赛项目', 'Events')}</h3>{projects.map((item, index) => <div className="competition-project-editor" key={index}><PuzzlePicker selectedEvent={item.project} wcaEvents={PROJECTS} availableEvents={EMPTY_EVENTS} isZh={t('zh', 'en') === 'zh'} onSelect={value => { if (PROJECTS.has(value)) setProjects(current => current.map((row, i) => i === index ? { ...row, project: value, device: value === '333' ? row.device : 'ordinary' } : row)); }} /><CompactSelect value={item.device} label={item.device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube')} ariaLabel={t(`项目 ${index + 1} 魔方类型`, `Cube type for event ${index + 1}`)} items={[{ value: 'ordinary', label: t('普通魔方', 'Standard cube') }, ...(item.project === '333' ? [{ value: 'smart', label: t('智能魔方', 'Smart cube') }] : [])]} onChange={value => setProjects(current => current.map((row, i) => i === index ? { ...row, device: value as 'ordinary' | 'smart' } : row))} /><label>{t('报名费（元）', 'Entry fee (CNY)')}<input className="platform-field-control" type="number" min={0} step="0.01" value={item.amount} onChange={event => setProjects(current => current.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} /></label><label>{t('人数上限', 'Entry capacity')}<input className="platform-field-control" type="number" min={1} step={1} value={item.capacity} onChange={event => setProjects(current => current.map((row, i) => i === index ? { ...row, capacity: event.target.value } : row))} /></label><button type="button" className="competition-secondary" onClick={() => setProjects(current => current.filter((_, i) => i !== index))}>{t('移除此项', 'Remove event')}</button></div>)}<button type="button" className="competition-secondary" onClick={() => setProjects(current => [...current, { project: '333', device: 'ordinary', amount: '', capacity: '' }])}><Plus size={15} />{t('添加项目', 'Add event')}</button>
        {!validProjects ? <p className="competition-error">{t('项目不能重复；请填写有效费用和人数上限。', 'Events must be unique. Enter a valid fee and capacity.')}</p> : null}
        <h3>{t('收款与结算', 'Collection and settlement')}</h3><p className="competition-muted">{t('CubeRoot 统一收款。以下条款由平台与主办方约定；留空时不能发布收费比赛。', 'CubeRoot collects fees. These terms must be agreed with the organizer; paid competitions cannot be published while they are blank.')}</p>
        <div className="competition-form-grid"><label>{t('平台抽成（%）', 'Platform commission (%)')}<input className="platform-field-control" type="number" min={0} max={100} step="0.01" value={commission} onChange={event => setCommission(event.target.value)} aria-invalid={!validRate} /><small>{t('0–100；不抽成也需明确填写 0', '0–100; enter 0 explicitly for no commission')}</small></label><div className="competition-field"><span>{t('结算起点', 'Settlement starts from')}</span><CompactSelect value={anchor} label={anchors.find(item => item.value === anchor)!.label} items={anchors} onChange={setAnchor} ariaLabel={t('结算起点', 'Settlement starts from')} /></div><label>{t('结算等待天数', 'Settlement delay (days)')}<input className="platform-field-control" type="number" min={0} max={3650} step={1} value={settlementDays} onChange={event => setSettlementDays(event.target.value)} aria-invalid={!validDays} /></label></div>
      </> : null}
      <div className="competition-policy-fields"><label>{t('退款政策', 'Refund policy')}<textarea className="platform-field-control" rows={3} value={refundPolicy} maxLength={10000} onChange={event => setRefundPolicy(event.target.value)} /></label><label>{t('录像保留与争议处理', 'Recording retention and dispute policy')}<textarea className="platform-field-control" rows={3} value={recordingPolicy} maxLength={10000} onChange={event => setRecordingPolicy(event.target.value)} /></label></div>
      </fieldset><div className="competition-toolbar"><button type="button" className="competition-primary" disabled={!canSave || (!competition && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))} onClick={() => { void save(); }}>{busy ? t('处理中…', 'Working…') : competition ? t('保存设置', 'Save settings') : t('创建草稿', 'Create draft')}</button>{competition && (['draft', 'pending_approval'].includes(competition.status) || (competition.canPublish && competition.status === 'pending_approval')) ? <button type="button" className="competition-secondary" disabled={busy || dirty} onClick={() => { void publish(); }}>{competition.canPublish ? t('审核并发布', 'Approve and publish') : t('提交平台确认', 'Submit for platform approval')}</button> : null}{competition && dirty ? <span className="competition-muted">{t('请先保存修改，再提交发布。', 'Save your changes before submitting for publication.')}</span> : null}</div>
      {!validDates && Object.values(dates).every(Boolean) ? <p className="competition-error">{t('请检查起止时间：报名开始须早于截止，比赛开始须早于结束。', 'Check the dates: opening must precede closing, and the competition must start before it ends.')}</p> : null}
    </>}
    {error ? <p className="competition-error" role="alert">{error}</p> : null}{saved ? <p role="status" className="competition-muted">{saved}</p> : null}
  </section>;
}

function OrganizerOnboarding({ organizations, onLoaded }: { organizations: TeachingOrganizationAccess[]; onLoaded: (ids: string[]) => void }) {
  const t = useT();
  const user = useAuthUser();
  const admin = hasAdminAccess(user);
  const [applications, setApplications] = useState<OrganizerApplication[]>([]);
  const [queue, setQueue] = useState<OrganizerApplication[]>([]);
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([listOrganizerApplications(), admin ? listOrganizerReviewQueue() : Promise.resolve({ applications: [] })])
      .then(([mine, review]) => { if (!active) return; setApplications(mine.applications); setQueue(review.applications); setEligibleIds(mine.eligibleOrganizationIds); onLoaded(mine.eligibleOrganizationIds); })
      .catch(error => { if (active) setError(message(error, t('主办申请加载失败。', 'Could not load organizer applications.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, onLoaded, revision, t, user?.uid]);
  const pending = applications.some(item => item.status === 'pending');
  const available = organizations.filter(item => !eligibleIds.includes(item.id));
  const valid = !!contact.trim() && !!description.trim() && (selectedOrganization ? available.some(item => item.id === selectedOrganization) : !!name.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); setRevision(value => value + 1); }
    catch (error) { setError(message(error, t('操作未完成，请重试。', 'Could not complete the action. Try again.'))); }
    finally { setBusy(false); }
  }
  return <div className="competition-onboarding">
    {loading ? <p role="status" className="competition-muted">{t('正在加载主办资格…', 'Loading organizer access…')}</p> : null}
    {applications.map(item => <div key={item.id} className="competition-registration"><div><strong>{item.name}</strong><p>{item.status === 'pending' ? t('主办申请待审核', 'Organizer application pending') : item.status === 'approved' ? t('主办申请已通过', 'Organizer approved') : t('主办申请未通过', 'Application declined')}</p>{item.reviewNote ? <p>{item.reviewNote}</p> : null}{item.status === 'approved' && item.organizationSlug ? <AppLink prefetch={false} href={`/platform/org/${encodeURIComponent(item.organizationSlug)}`}>{t('管理主办组织', 'Manage organization')}</AppLink> : null}</div></div>)}
    {!pending ? <details className="competition-rules" open={!organizations.length && !applications.length}><summary>{t('申请主办方', 'Apply to host competitions')}</summary><p className="competition-muted">{t('提交主办信息，CubeRoot 审核后可创建比赛。已有组织可直接关联申请。', 'Submit organizer details for CubeRoot approval. You can apply using an existing organization.')}</p><div className="competition-form-grid">
      {available.length ? <div className="competition-field"><span>{t('使用组织', 'Organization')}</span><CompactSelect value={selectedOrganization} label={available.find(item => item.id === selectedOrganization)?.name ?? t('新建主办组织', 'New organizer')} items={[{ value: '', label: t('新建主办组织', 'New organizer') }, ...available.map(item => ({ value: item.id, label: item.name }))]} onChange={setSelectedOrganization} ariaLabel={t('申请组织', 'Applicant organization')} /></div> : null}
      {!selectedOrganization ? <><label>{t('主办方名称', 'Organizer name')}<input className="platform-field-control" value={name} maxLength={160} onChange={event => setName(event.target.value)} /></label><label>{t('组织网址名称', 'Organization URL name')}<input className="platform-field-control" value={slug} maxLength={64} onChange={event => setSlug(event.target.value)} /><small>{t('小写字母、数字和连字符', 'Lowercase letters, numbers and hyphens')}</small></label></> : null}
      <label>{t('联系方式', 'Contact details')}<input className="platform-field-control" value={contact} maxLength={500} onChange={event => setContact(event.target.value)} /><small>{t('仅本人和平台审核人员可见', 'Visible only to you and platform reviewers')}</small></label><label>{t('办赛计划与经验', 'Competition plans and experience')}<textarea className="platform-field-control" rows={3} value={description} maxLength={4000} onChange={event => setDescription(event.target.value)} /></label></div><button className="competition-secondary" type="button" disabled={loading || busy || !valid} onClick={() => { void act(() => submitOrganizerApplication({ name: name.trim(), slug, contact: contact.trim(), description: description.trim(), ...(selectedOrganization ? { organizationId: selectedOrganization } : {}) })); }}>{t('提交主办申请', 'Submit application')}</button></details> : <p className="competition-muted">{t('审核期间无需重复申请。', 'Your application is under review.')}</p>}
    {admin && queue.length ? <details className="competition-rules"><summary>{t('审核主办申请', 'Review organizer applications')}</summary>{queue.map(item => <div className="competition-policy-fields" key={item.id}><h3>{item.name}</h3><p>{item.contact}</p><p>{item.description}</p><label>{t('审核意见', 'Review note')}<textarea className="platform-field-control" rows={2} value={notes[item.id] ?? ''} maxLength={4000} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} /></label><div className="competition-toolbar"><button type="button" className="competition-secondary" disabled={busy} onClick={() => { void act(() => reviewOrganizerApplication(item.id, 'approve', notes[item.id]?.trim() ?? '')); }}>{t('通过主办申请', 'Approve organizer')}</button><button type="button" className="competition-secondary" disabled={busy || !notes[item.id]?.trim()} onClick={() => { void act(() => reviewOrganizerApplication(item.id, 'reject', notes[item.id].trim())); }}>{t('拒绝并说明原因', 'Decline with reason')}</button></div></div>)}</details> : null}
    {error ? <p role="alert" className="competition-error">{error}</p> : null}<button type="button" className="competition-secondary" disabled={loading || busy} onClick={() => { setError(''); setRevision(value => value + 1); }}>{t('刷新主办资格', 'Refresh organizer access')}</button>
  </div>;
}

function SessionEditor({ competition, onSaved }: { competition: OnlineCompetition; onSaved: () => void }) {
  const t = useT();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [members, setMembers] = useState<TeachingMember[]>([]);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const items: TeachingMember[] = [];
      let page = 1;
      while (active) {
        const result = await listTeachingMembers(competition.organizationSlug, page++, 100);
        items.push(...result.items);
        if (items.length >= result.total || !result.items.length) break;
      }
      if (active) setMembers(items.filter(item => item.status === 'active' && ['owner', 'admin', 'teacher', 'assistant'].includes(item.role)));
    })().catch(error => { if (active) setError(message(error, t('监督员名单加载失败。', 'Could not load supervisors.'))); });
    return () => { active = false; };
  }, [competition.organizationSlug, t]);
  const supervisors = [{ value: '', label: t('暂不安排', 'Assign later') }, ...members.map(member => ({ value: String(member.userId), label: member.displayName })), { value: 'assistance', label: t('请 CubeRoot 协助安排', 'Ask CubeRoot to help') }];
  const valid = ['draft', 'pending_approval'].includes(competition.status) && startsAt && endsAt && startsAt < endsAt && Date.parse(`${startsAt}:00+08:00`) >= Date.parse(competition.startsAt) && Date.parse(`${endsAt}:00+08:00`) <= Date.parse(competition.endsAt) && /^[1-9]\d*$/.test(capacity) && Number(capacity) <= 1000;
  async function save() {
    if (!valid || busy) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const body = { startsAt: isoDate(startsAt), endsAt: isoDate(endsAt), capacity: Number(capacity), supervisorUserId: supervisor && supervisor !== 'assistance' ? Number(supervisor) : null, assistanceRequested: supervisor === 'assistance' };
      if (editingId) await updateCompetitionSession(competition.id, editingId, body);
      else await addCompetitionSession(competition.id, body);
      setSaved(t('场次已保存', 'Session saved')); setStartsAt(''); setEndsAt(''); setCapacity(''); setSupervisor(''); setEditingId(''); onSaved();
    } catch (error) { setError(message(error, t('场次保存失败。', 'Could not save session.'))); }
    finally { setBusy(false); }
  }
  return <section className="competition-editor"><h2>{t('监督排班', 'Supervision schedule')}</h2><p className="competition-muted">{t('主办方安排监督员，CubeRoot 可以协助。未完成排班的场次不能开放报名。', 'Organizers assign supervisors, with help available from CubeRoot. Sessions require an assigned supervisor before registration opens.')}</p>
    {competition.sessions.map(session => <div className="competition-registration" key={session.id}><div><strong>{dateText(session.startsAt)}</strong><p>{dateText(session.endsAt)}</p></div><span>{session.supervisorUserId ? members.find(member => member.userId === session.supervisorUserId)?.displayName ?? t(`监督员 ${session.supervisorUserId}`, `Supervisor ${session.supervisorUserId}`) : session.assistanceRequested ? t('待 CubeRoot 协助', 'Awaiting CubeRoot assistance') : t('待排班', 'Unassigned')}</span><span>{t(`${session.capacity} 个名额`, `${session.capacity} places`)}</span>{['draft', 'pending_approval'].includes(competition.status) ? <button type="button" className="competition-secondary" onClick={() => { setEditingId(session.id); setStartsAt(inputDate(session.startsAt)); setEndsAt(inputDate(session.endsAt)); setCapacity(String(session.capacity)); setSupervisor(session.supervisorUserId ? String(session.supervisorUserId) : session.assistanceRequested ? 'assistance' : ''); }}>{t('修改场次', 'Edit session')}</button> : null}</div>)}
    <fieldset className="competition-form-fields" disabled={!['draft', 'pending_approval'].includes(competition.status) || busy}><h3>{editingId ? t('修改场次', 'Edit session') : t('添加场次', 'Add a session')}</h3><div className="competition-form-grid"><label>{t('开始时间（北京时间）', 'Starts at (UTC+8)')}<input className="platform-field-control" type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label>{t('结束时间（北京时间）', 'Ends at (UTC+8)')}<input className="platform-field-control" type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label><label>{t('人数上限', 'Capacity')}<input className="platform-field-control" type="number" min={1} max={1000} step={1} value={capacity} onChange={event => setCapacity(event.target.value)} /></label><div className="competition-field"><span>{t('监督员', 'Supervisor')}</span><CompactSelect value={supervisor} label={supervisors.find(item => item.value === supervisor)?.label ?? t('选择监督员', 'Choose supervisor')} items={supervisors} onChange={setSupervisor} ariaLabel={t('监督员', 'Supervisor')} /></div></div>
    <p className="competition-muted">{t('场次须在比赛起止时间内。', 'Sessions must fall within the competition window.')}</p><button type="button" className="competition-primary" disabled={!valid || busy} onClick={() => { void save(); }}>{t('保存场次', 'Save session')}</button>{editingId ? <button type="button" className="competition-secondary" onClick={() => { setEditingId(''); setStartsAt(''); setEndsAt(''); setCapacity(''); setSupervisor(''); }}>{t('取消修改', 'Cancel edit')}</button> : null}</fieldset>{error ? <p className="competition-error" role="alert">{error}</p> : null}{saved ? <p role="status">{saved}</p> : null}
  </section>;
}

function CompetitionParticipation({ competitionId, registration, finalized, onSaved }: { competitionId: string; registration: CompetitionRegistration; finalized: boolean; onSaved: () => void }) {
  const t = useT();
  const user = useAuthUser();
  const ownSmartEntry = registration.userId === user?.uid && registration.device === 'smart' && registration.project === '333' && registration.checkedInAt && !registration.resultRecordedAt;
  const [attempts, setAttempts] = useState<CompetitionAttempt[]>([]);
  const [seconds, setSeconds] = useState('');
  const [penalty, setPenalty] = useState<'none' | '+2' | 'DNF' | 'DNS'>('none');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dispute, setDispute] = useState('');
  const [disputeSaved, setDisputeSaved] = useState(false);
  useEffect(() => {
    let active = true;
    async function read() {
      try { const result = await getCompetitionAttempts(registration.id); if (active) setAttempts(result.attempts); }
      catch (error) { if (active) setError(message(error, t('尝试记录加载失败。', 'Could not load attempts.'))); }
    }
    void read();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [registration.id, revision, t]);
  const current = attempts.find(item => !item.recordedAt);
  const complete = attempts.length === 5 && attempts.every(item => item.recordedAt);
  const failed = penalty === 'DNF' || penalty === 'DNS';
  const validSeconds = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(seconds) && Number(seconds) > 0 && Number(seconds) <= 86400;
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); setSeconds(''); setPenalty('none'); setRevision(value => value + 1); onSaved(); }
    catch (error) { setError(message(error, t('操作未完成，请重试。', 'The action did not complete. Try again.'))); }
    finally { setBusy(false); }
  }
  const penaltyOptions = [{ value: 'none', label: t('无罚时', 'No penalty') }, { value: '+2', label: '+2' }, { value: 'DNF', label: 'DNF' }, { value: 'DNS', label: 'DNS' }];
  return <section className="competition-participation"><h2>{registration.displayName} {t('的赛场', '— competition session')}</h2>
    {!registration.resultRecordedAt && ['confirmed', 'attended'].includes(registration.status) ? ownSmartEntry
      ? <AppLink className="competition-primary" prefetch={false} href={`/timer?event=333&competition=${encodeURIComponent(competitionId)}&entry=${encodeURIComponent(registration.id)}`}>{t('进入智能魔方赛场', 'Enter smart cube session')}</AppLink>
      : <CompetitionVideoRoom registrationId={registration.id} /> : null}
    <p className="competition-muted">{registration.device === 'smart' ? t('智能魔方组：本场成绩仍须监督员当场确认。', 'Smart-cube division: the supervisor confirms each result during this session.') : t('保持双手、魔方与计时器可见，等待监督员发放打乱。', 'Keep your hands, cube and timer visible. Wait for the supervisor to release the scramble.')}</p>
    {current ? <div className="competition-current-attempt"><h3>{t(`第 ${current.attemptNumber} 次`, `Attempt ${current.attemptNumber}`)}</h3><p className="competition-scramble">{current.scramble}</p></div> : <p className="competition-muted">{complete ? t('五次尝试已记录。', 'All five attempts are recorded.') : t('等待下一次打乱。', 'Waiting for the next scramble.')}</p>}
    {registration.canRecordResult && !registration.resultRecordedAt ? <>
      {current ? <div className="competition-score-form"><label>{t('原始用时（秒）', 'Raw time (seconds)')}<input className="platform-field-control" type="number" inputMode="decimal" min="0.01" max={86400} step="0.01" value={seconds} disabled={failed} onChange={event => setSeconds(event.target.value)} /></label><CompactSelect value={penalty} label={penaltyOptions.find(item => item.value === penalty)!.label} items={penaltyOptions} onChange={value => setPenalty(value as typeof penalty)} ariaLabel={t('罚时', 'Penalty')} /><button className="competition-primary" type="button" disabled={busy || (!failed && !validSeconds)} onClick={() => { void act(() => recordCompetitionAttempt(registration.id, current.attemptNumber, { centiseconds: failed ? null : Math.round(Number(seconds) * 100), penalty })); }}>{t('确认本次成绩', 'Confirm attempt')}</button></div> : complete ? <button type="button" className="competition-primary" disabled={busy} onClick={() => { void act(() => finalizeCompetitionRegistration(registration.id)); }}>{t('确认完赛', 'Confirm completed result')}</button> : <button type="button" className="competition-primary" disabled={busy} onClick={() => { void act(() => nextCompetitionAttempt(registration.id)); }}>{t('发放下一次打乱', 'Release next scramble')}</button>}
    </> : null}
    <ol className="competition-attempts">{attempts.filter(item => item.recordedAt).map(item => <li key={item.attemptNumber}><span>{t(`第 ${item.attemptNumber} 次`, `Attempt ${item.attemptNumber}`)}</span><strong>{formatWcaResult(item.penalty === 'DNF' ? -1 : item.penalty === 'DNS' ? -2 : (item.centiseconds ?? 0) + (item.penalty === '+2' ? 200 : 0), registration.project, 'single')}{item.penalty === '+2' ? ' (+2)' : ''}</strong></li>)}</ol>
    {registration.resultRecordedAt ? <p role="status" className="competition-muted">{t('监督员已确认完赛，成绩已进入公示。', 'The supervisor confirmed the result. It is now available for review.')}</p> : null}
    {registration.resultRecordedAt && registration.userId === user?.uid && !finalized ? <details className="competition-rules"><summary>{t('对成绩有异议', 'Dispute this result')}</summary><label className="competition-field">{t('说明原因', 'Explain the issue')}<textarea className="platform-field-control" rows={3} maxLength={4000} value={dispute} onChange={event => { setDispute(event.target.value); setDisputeSaved(false); }} /></label><button type="button" className="competition-secondary" disabled={busy || !dispute.trim() || disputeSaved} onClick={() => { void act(async () => { await raiseCompetitionDispute(registration.id, dispute.trim()); setDisputeSaved(true); }); }}>{t('提交异议', 'Submit dispute')}</button>{disputeSaved ? <p role="status">{t('异议已提交，等待处理。', 'Dispute submitted for review.')}</p> : null}</details> : null}
    <CompetitionEvidenceFiles registrationId={registration.id} canUpload={!finalized} />
    {error ? <p role="alert" className="competition-error">{error}</p> : null}
  </section>;
}

function CompetitionResults({ id, revision }: { id: string; revision: number }) {
  const t = useT();
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void listCompetitionResults(id).then(result => { if (active) { setResults(result.results); setError(''); } })
      .catch(error => { if (active) setError(message(error, t('成绩加载失败。', 'Could not load results.'))); });
    return () => { active = false; };
  }, [id, revision, t]);
  const rows = results.map(result => {
    const times = result.attempts.map(item => item.penalty === 'DNF' ? -1 : item.penalty === 'DNS' ? -2 : (item.centiseconds ?? 0) + (item.penalty === '+2' ? 200 : 0));
    return { ...result, times, ...computeWcaBestAverage(times, result.project) };
  }).sort((a, b) => a.project.localeCompare(b.project) || a.device.localeCompare(b.device) || (a.average && a.average > 0 ? a.average : Infinity) - (b.average && b.average > 0 ? b.average : Infinity) || (a.best > 0 ? a.best : Infinity) - (b.best > 0 ? b.best : Infinity));
  const groups = Array.from(new Set(rows.map(row => `${row.project}:${row.device}`))).map(key => rows.filter(row => `${row.project}:${row.device}` === key));
  return <section className="competition-results"><h2>{t('比赛成绩', 'Results')}</h2>{error ? <p role="alert" className="competition-error">{error}</p> : !rows.length ? <p className="competition-muted">{t('完赛后在这里查看成绩。', 'Results will appear here after competitors finish.')}</p> : groups.map(group => <div key={`${group[0].project}:${group[0].device}`}><h3>{eventDisplayName(group[0].project, t('zh', 'en') === 'zh')} {group[0].device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube')}</h3>{group.map(row => {
    const rank = group.findIndex(other => other.average === row.average && other.best === row.best) + 1;
    return <div className="competition-result-row" key={row.id}><span className="competition-muted" aria-label={t(`第 ${rank} 名`, `Rank ${rank}`)}>{rank}</span><div><strong>{row.displayName}</strong><p>{row.finalizedAt ? t('最终成绩', 'Final') : t('公示中', 'Provisional')}</p></div><div><strong>{formatWcaResult(row.average ?? 0, row.project, 'average')}</strong><small>ao5</small></div><div><strong>{formatWcaResult(row.best, row.project, 'single')}</strong><small>{t('最佳', 'Best')}</small></div><details className="competition-result-attempts"><summary>{t('五次成绩', 'All attempts')}</summary><span>{row.times.map(value => formatWcaResult(value, row.project, 'single')).join(' / ')}</span></details></div>;
  })}</div>)}</section>;
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
    <h3>{t('成绩异议', 'Result disputes')}</h3>
    {!disputes.length ? <p className="competition-muted">{t('暂无异议。', 'No disputes.')}</p> : disputes.map(issue => <div className="competition-dispute" key={issue.id}>
      <strong>{registrations.find(item => item.id === issue.registrationId)?.displayName ?? t('参赛选手', 'Competitor')}</strong><p className="competition-muted">{dateText(issue.createdAt)}</p><p>{issue.reason}</p>
      {competition.canPublish ? <CompetitionEvidenceFiles registrationId={issue.registrationId} canUpload={false} /> : null}
      {issue.resolvedAt ? <p>{t('处理结果：', 'Resolution: ')}{issue.resolution}</p> : competition.canPublish ? <DisputeResolutionForm issue={issue} busy={busy} onResolve={(resolution, attempts) => act(() => resolveCompetitionDispute(issue.id, resolution, attempts))} /> : <p className="competition-muted">{t('等待 CubeRoot 处理。', 'Awaiting CubeRoot review.')}</p>}
    </div>)}
    {competition.status === 'published' && !settlement?.finalizedAt ? <div className="competition-toolbar"><button type="button" className="competition-secondary" disabled={busy || !ended} onClick={() => { void act(() => closeCompetitionSessions(competition.id)); }}>{t('处理缺赛成绩', 'Close unfinished entries')}</button>{competition.canPublish ? <button type="button" className="competition-secondary" disabled={busy || !ended || disputes.some(issue => !issue.resolvedAt)} onClick={() => { void act(() => finalizeCompetition(competition.id)); }}>{t('定稿比赛成绩', 'Finalize results')}</button> : null}<span className="competition-muted">{t('已结束场次中，未完成的已发打乱记 DNF，未发打乱记 DNS。比赛结束且异议处理后可定稿。', 'For ended sessions, unfinished issued attempts receive DNF and unissued attempts receive DNS. Finalize after the competition and dispute review end.')}</span></div> : null}
    <h3>{t('结算账单', 'Settlement statement')}</h3>
    {settlement ? <><dl className="competition-statement"><div><dt>{t('净收款', 'Net collected')}</dt><dd>{money(Number(settlement.netCollectedMinor), settlement.currency)}</dd></div><div><dt>{t('已退款', 'Refunded')}</dt><dd>{money(Number(settlement.refundedMinor), settlement.currency)}</dd></div><div><dt>{t('平台费用', 'Platform fee')}</dt><dd>{settlement.commissionBps == null ? t('未配置', 'Not configured') : money(Number(settlement.platformFeeMinor), settlement.currency)}</dd></div><div><dt>{t('主办方应收', 'Organizer proceeds')}</dt><dd>{settlement.commissionBps == null ? t('未配置', 'Not configured') : money(Number(settlement.organizerAmountMinor), settlement.currency)}</dd></div><div><dt>{t('预计可结算时间', 'Eligible from')}</dt><dd>{settlement.eligibleAt ? dateText(settlement.eligibleAt) : t('待确认条款与成绩', 'Pending terms and final results')}</dd></div></dl><p className="competition-muted">{recovery ? t('退款后存在应追回款项，请完成对账。', 'Refunds require a recovery payment and reconciliation.') : outstanding === 0 && settlement.transferStatus === 'recorded' ? t('当前款项已登记结清。', 'The current balance has been settled and recorded.') : settlement.eligible ? t('已满足结算条件，等待 CubeRoot 确认付款。', 'Eligible for settlement; awaiting CubeRoot payment confirmation.') : t('达到约定结算时间且成绩定稿后，方可结算。', 'Settlement requires finalized results and the agreed settlement date.')} {settlement.transferStatus === 'recorded' ? t('转账已登记。', 'Transfer recorded.') : t('此账单不代表已经转账。', 'This statement does not confirm a transfer.')}</p></> : null}
    {settlement?.transfers?.length ? <><h3>{t('已登记的转账', 'Recorded transfers')}</h3>{settlement.transfers.map(transfer => <p className="competition-muted" key={transfer.id}>{dateText(transfer.transferredAt ?? transfer.createdAt)} {transfer.entryType === 'adjustment' ? t('退款调整', 'Refund adjustment') : transfer.entryType === 'recovery' ? t('已收回款项', 'Recovered funds') : t('已完成转账', 'Completed transfer')} {money(Number(transfer.amountMinor), settlement.currency)}</p>)}</> : null}
    {settlement?.reconciliationRequired ? <p role="alert" className="competition-error">{t('已登记转账与当前应结算金额不一致，请联系 CubeRoot 对账。', 'Recorded transfers differ from the current settlement amount. Contact CubeRoot for reconciliation.')}</p> : null}
    {competition.canPublish && settlement && outstanding !== 0 && (recovery || settlement.eligible) ? <details className="competition-rules"><summary>{recovery ? t('登记已收回款项', 'Record recovered funds') : t('登记已完成转账', 'Record a completed transfer')}</summary><p>{t('先在线下完成转账，再登记凭据。这项操作只记账。', 'Complete the transfer externally, then record its reference here. This action records the transfer only.')}</p><p>{recovery ? t('应收回金额：', 'Recovery amount: ') : t('应转账金额：', 'Transfer amount: ')}{money(Math.abs(outstanding), settlement.currency)}</p><div className="competition-form-grid"><label>{t('转账凭据编号', 'Transfer reference')}<input className="platform-field-control" maxLength={200} value={providerReference} onChange={event => setProviderReference(event.target.value)} /></label><label>{t('实际转账时间（北京时间）', 'Actual transfer time (UTC+8)')}<input className="platform-field-control" type="datetime-local" value={transferredAt} onChange={event => setTransferredAt(event.target.value)} /></label></div><BoolToggle value={transferConfirmed} onChange={setTransferConfirmed} label={t('我已核对收款方、金额与转账凭据', 'I verified the recipient, amount and transfer reference')} /><button type="button" className="competition-secondary" disabled={busy || !providerReference.trim() || !transferredAt || !Number.isFinite(Date.parse(`${transferredAt}:00+08:00`)) || Date.parse(`${transferredAt}:00+08:00`) > now || !transferConfirmed} onClick={() => { void act(() => recordCompetitionSettlement(competition.id, { amountMinor: Math.abs(outstanding), direction: recovery ? 'recovery' : 'payout', providerReference: providerReference.trim(), transferredAt: isoDate(transferredAt) })); }}>{t('确认登记', 'Record transfer')}</button></details> : null}
    {error ? <p className="competition-error" role="alert">{error}</p> : null}{saved ? <p role="status" className="competition-muted">{saved}</p> : null}
  </section>;
}

function DisputeResolutionForm({ issue, busy, onResolve }: { issue: CompetitionDispute; busy: boolean; onResolve: (resolution: string, attempts?: CompetitionResult['attempts']) => Promise<void> }) {
  const t = useT();
  const [resolution, setResolution] = useState('');
  const [correct, setCorrect] = useState(false);
  const [attempts, setAttempts] = useState(Array.from({ length: 5 }, () => ({ seconds: '', penalty: 'none' as 'none' | '+2' | 'DNF' | 'DNS' })));
  const penalties = [{ value: 'none', label: t('无罚时', 'No penalty') }, { value: '+2', label: '+2' }, { value: 'DNF', label: 'DNF' }, { value: 'DNS', label: 'DNS' }];
  const valid = !correct || attempts.every(item => ['DNF', 'DNS'].includes(item.penalty) || (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(item.seconds) && Number(item.seconds) > 0 && Number(item.seconds) <= 86400));
  return <div><label className="competition-field">{t('处理说明', 'Resolution')}<textarea rows={3} className="platform-field-control" maxLength={4000} value={resolution} onChange={event => setResolution(event.target.value)} /></label>
    <BoolToggle value={correct} onChange={setCorrect} label={t('根据复核结果更正成绩', 'Correct the result after review')} />
    {correct ? <><p className="competition-muted">{t('填写复核后的全部五次原始用时与罚时。原成绩会保留在审核记录中。', 'Enter all five reviewed raw times and penalties. The original result remains in the audit record.')}</p>{attempts.map((item, index) => <div key={`${issue.id}:${index}`} className="competition-score-form"><label>{t(`第 ${index + 1} 次（秒）`, `Attempt ${index + 1} (seconds)`)}<input className="platform-field-control" type="number" step="0.01" min="0.01" max={86400} disabled={['DNF', 'DNS'].includes(item.penalty)} value={item.seconds} onChange={event => setAttempts(current => current.map((row, i) => i === index ? { ...row, seconds: event.target.value } : row))} /></label><CompactSelect value={item.penalty} label={penalties.find(value => value.value === item.penalty)!.label} items={penalties} ariaLabel={t(`第 ${index + 1} 次罚时`, `Penalty for attempt ${index + 1}`)} onChange={value => setAttempts(current => current.map((row, i) => i === index ? { ...row, penalty: value as typeof item.penalty } : row))} /></div>)}</> : null}
    <button type="button" className="competition-secondary" disabled={busy || !resolution.trim() || !valid} onClick={() => { void onResolve(resolution.trim(), correct ? attempts.map(item => ({ centiseconds: ['DNF', 'DNS'].includes(item.penalty) ? null : Math.round(Number(item.seconds) * 100), penalty: item.penalty })) : undefined); }}>{t('确认处理', 'Resolve dispute')}</button>
  </div>;
}

function CompetitionEvidenceFiles({ registrationId, canUpload }: { registrationId: string; canUpload: boolean }) {
  const t = useT();
  const [files, setFiles] = useState<CompetitionEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void listCompetitionEvidence(registrationId).then(result => { if (active) setFiles(result.evidence); })
      .catch(error => { if (active) setError(message(error, t('复核录像加载失败。', 'Could not load review recordings.'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [registrationId, revision, t]);
  async function upload(file: File) {
    setError('');
    if (file.size <= 0 || file.size > 64 * 1024 * 1024 || !['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      setError(t('请选择不超过 64 MiB 的 MP4、WebM 或 MOV 录像。', 'Choose an MP4, WebM or MOV recording up to 64 MiB.')); return;
    }
    setBusy(true);
    try { await uploadCompetitionEvidence(registrationId, file); setRevision(value => value + 1); }
    catch (error) { setError(message(error, t('录像上传失败。', 'Could not upload recording.'))); }
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
  return <details className="competition-rules"><summary>{t('复核录像', 'Review recordings')}</summary><p>{t('仅参赛选手、指定监督员与 CubeRoot 审核人员可查看。通常保留 30 天，未结异议期间继续保留。', 'Visible only to the competitor, assigned supervisor and CubeRoot reviewers. Retained for 30 days, or longer while a dispute remains unresolved.')}</p>
    {loading ? <p role="status">{t('正在加载…', 'Loading…')}</p> : files.length ? files.map(file => <div className="competition-toolbar" key={file.id}><span>{dateText(file.createdAt)} {Math.ceil(Number(file.sizeBytes) / 1024 / 1024)} MiB</span><button type="button" className="competition-secondary" disabled={busy} onClick={() => { void download(file); }}>{t('下载录像', 'Download recording')}</button></div>) : <p>{t('尚未上传复核录像。', 'No review recordings uploaded.')}</p>}
    {canUpload ? <label className="competition-field">{t('上传争议复核片段', 'Upload a dispute review clip')}<input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={busy || loading || files.length >= 2} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /><small>{t('最多 2 个文件，每个不超过 64 MiB。', 'Up to 2 files, 64 MiB each.')}</small></label> : null}
    {busy ? <p role="status">{t('正在处理录像…', 'Processing recording…')}</p> : null}{error ? <p role="alert" className="competition-error">{error}</p> : null}
  </details>;
}
