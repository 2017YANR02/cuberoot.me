'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { competitionDateTime as date } from '@/lib/competition-date';
import { competitionHref } from '@/lib/competition-links';
import { eventDisplayName } from '@/lib/wca-events';
import { listCompetitionReviewQueue, reviewCompetition, type OnlineCompetition, type CompetitionSupervisor } from '@/lib/online-competition-api';
import { CompetitionSettlementFields, competitionDeviceName, competitionFormatName, competitionModeName, parseCompetitionSettlementTerms } from './CompetitionDraftForm';

export function CompetitionReviewQueue() {
  const t = useT();
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof listCompetitionReviewQueue>> | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  useEffect(() => {
    let active = true;
    void listCompetitionReviewQueue().then(result => {
      if (active) { setQueue(result); setError(''); }
    }).catch(cause => { if (active) setError(String(cause instanceof Error ? cause.message : cause)); });
    return () => { active = false; };
  }, [revision]);
  if (error) return <div role="alert"><p>{error}</p><button type="button" className="competition-secondary" onClick={() => setRevision(n => n + 1)}>{t('重试', 'Retry')}</button></div>;
  if (!queue) return <LoadingIndicator>{t('正在读取待审赛事…', 'Loading competitions awaiting review…')}</LoadingIndicator>;
  if (!queue.competitions.length) return <p>{t('暂无待审赛事。', 'No pending competitions.')}</p>;
  return <div className="competition-review-queue">
    {queue.competitions.map(item => <article key={item.id} className="competition-review-card" data-site-surface="panel">
      <h2>{t(item.titleZh || item.titleEn, item.titleEn || item.titleZh)}</h2>
      <p>{item.organizationName} · {date(item.startsAt)} – {date(item.endsAt)}</p>
      {selected === item.id
        ? <ReviewDetails item={item} supervisors={queue.supervisors} onSaved={() => { setSelected(''); setRevision(n => n + 1); }} />
        : <button type="button" className="competition-secondary" onClick={() => setSelected(item.id)}>{t('审核赛事', 'Review competition')}</button>}
    </article>)}
  </div>;
}

function ReviewDetails({ item, supervisors, onSaved }: { item: OnlineCompetition; supervisors: CompetitionSupervisor[]; onSaved: () => void }) {
  const t = useT();
  const lang = useLang();
  const { id } = item;
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState({
    rate: item.commissionBps == null ? '' : String(item.commissionBps / 100),
    days: item.settlementDays == null ? '' : String(item.settlementDays),
    anchor: item.settlementAnchor ?? '',
  } as { rate: string; days: string; anchor: string });
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paid = item.projects.some(p => p.amountMinor > 0);
  const settlement = parseCompetitionSettlementTerms(terms);
  const needsAssignment = item.sessions.filter(s => s.assistanceRequested && !s.staffed);
  async function decide(decision: 'approve' | 'reject') {
    setBusy(true); setError('');
    try {
      await reviewCompetition(id, { decision, note: note.trim(), ...(item.submittedAt ? { submittedAt: item.submittedAt } : {}), ...(decision === 'approve' ? {
        ...settlement, supervisorAssignments: needsAssignment.map(s => ({ sessionId: s.id, supervisorUserId: assignments[s.id] })),
      } : {}) });
      onSaved();
    } catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); }
    finally { setBusy(false); }
  }
  return <>
    <p>{competitionModeName(item.supervisionMode ?? 'supervised', t)} · {competitionFormatName(item.format ?? 'average', t)}</p>
    <p>{t('报名时间', 'Registration')} {date(item.registrationOpensAt)} – {date(item.registrationClosesAt)}</p>
    <ul className="competition-review-projects">{item.projects.map(p => <li key={p.id}>
      <EventIcon event={p.project} /> {eventDisplayName(p.project, lang === 'zh')} · {competitionDeviceName(p.device, t)} · {t(`${p.capacity} 位`, `${p.capacity} places`)} · {new Intl.NumberFormat(lang, { style: 'currency', currency: p.currency }).format(p.amountMinor / 100)}
    </li>)}</ul>
    {item.offlineVenue && <p>{[item.offlineVenue.city, item.offlineVenue.address, item.offlineVenue.contact, item.offlineVenue.checkinGuide].filter(Boolean).join(' · ')}</p>}
    <p className="competition-review-policy">{item.refundPolicy}</p>
    <p className="competition-review-policy">{item.recordingPolicy}</p>
    <AppLink href={competitionHref(id)} prefetch={false}>{t('预览报名页', 'Preview registration')}</AppLink>
    {item.sessions.filter(s => !s.kind || s.kind === 'supervised').map(s => <div className="competition-field competition-review-session" key={s.id}>
      <span>{date(s.startsAt)} – {date(s.endsAt)} · {t(`${s.capacity} 位`, `${s.capacity} places`)}</span>
      {s.staffed ? <span>{t('已排班', 'Assigned')}</span> : s.assistanceRequested && <label className="competition-field">
        {t('指派平台监督员', 'Assign a platform supervisor')}
        <select className="platform-field-control" value={assignments[s.id] ?? ''} onChange={event => setAssignments(current => ({ ...current, [s.id]: Number(event.target.value) }))}>
          <option value="">{t('选择监督员', 'Choose a supervisor')}</option>{supervisors.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>}
    </div>)}
    {paid && <CompetitionSettlementFields terms={terms} onChange={setTerms} />}
    <label className="competition-field">{t('审核意见', 'Review note')}<textarea className="platform-field-control" rows={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label>
    <div className="competition-toolbar">
      <button type="button" className="competition-primary" disabled={busy || (paid && !settlement) || needsAssignment.some(s => !assignments[s.id])} onClick={() => void decide('approve')}>{t('批准并正式发布', 'Approve and publish')}</button>
      <button type="button" className="competition-secondary" disabled={busy || !note.trim()} onClick={() => void decide('reject')}>{t('退回修改', 'Request changes')}</button>
    </div>
    {error && <p className="competition-error" role="alert">{error}</p>}
  </>;
}
