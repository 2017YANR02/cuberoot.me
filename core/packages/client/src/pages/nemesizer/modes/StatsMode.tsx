import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NemesizerDataset } from '../data/nemesizerData';
import PersonCell from '../components/PersonCell';

interface Props { ds: NemesizerDataset; isZh: boolean; }

type Tab = 'most' | 'few' | 'people' | 'biggest' | 'countries';

const TABS: { id: Tab; en: string; zh: string }[] = [
  { id: 'most', en: 'Most nemeses', zh: '最多宿敌' },
  { id: 'few', en: 'Fewest nemeses', zh: '最少宿敌' },
  { id: 'people', en: 'People', zh: '选手' },
  { id: 'biggest', en: 'Biggest nemesizers', zh: '被视为宿敌最多者' },
  { id: 'countries', en: 'Top countries', zh: '顶尖国家' },
];

export default function StatsMode({ ds, isZh }: Props) {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'most';

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  return (
    <div>
      <div className="nemesizer-stats-tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setParam('tab', t.id)}>
            {isZh ? t.zh : t.en}
          </button>
        ))}
      </div>
      <p className="nemesizer-small-muted" style={{ textAlign: 'center', marginTop: 0 }}>
        {isZh ? '（世界范围）' : '(world scope)'}
      </p>
      {tab === 'most' && <TopNemesesTable ds={ds} isZh={isZh} order="most" />}
      {tab === 'few' && <TopNemesesTable ds={ds} isZh={isZh} order="few" />}
      {tab === 'biggest' && <TopNemesizersTable ds={ds} isZh={isZh} />}
      {tab === 'people' && <PeopleTable ds={ds} isZh={isZh} />}
      {tab === 'countries' && <CountriesTable ds={ds} isZh={isZh} />}
    </div>
  );
}

function TopNemesesTable({ ds, isZh, order }: { ds: NemesizerDataset; isZh: boolean; order: 'most' | 'few' }) {
  const sorted = useMemo(() => {
    return Array.from({ length: ds.persons.length }, (_, i) => i)
      .filter(i => ds.ranksByPerson[i].length > 0)
      .sort((a, b) => (order === 'most' ? ds.counts.nemesisCount[b] - ds.counts.nemesisCount[a] : ds.counts.nemesisCount[a] - ds.counts.nemesisCount[b]))
      .slice(0, 500);
  }, [ds, order]);
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead>
          <tr>
            <th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th><th>{isZh ? '宿敌数' : 'Nemeses'}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(i => (
            <tr key={ds.persons[i].wcaId}>
              <td>{ds.persons[i].wcaId}</td>
              <td><PersonCell person={ds.persons[i]} isZh={isZh} /></td>
              <td>{ds.counts.nemesisCount[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopNemesizersTable({ ds, isZh }: { ds: NemesizerDataset; isZh: boolean }) {
  const sorted = useMemo(() => {
    return Array.from({ length: ds.persons.length }, (_, i) => i)
      .sort((a, b) => ds.counts.nemesizedCount[b] - ds.counts.nemesizedCount[a])
      .slice(0, 500);
  }, [ds]);
  return (
    <div>
      <p className="nemesizer-results-summary">
        {isZh ? '克最多人的选手是？' : 'Who nemesizes the most people?'}
      </p>
      <div className="nemesizer-table-wrap">
        <table className="nemesizer-table">
          <thead><tr><th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th><th>{isZh ? '被视为宿敌数' : 'Nemesized'}</th></tr></thead>
          <tbody>
            {sorted.map(i => (
              <tr key={ds.persons[i].wcaId}>
                <td>{ds.persons[i].wcaId}</td>
                <td><PersonCell person={ds.persons[i]} isZh={isZh} /></td>
                <td>{ds.counts.nemesizedCount[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeopleTable({ ds, isZh }: { ds: NemesizerDataset; isZh: boolean }) {
  const sorted = useMemo(() =>
    Array.from({ length: ds.persons.length }, (_, i) => i)
      .sort((a, b) => ds.persons[a].wcaId.localeCompare(ds.persons[b].wcaId))
      .slice(0, 500),
    [ds]);
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead><tr>
          <th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th>
          <th>{isZh ? '宿敌数' : 'Nemeses'}</th><th>{isZh ? '被视为宿敌数' : 'Nemesized'}</th>
        </tr></thead>
        <tbody>
          {sorted.map(i => (
            <tr key={ds.persons[i].wcaId}>
              <td>{ds.persons[i].wcaId}</td>
              <td><PersonCell person={ds.persons[i]} isZh={isZh} /></td>
              <td>{ds.counts.nemesisCount[i]}</td>
              <td>{ds.counts.nemesizedCount[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nemesizer-small-muted" style={{ textAlign: 'center', padding: 12 }}>
        {isZh ? '仅显示前 500 行（按 WCA ID 排序）。' : 'Showing first 500 (sorted by WCA ID).'}
      </p>
    </div>
  );
}

function CountriesTable({ ds, isZh }: { ds: NemesizerDataset; isZh: boolean }) {
  const tally = useMemo(() => {
    const t = new Map<string, { sumNemesis: number; sumNemesized: number; n: number }>();
    for (let i = 0; i < ds.persons.length; i++) {
      const iso = ds.persons[i].countryIso2;
      if (!iso) continue;
      const cur = t.get(iso) ?? { sumNemesis: 0, sumNemesized: 0, n: 0 };
      cur.sumNemesis += ds.counts.nemesisCount[i];
      cur.sumNemesized += ds.counts.nemesizedCount[i];
      cur.n += 1;
      t.set(iso, cur);
    }
    return Array.from(t.entries()).sort((a, b) => b[1].sumNemesized - a[1].sumNemesized);
  }, [ds]);
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead><tr>
          <th>{isZh ? '国家' : 'Country'}</th>
          <th>{isZh ? '选手数' : 'People'}</th>
          <th>{isZh ? '总宿敌数' : 'Total nemeses'}</th>
          <th>{isZh ? '总被视为宿敌数' : 'Total nemesized'}</th>
        </tr></thead>
        <tbody>
          {tally.map(([iso, v]) => (
            <tr key={iso}><td>{iso.toUpperCase()}</td><td>{v.n}</td><td>{v.sumNemesis}</td><td>{v.sumNemesized}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
