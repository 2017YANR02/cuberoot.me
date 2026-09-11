'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Flag as FinishFlag,
  History,
  Play,
  Target,
} from 'lucide-react';
import {
  fromWcaSpelling,
  parseTimerEntry,
  roundAttempts,
  roundResult,
  type RoundConfig,
} from '@cuberoot/shared/timer';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { CompPicker } from '@/components/CompPicker';
import { CompCell } from '@/components/CompCell/CompCell';
import { Flag } from '@/components/Flag';
import HeaderToggles from '@/components/HeaderToggles';
import PersonLink from '@/components/PersonLink';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import Paginator from '@/components/wca-stats/Paginator';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { loadFlagData } from '@/lib/country-flags';
import type { Comp } from '@/lib/comp-search';
import { roundTypeName } from '@/lib/comp-schedule';
import { fetchCompWcif } from '@/lib/comp-wcif';
import { fetchWcaResults, fetchWcaScrambles } from '@/lib/wca-results-api';
import { fetchWcaPerson } from '@/lib/wca-person-api';
import { eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { persistItem } from '@/lib/safe-storage';
import {
  buildCompSimLeaderboard,
  expectedAttemptCount,
  hasCrossRoundCumulativeLimit,
  isPracticeRecord,
  isPracticeSession,
  makeCompSimSolve,
  matchPublishedCompSimRounds,
  PRACTICE_ISSUES,
  PRACTICE_VERSION,
  practiceRecord,
  practiceTargetDelta,
  roundConfigFromWcif,
  selectPlayableScrambleGroup,
  SUPPORTED_COMP_SIM_EVENTS,
  type PracticeIssue,
  type PracticeRecord,
  type PracticeRound,
  type PracticeSession,
} from '@/lib/comp-sim';
import { tr, useLang } from '@/i18n/tr';
import './comp-sim.css';

const HISTORY_KEY = 'cuberoot-competition-practice-history-v2';
const ACTIVE_PREFIX = 'cuberoot-competition-practice-active-v2:';
const LOCAL_CONFIG: RoundConfig = {
  on: true,
  format: 'ao5',
  cutoffMs: null,
  cutoffAttempts: 0,
  limitMs: null,
  cumulative: false,
};

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function readHistory(): PracticeRecord[] {
  const value = readJson(HISTORY_KEY);
  return Array.isArray(value) ? value.filter(isPracticeRecord) : [];
}
function displayMs(ms: number | null, event: string, average = false): string {
  return (
    formatWcaResult(
      ms === null ? 0 : Number.isFinite(ms) ? Math.round(ms / 10) : -1,
      event,
      average ? 'average' : 'single',
      { zero: 'empty' },
    ) || '—'
  );
}
function targetLabel(record: Pick<PracticeRecord, 'solves' | 'config' | 'targetMs' | 'eventId'>): string {
  if (record.targetMs === null) return tr({ zh: '未设置目标', en: 'No target set' });
  const delta = practiceTargetDelta(record.solves, record.config, record.targetMs);
  if (delta === null) return tr({ zh: '本轮没有可比较的有效成绩', en: 'No valid round result to compare' });
  if (delta === 0) return tr({ zh: '达到目标', en: 'Target reached' });
  const gap = displayMs(Math.abs(delta), record.eventId, true);
  return delta < 0
    ? tr({ zh: `比目标快 ${gap}`, en: `${gap} faster than target` })
    : tr({ zh: `距目标还差 ${gap}`, en: `${gap} above target` });
}

// Page-local review: all arithmetic comes from the shared round engine.
function RoundReview({ record }: { record: PracticeRecord }) {
  const result = roundResult(record.solves, record.config);
  const average = record.config.format === 'ao5' || record.config.format === 'mo3';
  const finite = result.list.flatMap((attempt) =>
    attempt.ms !== null && Number.isFinite(attempt.ms) ? [attempt.ms] : [],
  );
  const longest = Math.max(1, ...finite);
  const issues = Object.keys(PRACTICE_ISSUES).filter(
    (issue) => issue !== 'none' && record.issues.includes(issue as PracticeIssue),
  ) as PracticeIssue[];
  return (
    <div className="practice-review">
      <div className="practice-metrics">
        <div>
          <span>
            {average
              ? tr({ zh: '本轮平均', en: 'Round average' })
              : tr({ zh: '本轮成绩', en: 'Round result' })}
          </span>
          <strong>{displayMs(result.official, record.eventId, average)}</strong>
        </div>
        <div>
          <span>{tr({ zh: '最佳单次', en: 'Best attempt' })}</span>
          <strong>{displayMs(result.best, record.eventId)}</strong>
        </div>
        <div>
          <span>{tr({ zh: '目标成绩', en: 'Target result' })}</span>
          <strong>{displayMs(record.targetMs, record.eventId, average)}</strong>
        </div>
      </div>
      <p className="practice-target-message">
        <Target size={18} aria-hidden="true" />
        {targetLabel(record)}
      </p>
      {result.endedBy === 'cutoff' && (
        <p role="status">
          {tr({
            zh: '本轮未达到及格线，已按轮次规则结束；未进行的单次不计为 DNS。',
            en: 'The cutoff was missed, so this round ended early. Unattempted solves do not count as DNS.',
          })}
        </p>
      )}
      {result.endedBy === 'limit' && (
        <p role="status">
          {tr({
            zh: '本轮已达到累计时限，后续单次按轮次规则处理。',
            en: 'The cumulative time limit ended this round. Remaining attempts follow the round rules.',
          })}
        </p>
      )}
      <h3>{tr({ zh: '逐把记录', en: 'Attempt breakdown' })}</h3>
      <ol className="practice-attempts">
        {result.list.map((attempt, index) => (
          <li key={index}>
            <div className="practice-attempt-row">
              <span className="practice-attempt-number">{index + 1}</span>
              <span className="practice-bar-track" aria-hidden="true">
                <span
                  style={{
                    width: `${attempt.ms !== null && Number.isFinite(attempt.ms) ? (attempt.ms / longest) * 100 : 0}%`,
                  }}
                />
              </span>
              <strong>{displayMs(attempt.ms, record.eventId)}</strong>
              {attempt.solve?.penalty === '+2' && <span className="practice-penalty">+2</span>}
            </div>
            {attempt.overLimit && <p>{tr({ zh: '超过时限', en: 'Time limit exceeded' })}</p>}
            {record.issues[index] && record.issues[index] !== 'none' && (
              <p>{tr(PRACTICE_ISSUES[record.issues[index]])}</p>
            )}
            {attempt.solve?.comment && <p className="practice-note">{attempt.solve.comment}</p>}
            {attempt.solve && (
              <details>
                <summary>{tr({ zh: '查看本把打乱', en: 'View scramble' })}</summary>
                <p className="practice-scramble-small">{attempt.solve.scramble}</p>
              </details>
            )}
          </li>
        ))}
      </ol>
      <h3>{tr({ zh: '下次关注', en: 'Focus for next time' })}</h3>
      {issues.length ? (
        <ul className="practice-focus-list">
          {issues.map((issue) => (
            <li key={issue}>
              {tr(PRACTICE_ISSUES[issue])}
              <strong>
                {record.issues.filter((item) => item === issue).length} / {record.solves.length}
              </strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {tr({
            zh: '本轮没有记录失误。下次可在录入成绩时留下一条观察。',
            en: 'No issues were noted this round. Add an observation with your next attempt.',
          })}
        </p>
      )}
    </div>
  );
}

export default function CompSimPage() {
  const isZh = useLang() === 'zh';
  const user = useAuthUser();
  const loginWithWca = useAuthStore((state) => state.loginWithWca);
  const owner = user?.wcaId || 'guest';
  const [source, setSource] = useState<'generated' | 'historical'>('generated');
  const [competitionInput, setCompetitionInput] = useState('');
  const [competition, setCompetition] = useState<Comp | null>(null);
  const [eventId, setEventId] = useState('333');
  const [target, setTarget] = useState('');
  const [voice, setVoice] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [resume, setResume] = useState<PracticeSession | null>(null);
  const [history, setHistory] = useState<PracticeRecord[]>([]);
  const [legacy, setLegacy] = useState<
    { key: string; competition: string; event: string; round: string; result: string }[]
  >([]);
  const [comparisonPage, setComparisonPage] = useState(1);
  const [comparisonSize, setComparisonSize] = useState(50);
  const [review, setReview] = useState<PracticeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const requestId = useRef(0);
  const historyRef = useRef<PracticeRecord[]>([]);
  const submitLock = useRef(false);
  const entryRef = useRef<HTMLInputElement>(null);
  const liveHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const round = session?.rounds[session.roundIndex];
  const result = useMemo(() => session && round ? roundResult(session.solves, round.config) : null, [session?.solves, round]);
  const completed = session?.stage === 'results' ? practiceRecord(session) : null;
  const currentScramble = round?.group.scrambles[session?.solves.length ?? 0]?.scramble ?? '';
  const availableEvents =
    source === 'historical'
      ? (competition?.events ?? []).map(toWcaEventId).filter((id) => SUPPORTED_COMP_SIM_EVENTS.has(id))
      : [...SUPPORTED_COMP_SIM_EVENTS];
  const groups = [
    {
      id: 'practice-events',
      label: tr({ zh: '训练项目', en: 'Practice events' }),
      items: availableEvents.map((id) => ({
        id,
        label: eventDisplayName(id, isZh),
        iconClass: id === 'fto' ? 'unofficial-fto' : `event-${id}`,
      })),
    },
  ];
  const leaderboard = useMemo(
    () =>
      session?.competition && round && result?.complete
        ? buildCompSimLeaderboard({
            officialRows: round.officialRows,
            result,
            sim: {
              wcaId: session.owner === 'guest' ? '' : session.owner,
              name: tr({ zh: '本次训练', en: 'This practice' }),
              countryIso2: '',
            },
            personalRecords: session.personalRecords,
          })
        : [],
    [session, round, result],
  );

  useEffect(() => {
    void loadFlagData();
    const old = readJson('cuberoot-comp-sim-results-v1');
    if (Array.isArray(old))
      setLegacy(
        old.filter(
          (row) =>
            row &&
            ['key', 'competition', 'event', 'round', 'result'].every((key) => typeof row[key] === 'string'),
        ),
      );
    return () => {
      requestId.current += 1;
    };
  }, []);
  useEffect(() => {
    historyRef.current = readHistory();
    setHistory(historyRef.current.filter((record) => record.owner === owner));
    const saved = readJson(ACTIVE_PREFIX + owner);
    setResume(isPracticeSession(saved) && saved.owner === owner ? saved : null);
  }, [owner]);
  useEffect(() => {
    if (!session) return;
    let saved = persistItem(ACTIVE_PREFIX + session.owner, JSON.stringify(session));
    if (session.stage === 'results') {
      const record = practiceRecord(session);
      const merged = new Map([...readHistory(), ...historyRef.current].map((item) => [item.id, item]));
      merged.set(record.id, record);
      const records = [...merged.values()].sort((a, b) => b.at - a.at);
      historyRef.current = records;
      saved = persistItem(HISTORY_KEY, JSON.stringify(records)) && saved;
      setHistory(records.filter((item) => item.owner === owner));
    }
    setStorageWarning(!saved);
  }, [session, owner]);
  useEffect(() => {
    submitLock.current = false;
    setComparisonPage(1);
    if (session?.stage === 'entry') entryRef.current?.focus();
    else if (session) liveHeadingRef.current?.focus();
  }, [session?.stage, session?.solves.length]);
  useEffect(() => {
    if (review) reviewRef.current?.focus();
  }, [review]);
  useEffect(() => {
    if (session?.stage !== 'inspection' || session.inspectionAt === null) return;
    const started = session.inspectionAt;
    const update = () => setElapsed(Math.max(0, Date.now() - started));
    update();
    const interval = window.setInterval(update, 100);
    const timers: number[] = [];
    if (session.voice && 'speechSynthesis' in window) {
      for (const seconds of [8, 12]) {
        const wait = started + seconds * 1000 - Date.now();
        if (wait > 0)
          timers.push(
            window.setTimeout(() => {
              const cue = new SpeechSynthesisUtterance(tr({ zh: `${seconds} 秒`, en: `${seconds} seconds` }));
              cue.lang = isZh ? 'zh-CN' : 'en-US';
              window.speechSynthesis.speak(cue);
            }, wait),
          );
      }
    }
    return () => {
      window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
      if (session.voice && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [session?.stage, session?.inspectionAt, session?.voice, isZh]);

  const updateSession = (patch: Partial<PracticeSession>) =>
    setSession((previous) => (previous ? { ...previous, ...patch } : previous));
  const changeSource = (value: 'generated' | 'historical') => {
    setSource(value);
    setCompetition(null);
    setCompetitionInput('');
    setEventId(value === 'generated' ? '333' : '');
    setError('');
  };
  const start = async () => {
    if (busy || !eventId || (source === 'historical' && !competition)) return;
    const parsedTarget = target.trim() ? parseTimerEntry(target) : null;
    if (target.trim() && (!parsedTarget || parsedTarget.penalty !== 'ok' || parsedTarget.ms <= 0)) {
      setError(tr({ zh: '目标请输入有效时间，例如 20.00。', en: 'Enter a target time such as 20.00.' }));
      return;
    }
    const token = ++requestId.current;
    setBusy(true);
    setError('');
    setReview(null);
    try {
      const loaded: PracticeRound[] = [];
      let records: PracticeSession['personalRecords'] = { single: null, average: null };
      if (source === 'generated') {
        const config = {
          ...LOCAL_CONFIG,
          format: eventId === '666' || eventId === '777' ? ('mo3' as const) : ('ao5' as const),
        };
        const { pooledScramble } = await import('@/lib/cubing-scramble');
        const scrambles = [];
        for (let index = 0; index < roundAttempts(config.format); index++) {
          const scramble = await pooledScramble(eventId);
          if (token !== requestId.current) return;
          if (!scramble)
            throw new Error(
              tr({ zh: '打乱生成失败，请重试。', en: 'Scramble generation failed. Please try again.' }),
            );
          scrambles.push({
            event_id: eventId,
            round_type_id: '1',
            group_id: 'practice',
            is_extra: false,
            scramble_num: index + 1,
            scramble,
          });
        }
        loaded.push({
          detail: {
            id: `${eventId}-r1`,
            format: config.format === 'mo3' ? 'm' : 'a',
            timeLimitCs: null,
            cumulative: false,
            cumulativeRoundIds: [],
            cutoff: null,
            advancementCondition: null,
          },
          config,
          roundTypeId: '1',
          officialRows: [],
          group: { groupId: 'practice', scrambles, extras: [] },
        });
      } else if (competition) {
        const [data, scrambles, wcif, person] = await Promise.all([
          fetchWcaResults(competition.id, eventId),
          fetchWcaScrambles(competition.id),
          fetchCompWcif(competition.id),
          user?.wcaId ? fetchWcaPerson(user.wcaId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!data?.rounds.length || !scrambles?.length)
          throw new Error(
            tr({
              zh: '该项目尚无完整的已发布成绩和打乱，请选择另一场比赛。',
              en: 'Published results and scrambles are missing. Choose another competition.',
            }),
          );
        const matched = matchPublishedCompSimRounds(wcif.roundDetails[eventId] ?? [], data.rounds);
        if (!matched)
          throw new Error(
            tr({
              zh: '比赛规则与成绩轮次无法对应。',
              en: 'Round rules could not be matched to published results.',
            }),
          );
        for (const { detail, officialRound } of matched) {
          const config = roundConfigFromWcif(detail);
          const attempts = expectedAttemptCount(detail.format);
          if (!config || !attempts || hasCrossRoundCumulativeLimit(detail))
            throw new Error(
              tr({
                zh: '这场比赛包含暂不支持的赛制或跨轮累计时限。',
                en: 'This competition includes an unsupported format or a cumulative limit shared across rounds.',
              }),
            );
          const group = selectPlayableScrambleGroup(scrambles, eventId, officialRound.roundTypeId, attempts);
          if (!group)
            throw new Error(
              tr({
                zh: '部分轮次缺少完整打乱，请选择另一场比赛。',
                en: 'A round is missing a complete scramble set. Choose another competition.',
              }),
            );
          loaded.push({
            detail,
            config,
            roundTypeId: officialRound.roundTypeId,
            officialRows: officialRound.results,
            group,
          });
        }
        const personal = person?.personal_records[eventId];
        records = { single: personal?.single?.best ?? null, average: personal?.average?.best ?? null };
      }
      if (source === 'generated' && user?.wcaId) {
        const person = await fetchWcaPerson(user.wcaId).catch(() => null);
        const personal = person?.personal_records[eventId];
        records = { single: personal?.single?.best ?? null, average: personal?.average?.best ?? null };
      }
      if (token !== requestId.current) return;
      if (!loaded.length) throw new Error(tr({ zh: '没有可用轮次。', en: 'No rounds are available.' }));
      setSession({
        version: PRACTICE_VERSION,
        id: crypto.randomUUID(),
        owner,
        eventId,
        competition:
          source === 'historical' && competition
            ? { id: competition.id, name: competition.name, country: competition.country }
            : null,
        rounds: loaded,
        roundIndex: 0,
        solves: [],
        issues: [],
        targetMs: parsedTarget?.ms ?? null,
        voice,
        stage: 'ready',
        inspectionAt: null,
        entry: '',
        plusTwo: false,
        note: '',
        issue: 'none',
        personalRecords: records,
      });
      setResume(null);
    } catch (caught) {
      if (token === requestId.current)
        setError(
          caught instanceof Error
            ? caught.message
            : tr({ zh: '训练准备失败，请重试。', en: 'Could not prepare this practice. Try again.' }),
        );
    } finally {
      if (token === requestId.current) setBusy(false);
    }
  };
  const submit = (dnf = false) => {
    if (!session || !round || session.stage !== 'entry' || submitLock.current) return;
    const parsed = dnf ? { ms: 0, penalty: 'DNF' as const } : parseTimerEntry(session.entry);
    if (!parsed || parsed.penalty === 'DNS' || (parsed.penalty !== 'DNF' && parsed.ms <= 0)) {
      setError(
        tr({
          zh: '请输入有效成绩，例如 12.34、1:23.45 或 DNF。',
          en: 'Enter a valid result such as 12.34, 1:23.45, or DNF.',
        }),
      );
      return;
    }
    submitLock.current = true;
    const solve = makeCompSimSolve(
      fromWcaSpelling(session.eventId),
      currentScramble,
      parsed.ms,
      parsed.penalty === 'DNF' ? 'DNF' : session.plusTwo || parsed.penalty === '+2' ? '+2' : 'ok',
    );
    solve.comment = session.note.trim();
    const solves = [...session.solves, solve];
    updateSession({
      solves,
      issues: [...session.issues, session.issue],
      entry: '',
      plusTwo: false,
      note: '',
      issue: 'none',
      inspectionAt: null,
      stage: roundResult(solves, round.config).complete ? 'results' : 'ready',
    });
    setError('');
  };
  const leave = () => {
    setResume(session);
    setSession(null);
    setError('');
    setElapsed(0);
  };
  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cuberoot-practice.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sourceName = (record: { competition: PracticeSession['competition'] }) =>
    record.competition ? (
      <CompCell compId={record.competition.id} compName={record.competition.name} isZh={isZh} date={null} />
    ) : (
      tr({ zh: '自主练习', en: 'Personal practice' })
    );
  const messages = (
    <>
      {error && (
        <p className="practice-alert" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          {error}
        </p>
      )}
      {storageWarning && (
        <p className="practice-alert" role="alert">
          {tr({
            zh: '本机存储不可用，记录仅保留在当前页面。请在离开前导出训练历史。',
            en: 'Local storage is unavailable. Records remain in this page only. Export your history before leaving.',
          })}
        </p>
      )}
    </>
  );

  if (session && round && result)
    return (
      <main className="practice-page">
        <header className="practice-topbar">
          <div>
            <span className="practice-eyebrow">{tr({ zh: '赛前训练', en: 'Competition Practice' })}</span>
            <h1 ref={liveHeadingRef} tabIndex={-1}>
              {session.stage === 'results'
                ? tr({ zh: '本轮复盘', en: 'Round review' })
                : eventDisplayName(session.eventId, isZh)}
            </h1>
            <p>
              {sourceName(session)} ·{' '}
              {session.competition
                ? roundTypeName(round.roundTypeId, isZh)
                : tr({ zh: '一轮练习', en: 'Practice round' })}
            </p>
          </div>
          <HeaderToggles />
        </header>
        <nav className="practice-progress" aria-label={tr({ zh: '训练进度', en: 'Practice progress' })}>
          {[
            tr({ zh: '本轮计划', en: 'Plan' }),
            tr({ zh: '完成一轮', en: 'Practice' }),
            tr({ zh: '本轮复盘', en: 'Review' }),
          ].map((label, index) => (
            <span
              key={index}
              aria-current={index === (session.stage === 'results' ? 2 : 1) ? 'step' : undefined}
            >
              {index === 0 ? <Check size={16} aria-hidden="true" /> : <span>{index + 1}</span>}
              {label}
            </span>
          ))}
        </nav>
        {messages}
        {completed ? (
          <section className="practice-card">
            <RoundReview record={completed} />
            {(session.personalRecords.average !== null || session.personalRecords.single !== null) && (
              <p className="practice-personal-records">
                {tr({ zh: 'WCA 个人纪录参考', en: 'WCA personal record reference' })}:{' '}
                {tr({ zh: '单次', en: 'Single' })}{' '}
                {formatWcaResult(session.personalRecords.single ?? 0, session.eventId, 'single', {
                  zero: 'empty',
                }) || '—'}{' '}
                · {tr({ zh: '平均', en: 'Average' })}{' '}
                {formatWcaResult(session.personalRecords.average ?? 0, session.eventId, 'average', {
                  zero: 'empty',
                }) || '—'}
              </p>
            )}
            {leaderboard.length > 0 && (
              <details className="practice-comparison">
                <summary>{tr({ zh: '与历史比赛成绩对照', en: 'Compare with historical results' })}</summary>
                <p>
                  {tr({
                    zh: '这是训练成绩与已发布成绩的假设对照，不是实时比赛，也不会计入官方纪录。',
                    en: 'This compares practice against published results. It is not a live competition or an official record.',
                  })}
                </p>
                <p>{tr({ zh: '本次训练的对照排名', en: 'Your practice comparison rank' })}: #{leaderboard.find((row) => row.kind === 'sim')?.rank}</p>
                <Paginator page={comparisonPage} totalPages={Math.max(1, Math.ceil(leaderboard.length / comparisonSize))} size={comparisonSize} pageSizeOptions={[25, 50, 100]} isZh={isZh} className="practice-pagination" onPageChange={setComparisonPage} onSizeChange={(size) => { setComparisonSize(size); setComparisonPage(1); }} />
                <div className="practice-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr({ zh: '对照排名', en: 'Comparison rank' })}</th>
                        <th>{tr({ zh: '选手', en: 'Competitor' })}</th>
                        <th>{tr({ zh: '成绩', en: 'Result' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.slice((comparisonPage - 1) * comparisonSize, comparisonPage * comparisonSize).map((row) => (
                        <tr
                          key={`${row.kind}:${row.wcaId}`}
                          className={row.kind === 'sim' ? 'practice-own' : undefined}
                        >
                          <td>{row.rank}</td>
                          <td>
                            {row.kind === 'sim' ? (
                              tr({ zh: '本次训练', en: 'This practice' })
                            ) : (
                              <>
                                <Flag iso2={row.countryIso2} />{' '}
                                <PersonLink wcaId={row.wcaId} name={row.name} isZh={isZh} />
                              </>
                            )}
                          </td>
                          <td>
                            {formatWcaResult(
                              row.primary,
                              session.eventId,
                              round.config.format === 'ao5' || round.config.format === 'mo3'
                                ? 'average'
                                : 'single',
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            <div className="practice-actions">
              {session.roundIndex + 1 < session.rounds.length && (
                <button
                  type="button"
                  className="practice-primary"
                  onClick={() =>
                    updateSession({
                      roundIndex: session.roundIndex + 1,
                      solves: [],
                      issues: [],
                      stage: 'ready',
                      entry: '',
                      plusTwo: false,
                      note: '',
                      issue: 'none',
                      inspectionAt: null,
                    })
                  }
                >
                  {tr({ zh: '练习下一轮', en: 'Practice next round' })}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              )}
              <button type="button" className="practice-secondary" onClick={leave}>
                {tr({ zh: '完成训练', en: 'Finish practice' })}
              </button>
              <button type="button" className="practice-secondary" onClick={exportHistory}>
                {tr({ zh: '导出训练历史', en: 'Export practice history' })}
              </button>
            </div>
          </section>
        ) : (
          <div className="practice-workspace">
            <section className="practice-card practice-active">
              <span className="practice-eyebrow">
                {tr({
                  zh: `第 ${session.solves.length + 1} 把 / 共 ${result.attempts} 把`,
                  en: `Attempt ${session.solves.length + 1} of ${result.attempts}`,
                })}
              </span>
              {session.stage === 'ready' && (
                <>
                  <h2>{tr({ zh: '准备好，再开始', en: 'Start when you are ready' })}</h2>
                  <p>
                    {tr({
                      zh: '按下方序列打乱魔方，准备好实体计时器。',
                      en: 'Apply this scramble and prepare your physical timer.',
                    })}
                  </p>
                  <div className="practice-scramble">{currentScramble}</div>
                  <div className="practice-actions">
                    <button
                      type="button"
                      className="practice-primary"
                      onClick={() => {
                        setElapsed(0);
                        updateSession({ stage: 'inspection', inspectionAt: Date.now() });
                      }}
                    >
                      {tr({ zh: '进入观察', en: 'Start inspection' })}
                      <Play size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="practice-secondary"
                      onClick={() => updateSession({ stage: 'entry', inspectionAt: null })}
                    >
                      {tr({ zh: '直接录入成绩', en: 'Enter a result directly' })}
                    </button>
                  </div>
                </>
              )}
              {session.stage === 'inspection' && (
                <>
                  <h2>{tr({ zh: '观察与规划', en: 'Inspect and plan' })}</h2>
                  <div
                    className="practice-clock"
                    role="timer"
                    aria-label={tr({ zh: '观察已用秒数', en: 'Inspection seconds elapsed' })}
                  >
                    {Math.floor(elapsed / 1000)}
                    <small>/ 15 s</small>
                  </div>
                  <p>
                    {tr({
                      zh: '屏幕时间仅供辅助。开始还原时停止提示，实际成绩以实体计时器为准。',
                      en: 'This display is a guide. Stop the cues when you begin solving; use your physical timer for the result.',
                    })}
                  </p>
                  <button
                    type="button"
                    className="practice-primary"
                    onClick={() => updateSession({ stage: 'entry', inspectionAt: null })}
                  >
                    {tr({ zh: '开始还原，停止提示', en: 'Begin solving · stop cues' })}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </>
              )}
              {session.stage === 'entry' && (
                <>
                  <h2>{tr({ zh: '记录这一次发挥', en: 'Capture this attempt' })}</h2>
                  <p>
                    {tr({
                      zh: '输入实体计时器读数；如有罚时，请手动标记。',
                      en: 'Enter your physical timer reading and mark any penalty manually.',
                    })}
                  </p>
                  <label htmlFor="practice-result">{tr({ zh: '本把成绩', en: 'Attempt result' })}</label>
                  <div className="practice-input-wrap">
                    <input
 className="practice-input"
                      id="practice-result"
                      ref={entryRef}
                      inputMode="decimal"
                      autoComplete="off"
                      maxLength={16}
                      value={session.entry}
                      placeholder="12.34"
                      onChange={(event) => updateSession({ entry: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          submit();
                        }
                      }}
                    />
                    {session.entry && <ClearButton onClick={() => updateSession({ entry: '' })} />}
                  </div>
                  <BoolToggle
                    value={session.plusTwo}
                    onChange={(plusTwo) => updateSession({ plusTwo })}
                    label={tr({ zh: '加罚 2 秒', en: 'Add a 2-second penalty' })}
                  />
                  <label htmlFor="practice-issue">
                    {tr({ zh: '本把观察（可选）', en: 'Observation (optional)' })}
                  </label>
                  <select
 className="practice-select"
                    id="practice-issue"
                    value={session.issue}
                    onChange={(event) => updateSession({ issue: event.target.value as PracticeIssue })}
                  >
                    {Object.entries(PRACTICE_ISSUES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {tr(label)}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="practice-note">
                    {tr({ zh: '给下次的提醒（可选）', en: 'Note for next time (optional)' })}
                  </label>
                  <textarea
 className="practice-textarea"
                    id="practice-note"
                    rows={2}
                    maxLength={500}
                    value={session.note}
                    onChange={(event) => updateSession({ note: event.target.value })}
                    placeholder={tr({
                      zh: '例如：第一组还原后停顿，下一把注意衔接。',
                      en: 'For example: paused after the first pair; work on the transition.',
                    })}
                  />
                  <div className="practice-actions">
                    <button type="button" className="practice-primary" onClick={() => submit()}>
                      {tr({ zh: '保存本把', en: 'Save attempt' })}
                      <Check size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="practice-secondary" onClick={() => submit(true)}>
                      {tr({ zh: '记为 DNF', en: 'Record DNF' })}
                    </button>
                  </div>
                </>
              )}
            </section>
            <aside className="practice-card practice-scorecard">
              <h2>{tr({ zh: '本轮成绩单', en: 'Round scorecard' })}</h2>
              <p>{round.config.format.toUpperCase()}</p>
              <ol>
                {result.list.map((attempt, index) => (
                  <li key={index} aria-current={index === session.solves.length ? 'step' : undefined}>
                    <span>{index + 1}</span>
                    <strong>{displayMs(attempt.ms, session.eventId)}</strong>
                  </li>
                ))}
              </ol>
              {session.targetMs !== null && (
                <p>
                  <Target size={16} aria-hidden="true" /> {tr({ zh: '目标', en: 'Target' })}{' '}
                  {displayMs(session.targetMs, session.eventId, true)}
                </p>
              )}
              {round.config.cutoffMs !== null && (
                <p>
                  {tr({ zh: '及格线', en: 'Cutoff' })}: {displayMs(round.config.cutoffMs, session.eventId)} (
                  {round.config.cutoffAttempts})
                </p>
              )}
              {round.config.limitMs !== null && (
                <p>
                  {round.config.cumulative
                    ? tr({ zh: '累计时限', en: 'Cumulative limit' })
                    : tr({ zh: '单次时限', en: 'Time limit' })}
                  : {displayMs(round.config.limitMs, session.eventId)}
                </p>
              )}
              <button type="button" className="practice-secondary" onClick={leave}>
                {tr({ zh: '暂存并离开', en: 'Save for later' })}
              </button>
            </aside>
          </div>
        )}
      </main>
    );

  return (
    <main className="practice-page">
      <header className="practice-topbar">
        <div>
          <BackHome />
          <h1>{tr({ zh: '赛前训练', en: 'Competition Practice' })}</h1>
          <p>
            {tr({
              zh: '完成一轮练习，记录发挥，找到下一次训练重点。',
              en: 'Complete a round, track your performance, and find your next focus.',
            })}
          </p>
        </div>
        <HeaderToggles />
      </header>
      {messages}
      {resume && (
        <section className="practice-resume">
          <History size={22} aria-hidden="true" />
          <div>
            <strong>
              {resume.stage === 'results'
                ? tr({ zh: '上次训练已完成', en: 'Your last round is complete' })
                : tr({ zh: '接着上次练', en: 'Pick up where you left off' })}
            </strong>
            <p>
              {eventDisplayName(resume.eventId, isZh)} ·{' '}
              {tr({
                zh: `已记录 ${resume.solves.length} 把`,
                en: `${resume.solves.length} attempts recorded`,
              })}
            </p>
          </div>
          <button
            type="button"
            className="practice-primary"
            disabled={busy}
            onClick={() => {
              setSession(
                resume.stage === 'inspection' ? { ...resume, stage: 'ready', inspectionAt: null } : resume,
              );
              setReview(null);
            }}
          >
            {resume.stage === 'results'
              ? tr({ zh: '查看复盘', en: 'View review' })
              : tr({ zh: '继续训练', en: 'Resume practice' })}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>
      )}
      <div className="practice-workspace">
        <section className="practice-card practice-plan" aria-busy={busy}>
          <div className="practice-section-title">
            <Target size={22} aria-hidden="true" />
            <h2>{tr({ zh: '本轮计划', en: 'Your round plan' })}</h2>
          </div>
          <fieldset disabled={busy}>
            <label htmlFor="practice-source">{tr({ zh: '打乱来源', en: 'Scramble source' })}</label>
            <select
 className="practice-select"
              id="practice-source"
              value={source}
              onChange={(event) => changeSource(event.target.value as 'generated' | 'historical')}
            >
              <option value="generated">
                {tr({ zh: '生成一组新打乱', en: 'Generate fresh scrambles' })}
              </option>
              <option value="historical">
                {tr({ zh: '使用历史比赛打乱', en: 'Use a historical competition' })}
              </option>
            </select>
            {source === 'historical' && (
              <div className="practice-field">
                <label>{tr({ zh: '比赛资料', en: 'Competition archive' })}</label>
                <CompPicker
                  value={competitionInput}
                  onChange={(value) => {
                    setCompetitionInput(value);
                    if (value !== competition?.name) {
                      setCompetition(null);
                      setEventId('');
                    }
                  }}
                  onPick={(picked) => {
                    setCompetition(picked);
                    setCompetitionInput(picked.name);
                    setEventId(
                      (picked.events ?? [])
                        .map(toWcaEventId)
                        .find((id) => SUPPORTED_COMP_SIM_EVENTS.has(id)) ?? '',
                    );
                  }}
                  placeholder={tr({ zh: '搜索已结束的比赛', en: 'Search completed competitions' })}
                  isZh={isZh}
                  hideFuture
                  hideNotEnded
                  hideCancelled
                />
              </div>
            )}
            <div className="practice-field">
              <label>{tr({ zh: '训练项目', en: 'Practice event' })}</label>
              {availableEvents.length ? (
                <PuzzlePicker
                  isZh={isZh}
                  selectedEvent={eventId}
                  groups={groups}
                  onSelect={(id) => {
                    setEventId(id);
                    setError('');
                  }}
                />
              ) : (
                <p>
                  {tr({
                    zh: '选择比赛后显示可练习的项目。',
                    en: 'Choose a competition to see its available events.',
                  })}
                </p>
              )}
            </div>
            <label htmlFor="practice-target">
              {tr({ zh: '目标成绩（可选）', en: 'Target result (optional)' })}
            </label>
            <div className="practice-input-wrap">
              <input
 className="practice-input"
                id="practice-target"
                inputMode="decimal"
                maxLength={16}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="20.00"
              />
              {target && <ClearButton onClick={() => setTarget('')} />}
            </div>
            <p className="practice-help">
              {tr({
                zh: '目标按本轮赛制比较：平均制比较平均，最佳制比较最佳单次。',
                en: 'Your target follows the round format: average for average rounds, best single for best-of rounds.',
              })}
            </p>
            <BoolToggle
              value={voice}
              onChange={setVoice}
              label={tr({
                zh: '观察时朗读 8 秒与 12 秒提示',
                en: 'Speak the 8- and 12-second inspection cues',
              })}
            />
            <p className="practice-help">
              {tr({
                zh: '语音可用性取决于浏览器；始终提供屏幕时间提示。',
                en: 'Speech depends on your browser. The on-screen time guide is always available.',
              })}
            </p>
            <button
              type="button"
              className="practice-primary practice-start"
              disabled={!eventId || (source === 'historical' && !competition)}
              onClick={start}
            >
              {busy
                ? tr({ zh: '正在准备打乱与轮次…', en: 'Preparing scrambles and rounds…' })
                : tr({ zh: '开始本轮训练', en: 'Start this round' })}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </fieldset>
          {busy && (
            <button
              type="button"
              className="practice-secondary"
              onClick={() => {
                requestId.current += 1;
                setBusy(false);
              }}
            >
              {tr({ zh: '取消准备', en: 'Cancel preparation' })}
            </button>
          )}
        </section>
        <aside className="practice-aside">
          <section className="practice-card practice-overview">
            <span className="practice-eyebrow">
              {tr({ zh: '专注一轮，持续进步', en: 'One round at a time' })}
            </span>
            <h2>
              {eventId ? eventDisplayName(eventId, isZh) : tr({ zh: '你的下一轮', en: 'Your next round' })}
            </h2>
            <p>
              {source === 'generated'
                ? tr({
                    zh: '新打乱 · 实体计时 · 本机记录',
                    en: 'Fresh scrambles · physical timer · local history',
                  })
                : tr({
                    zh: '历史打乱 · 原轮次规则 · 成绩对照',
                    en: 'Archived scrambles · round rules · result comparison',
                  })}
            </p>
            <ul className="practice-benefits">
              <li>
                <Play size={18} aria-hidden="true" />
                <div>
                  <strong>{tr({ zh: '按自己的节奏准备', en: 'Prepare at your pace' })}</strong>
                  <p>
                    {tr({
                      zh: '准备、观察、还原，每次只关注当前一步。',
                      en: 'Prepare, inspect, solve. Focus on the current step.',
                    })}
                  </p>
                </div>
              </li>
              <li>
                <BookOpen size={18} aria-hidden="true" />
                <div>
                  <strong>{tr({ zh: '留下具体观察', en: 'Keep useful observations' })}</strong>
                  <p>
                    {tr({
                      zh: '成绩之外，记下停顿和失误发生在哪里。',
                      en: 'Alongside the time, note where pauses and mistakes happened.',
                    })}
                  </p>
                </div>
              </li>
              <li>
                <FinishFlag size={18} aria-hidden="true" />
                <div>
                  <strong>{tr({ zh: '带着重点继续练', en: 'Leave with a focus' })}</strong>
                  <p>
                    {tr({
                      zh: '从逐把记录和目标差距中安排下一轮。',
                      en: 'Use your attempts and target gap to plan the next round.',
                    })}
                  </p>
                </div>
              </li>
            </ul>
            {competition && <p>{sourceName({ competition })}</p>}
          </section>
          <section className="practice-account">
            <p>
              {tr({
                zh: '无需登录即可训练，记录保存在当前浏览器。',
                en: 'Practice without signing in. Records stay in this browser.',
              })}
            </p>
            {!user?.wcaId && (
              <button type="button" className="practice-secondary" onClick={() => loginWithWca()}>
                {tr({ zh: '关联 WCA 个人纪录', en: 'Connect WCA personal records' })}
              </button>
            )}
            {user?.wcaId && (
              <p>
                <Flag iso2={user.country} /> <PersonLink wcaId={user.wcaId} name={user.name} isZh={isZh} />
              </p>
            )}
          </section>
        </aside>
      </div>
      <section className="practice-card practice-history">
        <div className="practice-section-title">
          <History size={22} aria-hidden="true" />
          <h2>{tr({ zh: '训练历史', en: 'Practice history' })}</h2>
          {history.length > 0 && (
            <button type="button" className="practice-secondary" onClick={exportHistory}>
              {tr({ zh: '导出', en: 'Export' })}
            </button>
          )}
        </div>
        {history.length ? (
          <ul>
            {history.map((record) => (
              <li key={record.id}>
                <button type="button" className="practice-history-button" onClick={() => setReview(record)}>
                  <span>
                    <strong>{eventDisplayName(record.eventId, isZh)}</strong> · {sourceName(record)}
                    <small>
                      {new Date(record.at).toLocaleString(isZh ? 'zh-CN' : 'en-US')} ·{' '}
                      {record.competition
                        ? roundTypeName(record.roundTypeId, isZh)
                        : tr({ zh: '一轮练习', en: 'Practice round' })}
                    </small>
                  </span>
                  <span>
                    <strong>
                      {displayMs(
                        roundResult(record.solves, record.config).official,
                        record.eventId,
                        record.config.format === 'ao5' || record.config.format === 'mo3',
                      )}
                    </strong>
                    <small>{targetLabel(record)}</small>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="practice-empty">
            <BookOpen size={28} aria-hidden="true" />
            <p>
              {tr({
                zh: '完成第一轮后，在这里查看成绩、目标和逐把备注。',
                en: 'After your first round, find your results, targets, and attempt notes here.',
              })}
            </p>
          </div>
        )}
        {legacy.length > 0 && (
          <details>
            <summary>{tr({ zh: '旧版历史摘要', en: 'Earlier history summaries' })}</summary>
            <ul>
              {legacy.map((record) => (
                <li key={record.key}>
                  {record.competition} · {record.event} · {record.round} · {record.result}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      {review && (
        <section ref={reviewRef} tabIndex={-1} className="practice-card practice-history-review">
          <div className="practice-section-title">
            <h2>{tr({ zh: '历史复盘', en: 'Past round review' })}</h2>
            <button type="button" className="practice-secondary" onClick={() => setReview(null)}>
              {tr({ zh: '收起复盘', en: 'Close review' })}
            </button>
          </div>
          <p>
            {eventDisplayName(review.eventId, isZh)} · {sourceName(review)}
          </p>
          <RoundReview record={review} />
        </section>
      )}
    </main>
  );
}
