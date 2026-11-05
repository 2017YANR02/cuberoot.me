'use client';

import { useEffect, useState } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import PersonCell from '../_components/PersonCell';
import { fetchStats, type StatsResponse } from '../_data/nemesizerApi';
import { ListSelect } from '@/components/ListSelect';
import { tr } from '@/i18n/tr';
import { LoadingIndicator } from '@/components/LoadingIndicator';

interface Props { isZh: boolean; }

type Tab = 'most' | 'few' | 'people' | 'biggest' | 'countries';
const TAB_KEYS: Tab[] = ['most', 'few', 'people', 'biggest', 'countries'];

const TABS: { id: Tab; en: string; zh: string
 }[] = [
  { id: 'most',      en: 'Most nemeses',         zh: '最多宿敌'
},
  { id: 'few',       en: 'Fewest nemeses',       zh: '最少宿敌'
},
  { id: 'people',    en: 'People',               zh: '选手'
},
  { id: 'biggest',   en: 'Biggest nemesizers',   zh: '被视为宿敌最多者'
},
  { id: 'countries', en: 'Top countries',        zh: '顶尖国家'
},
];

export default function StatsMode({ isZh }: Props) {
  // 统计子 tab 是页内瞬时态 → replace,不堆历史
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum<Tab>(TAB_KEYS).withDefault('most').withOptions({ history: 'replace', scroll: false }),
  );

  // Keep each response paired with its dimension while the next one loads.
  const [snapshot, setSnapshot] = useState<{ tab: Tab; data: StatsResponse } | null>(null);
  const data = snapshot?.data;
  const displayedTab = snapshot?.tab;
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(false);
    fetchStats(tab, ctl.signal)
      .then(r => { if (!ctl.signal.aborted) { setSnapshot({ tab, data: r }); setLoading(false); } })
      .catch(e => { if (!ctl.signal.aborted) { console.error('stats fetch:', e); setError(true); setLoading(false); } });
    return () => ctl.abort();
  }, [tab]);

  return (
    <div>
      <div className="nemesizer-filters">
        <ListSelect items={TABS.map(t => ({ value: t.id, label: tr(t) }))} value={tab}
          onChange={v => setTab(v as Tab)} clearable={false}
          allLabel={tr({ zh: '统计', en: 'Statistics' })} ariaLabel={tr({ zh: '统计', en: 'Statistics' })} />
      </div>
      {error && <p role="alert" className="nemesizer-small-muted">{tr({ zh: '加载失败，请切换维度重试。', en: 'Could not load this view. Select a dimension to retry.' })}</p>}
      <div className="nemesizer-stats-stage" aria-busy={loading}>
      <div key={displayedTab ?? 'loading'} className="nemesizer-stats-content">
      {loading && !data && <div className="nemesizer-loading"><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…'
    })}</LoadingIndicator></div>}
      {data && displayedTab === 'most' && <PersonsCountTable persons={data.persons ?? []} valueLabel={tr({ zh: '宿敌数', en: 'Nemeses'
    })} valueKey="nemesisCount" isZh={isZh} />}
      {data && displayedTab === 'few' && <PersonsCountTable persons={data.persons ?? []} valueLabel={tr({ zh: '宿敌数', en: 'Nemeses'
    })} valueKey="nemesisCount" isZh={isZh} />}
      {data && displayedTab === 'biggest' && (
        <>
          <PersonsCountTable persons={data.persons ?? []} valueLabel={tr({ zh: '被视为宿敌数', en: 'Nemesized'
        })} valueKey="nemesizedCount" isZh={isZh} />
        </>
      )}
      {data && displayedTab === 'people' && (
        <>
          <PeopleTable persons={data.persons ?? []} isZh={isZh} />
          {data.truncated && (
            <p className="nemesizer-small-muted" style={{ textAlign: 'center', padding: 12 }}>
              {(isZh ? `仅显示前 500 行（共 ${data.totalCount}）。` : `Showing first 500 of ${data.totalCount}.`)}
            </p>
          )}
        </>
      )}
      {data && displayedTab === 'countries' && <CountriesTable rows={data.rows ?? []} isZh={isZh} />}
      </div>
      </div>
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
    <div className="wse-table-wrapper sticky-scroll nemesizer-table-wrap">
      <table className="wse-table sticky-thead">
        <thead>
          <tr><th>WCA ID</th><th className="wca-person-column">{tr({ zh: '姓名', en: 'Name' })}</th><th>{valueLabel}</th></tr>
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
    <div className="wse-table-wrapper sticky-scroll nemesizer-table-wrap">
      <table className="wse-table sticky-thead">
        <thead><tr>
          <th>WCA ID</th><th className="wca-person-column">{tr({ zh: '姓名', en: 'Name' })}</th>
          <th>{tr({ zh: '宿敌数', en: 'Nemeses'
        })}</th><th>{tr({ zh: '被视为宿敌数', en: 'Nemesized'
        })}</th>
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

function CountriesTable({ rows }: {
  rows: { iso2: string; peopleCount: number; sumNemesis: number; sumNemesized: number }[];
  isZh: boolean;
}) {
  return (
    <div className="wse-table-wrapper sticky-scroll nemesizer-table-wrap">
      <table className="wse-table sticky-thead">
        <thead><tr>
          <th>{tr({ zh: '国家', en: 'Country'
        })}</th>
          <th>{tr({ zh: '选手数', en: 'People'
        })}</th>
          <th>{tr({ zh: '总宿敌数', en: 'Total nemeses'
        })}</th>
          <th>{tr({ zh: '总被视为宿敌数', en: 'Total nemesized'
        })}</th>
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
