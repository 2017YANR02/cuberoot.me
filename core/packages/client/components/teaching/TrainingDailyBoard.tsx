'use client';
import { useEffect, useState } from 'react';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import { DateInput } from '@/components/DateInput';
import WcaEventSelector from '@/components/WcaEventSelector';
import { useT } from '@/hooks/useT';
import { getTeachingDailyBoard, type TeachingDailyBoard } from '@/lib/teaching-saas-api';
import { trainingToolHref, formatTrainingGoal } from '@/lib/teaching-training';
import { flushTrainingEvidenceOutbox, getTrainingEvidenceOutbox } from '@/lib/training-evidence';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';
import { teachingErrorMessage } from './TeachingUi';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export default function TrainingDailyBoard({ orgSlug, assignmentId, learner = false }: { orgSlug: string; assignmentId: string; learner?: boolean }) {
  const t = useT();
  const [date, setDate] = useQueryState('trainingDate', parseAsString);
  const [page, setPage] = useQueryState('trainingPage', parseAsInteger.withDefault(1));
  const [rankEvent, setRankEvent] = useQueryState('trainingRankEvent', parseAsString);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [board, setBoard] = useState<TeachingDailyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(0);
  const reload = () => setRevision(value => value + 1);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    void (async () => {
      if (learner) {
        await flushTrainingEvidenceOutbox();
        if (!cancelled) setPending(getTrainingEvidenceOutbox().filter(item => item.destination.organizationSlug === orgSlug && item.destination.assignmentId === assignmentId).length);
      }
      return getTeachingDailyBoard(orgSlug, assignmentId, learner, date, Math.max(1, page), rankEvent);
    })()
      .then(result => { if (!cancelled) setBoard(result); })
      .catch(reason => { if (!cancelled) setError(teachingErrorMessage(reason, t)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgSlug, assignmentId, learner, date, page, rankEvent, revision, t]);
  const isZh = t('zh', 'en') === 'zh';
  async function copyRoom() {
    const url = new URL(`${isZh ? '/zh' : ''}/training/${encodeURIComponent(orgSlug)}`, window.location.origin);
    url.searchParams.set('assignment', assignmentId);
    try { await navigator.clipboard.writeText(url.href); setCopied(true); setCopyFailed(false); }
    catch { setCopyFailed(true); }
  }
  return <section className="org-section training-daily-board">
    <h2>{t('每日训练打卡', 'Daily training check-in')}</h2>
    <div className="org-form-actions">
      <DateInput value={date || board?.date || ''} onChange={value => { void setDate(value || null); void setPage(1); void setRankEvent(null); }} />
      <WcaEventSelector availableEvents={new Set(board?.events ?? [])} selectedEvent={rankEvent ?? ''} onSelect={event => { void setRankEvent(event || null); void setPage(1); }} isZh={isZh} onlyAvailable allowAll allLabel={t('按练习次数排名', 'Rank by attempts')} appendEvents={(board?.events ?? []).filter(event => !isWcaEvent(event)).map(event => ({ id: event, iconClass: '', textLabel: eventDisplayName(event, isZh) }))} />
      <button type="button" className="org-secondary-button" onClick={() => { void setDate(null); void setPage(1); reload(); }}>{t('今天', 'Today')}</button>
      <button type="button" className="org-secondary-button" onClick={reload}>{t('刷新', 'Refresh')}</button>
      <button type="button" className="org-secondary-button" onClick={() => void copyRoom()}>{copied ? t('已复制固定入口', 'Room link copied') : t('复制固定打卡入口', 'Copy room link')}</button>
    </div>
    {copyFailed && <p role="alert">{t('复制失败，请重试。', 'Copy failed. Please retry.')}</p>}
    {loading ? <p aria-busy="true"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p> : error ? <p role="alert">{error}</p> : board && <>
      <h3>{board.assignment.title}</h3><p>{board.assignment.instructions}</p>
      {!!pending && <p role="status">{t(`有 ${pending} 条训练记录尚未同步，联网后点击刷新重试；若持续失败，请联系老师核对账号和任务。`, `${pending} training records have not synced. Refresh when online; if this persists, ask your teacher to check your account and assignment.`)}</p>}
      {!!board.goals.length && <p>{board.goals.map(goal => formatTrainingGoal(goal, isZh ? 'zh' : 'en')).join(' · ')}</p>}
      <p>{board.date} · {board.timezone} · {t(`完成 ${board.completedTotal} / ${board.total} 人，每人目标 ${board.assignment.expectedCount} 次`, `${board.completedTotal} / ${board.total} completed; ${board.assignment.expectedCount} attempts per learner`)}</p>
      <p className="org-help">{t('从本任务进入训练后自动记录。默认按练习次数排名；选择项目后按该项目当日最佳成绩排名，同成绩并列。均值仅包含成功还原，记录为学员自报。', 'Training started from this assignment is recorded automatically. Rank by attempt count, or select an event to rank by its daily best result, with ties. Means include successful solves only. Records are self-reported.')}</p>
      {learner && board.assignment.status === 'published' && <AppLink className="org-primary-link" href={trainingToolHref(board.templateVersion.source, orgSlug, assignmentId)} prefetch={false}>{t('开始今日训练', 'Start today’s training')}</AppLink>}
      {board.assignment.status === 'closed' && <p>{t('任务已结束，保留历史记录。', 'This assignment is closed. Historical records remain available.')}</p>}
      <div className="sticky-scroll"><table className="sticky-thead"><thead><tr><th>{t('排名', 'Rank')}</th><th>{t('学员', 'Learner')}</th><th>{t('次数', 'Attempts')}</th><th>{t('完成情况', 'Completion')}</th><th>{t('训练分钟', 'Minutes')}</th><th>{t('成绩：最佳 / 均值', 'Results: best / mean')}</th></tr></thead><tbody>
        {board.rows.map(row => <tr key={row.studentId}><td>{row.rank ?? '—'}</td><td>{learner ? row.name : <AppLink href={`/org/${orgSlug}/training/assignments/${assignmentId}/students/${row.studentId}`} prefetch={false}>{row.name}</AppLink>}{row.studentId === board.selfId ? t('（我）', ' (me)') : ''}</td><td>{row.count}</td><td>{row.completed ? t('已完成', 'Completed') : row.count ? t('进行中', 'In progress') : t('未开始', 'Not started')}</td><td>{(row.durationMs / 60000).toFixed(1)}</td><td>{row.results.map(result => <div key={result.event}>{eventDisplayName(result.event, isZh)}: {result.bestMs === null ? '—' : `${(result.bestMs / 1000).toFixed(2)}s`} / {result.meanMs === null ? '—' : `${(result.meanMs / 1000).toFixed(2)}s`}</div>)}</td></tr>)}
      </tbody></table></div>
      {!board.rows.length && <p>{t('没有可显示的学员。', 'No learners to display.')}</p>}
      <div className="org-form-actions"><button type="button" disabled={page <= 1} onClick={() => void setPage(page - 1)}>{t('上一页', 'Previous')}</button><button type="button" disabled={page * board.pageSize >= board.total} onClick={() => void setPage(page + 1)}>{t('下一页', 'Next')}</button></div>
    </>}
  </section>;
}
