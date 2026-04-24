import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import type { NemesizerDataset } from '../data/nemesizerData';
import PersonSearch from '../components/PersonSearch';
import PersonCell from '../components/PersonCell';
import { NEMESIZER_EVENTS } from '../data/nemesizerData';
import { displayCuberName } from '../../../utils/name_utils';

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
        <PersonSearch ds={ds} isZh={isZh} initialQuery={p1} onPick={id => setParam('p1', id)} autoPickSingle
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
        {isZh ? '选手 1' : 'Compare'}: <b>{displayCuberName(ds.persons[idx1].name, isZh)}</b> ({ds.persons[idx1].wcaId})
      </div>
      <PersonSearch ds={ds} isZh={isZh} initialQuery={p2} onPick={id => setParam('p2', id)} autoPickSingle
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
            const class1 = cellClass(v1, v2, show);
            const class2 = cellClass(v2, v1, show);
            return (
              <tr key={i}>
                <td>{labelEk(r.ev, r.kind, isZh)}</td>
                <td className={class1}>{v1 !== undefined ? formatValue(v1, r.ev, show) : ''}</td>
                <td className={class2}>{v2 !== undefined ? formatValue(v2, r.ev, show) : ''}</td>
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

function cellClass(mine: number | undefined, other: number | undefined, _show: Show): string {
  if (mine === undefined) return 'nemesizer-h2h-cell-none';
  if (other === undefined) return 'nemesizer-h2h-cell-better';
  if (mine < other) return 'nemesizer-h2h-cell-better';
  if (mine > other) return 'nemesizer-h2h-cell-worse';
  return '';
}

function labelEk(ev: string, kind: number, isZh: boolean): string {
  const evName = eventLabel(ev, isZh);
  const suffix = kind === 0 ? (isZh ? '单次' : 'single') : (isZh ? '平均' : 'average');
  return `${evName} ${suffix}`;
}

const EVENT_LABEL_EN: Record<string, string> = {
  '333': '3x3', '222': '2x2', '444': '4x4', '555': '5x5', '666': '6x6', '777': '7x7',
  '333bf': '3BLD', '333fm': 'FMC', '333oh': 'One handed',
  'minx': 'Megaminx', 'pyram': 'Pyraminx', 'clock': 'Clock',
  'skewb': 'Skewb', 'sq1': 'Square-1',
  '444bf': '4BLD', '555bf': '5BLD', '333mbf': 'Multi-Blind',
};
const EVENT_LABEL_ZH: Record<string, string> = {
  '333': '三阶', '222': '二阶', '444': '四阶', '555': '五阶', '666': '六阶', '777': '七阶',
  '333bf': '三盲', '333fm': 'FMC', '333oh': '单手',
  'minx': '五魔方', 'pyram': '金字塔', 'clock': '魔表',
  'skewb': 'Skewb', 'sq1': 'SQ1',
  '444bf': '四盲', '555bf': '五盲', '333mbf': '多盲',
};

export function eventLabel(ev: string, isZh: boolean): string {
  return (isZh ? EVENT_LABEL_ZH[ev] : EVENT_LABEL_EN[ev]) ?? ev;
}

export function formatValue(v: number, ev: string, show: Show): string {
  if (show === 'ranks') return String(v);
  if (ev === '333fm') {
    // FMC: single is move count; average is moves*100 (WCA stores as best*100)
    return (v / 100).toFixed(2).replace(/\.00$/, '');
  }
  if (ev === '333mbf') {
    // encoded DDDTTTTTMM where DD = 99 - (solved - unsolved), TTTTT = seconds, MM = missed
    // Show as "solved/attempted m:ss"
    const missed = v % 100;
    const timeSec = Math.floor(v / 100) % 100000;
    const diff = 99 - Math.floor(v / 10000000);
    const solved = diff + missed;
    const attempted = solved + missed;
    const min = Math.floor(timeSec / 60);
    const sec = timeSec % 60;
    return `${solved}/${attempted} ${min}:${String(sec).padStart(2, '0')}`;
  }
  // centiseconds
  const totalCs = v;
  if (totalCs < 100 * 60) {
    return (totalCs / 100).toFixed(2);
  }
  const min = Math.floor(totalCs / 6000);
  const rest = totalCs % 6000;
  return `${min}:${String(Math.floor(rest / 100)).padStart(2, '0')}.${String(rest % 100).padStart(2, '0')}`;
}
