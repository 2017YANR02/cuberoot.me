'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import NemesizerPersonPicker from '../_components/NemesizerPersonPicker';
import PersonCell from '../_components/PersonCell';
import {
  fetchNemeses,
  type NemesesResponse,
  type RelationView,
  type Scope,
  type NemPersonRow,
} from '../_data/nemesizerApi';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface Props { isZh: boolean; }

const VIEWS: { id: RelationView; en: string; zh: string
    zhHant?: string;
 }[] = [
  { id: 'myNem',      en: 'Show my nemeses',              zh: '显示我的宿敌',
      zhHant: "顯示我的宿敵"
},
  { id: 'iNem',       en: 'Show who I nemesize',          zh: '显示谁把我视为宿敌',
      zhHant: "顯示誰把我視為宿敵"
},
  { id: 'nearlyMe',   en: 'Show who nearly nemesizes me', zh: '显示差一步就成我宿敌的人',
      zhHant: "顯示差一步就成我宿敵的人"
},
  { id: 'iNearly',    en: 'Show who I nearly nemesize',   zh: '显示差一步就把我视为宿敌的人',
      zhHant: "顯示差一步就把我視為宿敵的人"
},
  { id: 'onlyJustMe', en: 'Show who only just nemesizes me', zh: '显示刚好成为我宿敌的人',
      zhHant: "顯示剛好成為我宿敵的人"
},
  { id: 'iOnlyJust',  en: 'Show who I only just nemesize',   zh: '显示刚好把我视为宿敌的人',
      zhHant: "顯示剛好把我視為宿敵的人"
},
];

type ShowMode = 'people' | 'countries';
type Order = 'id' | 'name' | 'nemeses' | 'nemesized';
type Direction = 'up' | 'down';

export default function StandardMode({ isZh }: Props) {
  // 选手 / 筛选 / 排序均为页内瞬时态 → replace,不堆历史
  const [q, setQ] = useQueryStates(
    {
      person: parseAsString,
      view: parseAsString,
      scope: parseAsString,
      show: parseAsString,
      order: parseAsString,
      direction: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  const person = (q.person ?? '').toUpperCase();
  const view = (q.view as RelationView) || 'myNem';
  const scope = (q.scope as Scope) || 'world';
  const showMode = (q.show as ShowMode) || 'people';
  const order = (q.order as Order) || 'id';
  const direction = (q.direction as Direction) || 'up';

  const setParam = (key: string, value: string) => {
    setQ({ [key]: value || null });
  };
  const pick = (wcaId: string) => setParam('person', wcaId);

  const [data, setData] = useState<NemesesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!person) { setData(null); setErr(null); return; }
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setLoading(true);
    setErr(null);
    fetchNemeses(person, view, scope, ctl.signal)
      .then(r => { if (!ctl.signal.aborted) { setData(r); setLoading(false); } })
      .catch(e => {
        if (ctl.signal.aborted) return;
        setLoading(false);
        setErr(e instanceof Error ? e.message : String(e));
      });
    return () => ctl.abort();
  }, [person, view, scope]);

  if (!person) {
    return (
      <NemesizerPersonPicker
        isZh={isZh}
        onPick={pick}
        placeholder={tr({ zh: '输入 WCA ID、姓名、国家或年份开始', en: 'Enter WCA ID, name, country or year',
            zhHant: "輸入 WCA ID、姓名、國家或年份開始"
        })}
      />
    );
  }

  if (err) {
    if (err.startsWith('404')) {
      return (
        <NemesizerPersonPicker
          isZh={isZh}
          initialQuery={person}
          onPick={pick}
          placeholder={tr({ zh: '没找到该选手,重试', en: 'Person not found, try again',
              zhHant: "沒找到該選手,重試"
        })}
        />
      );
    }
    return <div className="nemesizer-loading" style={{ color: 'var(--signal-danger)' }}>{err}</div>;
  }

  return (
    <>
      <NemesizerPersonPicker isZh={isZh} onPick={pick} />
      <ViewPicker view={view} onChange={v => setParam('view', v)} isZh={isZh} />
      <ScopePicker scope={scope} onChange={s => setParam('scope', s)} isZh={isZh} />
      <ShowPicker mode={showMode} onChange={m => setParam('show', m)} isZh={isZh} />
      {showMode === 'people' && (
        <SortPicker
          order={order}
          direction={direction}
          onOrder={o => setParam('order', o)}
          onDirection={d => setParam('direction', d)}
          isZh={isZh}
        />
      )}
      {loading && !data && <div className="nemesizer-loading">{tr({ zh: '计算中…', en: 'Computing…',
          zhHant: "計算中…"
    })}</div>}
      {data && (
        <>
          <SummaryLine data={data} isZh={isZh} />
          {data.persons.length > 0 && (
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <button className="nemesizer-btn-blue" onClick={() => exportCsv(data, showMode)}>
                {tr({ zh: '⬇ 导出 CSV', en: '⬇ Export CSV',
                    zhHant: "⬇ 匯出 CSV"
                })}
              </button>
            </div>
          )}
          {showMode === 'people'
            ? <PeopleTable data={data} isZh={isZh} order={order} direction={direction} />
            : <CountriesTable data={data} isZh={isZh} />}
          {loading && <div className="nemesizer-small-muted" style={{ textAlign: 'center', padding: 8 }}>{tr({ zh: '更新中…', en: 'Updating…' })}</div>}
        </>
      )}
    </>
  );
}

function ViewPicker({ view, onChange, isZh }: { view: RelationView; onChange: (v: RelationView) => void; isZh: boolean }) {
  return (
    <div className="nemesizer-view-group">
      {VIEWS.map(v => (
        <label key={v.id}>
          <input type="radio" checked={view === v.id} onChange={() => onChange(v.id)} />
          {(i18n.language === 'zh-Hant' ? (v.zhHant ?? v.zh) : (i18n.language.startsWith('zh') ? v.zh : v.en))}
        </label>
      ))}
    </div>
  );
}

function ScopePicker({ scope, onChange, isZh }: { scope: Scope; onChange: (s: Scope) => void; isZh: boolean }) {
  return (
    <div className="nemesizer-scope">
      {(['world', 'continent', 'country'] as const).map(s => (
        <label key={s}>
          <input type="radio" checked={scope === s} onChange={() => onChange(s)} />
          {i18n.language === 'zh-Hant' ? (({ world: '世界', continent: '大洲', country: '國家' })[s]) : (isZh ? ({ world: '世界', continent: '大洲', country: '国家' })[s] : s[0].toUpperCase() + s.slice(1))}
        </label>
      ))}
    </div>
  );
}

function SortPicker({ order, direction, onOrder, onDirection, isZh }: {
  order: Order; direction: Direction;
  onOrder: (o: Order) => void; onDirection: (d: Direction) => void; isZh: boolean;
}) {
  return (
    <div className="nemesizer-sort">
      <strong>{tr({ zh: '排序：', en: 'Sort by:' })}</strong>
      <select value={order} onChange={e => onOrder(e.target.value as Order)}>
        <option value="id">WCA ID</option>
        <option value="name">{tr({ zh: '姓名', en: 'Name' })}</option>
        <option value="nemeses">{tr({ zh: '宿敌数', en: 'Nemeses',
            zhHant: "宿敵數"
        })}</option>
        <option value="nemesized">{tr({ zh: '被视为宿敌数', en: 'Nemesized',
            zhHant: "被視為宿敵數"
        })}</option>
      </select>
      <label><input type="radio" checked={direction === 'up'} onChange={() => onDirection('up')} />{tr({ zh: '升序', en: 'Up' })}</label>
      <label><input type="radio" checked={direction === 'down'} onChange={() => onDirection('down')} />{tr({ zh: '降序', en: 'Down' })}</label>
    </div>
  );
}

function ShowPicker({ mode, onChange, isZh }: { mode: ShowMode; onChange: (m: ShowMode) => void; isZh: boolean }) {
  return (
    <div className="nemesizer-show-section">
      <strong>{tr({ zh: '显示：', en: 'Show:',
          zhHant: "顯示："
    })}</strong>
      <label><input type="radio" checked={mode === 'people'} onChange={() => onChange('people')} />{tr({ zh: '选手', en: 'People',
          zhHant: "選手"
    })}</label>
      <label><input type="radio" checked={mode === 'countries'} onChange={() => onChange('countries')} />{tr({ zh: '国家', en: 'Countries',
          zhHant: "國家"
    })}</label>
    </div>
  );
}

function SummaryLine({ data, isZh }: { data: NemesesResponse; isZh: boolean }) {
  const scopeText = (() => {
    if (data.scope === 'world') return tr({ zh: '世界', en: 'the world' });
    if (data.scope === 'country') return data.ref.iso2.toUpperCase();
    return data.ref.continent;
  })();
  const verbZh: Record<RelationView, string> = {
    myNem: '的宿敌共', iNem: '被视为宿敌共', nearlyMe: '差一步宿敌共', iNearly: '差一步被视为宿敌共',
    onlyJustMe: '刚好宿敌共', iOnlyJust: '刚好被视为宿敌共',
  };
  const verbEn: Record<RelationView, string> = {
    myNem: 'has', iNem: 'nemesizes', nearlyMe: 'is nearly nemesized by',
    iNearly: 'nearly nemesizes', onlyJustMe: 'is only-just nemesized by', iOnlyJust: 'only-just nemesizes',
  };
  const personLike = { wcaId: data.ref.wcaId, name: data.ref.name, countryIso2: data.ref.iso2, continentIdx: 0 };
  if (isZh) {
    return (
      <div className="nemesizer-results-summary">
        <PersonCell person={personLike} isZh={isZh} />
        （{scopeText}）{verbZh[data.view]}{data.totalCount} 个人
      </div>
    );
  }
  return (
    <div className="nemesizer-results-summary">
      <PersonCell person={personLike} isZh={isZh} />
      {' '}{verbEn[data.view]} {data.totalCount} people in {scopeText}
    </div>
  );
}

function PeopleTable({ data, isZh, order, direction }: {
  data: NemesesResponse; isZh: boolean; order: Order; direction: Direction;
}) {
  const sign = direction === 'down' ? -1 : 1;
  const cmp = (a: NemPersonRow, b: NemPersonRow): number => {
    switch (order) {
      case 'id':        return sign * a.wcaId.localeCompare(b.wcaId);
      case 'name':      return sign * a.name.localeCompare(b.name);
      case 'nemeses':   return sign * (a.nemesisCount - b.nemesisCount);
      case 'nemesized': return sign * (a.nemesizedCount - b.nemesizedCount);
    }
  };
  const sorted = [...data.persons].sort(cmp);
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead>
          <tr>
            <th>WCA ID</th>
            <th>{tr({ zh: '姓名', en: 'Name' })}</th>
            <th>{tr({ zh: '共同项目', en: 'Shared events',
                zhHant: "共同項目"
            })}</th>
            <th>{tr({ zh: '我的宿敌数', en: 'Nemeses',
                zhHant: "我的宿敵數"
            })}</th>
            <th>{tr({ zh: '被视为宿敌数', en: 'Nemesized',
                zhHant: "被視為宿敵數"
            })}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <tr key={p.wcaId}>
              <td>{p.wcaId}</td>
              <td><PersonCell person={{ wcaId: p.wcaId, name: p.name, countryIso2: p.iso2, continentIdx: 0 }} isZh={isZh} /></td>
              <td>{p.sharedEkCount}</td>
              <td>{p.nemesisCount}</td>
              <td>{p.nemesizedCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.truncated && (
        <p className="nemesizer-small-muted" style={{ textAlign: 'center', padding: '12px' }}>
          {i18n.language === 'zh-Hant' ? (`僅顯示前 ${sorted.length} 行（共 ${data.totalCount}）。`) : (isZh ? `仅显示前 ${sorted.length} 行（共 ${data.totalCount}）。` : `Showing first ${sorted.length} of ${data.totalCount}.`)}
        </p>
      )}
    </div>
  );
}

function CountriesTable({ data, isZh }: { data: NemesesResponse; isZh: boolean }) {
  const sorted = Object.entries(data.countryTally).sort((a, b) => b[1] - a[1]);
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead><tr><th>{tr({ zh: '国家', en: 'Country',
            zhHant: "國家"
        })}</th><th>{tr({ zh: '数量', en: 'Count',
            zhHant: "數量"
        })}</th></tr></thead>
        <tbody>
          {sorted.map(([iso, n]) => (
            <tr key={iso}><td>{iso.toUpperCase()}</td><td>{n}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportCsv(data: NemesesResponse, showMode: ShowMode) {
  const lines: string[] = [];
  if (showMode === 'people') {
    lines.push('wca_id,name,shared_events,nemeses,nemesized');
    for (const p of data.persons) {
      const name = p.name.replace(/"/g, '""');
      lines.push(`${p.wcaId},"${name}",${p.sharedEkCount},${p.nemesisCount},${p.nemesizedCount}`);
    }
  } else {
    lines.push('country_iso2,count');
    for (const [iso, n] of Object.entries(data.countryTally).sort((a, b) => b[1] - a[1])) {
      lines.push(`${iso},${n}`);
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nemesizer_${data.ref.wcaId}_${data.view}_${showMode}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
