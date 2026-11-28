'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check } from '@app-foundation/icons/lucide';
import { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import AppLink from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import BoolToggle from '@/components/BoolToggle';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { COMPETITION_CHECK_IN_LEAD_MS } from '@cuberoot/shared/timer';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { hasAdminAccess, useAuthUser } from '@/lib/auth-store';
import { competitionDateInput, competitionDateIso, competitionDateTime } from '@/lib/competition-date';
import { competitionWorkspaceHref } from '@/lib/competition-links';
import {
  competitionSupervisors, createOnlineCompetition, publishOnlineCompetition, updateCompetitionDraft,
  type CompetitionDraftSettings, type CompetitionMode, type CompetitionRefundTemplate,
  type CompetitionSetup, type CompetitionSettlementTerms, type CompetitionSupervisor, type OnlineCompetition,
} from '@/lib/online-competition-api';
import { createCompetitionSlug } from './competition-slug';

const timedProjects = new Set<string>(WCA_TIMED_EVENT_ORDER);
const smartProjects = new Set<string>(['333']);
const noUnofficialProjects = new Set<string>();
const modes = ['self_service', 'supervised', 'offline'] as const;
const formats = ['average', 'advancement'] as const;
const devices = ['ordinary', 'smart'] as const;
const refundTemplates = ['before_24h', 'before_start', 'custom'] as const;
const emptyVenue = { city: '', address: '', contact: '', checkinGuide: '' };

export function competitionModeName(mode: CompetitionMode, t: ReturnType<typeof useT>) {
  const labels = {
    self_service: t('线上自助', 'Online self-service'),
    supervised: t('视频监考', 'Live supervision'),
    offline: t('线下合作', 'In-person partner event'),
  };
  return labels[mode];
}
export function competitionFormatName(format: CompetitionSetup['format'], t: ReturnType<typeof useT>) {
  return format === 'advancement' ? t('1v1 双败淘汰', '1v1 double elimination') : t('Ao5 竞速', 'Ao5 speed competition');
}
export function competitionDeviceName(device: CompetitionSetup['device'], t: ReturnType<typeof useT>) {
  return device === 'smart' ? t('智能魔方', 'Smart cube') : t('普通魔方', 'Standard cube');
}

type ProjectInput = { key: number; project: string; device: CompetitionSetup['device']; fee: string; capacity: string };
type SessionInput = { key: number; startsAt: string; endsAt: string; capacity: string; supervisorUserId: number | null; assistanceRequested: boolean };
const emptyProject: ProjectInput = { key: 0, project: '', device: 'ordinary', fee: '', capacity: '' };
const validMoney = (value: string) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim());
const validInteger = (value: string, min: number, max: number) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;

export function CompetitionSettlementFields({ terms, onChange }: {
  terms: { rate: string; days: string; anchor: string };
  onChange: (terms: { rate: string; days: string; anchor: string }) => void;
}) {
  const t = useT();
  return <div className="competition-form-grid">
    <label>{t('平台抽成比例（%）', 'Platform commission (%)')}<input className="platform-field-control" type="number" min={0} max={100} step="0.01" value={terms.rate} onChange={event => onChange({ ...terms, rate: event.target.value })} /></label>
    <label>{t('结算起点', 'Settlement starts from')}<select className="platform-field-control" value={terms.anchor} onChange={event => onChange({ ...terms, anchor: event.target.value })}>
      <option value="">{t('选择结算起点', 'Choose starting point')}</option>
      <option value="ended">{t('比赛结束', 'Competition end')}</option><option value="finalized">{t('成绩定稿', 'Final results')}</option>
    </select></label>
    <label>{t('结算等待天数', 'Settlement delay in days')}<input className="platform-field-control" type="number" min={0} max={3650} value={terms.days} onChange={event => onChange({ ...terms, days: event.target.value })} /></label>
  </div>;
}
export function parseCompetitionSettlementTerms(terms: { rate: string; days: string; anchor: string }): CompetitionSettlementTerms | undefined {
  if (!validMoney(terms.rate) || Number(terms.rate) > 100 || !validInteger(terms.days, 0, 3650) || (terms.anchor !== 'ended' && terms.anchor !== 'finalized')) return undefined;
  return { commissionBps: Math.round(Number(terms.rate) * 100), settlementDays: Number(terms.days), settlementAnchor: terms.anchor };
}

export function CompetitionDraftForm({ organizers = [], competition, onSaved, onCreated }: {
  organizers?: Array<{ id: string; name: string }>;
  competition?: OnlineCompetition;
  onSaved?: () => void;
  onCreated?: (id: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const admin = hasAdminAccess(useAuthUser());
  const router = useEntryRouter();
  const [step, setStep] = useState(0);
  const [organizationId, setOrganizationId] = useState('');
  const selectedOrganization = competition?.organizationId ?? (organizationId || (organizers.length === 1 ? organizers[0].id : ''));
  const [titleZh, setTitleZh] = useState(competition?.titleZh ?? '');
  const [titleEn, setTitleEn] = useState(competition?.titleEn ?? '');
  const [format, setFormat] = useState(competition?.format ?? competition?.setup?.format ?? 'average');
  const [mode, setMode] = useState<CompetitionMode>(competition?.supervisionMode ?? 'supervised');
  const [projects, setProjects] = useState<ProjectInput[]>(() => {
    if (competition?.projects.length) return competition.projects.map((p, key) => ({ ...p, key, fee: String(p.amountMinor / 100), capacity: String(p.capacity) }));
    const old = competition?.setup;
    return old?.project ? [{ key: 0, project: old.project, device: old.device, fee: String((old.feeMinor ?? 0) / 100), capacity: String(old.capacity) }] : [emptyProject];
  });
  const [sessions, setSessions] = useState<SessionInput[]>(() => (competition?.sessions ?? []).filter(s => !s.kind || s.kind === 'supervised').map((s, key) => ({
    ...s, key, startsAt: competitionDateInput(s.startsAt), endsAt: competitionDateInput(s.endsAt), capacity: String(s.capacity),
  })));
  const nextRow = useRef(100);
  const [supervisors, setSupervisors] = useState<CompetitionSupervisor[]>([]);
  const [staffError, setStaffError] = useState(false);
  const [venue, setVenue] = useState(competition?.offlineVenue ?? emptyVenue);
  const [dates, setDates] = useState({
    registrationOpensAt: competitionDateInput(competition?.registrationOpensAt ?? ''),
    registrationClosesAt: competitionDateInput(competition?.registrationClosesAt ?? ''),
    startsAt: competitionDateInput(competition?.startsAt ?? ''),
    endsAt: competitionDateInput(competition?.endsAt ?? ''),
  });
  const [refundTemplate, setRefundTemplate] = useState<CompetitionRefundTemplate>(competition?.refundTemplate ?? 'before_24h');
  const [refund, setRefund] = useState(competition?.refundPolicy ?? '');
  const [recording, setRecording] = useState(competition?.recordingPolicy ?? '');
  const [terms, setTerms] = useState({
    rate: competition?.commissionBps == null ? '' : String(competition.commissionBps / 100),
    days: competition?.settlementDays == null ? '' : String(competition.settlementDays),
    anchor: competition?.settlementAnchor ?? '',
  } as { rate: string; days: string; anchor: string });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedDraftId, setSavedDraftId] = useState(competition?.id ?? '');
  const [saved, setSaved] = useState('');
  const slug = useRef('');
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const persisted = useRef('');
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const initialStep = useRef(true);
  const steps = [t('比赛与项目', 'Competition and events'), t('时间与场次', 'Schedule and sessions'), t('规则与提交', 'Rules and submission')];

  useEffect(() => {
    if (initialStep.current) { initialStep.current = false; return; }
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!selectedOrganization || mode !== 'supervised' || step !== 1) return;
    let active = true;
    setSupervisors([]); setStaffError(false);
    void competitionSupervisors(selectedOrganization).then(result => { if (active) setSupervisors(result.supervisors); })
      .catch(() => { if (active) setStaffError(true); });
    return () => { active = false; };
  }, [mode, selectedOrganization, step]);

  const minimum = format === 'advancement' ? 2 : 1;
  const paid = projects.some(p => Number(p.fee) > 0);
  const settlement = parseCompetitionSettlementTerms(terms);
  const templateLabels = {
    before_24h: t('开赛前 24 小时可申请全额退款', 'Full refund requests until 24 hours before the competition'),
    before_start: t('开赛前可申请全额退款', 'Full refund requests before the competition'),
    custom: t('自定义', 'Custom'),
  };
  const refundPolicy = refund.trim() || (refundTemplate === 'custom' ? '' : templateLabels[refundTemplate]);
  const validDates = Object.values(dates).every(value => value && Number.isFinite(Date.parse(value + ':00+08:00')));
  const detailIssue = !selectedOrganization ? t('请选择主办组织。', 'Choose an organizer.')
    : !titleZh.trim() && !titleEn.trim() ? t('请填写比赛名称。', 'Enter a competition name.')
      : projects.some(p => !timedProjects.has(p.project) || (p.device === 'smart' && p.project !== '333')
        || !validMoney(p.fee) || Number(p.fee) > 100000 || !validInteger(p.capacity, minimum, 1000000))
        ? t('请检查每个项目的组别、费用和名额。免费比赛填 0。', 'Check each event, division, fee and capacity. Enter 0 for free entry.')
        : new Set(projects.map(p => `${p.project}:${p.device}`)).size !== projects.length ? t('项目和设备组别重复。', 'An event and equipment division appears twice.') : '';
  const scheduleIssue = !validDates ? t('请填写报名和比赛的四个时间。', 'Enter all four registration and competition times.')
    : dates.registrationOpensAt >= dates.registrationClosesAt || dates.startsAt >= dates.endsAt || dates.registrationClosesAt > dates.startsAt
      ? t('请按顺序设置报名和比赛时间。', 'Set registration and competition times in chronological order.')
      : mode === 'offline' && (!venue.city.trim() || !venue.address.trim()) ? t('请填写城市和场馆地址。', 'Enter the city and venue address.')
        : mode === 'supervised' && sessions.some(s => !s.startsAt || !s.endsAt || s.startsAt < dates.startsAt || s.endsAt > dates.endsAt || s.startsAt >= s.endsAt || !validInteger(s.capacity, 1, 1000))
          ? t('请检查场次时间和名额。', 'Check session times and capacities.') : '';

  function applySchedule(preset: 'tonight' | 'weekend' | 'next_week') {
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const now = Math.ceil(Date.now() / minute) * minute;
    // The form and API interpret its wall times as Beijing time.
    const midnight = Date.parse(competitionDateInput(new Date(now).toISOString()).slice(0, 10) + 'T00:00:00+08:00');
    const weekday = new Date(midnight + 8 * hour).getUTCDay();
    const saturday = midnight + ((6 - weekday + 7) % 7) * day;
    const nextMonday = midnight + (((8 - weekday) % 7) || 7) * day;
    const weekendStart = saturday + 10 * hour;
    const starts = preset === 'tonight' ? Math.max(midnight + 19 * hour, now + hour)
      : preset === 'weekend' ? weekendStart + (weekendStart <= now + hour ? 7 * day : 0)
        : nextMonday + 19 * hour;
    const ends = starts + (preset === 'tonight' ? 2 * hour : preset === 'weekend' ? 32 * hour : 6 * day + 3 * hour);
    const input = (time: number) => competitionDateInput(new Date(time).toISOString());
    const next = { registrationOpensAt: input(now), registrationClosesAt: input(starts - Math.max(15 * minute, COMPETITION_CHECK_IN_LEAD_MS)),
      startsAt: input(starts), endsAt: input(ends) };
    setDates(next);
    setError('');
    if (mode !== 'supervised') return;
    setSessions(current => current.map(session => {
      const oldStart = Date.parse(session.startsAt + ':00+08:00');
      const oldEnd = Date.parse(session.endsAt + ':00+08:00');
      const oldWindowStart = Date.parse(dates.startsAt + ':00+08:00');
      if (!Number.isFinite(oldStart) || !Number.isFinite(oldEnd) || !Number.isFinite(oldWindowStart)
        || (session.startsAt === dates.startsAt && session.endsAt === dates.endsAt)) {
        return { ...session, startsAt: next.startsAt, endsAt: next.endsAt };
      }
      const duration = Math.max(minute, Math.min(oldEnd - oldStart, ends - starts));
      const shifted = Math.min(ends - duration, starts + Math.max(0, oldStart - oldWindowStart));
      return { ...session, startsAt: input(shifted), endsAt: input(shifted + duration) };
    }));
  }

  function changeProject(key: number, update: Partial<ProjectInput>) {
    setProjects(current => current.map(row => row.key === key ? { ...row, ...update } : row));
  }

  function changeSession(key: number, update: Partial<SessionInput>) {
    setSessions(current => current.map(row => row.key === key ? { ...row, ...update } : row));
  }

  async function save(submit: boolean) {
    if (busy) return;
    setError(''); setSaved('');
    if (detailIssue || scheduleIssue) { setStep(detailIssue ? 0 : 1); setError(detailIssue || scheduleIssue); return; }
    if (submit && (!refundPolicy || !recording.trim() || (admin && paid && !settlement))) {
      setError(t('请填写规则和适用的结算条款。', 'Fill in the rules and applicable settlement terms.'));
      return;
    }
    if (submit && mode === 'supervised' && (!sessions.length || sessions.some(s => !s.supervisorUserId && (admin || !s.assistanceRequested)))) {
      setStep(1); setError(t('请为所有场次安排监督员或申请协助。', 'Assign a supervisor or request help for every session.'));
      return;
    }
    const payload: CompetitionDraftSettings = {
      titleZh: titleZh.trim(), titleEn: titleEn.trim(), supervisionMode: mode, format,
      projects: projects.map(p => ({ project: p.project, device: p.device, amountMinor: Math.round(Number(p.fee) * 100), capacity: Number(p.capacity) })),
      sessions: mode === 'supervised' ? sessions.map(s => ({
        startsAt: competitionDateIso(s.startsAt), endsAt: competitionDateIso(s.endsAt), capacity: Number(s.capacity),
        supervisorUserId: s.supervisorUserId, assistanceRequested: s.assistanceRequested,
      })) : [],
      ...(mode === 'offline' ? { offlineVenue: venue } : {}),
      startsAt: competitionDateIso(dates.startsAt), endsAt: competitionDateIso(dates.endsAt),
      registrationOpensAt: competitionDateIso(dates.registrationOpensAt), registrationClosesAt: competitionDateIso(dates.registrationClosesAt),
      refundTemplate, refundPolicy, recordingPolicy: recording.trim(),
    };
    slug.current ||= createCompetitionSlug(titleZh || titleEn, 'competition');
    const fingerprint = JSON.stringify([savedDraftId, selectedOrganization, slug.current, payload]);
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, key: crypto.randomUUID() };
    const key = requestRef.current.key;
    setBusy(true);
    try {
      let draftId = savedDraftId;
      const snapshot = JSON.stringify(payload);
      if (persisted.current !== snapshot) {
        const draft = draftId
          ? await updateCompetitionDraft(draftId, payload, key)
          : await createOnlineCompetition({ ...payload, organizationId: selectedOrganization, slug: slug.current }, key);
        draftId = draft.id;
        setSavedDraftId(draftId);
        persisted.current = snapshot;
        submission.current = null;
      }
      if (submit) {
        const fingerprint = JSON.stringify([draftId, settlement]);
        if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, key: crypto.randomUUID() };
        await publishOnlineCompetition(draftId, admin && paid ? settlement : undefined, submission.current.key);
      }
      setSaved(submit ? admin ? t('比赛已发布。', 'Competition published.') : t('已提交平台审核。', 'Submitted for review.') : t('草稿已保存。', 'Draft saved.'));
      if (competition) onSaved?.();
      else if (onCreated) onCreated(draftId);
      else router.push((lang === 'zh' ? '/zh' : '') + competitionWorkspaceHref('manage', draftId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('保存或提交失败，请重试。', 'Could not save or submit. Try again.'));
    } finally { setBusy(false); }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 2) { void save(true); return; }
    const issue = step === 0 ? detailIssue : scheduleIssue;
    setError(issue);
    if (!issue) setStep(step + 1);
  }

  const primaryTitle = lang === 'zh' ? titleZh : titleEn;
  const alternateTitle = lang === 'zh' ? titleEn : titleZh;
  const setPrimaryTitle = lang === 'zh' ? setTitleZh : setTitleEn;
  const setAlternateTitle = lang === 'zh' ? setTitleEn : setTitleZh;
  return <section className="competition-editor competition-setup">
    {competition?.reviewNote && <p className="competition-review-note" role="status">{competition.reviewNote}</p>}
    {competition?.reviewStatus === 'pending_approval' && <p className="competition-muted">{t('赛事正在审核。保存修改后需要重新提交。', 'Review is pending. Saving changes requires resubmission.')}</p>}
    <ol className="competition-setup-progress competition-draft-progress" aria-label={t('发布进度', 'Publication progress')}>
      {steps.map((label, index) => {
        const completed = index < step;
        return <li key={label} aria-current={index === step ? 'step' : undefined} data-complete={completed || undefined}>
          {completed ? <button type="button" className="competition-setup-step" disabled={busy} onClick={() => { setError(''); setStep(index); }}>
            <span aria-hidden><Check size={15} /></span><span>{label}</span>
          </button> : <div className="competition-setup-step"><span aria-hidden>{index + 1}</span><span>{label}</span></div>}
        </li>;
      })}
    </ol>
    <form className="competition-setup-panel" data-site-surface="panel" noValidate onSubmit={onSubmit}>
      <h2 ref={heading} tabIndex={-1}>{steps[step]}</h2>
      <fieldset className="competition-form-fields" disabled={busy}>
        {step === 0 && <>
          <div className="competition-form-grid">
            <label>{t('主办组织', 'Organizer')}
              {competition || savedDraftId || organizers.length === 1 ? <strong>{competition?.organizationName ?? organizers.find(org => org.id === selectedOrganization)?.name}</strong>
                : <select className="platform-field-control" value={selectedOrganization} onChange={event => { setOrganizationId(event.target.value); setSessions([]); }}>
                  <option value="">{t('选择主办组织', 'Choose an organizer')}</option>{organizers.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>}
            </label>
            <label>{t('比赛名称', 'Competition name')}<input className="platform-field-control" maxLength={160} value={primaryTitle} onChange={event => setPrimaryTitle(event.target.value)} /></label>
            <label>{t('比赛形态', 'Competition mode')}<select className="platform-field-control" value={mode} onChange={event => setMode(event.target.value as CompetitionMode)}>
              {modes.map(value => <option key={value} value={value}>{competitionModeName(value, t)}</option>)}
            </select></label>
            <label>{t('赛制', 'Format')}<select className="platform-field-control" value={format} onChange={event => setFormat(event.target.value as typeof format)}>
              {formats.map(value => <option key={value} value={value}>{competitionFormatName(value, t)}</option>)}
            </select></label>
          </div>
          <details className="competition-rules competition-alternate-title" open={alternateTitle ? true : undefined}>
            <MoreToggle as="summary">{t('另一语言的比赛名称', 'Competition name in the other language')}</MoreToggle>
            <input aria-label={t('英文比赛名称', 'Chinese competition name')} className="platform-field-control" maxLength={160} value={alternateTitle} onChange={event => setAlternateTitle(event.target.value)} />
          </details>
          <h3>{t('比赛项目', 'Events')}</h3>
          {projects.map(row => <div className="competition-project-editor" key={row.key}>
            <PuzzlePicker selectedEvent={row.project || undefined} wcaEvents={row.device === 'smart' ? smartProjects : timedProjects} availableEvents={noUnofficialProjects}
              isZh={lang === 'zh'} placeholderLabel={t('选择比赛项目', 'Choose an event')} showTriggerLabel showArrow onSelect={value => changeProject(row.key, { project: value })} />
            <label>{t('设备组别', 'Equipment division')}<select className="platform-field-control" value={row.device} onChange={event => {
              const device = event.target.value as ProjectInput['device'];
              changeProject(row.key, { device, project: device === 'smart' ? '333' : row.project });
            }}>{devices.map(value => <option key={value} value={value}>{competitionDeviceName(value, t)}</option>)}</select></label>
            <label>{t('报名费（元）', 'Entry fee (CNY)')}<input className="platform-field-control" type="number" inputMode="decimal" min={0} step="0.01" value={row.fee} onChange={event => changeProject(row.key, { fee: event.target.value })} /></label>
            <label>{t('名额', 'Capacity')}<input className="platform-field-control" type="number" min={minimum} value={row.capacity} onChange={event => changeProject(row.key, { capacity: event.target.value })} /></label>
            {projects.length > 1 && <button className="competition-secondary" type="button" onClick={() => setProjects(current => current.filter(p => p.key !== row.key))}>{t('移除项目', 'Remove event')}</button>}
          </div>)}
          {projects.length < 8 && <button className="competition-secondary" type="button" onClick={() => {
            const key = nextRow.current++;
            setProjects(current => [...current, { ...emptyProject, key }]);
          }}>{t('添加项目', 'Add event')}</button>}
        </>}
        {step === 1 && <>
          <p className="competition-muted">{t('所有时间使用北京时间（UTC+8）。', 'All times are in Beijing time (UTC+8).')}</p>
          <div className="competition-schedule-presets" role="group" aria-label={t('时间快捷预设', 'Schedule presets')}>
            <button className="competition-secondary" type="button" onClick={() => applySchedule('tonight')}>{t('今晚快赛（2 小时）', 'Tonight · 2 hours')}</button>
            <button className="competition-secondary" type="button" onClick={() => applySchedule('weekend')}>{t('本周末两日赛', 'Weekend · 2 days')}</button>
            <button className="competition-secondary" type="button" onClick={() => applySchedule('next_week')}>{t('下周常规赛', 'Next week · 7 days')}</button>
          </div>
          <div className="competition-form-grid">{([
            ['registrationOpensAt', t('报名开放', 'Registration opens')], ['registrationClosesAt', t('报名截止', 'Registration closes')],
            ['startsAt', t('比赛开始', 'Competition starts')], ['endsAt', t('比赛结束', 'Competition ends')],
          ] as const).map(([key, label]) => <label key={key}>{label}<input className="platform-field-control" type="datetime-local" value={dates[key]} onChange={event => setDates({ ...dates, [key]: event.target.value })} /></label>)}</div>
          {mode === 'self_service' && <p>{t('系统会创建覆盖整个赛期的自助场次。', 'An automatic session covers the entire competition window.')}</p>}
          {mode === 'offline' && <div className="competition-form-grid">{([
            ['city', t('城市', 'City')], ['address', t('场馆地址', 'Venue address')],
            ['contact', t('联系方式', 'Contact')], ['checkinGuide', t('签到指引', 'Check-in instructions')],
          ] as const).map(([key, label]) => <label key={key}>{label}<input className="platform-field-control" value={venue[key]} onChange={event => setVenue({ ...venue, [key]: event.target.value })} /></label>)}</div>}
          {mode === 'supervised' && <>
            <h3>{t('监督排班', 'Supervision schedule')}</h3>
            {staffError && <p role="status">{t('暂时无法读取监督员名单。', 'The supervisor list is temporarily unavailable.')}</p>}
            {sessions.map(session => <fieldset className="competition-time-group" key={session.key}>
              <div className="competition-form-grid">
                <label>{t('场次开始', 'Session starts')}<input className="platform-field-control" type="datetime-local" value={session.startsAt} onChange={event => changeSession(session.key, { startsAt: event.target.value })} /></label>
                <label>{t('场次结束', 'Session ends')}<input className="platform-field-control" type="datetime-local" value={session.endsAt} onChange={event => changeSession(session.key, { endsAt: event.target.value })} /></label>
                <label>{t('场次名额', 'Session capacity')}<input className="platform-field-control" type="number" min={1} max={1000} value={session.capacity} onChange={event => changeSession(session.key, { capacity: event.target.value })} /></label>
                <label>{t('监督员', 'Supervisor')}<select className="platform-field-control" value={session.supervisorUserId ?? ''} onChange={event => changeSession(session.key, { supervisorUserId: Number(event.target.value) || null, assistanceRequested: false })}>
                  <option value="">{t('选择监督员', 'Choose a supervisor')}</option>
                  {session.supervisorUserId && !supervisors.some(s => s.id === session.supervisorUserId) && <option value={session.supervisorUserId}>{t('当前监督员', 'Current supervisor')}</option>}
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></label>
                <BoolToggle label={t('请 CubeRoot 协助指派', 'Ask CubeRoot to assign a supervisor')} value={session.assistanceRequested} onChange={value => changeSession(session.key, { assistanceRequested: value, ...(value ? { supervisorUserId: null } : {}) })} />
                <button className="competition-secondary" type="button" onClick={() => setSessions(current => current.filter(s => s.key !== session.key))}>{t('移除场次', 'Remove session')}</button>
              </div>
            </fieldset>)}
            {sessions.length < 100 && <button className="competition-secondary" type="button" onClick={() => {
              const key = nextRow.current++;
              setSessions(current => [...current, { key, startsAt: dates.startsAt, endsAt: dates.endsAt, capacity: '16', supervisorUserId: null, assistanceRequested: false }]);
            }}>{t('添加场次', 'Add session')}</button>}
          </>}
        </>}
        {step === 2 && <>
          <div className="competition-policy-fields">
            <label>{t('退款规则模板', 'Refund policy template')}<select className="platform-field-control" value={refundTemplate} onChange={event => {
              const template = event.target.value as CompetitionRefundTemplate;
              setRefundTemplate(template);
              if (template !== 'custom') setRefund(templateLabels[template]);
            }}>
              {refundTemplates.map(value => <option key={value} value={value}>{templateLabels[value]}</option>)}
            </select></label>
            <label>{t('退款说明', 'Refund instructions')}<textarea className="platform-field-control" rows={3} placeholder={refundPolicy} maxLength={10000} value={refund} onChange={event => setRefund(event.target.value)} /></label>
            <label>{t('录像与争议', 'Recording and disputes')}<textarea className="platform-field-control" rows={3} maxLength={10000} value={recording} onChange={event => setRecording(event.target.value)} /></label>
          </div>
          {admin && paid && <CompetitionSettlementFields terms={terms} onChange={setTerms} />}
          <div className="competition-draft-summary" data-site-surface="panel">
            <strong>{primaryTitle || alternateTitle}</strong>
            <p>{competitionModeName(mode, t)} · {competitionFormatName(format, t)} · {t(`${projects.length} 个组别`, `${projects.length} divisions`)}</p>
            <p>{competitionDateTime(competitionDateIso(dates.startsAt))} – {competitionDateTime(competitionDateIso(dates.endsAt))}</p>
          </div>
        </>}
        {error && <p className="competition-error" role="alert">{error}</p>}
        {saved && <p role="status">{saved}</p>}
        <div className="competition-setup-footer">
          {step > 0 && <button type="button" className="competition-secondary" onClick={() => { setError(''); setStep(step - 1); }}>{t('上一步', 'Previous')}</button>}
          {step === 2 && <button type="button" className="competition-secondary" onClick={() => { void save(false); }}>{t('保存草稿', 'Save draft')}</button>}
          <button type="submit" className="competition-primary">{busy ? t('正在保存…', 'Saving…') : step < 2 ? t('下一步', 'Next') : admin ? t('立即发布', 'Publish now') : t('提交平台审核', 'Submit for review')}</button>
        </div>
      </fieldset>
    </form>
    {!competition && savedDraftId && (onCreated
      ? <button className="competition-secondary" type="button" onClick={() => onCreated(savedDraftId)}>{t('查看已保存赛事', 'View saved competition')}</button>
      : <AppLink href={competitionWorkspaceHref('manage', savedDraftId)}>{t('查看已保存赛事', 'View saved competition')}</AppLink>)}
  </section>;
}
