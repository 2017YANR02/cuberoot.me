import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Camera, ChevronRight } from '@app-foundation/icons/lucide';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';
import { Flag } from '@/components/Flag';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { eventDisplayName } from '@/lib/wca-events';
import { getCompetitionSupervisionCameras, superviseCompetitionMatch, type CompetitionBracketMatch, type CompetitionJudgeAction, type CompetitionRegistration } from '@/lib/online-competition-api';
import { competitionDeviceName } from './CompetitionDraftForm';
import { competitionBracketRound, competitionMatchCode } from './competition-results';
import type { SupervisionCameraGrid } from './CompetitionVideoRoom';

type Entry = CompetitionRegistration;
const finished = (entry: Entry) => !!entry.resultRecordedAt || entry.status === 'attended';
const phases = [
  (entry: Entry) => !finished(entry) && !!entry.checkedInAt && !entry.attemptNumber,
  (entry: Entry) => !finished(entry) && !!entry.checkedInAt && !!entry.attemptNumber,
  (entry: Entry) => !finished(entry) && !entry.checkedInAt,
  finished,
];

function useSupervisionSelection(selectedId: string | undefined, mobile: boolean) {
  const stage = useRef<HTMLElement>(null);
  const origin = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile) return;
    if (selectedId) {
      stage.current?.scrollIntoView?.({ block: 'start' });
      stage.current?.focus({ preventScroll: true });
    } else {
      origin.current?.focus();
      origin.current = null;
    }
  }, [mobile, selectedId]);
  return { stage, origin };
}

export function CompetitionDuelSupervisionDesk({ competitionId, matches, entries, activeId, onSelect, onRuling, renderRoom }: {
  competitionId: string; matches: CompetitionBracketMatch[]; entries: Entry[]; activeId: string;
  onSelect(id: string | null): void; onRuling: () => void; renderRoom(match: CompetitionBracketMatch, grid: SupervisionCameraGrid): ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const mobile = useIsMobile(859);
  const assigned = new Set(entries.map(entry => entry.id));
  const [filter, setFilter] = useState('all');
  const [batchSize, setBatchSize] = useState<number | null>(null);
  const [cameras, setCameras] = useState<Record<string, { a: boolean; b: boolean }>>({});
  const [participants, setParticipants] = useState<Record<string, { a: string; b: string }>>({});
  const [now, setNow] = useState(0);
  const [action, setAction] = useState<{ id: string; busy: boolean; message: string; error?: boolean } | null>(null);
  const [confirmation, setConfirmation] = useState<{ id: string; action: CompetitionJudgeAction; side?: 'a' | 'b'; game?: number } | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const queue = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const response = await getCompetitionSupervisionCameras(competitionId);
        if (active) { setCameras(response.cameras); setParticipants(response.participants); setBatchSize(response.dispatchBatchSize); }
      } catch { if (active) setCameras({}); }
      finally { pending = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [competitionId]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const phase = { ready: 0, in_progress: 1, pending: 2, completed: 3, bye: 4 };
  const sideOrder = { winners: 0, losers: 1, grand_final: 2 };
  const tables = matches.filter(match => match.status !== 'bye'
    && ((match.playerA && assigned.has(match.playerA)) || (match.playerB && assigned.has(match.playerB))))
    .sort((a, b) => phase[a.status] - phase[b.status] || sideOrder[a.side] - sideOrder[b.side] || a.round - b.round
      || (a.readyAt ?? '').localeCompare(b.readyAt ?? '') || a.number - b.number || a.id.localeCompare(b.id));
  const rows = tables.filter(match => filter === 'all' || match.status === filter || (filter === 'waiting' && match.status === 'pending'));
  const selected = tables.find(match => match.id === activeId) ?? (!mobile ? rows[0] : undefined);
  const { stage, origin } = useSupervisionSelection(selected?.id, mobile);
  const mayJoin = selected && entries.some(entry => entry.matchId === selected.id && entry.canJoinVideo);

  const name = (value: string | null) => value ? displayCuberName(value, lang === 'zh') : t('待定', 'TBD');
  function table(match: CompetitionBracketMatch) {
    const code = competitionMatchCode(match);
    if (match.status === 'pending' || !match.playerA || !match.playerB) return code;
    return `${t('桌', 'Table')} T${String(match.number).padStart(2, '0')} · ${code}`;
  }
  const clock = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const players = (match: CompetitionBracketMatch) => ([
    { side: 'a', id: match.playerA, name: name(match.nameA), country: match.countryA, checked: match.checkedInA, camera: cameras[match.id]?.a, ready: match.readyA, penalty: match.penaltyA },
    { side: 'b', id: match.playerB, name: name(match.nameB), country: match.countryB, checked: match.checkedInB, camera: cameras[match.id]?.b, ready: match.readyB, penalty: match.penaltyB },
  ] as const);
  function blocker(match: CompetitionBracketMatch) {
    if (match.status === 'completed') return t('本场结束', 'Match complete');
    if (match.status === 'in_progress') return t('监考中', 'In progress');
    const seats = players(match);
    if (seats.some(seat => !seat.id)) return t('等待选手落位', 'Waiting for seats');
    const checkIn = seats.find(seat => !seat.checked);
    if (checkIn) return t(`等 ${checkIn.name} 检录`, `Waiting for ${checkIn.name} to check in`);
    const offline = seats.find(seat => seat.camera === false);
    if (offline) return t(`等 ${offline.name} 开摄像头`, `Waiting for ${offline.name} to turn on their camera`);
    if (seats.some(seat => seat.camera === undefined)) return t('等待摄像头状态', 'Waiting for camera status');
    const waiting = seats.find(seat => !seat.ready);
    return waiting ? t(`等 ${waiting.name} 就绪`, `Waiting for ${waiting.name} to get ready`) : t('可发车', 'Ready to start');
  }
  const participant = (person: ReturnType<typeof players>[number]) => <span className="competition-judge-identity">
    {person.country ? <Flag iso2={person.country} spanClassName="country-flag" imgClassName="country-flag-ct" />
      : <span className="competition-empty-flag" aria-hidden />}{person.name}
  </span>;
  function indicators(person: ReturnType<typeof players>[number]) {
    const checked = person.checked ? t('已检录', 'Checked in') : t('未检录', 'Not checked in');
    const camera = person.camera == null ? t('摄像头状态未知', 'Camera status unknown')
      : person.camera ? t('摄像头在线', 'Camera online') : t('摄像头离线', 'Camera offline');
    return <small className="competition-judge-indicators">
      <span data-online={person.checked || undefined}>{checked}</span><span data-online={person.camera || undefined}>{camera}</span>
    </small>;
  }
  async function apply(request: NonNullable<typeof confirmation>) {
    setConfirmation(null);
    setAction({ id: request.id, busy: true, message: '' });
    try {
      await superviseCompetitionMatch(request.id, request.action, request.side, request.game);
      setAction({ id: request.id, busy: false, message: request.action === 'remind' ? t('已发送提醒', 'Reminder sent') : t('裁决已记录', 'Ruling recorded') });
      onRuling();
    } catch (error) {
      setAction({ id: request.id, busy: false, error: true, message: error instanceof Error ? error.message : t('操作未完成', 'Could not apply action') });
    }
  }
  const waitingSince = selected?.noShowDeadlineAt && now ? Date.parse(selected.noShowDeadlineAt) - now : null;
  const liveGame = !!selected?.gameNumber && !!selected.gameStartsAt && Date.parse(selected.gameStartsAt) <= now;
  const actionLabels = { remind: t('提醒未就绪选手', 'Remind entrant'), '+2': '+2', DNF: 'DNF',
    replay: t('重赛', 'Replay game'), absence: t('判缺席', 'Rule absence') };
  const cameraGrid: SupervisionCameraGrid = camera => selected && <div className="competition-judge-cameras">
    {players(selected).map(person => {
      const identity = participants[selected.id]?.[person.side];
      const video = identity && camera ? camera(identity) : null;
      return <section key={person.side}>
        <h3>{participant(person)}</h3>{video || <Camera size={25} aria-hidden />}{indicators(person)}
      </section>;
    })}
  </div>;
  const confirm = selected && confirmation?.id === selected.id && confirmation;
  return <div ref={workspace} className="competition-supervision competition-judge-desk" data-selected={!!selected || undefined}>
    <aside ref={queue} id="competition-judge-queue" className="competition-supervision-queue" aria-label={t('按桌排队', 'Match queue')}>
      <h2>{t('按桌排队', 'Match queue')}</h2>
      <div className="competition-section-tabs" aria-label={t('筛选桌台状态', 'Filter tables by status')}>
        {([['all', t('全部', 'All')], ['ready', t('候场', 'Ready seats')], ['waiting', t('待落位', 'Awaiting seats')],
          ['in_progress', t('监考中', 'In progress')], ['completed', t('已完成', 'Complete')]] as const).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); onSelect(null); }}>{label}</button>)}
      </div>
      {!rows.length && <p className="competition-muted">{t('此状态下暂无已分配桌台。', 'No assigned tables with this status.')}</p>}
      <ul>{rows.map(match => <li key={match.id}>
        <button type="button" className="competition-queue-entry competition-judge-entry" aria-current={match.id === selected?.id ? 'true' : undefined}
          onClick={event => { origin.current = event.currentTarget; setConfirmation(null); onSelect(match.id); }}>
          <span><strong className="competition-code">{table(match)}</strong>
            {match.status === 'ready' && match.readyAt && now > 0 && <time className="competition-code">{clock(now - Date.parse(match.readyAt))}</time>}</span>
          <span>{players(match).map(person => <span key={person.side}>{participant(person)}{indicators(person)}</span>)}</span>
          <small>{blocker(match)}</small>
        </button>
      </li>)}</ul>
    </aside>
    {!mobile && <ResizeDivider className="competition-supervision-divider" aria-controls="competition-judge-queue"
      label={t('调整桌台队列宽度', 'Resize match queue')}
      getSize={() => queue.current?.getBoundingClientRect().width ?? 0}
      onResize={(_, width) => {
        workspace.current?.style.setProperty('--competition-queue-width', `${Math.round(width)}px`);
        return queue.current?.getBoundingClientRect().width;
      }} />}
    <section ref={stage} className="competition-supervision-stage competition-judge-stage" tabIndex={-1} aria-label={t('主监考席', 'Supervision desk')}>
      {selected ? <>
        <header>
          <button type="button" className="competition-secondary competition-queue-back" aria-label={t('返回对局桌次', 'Back to match tables')}
            onClick={() => onSelect(null)}><ArrowLeft size={18} aria-hidden /></button>
          <div><h2 className="competition-code">{table(selected)}</h2>
            <p>{competitionBracketRound(selected.side, selected.round, t)} · BO{selected.bestOf}{selected.gameNumber ? ` · G${selected.gameNumber}` : ''}</p></div>
        </header>
        <div className="competition-judge-context">
          <strong>{blocker(selected)}</strong>
          {(selected.status === 'in_progress' || selected.status === 'completed') && <span className="competition-code">{selected.scoreA} : {selected.scoreB}</span>}
          {batchSize && <span>{t(`发车批次上限 ${batchSize} 桌`, `Dispatch batch limit ${batchSize} tables`)}</span>}
          {waitingSince !== null && <span>{t('自动判缺席', 'Automatic absence ruling')} <time className="competition-code">{clock(waitingSince)}</time></span>}
        </div>
        {mayJoin ? renderRoom(selected, cameraGrid) : cameraGrid()}
        {(selected.status === 'ready' || selected.status === 'in_progress') && <div className="competition-judge-controls">
          {players(selected).filter(person => person.id && assigned.has(person.id)).map(person => <div key={person.side}>
            <span>{participant(person)}</span>
            <div className="competition-toolbar">
            {(!person.ready || person.camera === false) && selected.status === 'ready' &&
              <button type="button" className="competition-secondary" disabled={action?.busy} onClick={() => {
                void apply({ id: selected.id, action: 'remind', side: person.side });
              }}>{actionLabels.remind}</button>}
            {(['+2', 'DNF'] as const).map(key => <button key={key} type="button" className="competition-secondary"
              disabled={action?.busy || !liveGame || (key === '+2' && person.penalty !== 'none')} onClick={() => {
                setConfirmation({ id: selected.id, action: key, side: person.side, game: selected.gameNumber ?? undefined });
              }}>{actionLabels[key]}</button>)}
            </div>
          </div>)}
          <div className="competition-toolbar">
            <button type="button" className="competition-secondary" disabled={action?.busy || !liveGame || !players(selected).every(person => person.id && assigned.has(person.id))}
              onClick={() => setConfirmation({ id: selected.id, action: 'replay', game: selected.gameNumber ?? undefined })}>{actionLabels.replay}</button>
            <button type="button" className="competition-secondary" disabled={action?.busy || waitingSince === null || waitingSince > 0 || (!!selected.readyA && !!selected.readyB)}
              onClick={() => setConfirmation({ id: selected.id, action: 'absence' })}>{actionLabels.absence}</button>
          </div>
          {confirm && <div className="competition-judge-confirm">
            <strong>{t('确认裁决', 'Confirm ruling')} · {actionLabels[confirm.action]}{confirm.side ? ` · ${players(selected).find(person => person.side === confirm.side)?.name}` : ''}</strong>
            <button type="button" className="competition-primary" onClick={() => void apply(confirm)}>{t('确认', 'Confirm')}</button>
            <button type="button" className="competition-secondary" onClick={() => setConfirmation(null)}>{t('取消', 'Cancel')}</button>
          </div>}
          {action?.id === selected.id && action.message && <p role={action.error ? 'alert' : 'status'}>{action.message}</p>}
        </div>}
      </> : <p className="competition-muted">{t('选择一桌开始监督。', 'Choose a table to supervise.')}</p>}
    </section>
  </div>;
}

export function CompetitionSupervisionDesk({ entries, activeId, onSelect, renderSeat }: {
  entries: Entry[]; activeId: string; onSelect: (id: string | null) => void;
  renderSeat: (entry: Entry) => ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const mobile = useIsMobile(859);
  const labels = [t('已检录待开赛', 'Checked in · waiting to start'), t('进行中', 'In progress'),
    t('未检录', 'Awaiting check-in'), t('已完赛', 'Finished')];
  const groups = phases.map((match, index) => ({ label: labels[index], entries: entries.filter(match) }));
  const selected = entries.find(entry => entry.id === activeId) ??
    (!mobile ? groups.find(group => group.entries.length)?.entries[0] : undefined);
  const { stage, origin } = useSupervisionSelection(selected?.id, mobile);

  return <div className="competition-supervision" data-selected={!!selected || undefined}>
    <aside className="competition-supervision-queue" aria-label={t('候场队列', 'Competitor queue')}>
      <h2>{t('候场队列', 'Competitor queue')}</h2>
      {!entries.length && <p className="competition-muted">{t('还没有报名记录。', 'No registrations yet.')}</p>}
      {groups.filter(group => group.entries.length).map(group => <section key={group.label}>
        <h3>{group.label}</h3>
        <ul>{group.entries.map(entry => <li key={entry.id}>
          <button type="button" className="competition-queue-entry" aria-current={entry.id === selected?.id ? 'true' : undefined} onClick={event => { origin.current = event.currentTarget; onSelect(entry.id); }}>
            <EventIcon event={entry.project} />
            <span><strong>{displayCuberName(entry.displayName, lang === 'zh')}</strong><small>{eventDisplayName(entry.project, lang === 'zh')} · {competitionDeviceName(entry.device, t)}</small></span>
            {entry.checkedInAt && !!entry.attemptNumber && !finished(entry) ? <span className="competition-queue-progress">{entry.attemptNumber}/5</span>
              : <ChevronRight size={15} aria-hidden />}
          </button>
        </li>)}</ul>
      </section>)}
    </aside>
    <section ref={stage} className="competition-supervision-stage" tabIndex={-1} aria-label={t('主监考席', 'Supervision desk')}>
      {selected ? <>
        <button type="button" className="competition-secondary competition-queue-back" aria-label={t('候场队列', 'Competitor queue')} onClick={() => onSelect(null)}><ArrowLeft size={18} aria-hidden /></button>
        {selected.checkedInAt || finished(selected) ? renderSeat(selected)
          : <div className="competition-supervision-empty" data-site-surface="panel">
            <h2>{displayCuberName(selected.displayName, lang === 'zh')}</h2>
            <p className="competition-muted">{t('等待选手检录', 'Waiting for competitor to check in')}</p>
          </div>}
      </> : <p className="competition-muted">{t('选择选手开始监督。', 'Choose a competitor to supervise.')}</p>}
    </section>
  </div>;
}
