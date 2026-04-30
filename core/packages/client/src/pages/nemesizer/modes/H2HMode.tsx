import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import type { NemesizerDataset } from '../data/nemesizerData';
import NemesizerPersonPicker from '../components/NemesizerPersonPicker';
import PersonCell from '../components/PersonCell';
import { NEMESIZER_EVENTS } from '../data/nemesizerData';
import { formatWcaResultK } from '../../../utils/wca_format_result';
import { eventDisplayName } from '../../../utils/wca_events';

interface Props { ds: NemesizerDataset; isZh: boolean; }

type Show = 'ranks' | 'results';

export default function H2HMode({ ds, isZh }: Props) {
  const [params, setParams] = useSearchParams();
  const p1 = params.get('p1') ?? '';
  const p2 = params.get('p2') ?? '';
  const show: Show = (params.get('show') as Show) || 'results';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const idx1 = p1 ? ds.wcaIdIndex.get(p1.toUpperCase()) : undefined;
  const idx2 = p2 ? ds.wcaIdIndex.get(p2.toUpperCase()) : undefined;

  if (idx1 === undefined) {
    return (
      <div>
        <h2 style={{ textAlign: 'center' }}>{isZh ? '正面对决' : 'Head to head!'}</h2>
        <NemesizerPersonPicker ds={ds} isZh={isZh} initialQuery={p1} onPick={id => setParam('p1', id)}
          placeholder={isZh ? '选手 1：WCA ID 或姓名' : 'Person 1: WCA ID or name'} />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ textAlign: 'center' }}>{isZh ? '正面对决' : 'Head to head!'}</h2>
      <div style={{ textAlign: 'center', margin: '10px' }}>
        <label style={{ marginRight: 18 }}>
          <input type="radio" checked={show === 'ranks'} onChange={() => setParam('show', 'ranks')} /> {isZh ? '排名' : 'Ranks'}
        </label>
        <label>
          <input type="radio" checked={show === 'results'} onChange={() => setParam('show', 'results')} /> {isZh ? '成绩' : 'Results'}
        </label>
      </div>
      <div className="nemesizer-results-summary">
        {isZh ? '选手 1' : 'Compare'}: <PersonCell person={ds.persons[idx1]} isZh={isZh} /> ({ds.persons[idx1].wcaId})
      </div>
      <NemesizerPersonPicker ds={ds} isZh={isZh} initialQuery={p2} onPick={id => setParam('p2', id)}
        placeholder={isZh ? '对手：WCA ID 或姓名' : 'With: WCA ID or name'} />
      {idx2 !== undefined && <Comparison ds={ds} isZh={isZh} p1={idx1} p2={idx2} show={show} />}
    </div>
  );
}

function Comparison({ ds, isZh, p1, p2, show }: { ds: NemesizerDataset; isZh: boolean; p1: number; p2: number; show: Show }) {
  const rowsByEv = useMemo(() => {
    const out: { ev: string; kind: number; r1?: number; b1?: number; r2?: number; b2?: number }[] = [];
    for (const ev of NEMESIZER_EVENTS) {
      const evIdx = NEMESIZER_EVENTS.indexOf(ev);
      for (const kind of [0, 1]) {
        if (ev === '333mbf' && kind === 1) continue;
        const ek = evIdx * 2 + kind;
        const r1 = ds.rankOfPerson[ek].get(p1);
        const r2 = ds.rankOfPerson[ek].get(p2);
        if (r1 === undefined && r2 === undefined) continue;
        const b1 = bestOf(ds, p1, evIdx, kind);
        const b2 = bestOf(ds, p2, evIdx, kind);
        out.push({ ev, kind, r1, b1, r2, b2 });
      }
    }
    return out;
  }, [ds, p1, p2]);
  const person1 = ds.persons[p1];
  const person2 = ds.persons[p2];
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead>
          <tr>
            <th>{isZh ? '项目' : 'Event'}</th>
            <th><PersonCell person={person1} isZh={isZh} /></th>
            <th><PersonCell person={person2} isZh={isZh} /></th>
          </tr>
        </thead>
        <tbody>
          {rowsByEv.map((r, i) => {
            const v1 = show === 'ranks' ? r.r1 : r.b1;
            const v2 = show === 'ranks' ? r.r2 : r.b2;
            const class1 = cellClass(v1, v2);
            const class2 = cellClass(v2, v1);
            const fmt = (v: number) => show === 'ranks' ? String(v) : formatWcaResultK(v, r.ev, r.kind as 0 | 1);
            return (
              <tr key={i}>
                <td>{labelEk(r.ev, r.kind, isZh)}</td>
                <td className={class1}>{v1 !== undefined ? fmt(v1) : ''}</td>
                <td className={class2}>{v2 !== undefined ? fmt(v2) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function bestOf(ds: NemesizerDataset, p: number, ev: number, kind: number): number | undefined {
  for (const r of ds.ranksByPerson[p]) {
    if (r.ev === ev && r.kind === kind) return r.best;
  }
  return undefined;
}

function cellClass(mine: number | undefined, other: number | undefined): string {
  if (mine === undefined) return 'nemesizer-h2h-cell-none';
  if (other === undefined) return 'nemesizer-h2h-cell-better';
  if (mine < other) return 'nemesizer-h2h-cell-better';
  if (mine > other) return 'nemesizer-h2h-cell-worse';
  return '';
}

function labelEk(ev: string, kind: number, isZh: boolean): string {
  const suffix = kind === 0 ? (isZh ? '单次' : 'single') : (isZh ? '平均' : 'average');
  return `${eventDisplayName(ev, isZh)} ${suffix}`;
}
