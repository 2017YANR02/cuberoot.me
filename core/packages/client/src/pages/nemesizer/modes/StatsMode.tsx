import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PersonCell from '../components/PersonCell';
import { fetchStats, type StatsResponse } from '../data/nemesizerApi';

interface Props { isZh: boolean; }

type Tab = 'most' | 'few' | 'people' | 'biggest' | 'countries';

const TABS: { id: Tab; en: string; zh: string }[] = [
  { id: 'most',      en: 'Most nemeses',         zh: '最多宿敌' },
  { id: 'few',       en: 'Fewest nemeses',       zh: '最少宿敌' },
  { id: 'people',    en: 'People',               zh: '选手' },
  { id: 'biggest',   en: 'Biggest nemesizers',   zh: '被视为宿敌最多者' },
  { id: 'countries', en: 'Top countries',        zh: '顶尖国家' },
];

export default function StatsMode({ isZh }: Props) {
  const [params, setParams] = useSearchParams();
  const tab = ((params.get('tab') as Tab) || 'most');
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    fetchStats(tab, ctl.signal)
      .then(r => { if (!ctl.signal.aborted) { setData(r); setLoading(false); } })
      .catch(e => { if (!ctl.signal.aborted) { console.error('stats fetch:', e); setLoading(false); } });
    return () => ctl.abort();
  }, [tab]);

  return (
    <div>
      <div className="nemesizer-stats-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setParam('tab', t.id)}
          >
            {isZh ? t.zh : t.en}
          </button>
        ))}
      </div>
      <p className="nemesizer-small-muted" style={{ textAlign: 'center', marginTop: 0 }}>
        {isZh ? '（世界范围）' : '(world scope)'}
      </p>
      {loading && !data && <div className="nemesizer-loading">{isZh ? '加载中…' : 'Loading…'}</div>}
      {data && tab === 'most' && <PersonsCountTable persons={data.persons ?? []} valueLabel={isZh ? '宿敌数' : 'Nemeses'} valueKey="nemesisCount" isZh={isZh} />}
      {data && tab === 'few' && <PersonsCountTable persons={data.persons ?? []} valueLabel={isZh ? '宿敌数' : 'Nemeses'} valueKey="nemesisCount" isZh={isZh} />}
      {data && tab === 'biggest' && (
        <>
          <p className="nemesizer-results-summary">{isZh ? '克最多人的选手是？' : 'Who nemesizes the most people?'}</p>
          <PersonsCountTable persons={data.persons ?? []} valueLabel={isZh ? '被视为宿敌数' : 'Nemesized'} valueKey="nemesizedCount" isZh={isZh} />
        </>
      )}
      {data && tab === 'people' && (
        <>
          <PeopleTable persons={data.persons ?? []} isZh={isZh} />
          {data.truncated && (
            <p className="nemesizer-small-muted" style={{ textAlign: 'center', padding: 12 }}>
              {isZh ? `仅显示前 500 行（共 ${data.totalCount}）。` : `Showing first 500 of ${data.totalCount}.`}
            </p>
          )}
        </>
      )}
      {data && tab === 'countries' && <CountriesTable rows={data.rows ?? []} isZh={isZh} />}
    </div>
  );
}

function PersonsCountTable({ persons, valueLabel, valueKey, isZh }: {
  persons: { wcaId: string; name: string; iso2: string; nemesisCount?: number; nemesizedCount?: number }[];
  valueLabel: string;
  valueKey: 'nemesisCount' | 'nemesizedCount';
  isZh: boolean;
}) {
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead>
          <tr><th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th><th>{valueLabel}</th></tr>
        </thead>
        <tbody>
          {persons.map(p => (
            <tr key={p.wcaId}>
              <td>{p.wcaId}</td>
              <td><PersonCell person={{ wcaId: p.wcaId, name: p.name, countryIso2: p.iso2, continentIdx: 0 }} isZh={isZh} /></td>
              <td>{p[valueKey] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeopleTable({ persons, isZh }: {
  persons: { wcaId: string; name: string; iso2: string; nemesisCount?: number; nemesizedCount?: number }[];
  isZh: boolean;
}) {
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead><tr>
          <th>WCA ID</th><th>{isZh ? '姓名' : 'Name'}</th>
          <th>{isZh ? '宿敌数' : 'Nemeses'}</th><th>{isZh ? '被视为宿敌数' : 'Nemesized'}</th>
        </tr></thead>
        <tbody>
          {persons.map(p => (
            <tr key={p.wcaId}>
              <td>{p.wcaId}</td>
              <td><PersonCell person={{ wcaId: p.wcaId, name: p.name, countryIso2: p.iso2, continentIdx: 0 }} isZh={isZh} /></td>
              <td>{p.nemesisCount ?? 0}</td>
              <td>{p.nemesizedCount ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountriesTable({ rows, isZh }: {
  rows: { iso2: string; peopleCount: number; sumNemesis: number; sumNemesized: number }[];
  isZh: boolean;
}) {
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
          {rows.map(r => (
            <tr key={r.iso2}>
              <td>{r.iso2.toUpperCase()}</td>
              <td>{r.peopleCount}</td>
              <td>{r.sumNemesis}</td>
              <td>{r.sumNemesized}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
