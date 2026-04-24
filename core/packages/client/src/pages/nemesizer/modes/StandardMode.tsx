import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NemesizerDataset } from '../data/nemesizerData';
import PersonSearch from '../components/PersonSearch';
import PersonCell from '../components/PersonCell';
import { applyRelation, filterByScope, type RelationView } from '../data/nemesizerAlgo';
import { displayCuberName } from '../../../utils/name_utils';

interface Props { ds: NemesizerDataset; isZh: boolean; }

const VIEWS: { id: RelationView; en: string; zh: string }[] = [
  { id: 'myNem',      en: 'Show my nemeses',              zh: '显示我的宿敌' },
  { id: 'iNem',       en: 'Show who I nemesize',          zh: '显示谁把我视为宿敌' },
  { id: 'nearlyMe',   en: 'Show who nearly nemesizes me', zh: '显示差一步就成我宿敌的人' },
  { id: 'iNearly',    en: 'Show who I nearly nemesize',   zh: '显示差一步就把我视为宿敌的人' },
  { id: 'onlyJustMe', en: 'Show who only just nemesizes me', zh: '显示刚好成为我宿敌的人' },
  { id: 'iOnlyJust',  en: 'Show who I only just nemesize',   zh: '显示刚好把我视为宿敌的人' },
];

type Scope = 'world' | 'continent' | 'country';
type ShowMode = 'people' | 'countries';

export default function StandardMode({ ds, isZh }: Props) {
  const [params, setParams] = useSearchParams();
  const person = params.get('person') ?? '';
  const view = (params.get('view') as RelationView) || 'myNem';
  const scope = (params.get('scope') as Scope) || 'world';
  const showMode = (params.get('show') as ShowMode) || 'people';

  const personIdx = person ? ds.wcaIdIndex.get(person.toUpperCase()) : undefined;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const pick = (wcaId: string) => setParam('person', wcaId);

  const results = useMemo(() => {
    if (personIdx === undefined) return null;
    const raw = applyRelation(ds, personIdx, view);
    return filterByScope(ds, raw, scope, personIdx);
  }, [ds, personIdx, view, scope]);

  if (!person || personIdx === undefined) {
    return (
      <>
        <PersonSearch
          ds={ds}
          isZh={isZh}
          initialQuery={person}
          onPick={pick}
          autoPickSingle
          placeholder={isZh ? '输入 WCA ID 或姓名开始' : 'Enter WCA ID or name to begin'}
        />
      </>
    );
  }

  const p = ds.persons[personIdx];

  return (
    <>
      <PersonSearch ds={ds} isZh={isZh} initialQuery={person} onPick={pick} placeholder={isZh ? 'WCA ID 或姓名' : 'WCA ID or name'} />
      <ViewPicker view={view} onChange={v => setParam('view', v)} isZh={isZh} />
      <ScopePicker scope={scope} onChange={s => setParam('scope', s)} isZh={isZh} />
      <ShowPicker mode={showMode} onChange={m => setParam('show', m)} isZh={isZh} />
      <SummaryLine
        person={p.name}
        isZh={isZh}
        count={results?.length ?? 0}
        view={view}
        scope={scope}
        scopeRef={personIdx}
        ds={ds}
      />
      {results && results.length > 0 && (
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <button className="nemesizer-btn-blue" onClick={() => exportCsv(ds, results, showMode, p.wcaId, view)}>
            {isZh ? '⬇ 导出 CSV' : '⬇ Export CSV'}
          </button>
        </div>
      )}
      {results && (showMode === 'people'
        ? <PeopleTable ds={ds} results={results} isZh={isZh} />
        : <CountriesTable ds={ds} results={results} isZh={isZh} />
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
          {isZh ? v.zh : v.en}
        </label>
      ))}
    </div>
  );
}

function ScopePicker({ scope, onChange, isZh }: { scope: 'world' | 'continent' | 'country'; onChange: (s: 'world' | 'continent' | 'country') => void; isZh: boolean }) {
  return (
    <div className="nemesizer-scope">
      {(['world', 'continent', 'country'] as const).map(s => (
        <label key={s}>
          <input type="radio" checked={scope === s} onChange={() => onChange(s)} />
          {isZh ? ({ world: '世界', continent: '大洲', country: '国家' })[s] : s[0].toUpperCase() + s.slice(1)}
        </label>
      ))}
    </div>
  );
}

function ShowPicker({ mode, onChange, isZh }: { mode: 'people' | 'countries'; onChange: (m: 'people' | 'countries') => void; isZh: boolean }) {
  return (
    <div className="nemesizer-show-section">
      <strong>{isZh ? '显示：' : 'Show:'}</strong>
      <label><input type="radio" checked={mode === 'people'} onChange={() => onChange('people')} />{isZh ? '选手' : 'People'}</label>
      <label><input type="radio" checked={mode === 'countries'} onChange={() => onChange('countries')} />{isZh ? '国家' : 'Countries'}</label>
    </div>
  );
}

function SummaryLine({ person, isZh, count, view, ds, scopeRef, scope }: {
  person: string; isZh: boolean; count: number; view: RelationView; ds: NemesizerDataset; scopeRef: number; scope: 'world' | 'continent' | 'country';
}) {
  const name = displayCuberName(person, isZh);
  const scopeText = (() => {
    if (scope === 'world') return isZh ? '世界' : 'the world';
    if (scope === 'country') {
      const c = ds.persons[scopeRef].countryIso2.toUpperCase();
      return isZh ? c : c;
    }
    const idx = ds.persons[scopeRef].continentIdx;
    return ds.continents[idx] ?? '';
  })();
  const verbZh: Record<RelationView, string> = {
    myNem: '的宿敌共', iNem: '被视为宿敌共', nearlyMe: '差一步宿敌共', iNearly: '差一步被视为宿敌共',
    onlyJustMe: '刚好宿敌共', iOnlyJust: '刚好被视为宿敌共',
  };
  const verbEn: Record<RelationView, string> = {
    myNem: 'has', iNem: 'nemesizes', nearlyMe: 'is nearly nemesized by',
    iNearly: 'nearly nemesizes', onlyJustMe: 'is only-just nemesized by', iOnlyJust: 'only-just nemesizes',
  };
  if (isZh) {
    const tail = view === 'myNem' || view === 'nearlyMe' || view === 'onlyJustMe'
      ? `${count} 个） in ${scopeText}`
      : `${count} 个人 in ${scopeText}`;
    return <div className="nemesizer-results-summary">{name}（{scopeText}）{verbZh[view]}{tail}</div>;
  }
  return <div className="nemesizer-results-summary">{name} {verbEn[view]} {count} people in {scopeText}</div>;
}

function PeopleTable({ ds, results, isZh }: { ds: NemesizerDataset; results: { personIdx: number; sharedEkCount: number }[]; isZh: boolean }) {
  const sorted = [...results].sort((a, b) => ds.persons[a.personIdx].wcaId.localeCompare(ds.persons[b.personIdx].wcaId));
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead>
          <tr>
            <th>{isZh ? 'WCA ID' : 'WCA ID'}</th>
            <th>{isZh ? '姓名' : 'Name'}</th>
            <th>{isZh ? '共同项目' : 'Shared events'}</th>
            <th>{isZh ? '我的宿敌数' : 'Nemeses'}</th>
            <th>{isZh ? '被视为宿敌数' : 'Nemesized'}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 500).map(r => {
            const p = ds.persons[r.personIdx];
            return (
              <tr key={p.wcaId}>
                <td>{p.wcaId}</td>
                <td><PersonCell person={p} isZh={isZh} /></td>
                <td>{r.sharedEkCount}</td>
                <td>{ds.counts.nemesisCount[r.personIdx]}</td>
                <td>{ds.counts.nemesizedCount[r.personIdx]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > 500 && (
        <p className="nemesizer-small-muted" style={{ textAlign: 'center', padding: '12px' }}>
          {isZh ? `仅显示前 500 行（共 ${sorted.length}）。` : `Showing first 500 of ${sorted.length}.`}
        </p>
      )}
    </div>
  );
}

function exportCsv(ds: NemesizerDataset, results: { personIdx: number; sharedEkCount: number }[], showMode: ShowMode, refId: string, view: RelationView) {
  const lines: string[] = [];
  if (showMode === 'people') {
    lines.push('wca_id,name,shared_events,nemeses,nemesized');
    for (const r of results) {
      const p = ds.persons[r.personIdx];
      const name = p.name.replace(/"/g, '""');
      lines.push(`${p.wcaId},"${name}",${r.sharedEkCount},${ds.counts.nemesisCount[r.personIdx]},${ds.counts.nemesizedCount[r.personIdx]}`);
    }
  } else {
    const tally = new Map<string, number>();
    for (const r of results) {
      const iso = ds.persons[r.personIdx].countryIso2;
      tally.set(iso, (tally.get(iso) ?? 0) + 1);
    }
    lines.push('country_iso2,count');
    for (const [iso, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`${iso},${n}`);
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nemesizer_${refId}_${view}_${showMode}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CountriesTable({ ds, results, isZh }: { ds: NemesizerDataset; results: { personIdx: number }[]; isZh: boolean }) {
  const tally = new Map<string, number>();
  for (const r of results) {
    const iso = ds.persons[r.personIdx].countryIso2;
    tally.set(iso, (tally.get(iso) ?? 0) + 1);
  }
  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead><tr><th>{isZh ? '国家' : 'Country'}</th><th>{isZh ? '数量' : 'Count'}</th></tr></thead>
        <tbody>
          {sorted.map(([iso, n]) => (
            <tr key={iso}><td>{iso.toUpperCase()}</td><td>{n}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
