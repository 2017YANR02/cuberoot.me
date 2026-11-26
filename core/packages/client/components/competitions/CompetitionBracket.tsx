'use client';

import { useEffect, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
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
  generateCompetitionBrackets, getCompetitionBrackets,
  type CompetitionBracketMatch, type CompetitionBracketStanding, type CompetitionRegistration, type OnlineCompetition,
} from '@/lib/online-competition-api';
import { CompetitionBracketTree } from './CompetitionBracketTree';
import { CompetitionRank, CompetitionReport, CompetitionReportShare, type ReportData } from './CompetitionReport';
import { competitionDeviceName } from './CompetitionDraftForm';

export const competitionMatchPlayable = (match: CompetitionBracketMatch) => ['ready', 'in_progress'].includes(match.status);

export function useCompetitionBrackets(id: string | null, finalized: boolean) {
  const [snapshot, setSnapshot] = useState<{ id: string; brackets: Awaited<ReturnType<typeof getCompetitionBrackets>> } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const competitionId = id;
    if (!competitionId) return;
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await getCompetitionBrackets(competitionId);
        if (active) { setSnapshot({ id: competitionId, brackets: result }); setError(''); }
      } catch (cause) { if (active) setError(String(cause instanceof Error ? cause.message : cause)); }
      finally { pending = false; }
    };
    void load();
    const timer = finalized ? null : setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 6000);
    return () => { active = false; if (timer !== null) clearInterval(timer); };
  }, [id, finalized, revision]);

  return {
    brackets: snapshot?.id === id ? snapshot?.brackets ?? null : null,
    error,
    refresh: () => setRevision(value => value + 1),
  };
}

export function CompetitionBracket({ competition, registrations, manage, allowGeneration, bracket }: {
  competition: OnlineCompetition; registrations: CompetitionRegistration[]; manage: boolean; allowGeneration: boolean;
  bracket: ReturnType<typeof useCompetitionBrackets>;
}) {
  const t = useT();
  const lang = useLang();
  const [division, setDivision] = useState('');
  const [, setSeatId] = useQueryState('match', parseAsString.withDefault('').withOptions({ history: 'push' }));
  const [busy, setBusy] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const { brackets, error, refresh } = bracket;
  useEffect(() => {
    if (window.location.hash !== '#competition-bracket') return;
    document.getElementById('competition-bracket')?.scrollIntoView?.();
  }, []);

  const entryIds = new Set(registrations.filter(entry => ['confirmed', 'attended'].includes(entry.status)).map(entry => entry.id));
  const own = (match: CompetitionBracketMatch) => (!!match.playerA && entryIds.has(match.playerA)) || (!!match.playerB && entryIds.has(match.playerB));
  const ownMatches = brackets?.matches.filter(match => own(match) && competitionMatchPlayable(match)) ?? [];
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
  const labels = {
    winners: t('胜者组 · BO3', 'Winners · BO3'), losers: t('败者组 · BO3', 'Losers · BO3'),
    grand_final: t('总决赛 · BO5', 'Grand final · BO5'),
  };

  async function generate() {
    setBusy(true); setGenerationError('');
    try { await generateCompetitionBrackets(competition.id); refresh(); }
    catch (cause) { setGenerationError(String(cause instanceof Error ? cause.message : cause)); }
    finally { setBusy(false); }
  }

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
    {(generationError || error) && <p role="alert" className="competition-error">{generationError || error}</p>}
    {!brackets && !error && <LoadingIndicator>{t('读取对阵…', 'Loading bracket…')}</LoadingIndicator>}
    {brackets && !brackets.generated && <p className="competition-muted">{t('报名截止后生成对阵。', 'The bracket is generated after registration closes.')}</p>}
    {manage && allowGeneration && !brackets?.generated && <button className="competition-primary" type="button" disabled={busy} onClick={() => void generate()}>{t('生成对阵', 'Generate bracket')}</button>}
    {brackets?.generated && matches.length === 0 && <p className="competition-muted">{t('该组别有效报名不足两位。', 'This division has fewer than two confirmed entries.')}</p>}
    {matches.length > 0 && <CompetitionBracketTree key={primaryDivision} matches={matches} labels={labels}
      canEnter={match => !manage && own(match) && competitionMatchPlayable(match)} onEnter={matchId => { void setSeatId(matchId); }} />}
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
