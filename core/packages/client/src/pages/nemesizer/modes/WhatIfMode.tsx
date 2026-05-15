import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import NemesizerPersonPicker from '../components/NemesizerPersonPicker';
import PersonCell from '../components/PersonCell';
import { NEMESIZER_EVENTS } from '@cuberoot/shared/nemesizer-format';
import {
  fetchPerson,
  fetchWhatIf,
  type PersonDetailResponse,
  type RelationView,
  type WhatIfResponse,
} from '../data/nemesizerApi';

interface Props { isZh: boolean; }

const DEBOUNCE_MS = 300;

export default function WhatIfMode({ isZh }: Props) {
  const [params, setParams] = useSearchParams();
  const person = (params.get('person') ?? '').toUpperCase();
  const view: RelationView = (params.get('view') as RelationView) || 'myNem';
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());

  const override = useMemo(() => {
    const m = new Map<number, number>();
    for (const [ek, v] of overrides) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n > 0) m.set(ek, n);
    }
    return m;
  }, [overrides]);

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  // Fetch the ref person (gives current ranks for the form).
  const [personData, setPersonData] = useState<PersonDetailResponse | null>(null);
  const [personErr, setPersonErr] = useState<string | null>(null);
  useEffect(() => {
    if (!person) { setPersonData(null); setPersonErr(null); return; }
    const ctl = new AbortController();
    fetchPerson(person, ctl.signal)
      .then(r => { if (!ctl.signal.aborted) { setPersonData(r); setPersonErr(null); } })
      .catch(e => { if (!ctl.signal.aborted) setPersonErr(e instanceof Error ? e.message : String(e)); });
    return () => ctl.abort();
  }, [person]);

  // Fetch what-if result. Debounced on overrides to avoid hammering server.
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const inflight = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!person) { setResult(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      inflight.current?.abort();
      const ctl = new AbortController();
      inflight.current = ctl;
      setResultLoading(true);
      fetchWhatIf(person, view, override, ctl.signal)
        .then(r => { if (!ctl.signal.aborted) { setResult(r); setResultLoading(false); } })
        .catch(e => {
          if (ctl.signal.aborted) return;
          setResultLoading(false);
          console.error('whatif fetch:', e);
        });
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [person, view, override]);

  if (!person) {
    return (
      <div>
        <h2 style={{ textAlign: 'center' }}>{isZh ? '假设…？' : 'What if…?'}</h2>
        <p className="nemesizer-results-summary">
          {isZh ? '假设你在某些项目上的排名不同，看看新的宿敌关系。' : 'Enter alternate ranks for one or more events to see the new you.'}
        </p>
        <NemesizerPersonPicker isZh={isZh} onPick={id => setParam('person', id)} />
      </div>
    );
  }

  if (personErr && personErr.startsWith('404')) {
    return (
      <div>
        <h2 style={{ textAlign: 'center' }}>{isZh ? '假设…？' : 'What if…?'}</h2>
        <NemesizerPersonPicker isZh={isZh} initialQuery={person} onPick={id => setParam('person', id)} />
      </div>
    );
  }

  if (!personData) {
    return <div className="nemesizer-loading">{isZh ? '加载中…' : 'Loading…'}</div>;
  }

  // Build lookup: ek → current rank.
  const rankByEk = new Map<number, number>();
  for (const r of personData.ranks) {
    const evIdx = NEMESIZER_EVENTS.indexOf(r.event as (typeof NEMESIZER_EVENTS)[number]);
    if (evIdx < 0) continue;
    rankByEk.set(evIdx * 2 + r.kind, r.rank);
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center' }}>{isZh ? '假设…？' : 'What if…?'}</h2>
      <div className="nemesizer-results-summary">
        <PersonCell person={{ wcaId: personData.wcaId, name: personData.name, countryIso2: personData.iso2, continentIdx: 0 }} isZh={isZh} />
        {' '}({personData.wcaId})
      </div>
      <NemesizerPersonPicker isZh={isZh} initialQuery={person} onPick={id => setParam('person', id)} autoConfirmExact={false} />
      <div className="nemesizer-view-group">
        {([
          ['myNem',      '显示我的宿敌',              'Show my nemeses'],
          ['iNem',       '显示谁把我视为宿敌',         'Show who I nemesize'],
          ['nearlyMe',   '显示差一步就成我宿敌的人',   'Show who nearly nemesizes me'],
          ['iNearly',    '显示差一步就把我视为宿敌的人', 'Show who I nearly nemesize'],
          ['onlyJustMe', '显示刚好成为我宿敌的人',     'Show who only just nemesizes me'],
          ['iOnlyJust',  '显示刚好把我视为宿敌的人',   'Show who I only just nemesize'],
        ] as const).map(([id, zh, en]) => (
          <label key={id}>
            <input type="radio" checked={view === id} onChange={() => setParam('view', id)} />
            {isZh ? zh : en}
          </label>
        ))}
      </div>
      <div className="nemesizer-whatif-grid">
        <div className="nemesizer-whatif-row is-header" style={{ fontWeight: 600 }}>
          <div>{isZh ? '项目' : 'Event'}</div>
          <div>{isZh ? '真实排名' : 'Real rank'}</div>
          <div>{isZh ? '假设排名' : 'What if rank'}</div>
        </div>
        {NEMESIZER_EVENTS.flatMap(ev => {
          const evIdx = NEMESIZER_EVENTS.indexOf(ev);
          return [0, 1].filter(k => !(ev === '333mbf' && k === 1)).map(kind => {
            const ek = evIdx * 2 + kind;
            const real = rankByEk.get(ek);
            return (
              <div className="nemesizer-whatif-row" key={`${ev}-${kind}`}>
                <div>{ev} {kind === 0 ? (isZh ? '单次' : 'single') : (isZh ? '平均' : 'average')}</div>
                <div>{real ?? '—'}</div>
                <div>
                  <input
                    type="number"
                    min="1"
                    value={overrides.get(ek) ?? ''}
                    onChange={e => {
                      const next = new Map(overrides);
                      if (e.target.value) next.set(ek, e.target.value); else next.delete(ek);
                      setOverrides(next);
                    }}
                  />
                </div>
              </div>
            );
          });
        })}
      </div>
      {result && (
        <>
          <div className="nemesizer-results-summary">
            {isZh
              ? `原 ${result.origCount}  →  假设后 ${result.newCount}`
              : `Original ${result.origCount}  →  After what-if ${result.newCount}`}
            {resultLoading && <span className="nemesizer-small-muted" style={{ marginLeft: 8 }}>{isZh ? '更新中…' : 'updating…'}</span>}
          </div>
          <div className="nemesizer-table-wrap">
            <table className="nemesizer-table">
              <thead><tr><th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th></tr></thead>
              <tbody>
                {[...result.persons]
                  .sort((a, b) => a.wcaId.localeCompare(b.wcaId))
                  .map(p => (
                    <tr key={p.wcaId}>
                      <td>{p.wcaId}</td>
                      <td><PersonCell person={{ wcaId: p.wcaId, name: p.name, countryIso2: p.iso2, continentIdx: 0 }} isZh={isZh} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!result && resultLoading && <div className="nemesizer-loading">{isZh ? '计算中…' : 'Computing…'}</div>}
    </div>
  );
}
