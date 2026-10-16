'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import WcaAuth from '@/components/WcaAuth';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from '@/lib/api-base';
import { tr } from '@/i18n/tr';
import type { ReconTestCase, ReconTestHistory, ReconTestRow, ReconTestStatus } from '@/lib/recon-test-results';

const TITLES: Record<string, { zh: string; en: string }> = {
  '6wrK7I3TuMk': { zh: '转体不要提前到 R′ 之前', en: 'Keep the rotation after R-prime' },
  '7tpMkIMmGcQ': { zh: 'F2L 不出现 z，动作顺序保持正确', en: 'No F2L z; preserve move order' },
  'E1pU5e-WEho': { zh: '连续 F/U 动作换成侧面手法', en: 'Reframe front/up triggers to the side' },
  FL_vn97ZyzM: { zh: '拓展十字用颜色标记', en: 'Color chips for extended cross' },
  QmqeMxJEBzA: { zh: '中层转动后十字仍朝下', en: 'Cross down after slice turns' },
  aesvQSa2hcQ: { zh: '去掉复原后的多余转体', en: 'No rotations after solving' },
  e7zlMhlhjPg: { zh: 'COLL 点击打开准确公式', en: 'Exact COLL library link' },
  howVgKOze0g: { zh: 'PLL 末尾没有多余 x′', en: 'No extra x-prime after PLL' },
  ialkciVVKAU: { zh: '图示、颜色和废步括号一致', en: 'Consistent diagrams, colors and waste brackets' },
  jcc_J24wchw: { zh: '没重置朝向，十字也必须朝下', en: 'Cross down without an orientation reset' },
  'oPAYPI4Qe-I': { zh: '转体不堆叠，公式名称和写法正确', en: 'No rotation cascades; correct library notation' },
  pQp3frgq9f8: { zh: 'F2L 每步结束十字朝下', en: 'Cross down after every F2L stage' },
};
const STATUS: Record<ReconTestStatus, { zh: string; en: string }> = {
  passed: { zh: '通过', en: 'Passed' }, failed: { zh: '失败', en: 'Failed' },
  running: { zh: '检查中', en: 'Running' }, 'not-run': { zh: '未检查', en: 'Not checked' },
  interrupted: { zh: '未完成', en: 'Interrupted' },
};
const title = (sample: ReconTestCase) => tr(TITLES[sample.id] ?? { zh: sample.issue, en: sample.issue });
const textRows = (rows: ReconTestRow[]) => rows.map(row => `${row.moves}${row.label ? '  ' + row.label : ''}${row.colors.length ? ' [' + row.colors.join(' / ') + ']' : ''}`).join('\n');
type History = ReconTestHistory & { cases?: ReconTestCase[]; hasMore?: boolean };

export default function RegressionResults() {
  const user = useAuthUser(); const admin = useIsAdmin();
  const [history, setHistory] = useState<History | null>(null);
  const [runId, setRunId] = useState(''); const [caseId, setCaseId] = useState('');
  const [offset, setOffset] = useState(0); const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [syncState, setSyncState] = useState<'pending' | 'done' | 'failed'>('pending');
  const [loading, setLoading] = useState(false);
  const attempted = useRef(new Set<string>()); const epoch = useRef(0); const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (!user || !admin || inFlight.current) return;
    inFlight.current = true;
    const current = ++epoch.current; setLoading(true); setError('');
    try {
      const local = await handleApi<History>(await sessionFetch(`/api/admin/recon-tests?offset=${offset}`, { headers: authHeaders(false), signal: AbortSignal.timeout(10000) }));
      const data = local.scope === 'local' ? local : await handleApi<History>(await sessionFetch(apiUrl(`/v1/recon-ground-truth/runs?offset=${offset}`), { headers: authHeaders(false), signal: AbortSignal.timeout(10000) }));
      if (epoch.current !== current) return;
      // Current admission comes from the catalog/latest run, never the selected historical run.
      if (!data.cases) {
        const latest = offset === 0 ? data : await handleApi<History>(await sessionFetch(apiUrl('/v1/recon-ground-truth/runs?offset=0'), { headers: authHeaders(false), signal: AbortSignal.timeout(10000) }));
        data.cases = latest.runs[0]?.cases ?? [];
      }
      if (epoch.current !== current) return;
      setHistory(data);
      if (data.scope === 'local') {
        // Synchronize the entire backlog, independently of the viewed history page.
        let page = offset === 0 ? data : await handleApi<History>(await sessionFetch('/api/admin/recon-tests?offset=0', { headers: authHeaders(false), signal: AbortSignal.timeout(10000) }));
        let syncOffset = 0;
        setSyncState('pending');
        while (epoch.current === current) {
          for (const run of page.runs.filter(run => run.status !== 'running' && run.finishedAt && !attempted.current.has(run.id))) {
            try {
              await handleApi(await sessionFetch(apiUrl('/v1/recon-ground-truth/runs'), { method: 'POST', headers: authHeaders(), body: JSON.stringify(run), signal: AbortSignal.timeout(10000) }));
              attempted.current.add(run.id);
            } catch { if (epoch.current === current) setSyncState('failed'); return; }
          }
          if (!page.hasMore) break;
          syncOffset += 20;
          page = await handleApi<History>(await sessionFetch(`/api/admin/recon-tests?offset=${syncOffset}`, { headers: authHeaders(false), signal: AbortSignal.timeout(10000) }));
        }
        if (epoch.current === current) setSyncState('done');
      }
    } catch { if (epoch.current === current) setError(tr({ zh: '暂时无法读取检查记录，请重试。', en: 'Unable to load check history. Please retry.' })); }
    finally { inFlight.current = false; if (epoch.current === current) setLoading(false); }
  }, [user, admin, offset]);
  useEffect(() => {
    void load(); const timer = setInterval(() => { void load(); }, 15000);
    return () => { clearInterval(timer); epoch.current++; };
  }, [load]);
  const run = history?.runs.find(item => item.id === runId) ?? history?.runs[0];
  const catalog = history?.cases ?? [];
  const approvedCount = catalog.filter(sample => sample.approved === true).length;
  const cases = catalog.filter(sample => filter === 'all' || (sample.approved === true ? 'approved' : 'pending') === filter);
  const selected = cases.find(item => item.id === caseId) ?? cases[0];
  const selectedResult = run?.cases.find(item => item.id === selected?.id);
  const stale = !!run && !!history?.currentFingerprint && run.fingerprint !== history.currentFingerprint;
  if (!user || !admin) return <main className="gt-page"><h1>{tr({ zh: '复盘测试', en: 'Reconstruction tests' })}</h1><p>{tr({ zh: '请使用管理员账号查看检查记录。', en: 'Sign in as an administrator to view test history.' })}</p><WcaAuth /></main>;
  return <main className="gt-page">
    <header className="gt-header"><div className="gt-title-row"><div>
      <h1>{tr({ zh: '智能魔方回归测试', en: 'Smart cube regression tests' })}</h1>
      <p>{tr({ zh: '只有你明确说“收录到回归测试”的样例才正式启用。测试通过不会自动收录；原始记录和检查历史都会保留。', en: 'Only cases you explicitly ask to include in regression tests become active. Passing a check never enrolls a case. Original recordings and history are retained.' })}</p>
    </div><button className="gt-refresh" type="button" disabled={loading} onClick={() => { attempted.current.clear(); void load(); }}>{tr({ zh: '刷新', en: 'Refresh' })}</button></div>
    {history?.scope === 'local' && <p className="gt-run-note">{tr(syncState === 'done' ? { zh: '本机记录已同步，线上也可查看。', en: 'Local records synchronized and available online.' } : syncState === 'failed' ? { zh: '本机记录已保存，尚未同步到线上。服务上线或连接恢复后，刷新会重试。', en: 'Saved locally; cloud sync is pending. Refresh to retry when the service is available.' } : { zh: '正在读取本机检查记录。', en: 'Reading local check records.' })}</p>}
    </header>
    {error && <p className="gt-error" role="alert">{error}</p>}
    {history && <div className="gt-run-summary"><strong>{tr({ zh: `正式启用 ${approvedCount} 个，待确认 ${catalog.length - approvedCount} 个`, en: `${approvedCount} active, ${catalog.length - approvedCount} awaiting confirmation` })}</strong>
      {approvedCount === 0 && <p className="gt-warning">{tr({ zh: '目前没有正式启用的智能魔方样例。自动检查仍会检查程序，但不代表这些复盘已经正确。', en: 'No smart cube cases are active. Automatic program checks continue, but do not confirm these reconstructions are correct.' })}</p>}
    </div>}
    <div className="gt-filters"><label className="gt-filter-label"><span>{tr({ zh: '检查历史', en: 'Check history' })}</span>
      <select className="gt-filter-select" value={run?.id ?? ''} onChange={e => setRunId(e.target.value)}>
        {!history?.runs.length && <option value="">{tr({ zh: '还没有检查记录', en: 'No checks recorded yet' })}</option>}
        {history?.runs.map(item => <option key={item.id} value={item.id}>{new Date(item.startedAt).toLocaleString()} · {tr(STATUS[item.status])}</option>)}
      </select></label>
      <button className="gt-refresh" disabled={!offset} onClick={() => { setOffset(Math.max(0, offset - 20)); setRunId(''); }}>{tr({ zh: '较新记录', en: 'Newer' })}</button>
      <button className="gt-refresh" disabled={history?.hasMore === false || !history?.runs.length || history.runs.length < 20} onClick={() => { setOffset(offset + 20); setRunId(''); }}>{tr({ zh: '更早记录', en: 'Older' })}</button>
      <label className="gt-filter-label"><span>{tr({ zh: '样例状态', en: 'Case status' })}</span><select className="gt-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">{tr({ zh: '全部', en: 'All' })}</option><option value="pending">{tr({ zh: '待确认', en: 'Awaiting confirmation' })}</option><option value="approved">{tr({ zh: '正式启用', en: 'Active' })}</option>
      </select></label>
    </div>
    {run && <div className="gt-run-summary"><strong>{tr({ zh: '历史运行结果', en: 'Historical run result' })}：{tr(STATUS[run.status])}</strong>
      <span>{tr({ zh: `程序检查：${run.passed} 项通过，${run.failed} 项失败，${run.skipped ?? 0} 项跳过`, en: `Program checks: ${run.passed} passed, ${run.failed} failed, ${run.skipped ?? 0} skipped` })}</span>
      <span>{tr({ zh: '代码版本', en: 'Revision' })}: {run.commit.slice(0, 10) || '—'}{run.dirty && tr({ zh: ' + 本地修改', en: ' + local changes' })} · {run.fingerprint.slice(0, 12)}</span>
      {stale && <p className="gt-warning">{tr({ zh: '这次检查后代码又改过了；此结果不能代表当前代码。', en: 'Code changed after this run; this result does not verify the current code.' })}</p>}
      {!!run.errors.length && <details><summary>{tr({ zh: '查看本次检查错误', en: 'View run errors' })}</summary><pre className="gt-run-errors">{run.errors.join('\n\n')}</pre></details>}
    </div>}
    <div className="gt-workbench"><section className="gt-candidates" aria-label={tr({ zh: '智能魔方样例', en: 'Smart cube cases' })}>
      {cases.map(sample => <button type="button" key={sample.id} className={`gt-candidate${selected?.id === sample.id ? ' is-selected' : ''}`} aria-pressed={selected?.id === sample.id} onClick={() => setCaseId(sample.id)}>
        <span className="gt-candidate-main">{title(sample)}</span><span className="gt-candidate-sub"><span>{tr(sample.approved ? { zh: '正式启用', en: 'Active' } : { zh: '待确认 · 不参加正式检查', en: 'Awaiting confirmation · excluded' })}</span><span>{sample.id}</span></span>
      </button>)}
    </section><section className="gt-detail" aria-label={tr({ zh: '样例结果', en: 'Case result' })}>
      {selected ? <><div className="gt-detail-head"><div><h2>{title(selected)}</h2><p>{tr(selected.approved ? { zh: '正式启用', en: 'Active' } : { zh: '待确认 · 不参加正式检查', en: 'Awaiting confirmation · excluded' })}</p></div>
        <Link className="gt-source-link" href={`/timer?share=${encodeURIComponent(selected.id)}`} prefetch={false} target="_blank">{tr({ zh: '打开具体复盘', en: 'Open reconstruction' })}</Link></div>
        {!selected.approved && <p className="gt-warning">{tr({ zh: '下面保留的答案尚未确认。以前显示“通过”，只说明程序当时与这份答案一致，不代表答案正确。', en: 'The saved answer below is unconfirmed. An earlier pass only means the program matched that answer, not that the answer was correct.' })}</p>}
        <p>{tr({ zh: '所选历史记录', en: 'Selected historical run' })}：{tr(STATUS[selectedResult?.status ?? 'not-run'])}</p>
        {!!selectedResult?.errors.length && <pre className="gt-run-errors">{selectedResult.errors.join('\n\n')}</pre>}
        <div className="gt-text-compare"><div><h3>{tr(selected.approved ? { zh: '预期显示', en: 'Expected display' } : { zh: '保留的答案（待确认）', en: 'Saved answer (unconfirmed)' })}</h3><pre>{textRows(selected.expected)}</pre></div>
        <div><h3>{tr({ zh: '所选历史记录的实际显示', en: 'Actual display in the selected historical run' })}</h3><pre>{selectedResult?.actual ? textRows(selectedResult.actual) : tr({ zh: '本次没有生成显示结果。', en: 'No display output was produced in this run.' })}</pre></div></div>
      </> : <p>{tr({ zh: '当前没有符合筛选条件的样例。', en: 'No cases match this filter.' })}</p>}
    </section></div>
  </main>;
}
