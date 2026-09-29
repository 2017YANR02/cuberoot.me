'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { CalendarClock, CalendarDays, CalendarX, Copy, Pencil, Plus, RefreshCw, Video } from 'lucide-react';
import { meetingOccurrences, type MeetingPlan } from '@cuberoot/shared/meeting';
import { toLocalIsoDate } from '@cuberoot/shared/iso-date';
import { ClearButton } from '@/components/ClearButton';
import { ListSelect } from '@/components/ListSelect';
import { tr } from '@/i18n/tr';
import { cancelMeetingPlan, fetchMeetingPlans } from '@/lib/meeting-api';
import { isMeetCode, normalizeMeetCode } from '@/lib/video-room-api';
import MeetScheduleEditor from './MeetScheduleEditor';
import { describeRule } from '../calendar/_components/RepeatEditor';

export default function MeetLobby({ maxParticipants, busy, error, onCreate, onJoin }: {
  maxParticipants: number; busy: boolean; error: string | null;
  onCreate: () => void; onJoin: (code: string) => void;
}) {
  const [view, setView] = useQueryState('view', parseAsStringEnum(['upcoming', 'past', 'join', 'schedule'])
    .withDefault('upcoming').withOptions({ history: 'push' }));
  const [code, setCode] = useState('');
  const [plans, setPlans] = useState<MeetingPlan[]>([]);
  const [editing, setEditing] = useState<MeetingPlan | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [now, setNow] = useState(0);
  const [offset, setOffset] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setLoadError(false);
    try { const rows = await fetchMeetingPlans(); if (request === generation.current) setPlans(rows); }
    catch { if (request === generation.current) setLoadError(true); }
    finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh(); setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => { generation.current++; clearInterval(timer); };
  }, [refresh]);
  const closeEditor = useCallback(() => { void setView('upcoming'); setEditing(null); }, [setView]);
  const past = view === 'past';
  const windowStart = past ? now - (offset + 1) * 30 * 86_400_000 : now + offset * 30 * 86_400_000;
  const windowEnd = windowStart + 30 * 86_400_000;
  const entries = useMemo(() => plans.flatMap(plan => meetingOccurrences(plan, windowStart, windowEnd))
    .filter(entry => !past || entry.end <= now)
    .sort((a, b) => past ? b.start - a.start : a.start - b.start), [plans, windowStart, windowEnd, past, now]);
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const date = toLocalIsoDate(new Date(entry.start));
    const group = groups.get(date) ?? []; group.push(entry); groups.set(date, group);
  }
  const clock = (value: number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return <main className="meet-page meet-lobby">
    <header className="meet-lobby-heading"><h1 className="meet-title">{tr({ zh: '会议', en: 'Meetings' })}</h1>
      {!!maxParticipants && <p className="meet-sub">{tr({ zh: `最多 ${maxParticipants} 人，最高 1080p。`, en: `Up to ${maxParticipants} people and up to 1080p.` })}</p>}
    </header>
    {view !== 'schedule' && <div className="meet-actions">
      <button type="button" className="meet-action" onClick={() => { void setView('join'); }}><span><Plus /></span>{tr({ zh: '加入会议', en: 'Join meeting' })}</button>
      <button type="button" className="meet-action" disabled={busy} onClick={onCreate}><span><Video /></span>{busy ? tr({ zh: '创建中…', en: 'Creating…' }) : tr({ zh: '快速会议', en: 'Quick meeting' })}</button>
      <button type="button" className="meet-action" onClick={() => { setEditing(null); void setView('schedule'); }}><span><CalendarClock /></span>{tr({ zh: '预约会议', en: 'Schedule' })}</button>
    </div>}
    {error && <p className="vc-err" role="alert">{error}</p>}
    {view === 'schedule' && <MeetScheduleEditor plan={editing} onClose={closeEditor} onSaved={() => { closeEditor(); void refresh(); }} />}
    {view === 'join' && <section className="meet-join-panel" data-site-surface="panel" aria-labelledby="meet-join-title">
      <header className="meet-section-heading"><h2 id="meet-join-title">{tr({ zh: '加入会议', en: 'Join meeting' })}</h2>
        <ClearButton variant="standalone" onClick={() => { void setView('upcoming'); }} ariaLabel={tr({ zh: '关闭', en: 'Close' })} />
      </header>
      <form className="meet-row" onSubmit={event => { event.preventDefault(); if (isMeetCode(code)) onJoin(code); }}>
        <div className="meet-code-field"><input autoFocus className="meet-code-input" inputMode="numeric" autoComplete="off"
          aria-label={tr({ zh: '会议码或邀请链接', en: 'Meeting code or invite link' })}
          placeholder={tr({ zh: '4 位会议码或邀请链接', en: '4-digit code or invite link' })}
          value={code} onChange={event => setCode(normalizeMeetCode(event.target.value))} />
          {code && <ClearButton onClick={() => setCode('')} />}
        </div>
        <button className="meet-go" type="submit" disabled={!isMeetCode(code)}>{tr({ zh: '下一步', en: 'Next' })}</button>
      </form>
    </section>}
    {view !== 'schedule' && <section className="meet-agenda" aria-label={tr({ zh: '我的预约', en: 'My scheduled meetings' })}>
      <header className="meet-section-heading"><h2>{tr({ zh: '我的预约', en: 'My scheduled meetings' })}</h2>
        <div className="meet-row">
          <ListSelect value={past ? 'past' : 'upcoming'} clearable={false} allLabel={tr({ zh: '即将开始', en: 'Upcoming' })}
            items={[{ value: 'upcoming', label: tr({ zh: '即将开始', en: 'Upcoming' }) }, { value: 'past', label: tr({ zh: '过去的预约', en: 'Past schedules' }) }]}
            onChange={value => { setOffset(0); void setView(value as 'past' | 'upcoming'); }} />
          <button className="meet-icon-button" type="button" disabled={loading} onClick={() => { void refresh(); }} aria-label={tr({ zh: '刷新预约', en: 'Refresh meetings' })}><RefreshCw size={18} /></button>
        </div>
      </header>
      {now > 0 && <p className="meet-sub">{toLocalIsoDate(new Date(windowStart))} ~ {toLocalIsoDate(new Date(windowEnd))} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>}
      {loading && <p className="meet-sub" role="status">{tr({ zh: '加载预约中…', en: 'Loading meetings…' })}</p>}
      {loadError && <p className="vc-err" role="alert">{tr({ zh: '无法加载预约，请刷新重试。', en: 'Could not load meetings. Please refresh.' })}</p>}
      {!loading && !loadError && entries.length === 0 && <div className="meet-empty"><CalendarDays size={32} /><p>{tr({ zh: '这段时间没有预约会议', en: 'No meetings scheduled in this period' })}</p></div>}
      {!loadError && [...groups].map(([date, items]) => <section key={date} className="meet-agenda-day">
        <h3><CalendarDays size={16} />{date}</h3>
        {items.map(({ plan, start, end }) => <article className="meet-agenda-item" key={`${plan.id}:${start}`}>
          <div className="meet-agenda-summary"><h4>{plan.title}</h4><p>{clock(start)}–{toLocalIsoDate(new Date(end)) !== date && `${toLocalIsoDate(new Date(end))} `}{clock(end)} · {plan.code}{plan.rrule && ` · ${describeRule(plan.rrule)}`}</p></div>
          <div className="meet-row">
            {!past && <button type="button" className="meet-go" onClick={() => onJoin(plan.code)}>{tr({ zh: '进入', en: 'Join' })}</button>}
            <button type="button" className="meet-icon-button" aria-label={tr({ zh: `复制邀请：${plan.title}`, en: `Copy invite: ${plan.title}` })} onClick={async () => {
              const invite = new URL(window.location.href); invite.search = ''; invite.searchParams.set('room', plan.code);
              try { await navigator.clipboard.writeText(`${plan.title}\n${new Date(start).toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})\n${invite}`); setActionMessage(tr({ zh: '邀请已复制', en: 'Invite copied' })); }
              catch { setActionMessage(tr({ zh: '复制失败，请重试。', en: 'Could not copy. Please retry.' })); }
            }}><Copy size={17} /></button>
            <button type="button" className="meet-icon-button" aria-label={tr({ zh: `编辑预约：${plan.title}`, en: `Edit meeting: ${plan.title}` })} onClick={() => { setEditing(plan); void setView('schedule'); }}><Pencil size={17} /></button>
            <button type="button" className="meet-icon-button" aria-label={tr({ zh: `取消预约：${plan.title}`, en: `Cancel meeting: ${plan.title}` })} onClick={() => setConfirmCancel(`${plan.id}:${start}`)}><CalendarX size={17} /></button>
          </div>
          {confirmCancel === `${plan.id}:${start}` && <div className="meet-cancel-confirm" role="group" aria-label={tr({ zh: '确认取消预约', en: 'Confirm cancellation' })}>
            <p>{plan.rrule ? tr({ zh: '取消整个周期会议？已有通话不会被强制挂断。', en: 'Cancel the entire series? Calls already in progress will continue.' }) : tr({ zh: '取消这场预约？', en: 'Cancel this meeting?' })}</p>
            <button type="button" className="meet-join" disabled={cancelling} onClick={() => setConfirmCancel(null)}>{tr({ zh: '保留预约', en: 'Keep meeting' })}</button>
            <button type="button" className="meet-join" disabled={cancelling} onClick={async () => {
              setCancelling(true);
              try { await cancelMeetingPlan(plan.id); setConfirmCancel(null); await refresh(); }
              catch { setActionMessage(tr({ zh: '取消失败，请重试。', en: 'Could not cancel. Please retry.' })); }
              finally { setCancelling(false); }
            }}>{tr({ zh: '确认取消', en: 'Confirm cancellation' })}</button>
          </div>}
        </article>)}
      </section>)}
      <div className="meet-row meet-agenda-pagination">
        {offset > 0 && <button className="meet-join" type="button" onClick={() => setOffset(value => value - 1)}>{tr({ zh: '上一段时间', en: 'Previous period' })}</button>}
        <button className="meet-join" type="button" onClick={() => setOffset(value => value + 1)}>{tr({ zh: '再看 30 天', en: 'Next 30 days' })}</button>
      </div>
    </section>}
    {actionMessage && <p className="meet-sub" role="status">{actionMessage}</p>}
  </main>;
}
