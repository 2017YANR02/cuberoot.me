'use client';

import { useEffect, useState } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import PersonCell from '../_components/PersonCell';
import { fetchStats, type StatsResponse } from '../_data/nemesizerApi';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface Props { isZh: boolean; }

type Tab = 'most' | 'few' | 'people' | 'biggest' | 'countries';
const TAB_KEYS: Tab[] = ['most', 'few', 'people', 'biggest', 'countries'];

const TABS: { id: Tab; en: string; zh: string }[] = [
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
            onClick={() => setTab(t.id)}
          >
            {(i18n.language.startsWith('zh') ? t.zh : t.en)}
          </button>
        ))}
      </div>
      <p className="nemesizer-small-muted" style={{ textAlign: 'center', marginTop: 0 }}>
        {tr({ zh: '（世界范围）', en: '(world scope)',
            zhHant: "（世界範圍）"
        })}
      </p>
      {loading && !data && <div className="nemesizer-loading">{tr({ zh: '加载中…', en: 'Loading…',
          zhHant: "載入中…"
    })}</div>}
      {data && tab === 'most' && <PersonsCountTable persons={data.persons ?? []} valueLabel={tr({ zh: '宿敌数', en: 'Nemeses',
          zhHant: "宿敵數"
    })} valueKey="nemesisCount" isZh={isZh} />}
      {data && tab === 'few' && <PersonsCountTable persons={data.persons ?? []} valueLabel={tr({ zh: '宿敌数', en: 'Nemeses',
          zhHant: "宿敵數"
    })} valueKey="nemesisCount" isZh={isZh} />}
      {data && tab === 'biggest' && (
        <>
          <p className="nemesizer-results-summary">{tr({ zh: '克最多人的选手是？', en: 'Who nemesizes the most people?',
              zhHant: "克最多人的選手是？"
        })}</p>
          <PersonsCountTable persons={data.persons ?? []} valueLabel={tr({ zh: '被视为宿敌数', en: 'Nemesized',
              zhHant: "被視為宿敵數"
        })} valueKey="nemesizedCount" isZh={isZh} />
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
          <tr><th>WCA ID</th><th>{tr({ zh: '姓名', en: 'Name' })}</th><th>{valueLabel}</th></tr>
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
          <th>WCA ID</th><th>{tr({ zh: '姓名', en: 'Name' })}</th>
          <th>{tr({ zh: '宿敌数', en: 'Nemeses',
              zhHant: "宿敵數"
        })}</th><th>{tr({ zh: '被视为宿敌数', en: 'Nemesized',
            zhHant: "被視為宿敵數"
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

function CountriesTable({ rows, isZh }: {
  rows: { iso2: string; peopleCount: number; sumNemesis: number; sumNemesized: number }[];
  isZh: boolean;
}) {
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead><tr>
          <th>{tr({ zh: '国家', en: 'Country',
              zhHant: "國家"
        })}</th>
          <th>{tr({ zh: '选手数', en: 'People',
              zhHant: "選手數"
        })}</th>
          <th>{tr({ zh: '总宿敌数', en: 'Total nemeses',
              zhHant: "總宿敵數"
        })}</th>
          <th>{tr({ zh: '总被视为宿敌数', en: 'Total nemesized',
              zhHant: "總被視為宿敵數"
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
