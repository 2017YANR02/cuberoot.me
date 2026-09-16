'use client';

import { useEffect, useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import { useTrainingStats } from '@/hooks/useTrainingStats';
import './training-stats.css';

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

export default function TrainingStatsPanel({ group, description }: { group: string; description?: string }) {
  const { stats, reset, unsaved } = useTrainingStats(group);
  const [confirmGroup, setConfirmGroup] = useState<string | null>(null);
  const graded = stats.correct + stats.wrong;
  return (
    <section className="training-stats" data-site-surface="panel" aria-label={tr({ zh: '训练统计', en: 'Training statistics' })}>
      <div className="training-stats-heading">
        <strong>{tr({ zh: '训练统计', en: 'Training statistics' })}</strong>
      </div>
      {description && <p>{description}</p>}
      <dl className="training-stats-metrics" aria-live="polite">
        <div><dt>{tr({ zh: '累计完成', en: 'Completed' })}</dt><dd>{stats.total}</dd></div>
        <div><dt>{tr({ zh: '正确 / 错误', en: 'Correct / Wrong' })}</dt><dd>{stats.correct} / {stats.wrong}</dd></div>
        <div><dt>{tr({ zh: '正确率', en: 'Accuracy' })}</dt><dd>{graded ? `${Math.round(stats.correct / graded * 100)}%` : '—'}</dd></div>
        <div><dt>{tr({ zh: '平均用时', en: 'Mean time' })}</dt><dd>{stats.timed ? seconds(stats.totalMs / stats.timed) : '—'}</dd></div>
        <div><dt>{tr({ zh: '最快用时', en: 'Best time' })}</dt><dd>{stats.bestMs === null ? '—' : seconds(stats.bestMs)}</dd></div>
      </dl>
      {stats.recent.length > 0 && <details>
        <summary>{tr({ zh: '最近记录', en: 'Recent attempts' })}</summary>
        <ol className="training-stats-history">{[...stats.recent].reverse().map(attempt => (
          <li key={attempt.id}>
            <time dateTime={new Date(attempt.at).toISOString()}>{new Date(attempt.at).toLocaleString()}</time>
            <span>{attempt.correct === null ? tr({ zh: '已完成', en: 'Completed' }) : attempt.correct ? tr({ zh: '正确', en: 'Correct' }) : tr({ zh: '错误', en: 'Wrong' })}</span>
            <span>{attempt.durationMs === undefined ? '—' : seconds(attempt.durationMs)}</span>
          </li>
        ))}</ol>
      </details>}
      {unsaved && <p role="alert">{tr({ zh: '浏览器暂时无法保存，当前记录仅在本次访问中保留。', en: 'Browser storage is unavailable. New results are kept for this visit only.' })}</p>}
      {stats.total > 0 && <div className="training-stats-actions">
        {confirmGroup === group ? <>
          <span>{tr({ zh: '清空当前分组的统计？', en: 'Clear statistics for this group?' })}</span>
          <button className="training-stats-action" type="button" onClick={() => { reset(); setConfirmGroup(null); }}>{tr({ zh: '确认清空', en: 'Confirm reset' })}</button>
          <button className="training-stats-action" type="button" onClick={() => setConfirmGroup(null)}>{tr({ zh: '取消', en: 'Cancel' })}</button>
        </> : <button className="training-stats-action" type="button" onClick={() => setConfirmGroup(group)}>{tr({ zh: '重置本组', en: 'Reset group' })}</button>}
      </div>}
    </section>
  );
}

/** For physical-cube drills without automatic grading; revealing/skipping is not a result. */
export function TrainingSelfCheck({ onResult, disabled }: { onResult: (correct: boolean) => void; disabled?: boolean }) {
  return <div className="training-stats-actions">
    <span>{tr({ zh: '自评本题', en: 'Rate this attempt' })}</span>
    <button className="training-stats-action" type="button" disabled={disabled} onClick={() => onResult(true)}>{tr({ zh: '做对了', en: 'Got it right' })}</button>
    <button className="training-stats-action" type="button" disabled={disabled} onClick={() => onResult(false)}>{tr({ zh: '需要再练', en: 'Needs practice' })}</button>
  </div>;
}

export function TrainingSelfPractice({ group, attempt, disabled }: { group: string; attempt: unknown; disabled?: boolean }) {
  const { record } = useTrainingStats(group);
  const startedAt = useRef(0);
  const recorded = useRef(false);
  const [rated, setRated] = useState(false);
  useEffect(() => {
    startedAt.current = Date.now();
    recorded.current = false;
    setRated(false);
  }, [group, attempt]);
  return <>
    <TrainingSelfCheck disabled={disabled || rated} onResult={correct => {
      if (recorded.current) return;
      recorded.current = true;
      record(correct, Date.now() - startedAt.current);
      setRated(true);
    }} />
  </>;
}

/** The iframe host cannot grade an upstream trainer: users explicitly start and rate an attempt. */
export function TrainingManualPractice({ group }: { group: string }) {
  const { record } = useTrainingStats(group);
  const startedAt = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  return <div className="training-manual-practice">
    {active ? <>
      <TrainingSelfCheck onResult={correct => {
        if (startedAt.current === null) return;
        record(correct, Date.now() - startedAt.current);
        startedAt.current = null;
        setActive(false);
      }} />
      <div className="training-stats-actions"><button className="training-stats-action" type="button" onClick={() => {
        startedAt.current = null;
        setActive(false);
      }}>{tr({ zh: '取消本次记录', en: 'Cancel this attempt' })}</button></div>
    </> : <div className="training-stats-actions"><button className="training-stats-action" type="button" onClick={() => {
      startedAt.current = Date.now();
      setActive(true);
    }}>{tr({ zh: '开始记录一次练习', en: 'Record a practice attempt' })}</button></div>}
    <TrainingStatsPanel group={group} description={tr({
      zh: '先点击开始记录，练完后自评本次结果。',
      en: 'Start recording, practise, then rate your attempt.',
    })} />
  </div>;
}
