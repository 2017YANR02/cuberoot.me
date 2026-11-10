'use client';

import { Tooltip } from '@/components/Tooltip';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { readTimerReplay } from '@cuberoot/shared/timer/replay-client';
import type { Solve } from '@cuberoot/shared/timer';
import { apiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { recordingSolve, type ReconIntakeCase, type ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import { useWebReconstructHost } from '@/lib/use-web-reconstruct-host';
import { intakeRequest } from '@/lib/recon-intake-api';
import { tr, useLang } from '@/i18n/tr';
import SourceInfo from './SourceInfo';
import '@/components/recon/recon-intake.css';

const ReconstructReport = dynamic(() => import('@cuberoot/timer-ui/reconstruct-report'), { ssr: false });
const ReconIntakeEditor = dynamic(() => import('@/components/recon/ReconIntakeAction').then(module => module.ReconIntakeEditor), { ssr: false });

const statuses = {
  'pending-test': { zh: '待测试', en: 'Pending test' }, 'needs-fix': { zh: '待修正', en: 'Needs correction' },
  'needs-review': { zh: '待验收', en: 'Needs review' }, active: { zh: '已启用', en: 'Active' },
};
const runStatuses = {
  passed: { zh: '通过', en: 'Passed' }, failed: { zh: '失败', en: 'Failed' },
  interrupted: { zh: '已中断', en: 'Interrupted' },
};
const text = (snapshot: ReconSnapshot | null | undefined) => snapshot
  ? [snapshot.inspection + ' // inspection', ...snapshot.lines.map(line => `${line.moves.join(' ')} // ${line.label ?? ''} [${line.fromIdx + 1}–${line.toIdx + 1}]`)].join('\n') : '—';
type Detail = {
  item: ReconIntakeCase;
  runs: Array<{ payload: ReconIntakeCase['latestRun']; revision: number; created_at: string }>;
  revisions: Array<{ revision: number; input: ReconIntakeCase['input']; expected: ReconSnapshot | null; actor: string; created_at: string }>;
};


export default function RegressionCaseDetail({ intakeId, replaySource, onChange }: {
  intakeId?: string; replaySource: string; onChange: () => void;
}) {
  const isZh = useLang() === 'zh', host = useWebReconstructHost();
  const [reportOpen, setReportOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [solve, setSolve] = useState<Solve | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0), [copied, setCopied] = useState(false);
  const refresh = () => { setReload(v => v + 1); onChange(); };
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setDetail(null); setSolve(null);
    const request = intakeId
      ? intakeRequest<Detail>('/' + intakeId).then(value => { if (current) setDetail(value); })
      : readTimerReplay(replaySource, [], { apiUrl, fetcher: sessionFetch }).then(value => { if (current) setSolve(value); });
    void request.catch(e => { if (current) setError(String(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [intakeId, replaySource, reload]);
  const item = detail?.item;
  const approve = async () => {
    if (!item) return;
    setBusy(true); setError('');
    try {
      await intakeRequest(`/${item.id}/review`, { revision: item.revision, action: 'approve' });
      refresh();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const copyTask = async () => {
    try {
      await navigator.clipboard.writeText(tr({
        zh: `处理智能魔方复盘待办队列${item ? `，先处理 ${item.id}` : ''}。阅读 docs/recon-intake-workflow.md，使用 core/ 的 pnpm recon:intake 命令领取和续期任务，从原始记录复现问题，保留人工预期，修正规则并验证已有回归，回写结果。仅本地修改，不提交、不推送。`,
        en: `Process the smart cube reconstruction queue${item ? `, starting with ${item.id}` : ''}. Read docs/recon-intake-workflow.md. Use pnpm recon:intake in core/ to claim and renew tasks, reproduce from raw recordings, preserve human expectations, fix general rules, run existing regressions and report results. Local changes only; do not commit or push.`,
      }));
      setCopied(true);
    } catch (e) { setError(String(e)); }
  };

  return <div className="ri-case-detail">
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">{tr({ zh: '正在加载复盘详情…', en: 'Loading reconstruction…' })}</p>}
    {item ? <>
      <div className="ri-case-heading"><h2>{tr(statuses[item.status])} · v{item.revision}</h2>
        <span>{tr({ zh: '实录用时', en: 'Recorded time' })} {(item.input.recording.timeMs / 1000).toFixed(3)}s</span></div>
      <div className="gt-review-summary">
        <span data-result={item.latestRun?.status ?? 'not-run'}>{tr({ zh: '单样本测试', en: 'Individual test' })}：{item.latestRun ? tr(runStatuses[item.latestRun.status]) : tr({ zh: '未运行', en: 'Not run' })}</span>
        <InfoTooltip content={tr({ zh: '播放器按当前代码重建。单样本测试与所选全量回归可能来自不同版本，展开对照可查看时间和版本。', en: 'Playback uses current code. Individual and regression results may come from different versions; expand comparisons for timestamps and revisions.' })} />
      </div>
      <details><MoreToggle as="summary">{tr({ zh: '来源与收录信息', en: 'Source and collection' })}{item.sourceSnapshot && ' · #' + item.sourceSnapshot.id}</MoreToggle>
        <SourceInfo source={item.sourceSnapshot} />
        <p><small>{item.id} · {item.createdBy} · {item.createdAt}</small></p>
        {item.sourceSnapshot && <pre>{item.sourceSnapshot.scramble}{'\n'}{item.sourceSnapshot.solution}</pre>}
        {item.claimedBy && <p>{tr({ zh: 'AI 领取', en: 'AI claim' })}：{item.claimedBy} · {item.leaseUntil}</p>}
      </details>
      <details onToggle={event => setReportOpen(event.currentTarget.open)}><MoreToggle as="summary">{tr({ zh: '复盘播放与分析', en: 'Playback and analysis' })}</MoreToggle>
        {reportOpen && <ReconstructReport solve={recordingSolve(item.input.recording, item.id)} host={{ ...host, renderIntakeAction: undefined }} isZh={isZh} hideActions hideDate />}
      </details>
      {!!item.input.annotations.length && <details><MoreToggle as="summary">{tr({ zh: '问题批注', en: 'Annotations' })} · {item.input.annotations.length}</MoreToggle>
      {item.input.annotations.map(note => <div className="ri-note" key={note.id}>
        <strong>{note.range ? `${note.range.fromIdx + 1}–${note.range.toIdx + 1}` : tr({ zh: '整条复盘', en: 'Whole replay' })} · {note.problem}</strong>
        <pre>{note.observed}</pre><p>{note.expectedAlgorithm}</p><p>{note.expectedEffect}</p>
      </div>)}
      </details>}
      <details><MoreToggle as="summary">{tr({ zh: '单样本预期与输出', en: 'Individual expected and actual' })}</MoreToggle>
      <div className="ri-compare"><div><h3>{item.expected ? tr({ zh: '已确认的人工预期', en: 'Approved expectation' })
        : tr({ zh: '收录时快照（尚未确认正确）', en: 'Intake snapshot (not approved)' })}</h3><pre>{text(item.expected ?? item.input.observed)}</pre></div>
        <div><h3>{tr({ zh: '最近测试输出', en: 'Latest test output' })}</h3><pre>{text(item.latestRun?.actual)}</pre></div></div>
      <p>{tr({ zh: '最近测试', en: 'Latest test' })}：{item.latestRun ? `${tr(runStatuses[item.latestRun.status])} · v${item.latestRun.revision} · ${item.latestRun.createdAt}` : tr({ zh: '未运行', en: 'Not run' })}</p>
      {item.latestRun && <><pre>{item.latestRun.errors.join('\n')}</pre><small>{item.latestRun.commit} · {item.latestRun.fingerprint}</small></>}
      </details>
      <div className="ri-queue-controls">
        <Tooltip content={tr({ zh: '复制当前样例的 AI 排查指令', en: 'Copy AI troubleshooting instructions for this case' })}>{tip => <button {...tip} className="ri-button" type="button" onClick={() => void copyTask()}>{copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: 'AI 处理指令', en: 'AI instructions' })}</button>}</Tooltip>
        <button className="ri-button" type="button" disabled={busy} onClick={() => setEditing(true)}>{tr({ zh: '修改批注', en: 'Edit annotations' })}</button>
        {item.status === 'needs-review' && item.latestRun?.status === 'passed' && item.latestRun.revision === item.revision &&
          <button className="ri-button" type="button" disabled={busy} onClick={() => void approve()}>{tr({ zh: '确认预期并重测', en: 'Approve and retest' })}</button>}
      </div>
      <details><MoreToggle as="summary">{tr({ zh: '测试与修改历史', en: 'Test and revision history' })}</MoreToggle>
      <h3>{tr({ zh: '测试历史', en: 'Test history' })}</h3>
        {detail!.runs.map((run, i) => <div key={run.payload?.id ?? i}><p>v{run.revision} · {run.payload && tr(runStatuses[run.payload.status])} · {run.created_at}</p>
          <pre>{text(run.payload?.actual)}</pre><pre>{run.payload?.errors.join('\n')}</pre></div>)}
      <h3>{tr({ zh: '批注与预期版本', en: 'Annotation and expectation history' })}</h3>
        {detail!.revisions.map(revision => <div key={revision.revision}>
          <p>v{revision.revision} · {revision.actor} · {revision.created_at}</p>
          {revision.input.annotations.map(note => <div key={note.id}><p>{note.problem}</p><pre>{note.expectedAlgorithm}</pre><p>{note.expectedEffect}</p></div>)}
          <pre>{text(revision.expected ?? revision.input.observed)}</pre>
        </div>)}</details>
      {editing && createPortal(<ReconIntakeEditor solve={recordingSolve(item.input.recording, item.id)} host={host}
        mode="needs-fix" source={item.input.source} existing={item} onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); refresh(); }} />, document.body)}

    </> : !loading && !intakeId && <>
      {solve ? <details onToggle={event => setReportOpen(event.currentTarget.open)}><MoreToggle as="summary">{tr({ zh: '复盘播放与分析', en: 'Playback and analysis' })}</MoreToggle>
        {reportOpen && <ReconstructReport solve={solve} host={{ ...host, renderIntakeAction: undefined }} isZh={isZh} hideActions hideDate />}</details>
        : <p>{tr({ zh: '此样例的原始动作记录暂不可用。', en: 'The original recording is currently unavailable.' })}</p>}
    </>}
  </div>;
}
