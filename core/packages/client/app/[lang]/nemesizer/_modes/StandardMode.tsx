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
import RelationPicker from '../_components/RelationPicker';
import { ListSelect } from '@/components/ListSelect';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { Download } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';

interface Props { isZh: boolean; }


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
      <NemesizerPersonPicker showSelectedPerson
        isZh={isZh}
        onPick={pick}
        placeholder={tr({ zh: '输入 WCA ID、姓名、国家或年份开始', en: 'Enter WCA ID, name, country or year'
        })}
      />
    );
  }

  if (err) {
    if (err.startsWith('404')) {
      return (
        <NemesizerPersonPicker showSelectedPerson
          isZh={isZh}
          initialQuery={person}
          onPick={pick}
          placeholder={tr({ zh: '没找到该选手,重试', en: 'Person not found, try again'
        })}
        />
      );
    }
    return <div className="nemesizer-loading" style={{ color: 'var(--destructive)' }}>{err}</div>;
  }

  return (
    <>
      <NemesizerPersonPicker showSelectedPerson isZh={isZh} initialQuery={person} onPick={pick} />
      <div className="nemesizer-filters"><RelationPicker view={view} onChange={v => setParam('view', v)} />
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
      </div>
      {loading && !data && <div className="nemesizer-loading">{tr({ zh: '计算中…', en: 'Computing…'
    })}</div>}
      {data && (
        <>
          <div className="nemesizer-results-summary">{tr({ zh: `共 ${data.totalCount} 位选手`, en: `${data.totalCount} people` })}</div>
          {data.persons.length > 0 && (
            <div className="nemesizer-actions">
              <button className="btn-secondary nemesizer-export" onClick={() => exportCsv(data, showMode)}>
                <Download size={16} aria-hidden="true" />{tr({ zh: '导出 CSV', en: 'Export CSV'
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

function ScopePicker({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void; isZh: boolean }) {
  return <LiquidGlassChips items={['world', 'continent', 'country'] as const} value={scope} onChange={onChange}
    ariaLabel={tr({ zh: '范围', en: 'Scope' })}
    getLabel={s => tr({ world: { zh: '世界', en: 'World' }, continent: { zh: '大洲', en: 'Continent' }, country: { zh: '国家', en: 'Country' } }[s])} />;
}

function SortPicker({ order, direction, onOrder, onDirection }: {
  order: Order; direction: Direction; onOrder: (o: Order) => void; onDirection: (d: Direction) => void; isZh: boolean;
}) {
  return <div className="nemesizer-sort">
    <ListSelect value={order} onChange={v => onOrder(v as Order)} clearable={false}
      allLabel={tr({ zh: '排序', en: 'Sort by' })} ariaLabel={tr({ zh: '排序', en: 'Sort by' })}
      items={[
        { value: 'id', label: 'WCA ID' }, { value: 'name', label: tr({ zh: '姓名', en: 'Name' }) },
        { value: 'nemeses', label: tr({ zh: '宿敌数', en: 'Nemeses' }) },
        { value: 'nemesized', label: tr({ zh: '被视为宿敌数', en: 'Nemesized' }) },
      ]} />
    <LiquidGlassChips items={['up', 'down'] as const} value={direction} onChange={onDirection}
      ariaLabel={tr({ zh: '排序方向', en: 'Sort direction' })}
      getLabel={v => v === 'up' ? tr({ zh: '升序', en: 'Ascending' }) : tr({ zh: '降序', en: 'Descending' })} />
  </div>;
}

function ShowPicker({ mode, onChange }: { mode: ShowMode; onChange: (m: ShowMode) => void; isZh: boolean }) {
  return <LiquidGlassChips items={['people', 'countries'] as const} value={mode} onChange={onChange}
    ariaLabel={tr({ zh: '显示', en: 'Show' })}
    getLabel={v => v === 'people' ? tr({ zh: '选手', en: 'People' }) : tr({ zh: '国家', en: 'Countries' })} />;
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
    <div className="wse-table-wrapper sticky-scroll nemesizer-table-wrap">
      <table className="wse-table sticky-thead">
        <thead>
          <tr>
            <th>WCA ID</th>
            <th className="wca-person-column">{tr({ zh: '姓名', en: 'Name' })}</th>
            <th>{tr({ zh: '共同项目', en: 'Shared events'
            })}</th>
            <th>{tr({ zh: '宿敌数', en: 'Nemeses'
            })}</th>
            <th>{tr({ zh: '被视为宿敌数', en: 'Nemesized'
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
          {(isZh ? `仅显示前 ${sorted.length} 行（共 ${data.totalCount}）。` : `Showing first ${sorted.length} of ${data.totalCount}.`)}
        </p>
      )}
    </div>
  );
}

function CountriesTable({ data }: { data: NemesesResponse; isZh: boolean }) {
  const sorted = Object.entries(data.countryTally).sort((a, b) => b[1] - a[1]);
  return (
    <div className="wse-table-wrapper sticky-scroll nemesizer-table-wrap">
      <table className="wse-table sticky-thead">
        <thead><tr><th>{tr({ zh: '国家', en: 'Country'
        })}</th><th>{tr({ zh: '数量', en: 'Count'
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
