import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NemesizerDataset } from '../data/nemesizerData';
import NemesizerPersonPicker from '../components/NemesizerPersonPicker';
import PersonCell from '../components/PersonCell';
import { NEMESIZER_EVENTS } from '../data/nemesizerData';
import { applyRelation, type RelationView } from '../data/nemesizerAlgo';

interface Props { ds: NemesizerDataset; isZh: boolean; }

export default function WhatIfMode({ ds, isZh }: Props) {
  const [params, setParams] = useSearchParams();
  const person = params.get('person') ?? '';
  const view: RelationView = (params.get('view') as RelationView) || 'myNem';
  const personIdx = person ? ds.wcaIdIndex.get(person.toUpperCase()) : undefined;

  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  if (personIdx === undefined) {
    return (
      <div>
        <h2 style={{ textAlign: 'center' }}>{isZh ? '假设…？' : 'What if…?'}</h2>
        <p className="nemesizer-results-summary">
          {isZh ? '假设你在某些项目上的排名不同，看看新的宿敌关系。' : 'Enter alternate ranks for one or more events to see the new you.'}
        </p>
        <NemesizerPersonPicker ds={ds} isZh={isZh} initialQuery={person} onPick={id => setParam('person', id)} />
      </div>
    );
  }

  const override = useMemo(() => {
    const m = new Map<number, number>();
    for (const [ek, v] of overrides) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n > 0) m.set(ek, n);
    }
    return m;
  }, [overrides]);

  const newResults = useMemo(() => applyRelation(ds, personIdx, view, override), [ds, personIdx, view, override]);
  const origResults = useMemo(() => applyRelation(ds, personIdx, view), [ds, personIdx, view]);

  const p = ds.persons[personIdx];

  return (
    <div>
      <h2 style={{ textAlign: 'center' }}>{isZh ? '假设…？' : 'What if…?'}</h2>
      <div className="nemesizer-results-summary">
        <PersonCell person={p} isZh={isZh} /> ({p.wcaId})
      </div>
      <NemesizerPersonPicker ds={ds} isZh={isZh} initialQuery={person} onPick={id => setParam('person', id)} autoConfirmExact={false} />
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
        <div className="nemesizer-whatif-row" style={{ fontWeight: 600, background: '#262626' }}>
          <div>{isZh ? '项目' : 'Event'}</div>
          <div>{isZh ? '真实排名' : 'Real rank'}</div>
          <div>{isZh ? '假设排名' : 'What if rank'}</div>
        </div>
        {NEMESIZER_EVENTS.flatMap(ev => {
          const evIdx = NEMESIZER_EVENTS.indexOf(ev);
          return [0, 1].filter(k => !(ev === '333mbf' && k === 1)).map(kind => {
            const ek = evIdx * 2 + kind;
            const real = ds.rankOfPerson[ek].get(personIdx);
            return (
              <div className="nemesizer-whatif-row" key={`${ev}-${kind}`}>
                <div>{ev} {kind === 0 ? (isZh ? '单次' : 'single') : (isZh ? '平均' : 'average')}</div>
                <div>{real ?? (isZh ? '—' : '—')}</div>
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
      <div className="nemesizer-results-summary">
        {isZh
          ? `原 ${origResults.length}  →  假设后 ${newResults.length}`
          : `Original ${origResults.length}  →  After what-if ${newResults.length}`}
      </div>
      <div className="nemesizer-table-wrap">
        <table className="nemesizer-table">
          <thead><tr><th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th></tr></thead>
          <tbody>
            {newResults.slice(0, 300).sort((a, b) => ds.persons[a.personIdx].wcaId.localeCompare(ds.persons[b.personIdx].wcaId)).map(r => {
              const pp = ds.persons[r.personIdx];
              return <tr key={pp.wcaId}><td>{pp.wcaId}</td><td><PersonCell person={pp} isZh={isZh} /></td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
