'use client';
import PageHeading from '@/components/PageHeading';
import MoreToggle from '@/components/MoreToggle';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import WcaAuth from '@/components/WcaAuth';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from '@/lib/api-base';
import { tr, useLang } from '@/i18n/tr';
import type { ReconTestCase, ReconTestHistory, ReconTestRow, ReconTestStatus } from '@/lib/recon-test-results';
import type { ReconIntakeCase } from '@cuberoot/shared/recon-ground-truth';
import { intakeRequest, resolveIntakeSource } from '@/lib/recon-intake-api';
import SourceInfo from './SourceInfo';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { SearchInput } from '@/components/SearchInput';
import { displayCuberName } from '@/lib/cuber-name-display';
import { ChevronLeft, ChevronRight } from '@app-foundation/icons/lucide';
import { useIsMobile } from '@/hooks/useIsMobile';

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
const title = (sample: ReconTestCase) => tr(TITLES[sample.id] ?? (sample.id.startsWith('intake-') ? { zh: '收录样本', en: 'Intake sample' } : { zh: sample.issue, en: sample.issue }));
const textRows = (rows: ReconTestRow[]) => rows.map(row => `${row.moves}${row.label ? '  ' + row.label : ''}${row.colors.length ? ' [' + row.colors.join(' / ') + ']' : ''}`).join('\n');
type History = ReconTestHistory & { cases?: ReconTestCase[]; hasMore?: boolean };
type IntakeSummary = Pick<ReconIntakeCase, 'id' | 'createdBy' | 'sourceSnapshot'>;
const intakeId = (id: string) => id.match(/^intake-([0-9a-f-]{36})-v\d+$/)?.[1];

export default function RegressionResults() {
  const isZh = useLang() === 'zh';
  const pageSize = useIsMobile(700) ? 3 : 6;
  const user = useAuthUser(); const admin = useIsAdmin();
  const [history, setHistory] = useState<History | null>(null);
  const [runId, setRunId] = useState(''); const [caseId, setCaseId] = useState('');
  const [offset, setOffset] = useState(0); const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [syncState, setSyncState] = useState<'pending' | 'done' | 'failed'>('pending');
  const [loading, setLoading] = useState(false);
  const [intakes, setIntakes] = useState<Record<string, IntakeSummary>>({});
  const [peopleLoading, setPeopleLoading] = useState(true), [peopleError, setPeopleError] = useState(false);
  const [metadataRefresh, setMetadataRefresh] = useState(0);
  const [query, setQuery] = useState(''), [personId, setPersonId] = useState(''), [collectorId, setCollectorId] = useState('');
  const [resultFilter, setResultFilter] = useState('all'), [casePage, setCasePage] = useState(1);
  useEffect(() => {
    if (!user || !admin) return;
    let active = true;
    setPeopleLoading(true); setPeopleError(false);
    void (async () => {
      const items: IntakeSummary[] = [];
      for (let start = 0; ; start += 50) {
        const page = await intakeRequest<{ items: IntakeSummary[]; hasMore: boolean }>(`?status=all&summary=1&offset=${start}`);
        if (!active) return;
        items.push(...page.items);
        if (!page.hasMore) break;
        if (start >= 100000) throw new Error('Intake list exceeds paging limit');
      }
      // Resolve only explicitly linked legacy sources, in small batches.
      const sources = new Map<number, ReconIntakeCase['sourceSnapshot']>();
      for (const item of items) if (item.sourceSnapshot) sources.set(item.sourceSnapshot.id, item.sourceSnapshot);
      const missing = [...sources.values()].filter(source => source && !source.metadata);
      for (let start = 0; start < missing.length && active; start += 5) {
        await Promise.all(missing.slice(start, start + 5).map(async source => {
          try { const resolved = await resolveIntakeSource(source); if (resolved) sources.set(resolved.id, resolved); } catch { /* Keep explicitly missing metadata. */ }
        }));
      }
      if (active) setIntakes(Object.fromEntries(items.map(item => [item.id, {
        ...item, sourceSnapshot: item.sourceSnapshot?.metadata ? item.sourceSnapshot : sources.get(item.sourceSnapshot?.id ?? 0) ?? item.sourceSnapshot,
      }])));
    })().catch(() => { if (active) setPeopleError(true); }).finally(() => { if (active) setPeopleLoading(false); });
    return () => { active = false; };
  }, [user, admin, metadataRefresh]);
  const attempted = useRef(new Set<string>()); const epoch = useRef(0); const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (!user || !admin || inFlight.current) return;
    inFlight.current = true;
    const current = ++epoch.current; setLoading(true); setError('');
    try {
      const local = await handleApi<History>(await sessionFetch(`/api/admin/recon-tests?offset=${offset}`, { headers: authHeaders(false), signal: AbortSignal.timeout(10000) }));
      if (epoch.current !== current) return;
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
    finally { if (epoch.current === current) { inFlight.current = false; setLoading(false); } }
  }, [user, admin, offset]);
  useEffect(() => {
    void load(); const timer = setInterval(() => { void load(); }, 15000);
    // Effect replay or a new page invalidates the old request and releases its
    // lock immediately. A stale request must not release the replacement's lock.
    return () => { clearInterval(timer); epoch.current++; inFlight.current = false; };
  }, [load]);
  const run = history?.runs.find(item => item.id === runId) ?? history?.runs[0];
  const catalog = history?.cases ?? [];
  const approvedCount = catalog.filter(sample => sample.approved === true).length;
  const sampleIntake = (sample: ReconTestCase) => intakes[intakeId(sample.id) ?? ''];
  const source = (sample: ReconTestCase) => sampleIntake(sample)?.sourceSnapshot;
  const names = new Map<string, string>();
  for (const item of Object.values(intakes)) {
    const m = item.sourceSnapshot?.metadata;
    for (const [id, name] of [[m?.personId, m?.person], [m?.collectorId, m?.collector], [m?.reconerId, m?.reconer]]) {
      if (id && name) names.set(id, displayCuberName(name, isZh));
    }
  }
  const personOptions = [...new Set(catalog.map(sample => source(sample)?.metadata?.personId).filter((id): id is string => !!id))];
  const collectorOptions = [...new Set(catalog.map(sample => sampleIntake(sample)?.createdBy).filter((id): id is string => !!id))];
  const matchesPerson = (filterId: string, id: string | null | undefined) => !filterId || (filterId === 'unknown' ? !id : id === filterId);
  const cases = catalog.filter(sample => {
    const m = source(sample)?.metadata;
    const creator = sampleIntake(sample)?.createdBy;
    return (filter === 'all' || (sample.approved === true ? 'approved' : 'pending') === filter)
      && matchesPerson(personId, m?.personId) && matchesPerson(collectorId, creator)
      && (resultFilter === 'all' || (run?.cases.find(item => item.id === sample.id)?.status ?? 'not-run') === resultFilter)
      && `${title(sample)} ${sample.id} ${m?.person ?? ''} ${m?.personId ?? ''} ${m?.collector ?? ''} ${creator ?? ''} ${m?.competition ?? ''} ${source(sample)?.id ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const totalPages = Math.max(1, Math.ceil(cases.length / pageSize));
  const page = Math.min(casePage, totalPages);
  const pageCases = cases.slice((page - 1) * pageSize, page * pageSize);
  const selected = pageCases.find(item => item.id === caseId) ?? pageCases[0];
  const selectedResult = run?.cases.find(item => item.id === selected?.id);
  const stale = !!run && !!history?.currentFingerprint && run.fingerprint !== history.currentFingerprint;
  const shortTitle = (sample: ReconTestCase) => {
    const m = source(sample)?.metadata;
    return m?.person ? `${m.value || '—'} · ${displayCuberName(m.person, isZh)}`
      : source(sample) ? `${tr({ zh: '来源', en: 'Source' })} #${source(sample)!.id}`
      : `${tr({ zh: '样例', en: 'Case' })} ${sample.id.startsWith('intake-') ? sample.id.slice(7, 15) : sample.id}`;
  };
  if (!user || !admin) return <main className="gt-page"><PageHeading backHref="/recon/ground-truth">{tr({ zh: '复盘测试', en: 'Reconstruction tests' })}</PageHeading><p>{tr({ zh: '请使用管理员账号查看检查记录。', en: 'Sign in as an administrator to view test history.' })}</p><WcaAuth /></main>;
  return <main className="gt-page gt-regression">
    <header className="gt-regression-header">
      <PageHeading backHref="/recon/ground-truth">{tr({ zh: '智能魔方回归测试', en: 'Smart cube regression tests' })}</PageHeading>
      <InfoTooltip iconSize={17} ariaLabel={tr({ zh: '回归测试说明', en: 'About regression tests' })}
        content={tr({ zh: '只有人工确认并启用的样例参加正式回归。通过表示程序与已保存预期一致，不替代人工验收。\n选手来自关联的原复盘；收录人是提交智能魔方样本的管理员。未记录身份的旧样例仍可按“未记录”筛选。', en: 'Only manually approved, active cases enter regression. A pass matches the saved expectation; it does not replace human review.\nSolver comes from the linked source. Collector is the administrator who submitted the smart-cube sample. Older cases without identities remain available under Not recorded.' })} />
      <button className="gt-refresh" type="button" disabled={loading} onClick={() => { attempted.current.clear(); setMetadataRefresh(value => value + 1); void load(); }}>{tr({ zh: '刷新', en: 'Refresh' })}</button>
    </header>
    <div className="gt-regression-summary">
      {history && <span>{tr({ zh: '启用 ' + approvedCount + ' · 待确认 ' + (catalog.length - approvedCount), en: approvedCount + ' active · ' + (catalog.length - approvedCount) + ' pending' })}</span>}
      {run && <strong data-result={run.status}>{tr(STATUS[run.status])}</strong>}
      {stale && <span className="gt-stale">{tr({ zh: '代码已变更', en: 'Code changed' })}<InfoTooltip iconSize={14} content={tr({ zh: '所选运行发生在代码修改之前，不能代表当前代码。', en: 'The selected run predates code changes and does not verify the current code.' })} /></span>}
      {history && approvedCount === 0 && <span className="gt-stale">{tr({ zh: '暂无启用样例', en: 'No active cases' })}</span>}
      {history?.scope === 'local' && syncState === 'failed' && <span className="gt-stale">{tr({ zh: '同步待重试', en: 'Sync pending' })}</span>}
    </div>
    {error && <p className="gt-error" role="alert">{error}</p>}
    <details className="gt-run-disclosure">
      <MoreToggle as="summary">{tr({ zh: '运行记录', en: 'Run history' })}{run && ' · ' + new Date(run.startedAt).toLocaleString()}</MoreToggle>
      <div className="gt-filters">
        <label className="gt-filter-label"><span>{tr({ zh: '检查历史', en: 'Check history' })}</span>
          <select className="gt-filter-select" value={run?.id ?? ''} onChange={e => { setRunId(e.target.value); setCasePage(1); }}>
            {!history?.runs.length && <option value="">{tr(!history && !error ? { zh: '加载中…', en: 'Loading…' } : { zh: '还没有检查记录', en: 'No checks recorded yet' })}</option>}
            {history?.runs.map(item => <option key={item.id} value={item.id}>{new Date(item.startedAt).toLocaleString()} · {tr(STATUS[item.status])}</option>)}
          </select>
        </label>
        <button className="gt-refresh" type="button" disabled={!offset || loading} onClick={() => { setOffset(Math.max(0, offset - 20)); setRunId(''); }}>{tr({ zh: '较新记录', en: 'Newer' })}</button>
        <button className="gt-refresh" type="button" disabled={loading || history?.hasMore === false || !history?.runs.length || history.runs.length < 20} onClick={() => { setOffset(offset + 20); setRunId(''); }}>{tr({ zh: '更早记录', en: 'Older' })}</button>
      </div>
      {run && <div className="gt-run-summary">
        <span>{tr({ zh: '程序检查：通过 ' + run.passed + ' · 失败 ' + run.failed + ' · 跳过 ' + (run.skipped ?? 0), en: 'Program checks: ' + run.passed + ' passed · ' + run.failed + ' failed · ' + (run.skipped ?? 0) + ' skipped' })}</span>
        <small>{run.commit.slice(0, 10) || '—'}{run.dirty && tr({ zh: ' + 本地修改', en: ' + local changes' })} · {run.fingerprint.slice(0, 12)}</small>
        {!!run.errors.length && <pre className="gt-run-errors">{run.errors.join('\n\n')}</pre>}
      </div>}
      {history?.scope === 'local' && <p className="gt-run-note">{tr(syncState === 'done' ? { zh: '本机记录已同步', en: 'Local records synchronized' } : syncState === 'failed' ? { zh: '本机记录已保存，刷新重试同步。', en: 'Saved locally. Refresh to retry sync.' } : { zh: '正在同步本机记录…', en: 'Synchronizing local records…' })}</p>}
    </details>
    <div className="gt-regression-filters">
      <SearchInput value={query} onChange={value => { setQuery(value); setCasePage(1); }} aria-label={tr({ zh: '搜索样例', en: 'Search cases' })} placeholder={tr({ zh: '姓名、编号或问题', en: 'Name, ID or issue' })} />
      {[
        { label: tr({ zh: '选手', en: 'Solver' }), value: personId, set: setPersonId, options: personOptions },
        { label: tr({ zh: '收录人', en: 'Collector' }), value: collectorId, set: setCollectorId, options: collectorOptions },
      ].map(field => <label className="gt-filter-label" key={field.label}><span>{field.label}</span>
        <select className="gt-filter-select" disabled={peopleLoading || peopleError} value={field.value} onChange={e => { field.set(e.target.value); setCasePage(1); }}>
          <option value="">{tr({ zh: '全部', en: 'All' })}</option>
          {field.options.sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b)).map(id => <option key={id} value={id}>{names.get(id) ?? id}</option>)}
          <option value="unknown">{tr({ zh: '未记录', en: 'Not recorded' })}</option>
        </select></label>)}
      <label className="gt-filter-label"><span>{tr({ zh: '样例状态', en: 'Case status' })}</span><select className="gt-filter-select" value={filter} onChange={e => { setFilter(e.target.value); setCasePage(1); }}>
        <option value="all">{tr({ zh: '全部', en: 'All' })}</option><option value="approved">{tr({ zh: '启用', en: 'Active' })}</option><option value="pending">{tr({ zh: '待确认', en: 'Pending' })}</option>
      </select></label>
      <label className="gt-filter-label"><span>{tr({ zh: '检查结果', en: 'Test result' })}</span><select className="gt-filter-select" value={resultFilter} onChange={e => { setResultFilter(e.target.value); setCasePage(1); }}>
        <option value="all">{tr({ zh: '全部', en: 'All' })}</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
      </select></label>
    </div>
    {peopleError && <p role="alert" className="gt-error">{tr({ zh: '人物筛选加载失败，请刷新重试。', en: 'Person filters could not load. Refresh to retry.' })}</p>}
    <div className="gt-workbench">
      <section className="gt-candidates" aria-label={tr({ zh: '智能魔方样例', en: 'Smart cube cases' })}>
        <div className="gt-section-head">{tr({ zh: '样例', en: 'Cases' })}<span>{cases.length}</span></div>
        {pageCases.map(sample => <button type="button" key={sample.id} className={'gt-candidate' + (selected?.id === sample.id ? ' is-selected' : '')} aria-pressed={selected?.id === sample.id} onClick={() => setCaseId(sample.id)}>
          <span className="gt-candidate-main"><strong>{shortTitle(sample)}</strong><span data-result={run?.cases.find(item => item.id === sample.id)?.status ?? 'not-run'}>{tr(STATUS[run?.cases.find(item => item.id === sample.id)?.status ?? 'not-run'])}</span></span>
          <span className="gt-candidate-sub">{tr(sample.approved ? { zh: '启用', en: 'Active' } : { zh: '待确认', en: 'Pending' })} · {title(sample)}</span>
        </button>)}
        <nav className="gt-pages" aria-label={tr({ zh: '样例分页', en: 'Case pages' })}>
          <button className="gt-page-button" type="button" disabled={page <= 1} aria-label={tr({ zh: '上一页样例', en: 'Previous cases' })} onClick={() => setCasePage(page - 1)}><ChevronLeft size={16} /></button>
          <span>{page} / {totalPages}</span>
          <button className="gt-page-button" type="button" disabled={page >= totalPages} aria-label={tr({ zh: '下一页样例', en: 'Next cases' })} onClick={() => setCasePage(page + 1)}><ChevronRight size={16} /></button>
        </nav>
      </section>
      <section className="gt-detail" aria-label={tr({ zh: '样例结果', en: 'Case result' })}>
        {selected ? <div key={selected.id}>
          <div className="gt-detail-head"><h2>{shortTitle(selected)}</h2>
            {(!selected.id.startsWith('intake-') || /^https?:\/\//.test(selected.source) || selected.source.startsWith('/')) && <Link className="gt-source-link" href={selected.source || '/timer?share=' + encodeURIComponent(selected.id)} prefetch={false} target="_blank">{tr({ zh: '打开复盘', en: 'Open replay' })}</Link>}
          </div>
          <div className="gt-case-status"><strong data-result={selectedResult?.status ?? 'not-run'}>{tr(STATUS[selectedResult?.status ?? 'not-run'])}</strong>
            {!selected.approved && <span className="gt-stale">{tr({ zh: '预期待确认', en: 'Expectation unconfirmed' })}<InfoTooltip iconSize={14} content={tr({ zh: '此样例不参加正式回归。旧的通过结果只表示与保存的答案一致，不代表答案已获确认。', en: 'This case is excluded from formal regression. An older pass only matched the saved answer and does not imply approval.' })} /></span>}
          </div>
          {!!selectedResult?.errors.length && <p className="gt-error">{tr({ zh: '存在检查错误', en: 'Check errors found' })}</p>}
          {source(selected) && <SourceInfo source={source(selected)} />}
          <details className="gt-case-disclosure"><MoreToggle as="summary">{tr({ zh: '样例说明', en: 'Case details' })}</MoreToggle>
            <p>{title(selected)}</p><small>{selected.id}</small>
            {sampleIntake(selected)?.createdBy && <p>{tr({ zh: '收录人', en: 'Collector' })}：{names.get(sampleIntake(selected)!.createdBy) ?? sampleIntake(selected)!.createdBy}</p>}
          </details>
          <details className="gt-case-disclosure"><MoreToggle as="summary">{tr({ zh: '预期与实际对照', en: 'Expected and actual' })}</MoreToggle>
            <div className="gt-text-compare"><div><h3>{tr({ zh: '预期', en: 'Expected' })}</h3><pre>{textRows(selectedResult?.expected ?? selected.expected)}</pre></div>
              <div><h3>{tr({ zh: '实际', en: 'Actual' })}</h3><pre>{selectedResult?.actual ? textRows(selectedResult.actual) : tr({ zh: '本次无输出', en: 'No output in this run' })}</pre></div></div>
          </details>
          {!!selectedResult?.errors.length && <details className="gt-case-disclosure"><MoreToggle as="summary">{tr({ zh: '错误详情', en: 'Error details' })}</MoreToggle><pre className="gt-run-errors">{selectedResult.errors.join('\n\n')}</pre></details>}
        </div> : !history ? (!error && <p role="status">{tr({ zh: '正在加载检查记录…', en: 'Loading check history…' })}</p>) : <p>{tr({ zh: '当前没有符合筛选条件的样例。', en: 'No cases match this filter.' })}</p>}
      </section>
    </div>
  </main>;
}
