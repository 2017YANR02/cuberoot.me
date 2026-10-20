'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { recordingSolve, type ReconIntakeCase, type ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { useWebReconstructHost } from '@/lib/use-web-reconstruct-host';
import { intakeRequest } from '@/lib/recon-intake-api';
import WcaAuth from '@/components/WcaAuth';
import { tr } from '@/i18n/tr';
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

export default function IntakeQueue() {
  const admin = useIsAdmin(), user = useAuthUser(), host = useWebReconstructHost();
  const [filter, setFilter] = useState('todo'), [offset, setOffset] = useState(0);
  const [items, setItems] = useState<ReconIntakeCase[]>([]), [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0), [copied, setCopied] = useState(false);
  const refresh = useCallback(() => setReload(v => v + 1), []);
  useEffect(() => {
    if (!admin) return;
    let current = true;
    setBusy(true); setError('');
    intakeRequest<{ items: ReconIntakeCase[]; hasMore: boolean }>(`?status=${filter}&offset=${offset}`)
      .then(data => { if (current) {
        setItems(data.items); setHasMore(data.hasMore);
        setSelected(id => data.items.some(i => i.id === id) ? id : data.items[0]?.id ?? null);
      } }).catch(e => { if (current) setError(String(e)); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [admin, filter, offset, reload]);
  useEffect(() => {
    setDetail(null);
    if (!admin || !selected) return;
    let current = true;
    intakeRequest<Detail>(`/${selected}`).then(data => { if (current) setDetail(data); })
      .catch(e => { if (current) setError(String(e)); });
    return () => { current = false; };
  }, [admin, selected, reload]);
  if (!user || !admin) return <main className="ri-queue"><p>{tr({ zh: '请使用管理员账号查看待办队列。', en: 'Sign in as an administrator to view the queue.' })}</p><WcaAuth /></main>;
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
  return <main className="ri-queue">
    <h1>{tr({ zh: '复盘收录待办', en: 'Reconstruction intake queue' })}</h1>
    <p>{tr({ zh: '收录保存原始记录。人工确认、自动测试和正式启用分别记账。', en: 'Collected samples retain their original recordings. Human approval, test results and activation are tracked separately.' })}</p>
    <div className="ri-queue-controls">
      <label>{tr({ zh: '状态', en: 'Status' })} <select className="ri-field" value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}>
        <option value="todo">{tr({ zh: '全部待办', en: 'All pending' })}</option><option value="all">{tr({ zh: '全部样本', en: 'All samples' })}</option>
        {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
      </select></label>
      <button className="ri-button" type="button" disabled={busy} onClick={refresh}>{tr({ zh: '刷新', en: 'Refresh' })}</button>
      <button className="ri-button" type="button" onClick={() => void copyTask()}>{copied ? tr({ zh: '已复制 AI 处理指令', en: 'AI instructions copied' }) : tr({ zh: '复制 AI 处理指令', en: 'Copy AI instructions' })}</button>
      <button className="ri-button" type="button" disabled={!offset || busy} onClick={() => setOffset(v => Math.max(0, v - 50))}>{tr({ zh: '上一页', en: 'Previous' })}</button>
      <button className="ri-button" type="button" disabled={!hasMore || busy} onClick={() => setOffset(v => v + 50)}>{tr({ zh: '下一页', en: 'Next' })}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!busy && !items.length && !error && <p>{tr({ zh: '当前没有样本。可在智能魔方复盘顶部收录。', en: 'No samples here. Collect one from the top of a smart cube reconstruction.' })}</p>}
    <div className="ri-queue-grid"><nav className="ri-case-list">
      {items.map(sample => <button className="ri-button ri-case-button" key={sample.id} type="button" aria-pressed={selected === sample.id} onClick={() => { setSelected(sample.id); setCopied(false); }}>
        {tr(statuses[sample.status])} · {(sample.input.recording.timeMs / 1000).toFixed(3)}s<br /><small>{sample.id.slice(0, 8)} · v{sample.revision}</small>
      </button>)}
    </nav>{item && <section>
      <h2>{tr(statuses[item.status])} · v{item.revision}</h2>
      <p><small>{item.id} · {item.createdBy}</small></p>
      {item.claimedBy && <p>{tr({ zh: 'AI 领取记录（到期可重新领取）', en: 'AI claim (available again after expiry)' })}：{item.claimedBy} · {item.leaseUntil}</p>}
      <ReconstructReport solve={recordingSolve(item.input.recording, item.id)} host={{ ...host, renderIntakeAction: undefined }} isZh={tr({ zh: true, en: false })} hideActions hideDate />
      <p>{tr({ zh: '上方按当前代码重建；下面保留收录时的快照与测试输出。', en: 'The player uses the current code. Saved intake snapshots and test outputs are retained below.' })}</p>
      {item.input.annotations.map(note => <div className="ri-note" key={note.id}>
        <strong>{note.range ? `${note.range.fromIdx + 1}–${note.range.toIdx + 1}` : tr({ zh: '整条复盘', en: 'Whole replay' })} · {note.problem}</strong>
        <pre>{note.observed}</pre><p>{note.expectedAlgorithm}</p><p>{note.expectedEffect}</p>
      </div>)}
      <div className="ri-compare"><div><h3>{item.expected ? tr({ zh: '已确认的人工预期', en: 'Approved expectation' })
        : tr({ zh: '收录时快照（尚未确认正确）', en: 'Intake snapshot (not approved)' })}</h3><pre>{text(item.expected ?? item.input.observed)}</pre></div>
        <div><h3>{tr({ zh: '最近测试输出', en: 'Latest test output' })}</h3><pre>{text(item.latestRun?.actual)}</pre></div></div>
      <p>{tr({ zh: '最近测试', en: 'Latest test' })}：{item.latestRun ? `${tr(runStatuses[item.latestRun.status])} · v${item.latestRun.revision} · ${item.latestRun.createdAt}` : tr({ zh: '未运行', en: 'Not run' })}</p>
      {item.latestRun && <><pre>{item.latestRun.errors.join('\n')}</pre><small>{item.latestRun.commit} · {item.latestRun.fingerprint}</small></>}
      <div className="ri-queue-controls">
        <button className="ri-button" type="button" disabled={busy} onClick={() => setEditing(true)}>{tr({ zh: '补充／修改批注', en: 'Revise annotations' })}</button>
        {item.status === 'needs-review' && item.latestRun?.status === 'passed' && item.latestRun.revision === item.revision &&
          <button className="ri-button" type="button" disabled={busy} onClick={() => void approve()}>{tr({ zh: '确认此测试输出为预期，重新测试', en: 'Approve this output and queue retest' })}</button>}
      </div>
      <details><summary>{tr({ zh: '测试历史', en: 'Test history' })}</summary>
        {detail.runs.map((run, i) => <div key={run.payload?.id ?? i}><p>v{run.revision} · {run.payload && tr(runStatuses[run.payload.status])} · {run.created_at}</p>
          <pre>{text(run.payload?.actual)}</pre><pre>{run.payload?.errors.join('\n')}</pre></div>)}</details>
      <details><summary>{tr({ zh: '批注与预期版本', en: 'Annotation and expectation history' })}</summary>
        {detail.revisions.map(revision => <div key={revision.revision}>
          <p>v{revision.revision} · {revision.actor} · {revision.created_at}</p>
          {revision.input.annotations.map(note => <div key={note.id}><p>{note.problem}</p><pre>{note.expectedAlgorithm}</pre><p>{note.expectedEffect}</p></div>)}
          <pre>{text(revision.expected ?? revision.input.observed)}</pre>
        </div>)}</details>
      {editing && createPortal(<ReconIntakeEditor solve={recordingSolve(item.input.recording, item.id)} host={host}
        mode="needs-fix" source={item.input.source} existing={item} onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); refresh(); }} />, document.body)}
    </section>}</div>
  </main>;
}
