'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Waypoints } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { ReconReferenceWindow } from '@/components/ReconReferenceWindow';
import { CompactSelect } from '@/components/CompactSelect';
import { Flag } from '@/components/Flag';
import { loadFlagData, personFlagIso2 } from '@/lib/country-flags';
import { displayCuberName } from '@/lib/cuber-name-display';
import { CompCell } from '@/components/CompCell/CompCell';
import { Tooltip } from '@/components/Tooltip';
import { intakeRequest } from '@/lib/recon-intake-api';
import { tr, useLang } from '@/i18n/tr';
import { buildNormalizedSolution, hasNormalizableCrossMove } from '@/lib/recon-norm-cross-extract';
import './recon-test-picker.css';

export interface ReconTestSource {
  id: number; scramble: string; solution: string; competition: string | null;
  competitionId?: string | null; country?: string | null;
  date: string | null; value: string | null; intakeId: string | null;
  intakeStatus: 'pending-test' | 'needs-fix' | 'needs-review' | 'active' | null;
  truthStatus: 'confirmed' | 'discussion' | 'rejected' | null;
  sourceChanged: boolean;
  sourceHash: string;
}
const statusLabel: Record<NonNullable<ReconTestSource['intakeStatus']>, { zh: string; en: string }> = {
  'pending-test': { zh: '待测试', en: 'Awaiting test' },
  'needs-fix': { zh: '待修复', en: 'Needs correction' },
  'needs-review': { zh: '待验收', en: 'Needs review' },
  active: { zh: '已启用', en: 'Active' },
};
interface SourceChoice { id: string; name: string }

export default function ReconTestPicker({ canSelect, onSelect }: {
  canSelect: boolean; onSelect: (source: ReconTestSource) => boolean;
}) {
  const isZh = useLang() === 'zh';
  const [open, setOpen] = useState(false);
  const [, setFlagsLoaded] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadFlagData().then(() => { if (active) setFlagsLoaded(true); });
    return () => { active = false; };
  }, [open]);
  const [filter, setFilter] = useState<'pending' | 'collected'>('pending');
  const [personId, setPersonId] = useState('2023GENG02');
  const [collectorId, setCollectorId] = useState('2017YANR02');
  const [choices, setChoices] = useState<{ persons: SourceChoice[]; collectors: SourceChoice[] }>({ persons: [], collectors: [] });
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<ReconTestSource[]>([]);
  const [selected, setSelected] = useState<ReconTestSource | null>(null);
  const [reference, setReference] = useState<ReconTestSource | null>(null);
  const useSource = (source: ReconTestSource) => {
    if (!onSelect(source)) return false;
    setReference(source);
    return true;
  };
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const requestScope = `${open}:${filter}:${offset}:${personId}:${collectorId}:${refresh}`;
  const scopeRef = useRef(requestScope);
  scopeRef.current = requestScope;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  const sourceQuery = useCallback((status: string, page: number) => `/sources?${new URLSearchParams({ v: '2', status, offset: String(page), personId, collectorId })}`, [personId, collectorId]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void intakeRequest<typeof choices>('/sources/filters').then(result => { if (active) setChoices(result); })
      .catch(() => { if (active) setError(tr({ zh: '无法加载筛选项，请重试。', en: 'Could not load filters. Try again.' })); });
    return () => { active = false; };
  }, [open, refresh]);
  useEffect(() => {
    window.addEventListener('recon-intake:changed', reload);
    return () => window.removeEventListener('recon-intake:changed', reload);
  }, [reload]);
  useEffect(() => {
    if (!open) return;
    ++requestVersion.current;
    let active = true;
    setLoading(true); setError('');
    void intakeRequest<{ items: ReconTestSource[]; hasMore: boolean }>(sourceQuery(filter, offset))
      .then(result => { if (active) { setItems(result.items); setHasMore(result.hasMore); } })
      .catch(() => { if (active) { setItems([]); setError(tr({ zh: '无法加载复盘，请重试。', en: 'Could not load reconstructions. Try again.' })); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; ++requestVersion.current; };
  }, [open, filter, offset, refresh, sourceQuery]);
  const nextPending = async () => {
    const version = ++requestVersion.current;
    const scope = requestScope;
    const isCurrent = () => mounted.current && requestVersion.current === version && scopeRef.current === scope;
    setLoading(true); setError('');
    try {
      const result = await intakeRequest<{ items: ReconTestSource[]; hasMore: boolean }>(sourceQuery('pending', 0));
      if (!isCurrent()) return;
      const next = result.items.find(item => item.id !== selected?.id);
      if (!next) { setError(tr({ zh: '没有其他未收录复盘。', en: 'No other uncollected reconstruction.' })); return; }
      setFilter('pending'); setOffset(0); setItems(result.items); setHasMore(result.hasMore);
      setSelected(next);
      if (!useSource(next)) setError(tr({ zh: '当前无法切换打乱，请检查设备和计时状态。', en: 'Cannot change the scramble now. Check the device and timer.' }));
    } catch { if (isCurrent()) setError(tr({ zh: '无法加载复盘，请重试。', en: 'Could not load reconstructions. Try again.' })); }
    finally { if (isCurrent()) setLoading(false); }
  };
  return <div className="recon-test" data-no-timer>
    <Tooltip content={tr({ zh: '复盘测试', en: 'Recon testing' })}>{tip =>
      <button {...tip} type="button" className="tb-btn recon-test-trigger" aria-label={tr({ zh: '复盘测试', en: 'Recon testing' })}
        aria-expanded={open} onClick={() => setOpen(value => !value)}><Waypoints size={18} aria-hidden="true" /></button>}
    </Tooltip>
    {reference && createPortal(<ReconReferenceWindow source={reference} onClose={() => setReference(null)} />,
      document.fullscreenElement ?? document.body)}
    {open && <section className="recon-test-panel" aria-label={tr({ zh: '复盘测试', en: 'Recon testing' })} data-site-surface="panel">
      <div className="recon-test-heading"><strong>{tr({ zh: '三阶复盘', en: '3×3 reconstructions' })}</strong>
        <button type="button" className="recon-test-control" onClick={() => setOpen(false)}>{tr({ zh: '收起', en: 'Close' })}</button></div>
      <div className="recon-test-people">
        {([
          { label: tr({ zh: '选手', en: 'Solver' }), value: personId, set: setPersonId, options: choices.persons,
            fallback: { id: '2023GENG02', name: 'Xuanyi Geng (耿暄一)' } },
          { label: tr({ zh: '收录者', en: 'Collector' }), value: collectorId, set: setCollectorId, options: choices.collectors,
            fallback: { id: '2017YANR02', name: 'Ruimin Yan (颜瑞民)' } },
        ]).map(field => {
          const options = field.options.some(choice => choice.id === field.fallback.id) ? field.options : [field.fallback, ...field.options];
          const items = [{ value: '', label: tr({ zh: '全部', en: 'All' }) }, ...options.map(choice => {
            const iso2 = personFlagIso2(choice.id);
            return { value: choice.id, label: <>{iso2 && <><Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" /> </>}{displayCuberName(choice.name, isZh)}</> };
          })];
          return <div key={field.label}><span>{field.label}</span><CompactSelect
            ariaLabel={field.label} label={items.find(item => item.value === field.value)?.label}
            items={items} value={field.value} disabled={loading} triggerClassName="recon-test-select"
            onChange={value => { field.set(value); setOffset(0); setSelected(null); }} /></div>;
        })}
      </div>
      <div className="recon-test-filters">{(['pending', 'collected'] as const).map(value => <button key={value} className="recon-test-control" type="button"
        aria-pressed={filter === value} onClick={() => { setFilter(value); setOffset(0); }}>
        {value === 'pending' ? tr({ zh: '未收录', en: 'Not collected' }) : tr({ zh: '已收录', en: 'Collected' })}</button>)}</div>
      {loading && <p role="status">{tr({ zh: '加载中…', en: 'Loading…' })}</p>}
      {error && <p role="alert">{error} <button type="button" className="recon-test-control" onClick={reload}>{tr({ zh: '重试', en: 'Retry' })}</button></p>}
      {!loading && !error && items.length === 0 && <p>{tr({ zh: '没有符合条件的复盘。', en: 'No reconstructions found.' })}</p>}
      {!loading && <div className="recon-test-list">{items.map(item => <button key={item.id} type="button"
        className="recon-test-item" aria-pressed={selected?.id === item.id} onClick={() => setSelected(item)}>
        <span>#{item.id} · {item.value || '—'} · {item.competition || item.competitionId
          ? <CompCell compId={item.competitionId ?? ''} compName={item.competition} country={item.country} isZh={isZh} date={null} />
          : item.date || '—'}</span>
        <small>{item.intakeStatus ? tr(statusLabel[item.intakeStatus]) : item.truthStatus === 'confirmed' && !item.sourceChanged
          ? tr({ zh: '已纳入', en: 'Included' }) : tr({ zh: '未收录', en: 'Not collected' })}{item.sourceChanged ? ` · ${tr({ zh: '来源已变化', en: 'Source changed' })}` : ''}</small>
      </button>)}</div>}
      <div className="recon-test-pages"><button className="recon-test-control" type="button" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - 50))}>{tr({ zh: '上一页', en: 'Previous' })}</button>
        <button className="recon-test-control" type="button" disabled={!hasMore || loading} onClick={() => setOffset(value => value + 50)}>{tr({ zh: '下一页', en: 'Next' })}</button></div>
      {selected && <div className="recon-test-selected"><div className="recon-test-heading"><strong>#{selected.id}</strong>
        <AppLink href={`/recon/${selected.id}`} target="_blank" rel="noopener noreferrer" prefetch={false}
          aria-label={tr({ zh: '打开复盘', en: 'Open reconstruction' })} title={tr({ zh: '打开复盘', en: 'Open reconstruction' })}>
          <ExternalLink size={18} aria-hidden="true" /></AppLink></div>
        <ReconReferenceContent source={selected} />
        <button type="button" className="recon-test-use" disabled={!canSelect} onClick={() => {
          if (!useSource(selected)) setError(tr({ zh: '当前无法切换打乱，请检查设备和计时状态。', en: 'Cannot change the scramble now. Check the device and timer.' }));
        }}>
          {tr({ zh: '使用此打乱', en: 'Use scramble' })}</button>
        <button type="button" className="recon-test-use" disabled={!canSelect || loading} onClick={() => void nextPending()}>
          {tr({ zh: '下一条未收录', en: 'Next uncollected' })}</button>
        {!canSelect && <small>{tr({ zh: '请连接智能魔方并结束当前计时。', en: 'Connect a smart cube and finish the current attempt.' })}</small>}
      </div>}
    </section>}
  </div>;
}

function ReconReferenceContent({ source }: { source: ReconTestSource }) {
  const solution = useMemo(() => hasNormalizableCrossMove(source.solution)
    ? buildNormalizedSolution(source.solution) ?? source.solution : source.solution, [source.solution]);
  return <><p>{source.scramble}</p><pre>{solution}</pre></>;
}
