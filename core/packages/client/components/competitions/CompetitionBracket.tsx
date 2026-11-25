'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { parseAsString, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import PersonLink from '@/components/PersonLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { competitionDateTime } from '@/lib/competition-date';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import {
  generateCompetitionBrackets, getCompetitionBrackets, getCompetitionDuel, readyCompetitionDuel,
  type CompetitionBracketMatch, type CompetitionBracketStanding, type CompetitionDuel, type CompetitionRegistration, type OnlineCompetition,
} from '@/lib/online-competition-api';
import { DuelTimer } from './DuelTimer';
import { CompetitionScramble } from './CompetitionScramble';
import { CompetitionBracketTree } from './CompetitionBracketTree';
import { CompetitionRank, CompetitionReport, CompetitionReportShare, type ReportData } from './CompetitionReport';
import { competitionDeviceName } from './CompetitionDraftForm';

const CompetitionVideoRoom = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionVideoRoom), { ssr: false });
const CompetitionSelfRecording = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionSelfRecording), { ssr: false });
const playable = (match: CompetitionBracketMatch) => ['ready', 'in_progress'].includes(match.status);

export function CompetitionBracket({ competition, registrations, manage, allowGeneration }: {
  competition: OnlineCompetition; registrations: CompetitionRegistration[]; manage: boolean; allowGeneration: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [division, setDivision] = useState('');
  const [seatId, setSeatId] = useQueryState('match', parseAsString.withDefault('').withOptions({ history: 'push' }));
  const [brackets, setBrackets] = useState<Awaited<ReturnType<typeof getCompetitionBrackets>> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const result = await getCompetitionBrackets(competition.id);
        if (active) { setBrackets(result); setError(''); }
      } catch (cause) { if (active) setError(String(cause instanceof Error ? cause.message : cause)); }
      finally { pending = false; }
    }
    void load();
    const timer = competition.finalizedAt ? null : setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 6000);
    return () => { active = false; if (timer !== null) clearInterval(timer); };
  }, [competition.id, competition.finalizedAt, revision]);

  useEffect(() => {
    if (window.location.hash !== '#competition-bracket') return;
    document.getElementById('competition-bracket')?.scrollIntoView?.();
  }, []);

  const entryIds = new Set(registrations.filter(entry => ['confirmed', 'attended'].includes(entry.status)).map(entry => entry.id));
  const own = (match: CompetitionBracketMatch) => (!!match.playerA && entryIds.has(match.playerA)) || (!!match.playerB && entryIds.has(match.playerB));
  const ownMatches = brackets?.matches.filter(match => own(match) && playable(match)) ?? [];
  const seat = brackets?.matches.find(match => match.id === seatId && own(match));
  const primaryDivision = division || ownMatches[0]?.ticketId || competition.projects[0]?.id;
  const matches = brackets?.matches.filter(match => match.ticketId === primaryDivision) ?? [];
  const standings = brackets?.standings.filter(row => row.ticketId === primaryDivision).sort((a, b) => a.rank - b.rank) ?? [];
  const project = competition.projects.find(p => p.id === primaryDivision);
  function done(row: CompetitionBracketStanding) {
    if (competition.finalizedAt) return true;
    return !!brackets?.matches.some(match => match.ticketId === row.ticketId && match.status === 'completed' &&
      (match.playerA === row.id || match.playerB === row.id) &&
      (match.side === 'grand_final' || (match.side === 'losers' && !!match.winner && match.winner !== row.id)));
  }

  function reportData(row: CompetitionBracketStanding): ReportData {
    const division = competition.projects.find(item => item.id === row.ticketId);
    const event = division?.project ?? '333';
    return {
      competition: t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh),
      organizer: competition.organizationName,
      division: `${eventDisplayName(event, lang === 'zh')} · ${competitionDeviceName(division?.device ?? 'ordinary', t)}`,
      name: displayCuberName(row.name, lang === 'zh'), rank: row.rank, final: !!competition.finalizedAt,
      date: competitionDateTime(row.recordedAt ?? competition.endsAt).slice(0, 10),
      metrics: [{ label: t('胜局', 'Games won'), value: String(row.wins) },
        { label: t('最佳单次', 'Best single'), value: row.best == null ? '—' : formatWcaResult(row.best, event, 'single') }],
    };
  }
  const ownReports = brackets?.standings.filter(row => entryIds.has(row.id) && done(row)) ?? [];
  const seatResult = seat && ownReports.find(row => row.ticketId === seat.ticketId && (row.id === seat.playerA || row.id === seat.playerB));
  const labels = {
    winners: t('胜者组 · BO3', 'Winners · BO3'), losers: t('败者组 · BO3', 'Losers · BO3'),
    grand_final: t('总决赛 · BO5', 'Grand final · BO5'),
  };

  async function generate() {
    setBusy(true); setError('');
    try { await generateCompetitionBrackets(competition.id); setRevision(n => n + 1); }
    catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); }
    finally { setBusy(false); }
  }

  if (seat && !manage) return <section id="competition-bracket" className="competition-bracket">
    <button type="button" className="competition-secondary" onClick={() => { void setSeatId(null); }}>{t('查看对阵', 'View bracket')}</button>
    <DuelSeat key={seat.id} id={seat.id} report={seatResult ? reportData(seatResult) : undefined} />
  </section>;

  return <section id="competition-bracket" className="competition-bracket">
    {ownMatches.length > 0 && !manage && <div className="competition-draft-summary competition-bracket-next" data-site-surface="panel">
      <h2>{t('我的当前对局', 'My current matches')}</h2>
      {ownMatches.map(match => <div key={match.id}>
        <span><EventIcon event={match.project} /> {eventDisplayName(match.project, lang === 'zh')} · {competitionDeviceName(match.device, t)} · {labels[match.side]}</span>
        <button className="competition-primary" type="button" onClick={() => { void setSeatId(match.id); }}>{t('进入对战席', 'Enter match')}</button>
      </div>)}
    </div>}
    {ownReports.map(row => <CompetitionReport key={row.id} data={reportData(row)} share />)}
    <h2>{t('双败淘汰对阵', 'Double-elimination bracket')}</h2>
    {competition.projects.length > 1 && <select aria-label={t('对阵组别', 'Bracket division')} className="platform-field-control" value={primaryDivision} onChange={event => setDivision(event.target.value)}>
      {competition.projects.map(p => <option key={p.id} value={p.id}>{eventDisplayName(p.project, lang === 'zh')} · {competitionDeviceName(p.device, t)}</option>)}
    </select>}
    {error && <p role="alert" className="competition-error">{error}</p>}
    {!brackets && !error && <LoadingIndicator>{t('读取对阵…', 'Loading bracket…')}</LoadingIndicator>}
    {brackets && !brackets.generated && <p className="competition-muted">{t('报名截止后生成对阵。', 'The bracket is generated after registration closes.')}</p>}
    {manage && allowGeneration && !brackets?.generated && <button className="competition-primary" type="button" disabled={busy} onClick={() => void generate()}>{t('生成对阵', 'Generate bracket')}</button>}
    {brackets?.generated && matches.length === 0 && <p className="competition-muted">{t('该组别有效报名不足两位。', 'This division has fewer than two confirmed entries.')}</p>}
    {matches.length > 0 && <CompetitionBracketTree key={primaryDivision} matches={matches} labels={labels}
      canEnter={match => !manage && own(match) && playable(match)} onEnter={matchId => { void setSeatId(matchId); }} />}
    {standings.length > 0 && <div className="competition-bracket-standings">
      <h3>{competition.finalizedAt ? t('最终名次', 'Final standings') : t('暂列名次', 'Provisional standings')}</h3>
      <table><thead><tr><th scope="col">{t('名次', 'Rank')}</th><th scope="col">{t('选手', 'Competitor')}</th><th scope="col">{t('胜局', 'Games won')}</th><th scope="col">{t('最佳单次', 'Best')}</th></tr></thead>
        <tbody>{standings.map(row => <tr key={row.id}><td><CompetitionRank rank={row.rank} final={!!competition.finalizedAt} /></td>
          <th scope="row"><PersonLink wcaId={row.wcaId ?? ''} name={row.name} isZh={lang === 'zh'}
            flag={row.countryCode ? <Flag iso2={row.countryCode} spanClassName="country-flag" imgClassName="country-flag-ct" /> : undefined} />
            {entryIds.has(row.id) && done(row) && <CompetitionReportShare data={reportData(row)} />}
          </th>
          <td>{row.wins}</td><td>{row.best == null ? '—' : formatWcaResult(row.best, project?.project ?? '333', 'single')}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

function DuelSeat({ id, report }: { id: string; report?: ReportData }) {
  const t = useT();
  const lang = useLang();
  const [snapshot, setSnapshot] = useState<{ duel: CompetitionDuel; offset: number } | null>(null);
  const [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [readError, setReadError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      const sent = performance.now();
      try {
        const duel = await getCompetitionDuel(id);
        const received = performance.now();
        if (active) {
          setClock(received);
          setSnapshot({ duel, offset: Date.parse(duel.serverNow) - (sent + received) / 2 });
          setReadError('');
        }
      } catch (cause) { if (active) setReadError(String(cause instanceof Error ? cause.message : cause)); }
      finally { pending = false; }
    }
    void load();
    const read = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 800);
    return () => { active = false; clearInterval(read); };
  }, [id, revision]);
  const start = snapshot?.duel.startAt ? Date.parse(snapshot.duel.startAt) : null;
  useEffect(() => {
    if (start === null) return;
    const tick = setInterval(() => setClock(performance.now()), 100);
    return () => clearInterval(tick);
  }, [start]);
  if (!snapshot) return readError ? <p role="alert">{readError}</p> : <LoadingIndicator>{t('正在打开对战席…', 'Opening match…')}</LoadingIndicator>;
  const { duel, offset } = snapshot;
  const sinceStart = start === null ? null : clock + offset - start;
  const needsRecording = duel.supervisionMode === 'self_service' && duel.device === 'ordinary' && duel.canPlay
    && (duel.status === 'ready' || duel.status === 'in_progress');

  async function ready() {
    setBusy(true); setWriteError('');
    try { await readyCompetitionDuel(id, duel.gameNumber); setRevision(n => n + 1); }
    catch (cause) { setWriteError(String(cause instanceof Error ? cause.message : cause)); }
    finally { setBusy(false); }
  }
  return <section className="competition-duel" data-site-surface="panel">
    <h2 className="competition-duel-score">
      <span>{displayCuberName(duel.ownName, lang === 'zh')}</span>
      <strong>{duel.ownScore} : {duel.opponentScore}</strong>
      <span>{displayCuberName(duel.opponentName, lang === 'zh')}</span>
    </h2>
    {report && <CompetitionReport data={report} share />}
    {duel.lastGame && <LastGame duel={duel} />}
    {needsRecording && <CompetitionSelfRecording onRecordingChange={setRecording} />}
    {duel.requiresSupervision && duel.canPlay && (duel.checkedIn && duel.registrationId
      ? <CompetitionVideoRoom registrationId={duel.registrationId} />
      : <p>{t('请先在参赛安排中检录，再进入监督视频。', 'Check in under Your entries, then join the supervision video.')}</p>)}
    {!duel.canPlay && !['completed', 'bye'].includes(duel.status) && <p>{t('等待比赛时间，双方须保持有效报名。', 'Waiting for the competition window and both active registrations.')}</p>}
    {duel.status === 'completed' || duel.status === 'bye' ? <p role="status">{t('对局已结束。', 'Match finished.')}</p> : duel.canPlay && <>
      <div className="competition-room-status">
        <span>{t(`第 ${duel.gameNumber} 局`, `Game ${duel.gameNumber}`)}</span>
        <span>{duel.opponentFinished ? t('对手已提交', 'Opponent finished') : sinceStart === null || sinceStart < 0
          ? duel.opponentReady ? t('对手已就绪', 'Opponent ready') : t('等待对手', 'Waiting for opponent')
          : duel.opponentPhase === 'solving' ? t('对手还原中', 'Opponent solving')
            : duel.opponentPhase === 'inspecting' ? t('对手观察中', 'Opponent inspecting') : t('对手打乱中', 'Opponent scrambling')}</span>
      </div>
      {start === null ? <button type="button" className="competition-primary" disabled={busy || duel.ownReady
        || (duel.requiresSupervision && !duel.checkedIn) || (needsRecording && !recording)}
        onClick={() => void ready()}>{duel.ownReady ? t('已就绪', 'Ready') : t('准备就绪', 'Ready up')}</button>
        : !duel.scramble ? <output className="competition-countdown" aria-label={t('开赛倒计时', 'Start countdown')}>{Math.max(0, Math.ceil(-(sinceStart ?? 0) / 1000)) || '…'}</output>
          : <div className="competition-current-attempt" data-site-surface="panel">
            <CompetitionScramble project={duel.project} scramble={duel.scramble} />
            {duel.ownResult ? <p role="status">{t('本局成绩已提交。', 'Your result is recorded.')}</p> : duel.device === 'smart'
              ? <AppLink className="competition-primary" href={`/timer?event=333&competition=${encodeURIComponent(duel.eventId)}&match=${encodeURIComponent(id)}`} prefetch={false}>{t('连接智能魔方并计时', 'Connect cube and start timing')}</AppLink>
              : <DuelTimer key={duel.gameNumber} duel={duel} clockOffset={offset} onSaved={() => setRevision(n => n + 1)} />}
          </div>}
    </>}
    {(writeError || readError) && <p className="competition-error" role="alert">{writeError || readError}</p>}
  </section>;
}

function LastGame({ duel }: { duel: CompetitionDuel }) {
  const t = useT();
  const lang = useLang();
  const game = duel.lastGame;
  if (!game) return null;
  const time = (result: typeof game.ownResult) => result
    ? formatWcaResult(result.penalty === 'DNF' ? -1 : result.penalty === 'DNS' ? -2
      : (result.centiseconds ?? 0) + (result.penalty === '+2' ? 200 : 0), duel.project, 'single') + (result.penalty === '+2' ? ' (+2)' : '')
    : '—';
  return <section className="competition-last-game" aria-live="polite">
    <h3>{t(`上一局结果 · 第 ${game.gameNumber} 局`, `Previous result · Game ${game.gameNumber}`)}</h3>
    <dl><div><dt>{displayCuberName(duel.ownName, lang === 'zh')}</dt><dd>{time(game.ownResult)}</dd></div>
      <div><dt>{displayCuberName(duel.opponentName, lang === 'zh')}</dt><dd>{time(game.opponentResult)}</dd></div></dl>
    <p>{game.winner === 'draw' ? t('平局', 'Draw') : game.winner === 'own' ? t('你赢下了这局', 'You won the game') : t('对手赢下了这局', 'Your opponent won the game')}</p>
  </section>;
}
