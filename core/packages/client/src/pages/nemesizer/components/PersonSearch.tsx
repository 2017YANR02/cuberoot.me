import { useEffect, useRef, useState } from 'react';
import type { NemesizerDataset } from '../data/nemesizerData';
import { findPersons } from '../data/nemesizerData';
import PersonCell from './PersonCell';

interface Props {
  ds: NemesizerDataset;
  isZh: boolean;
  initialQuery?: string;
  onPick: (wcaId: string) => void;
  autoPickSingle?: boolean;
  placeholder?: string;
}

export default function PersonSearch({ ds, isZh, initialQuery, onPick, autoPickSingle, placeholder }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = () => {
    setSubmittedQuery(query);
  };

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
      setSubmittedQuery(initialQuery);
    }
  }, [initialQuery]);

  const matches = submittedQuery ? findPersons(ds, submittedQuery) : [];

  useEffect(() => {
    if (autoPickSingle && matches.length === 1) {
      onPick(ds.persons[matches[0]].wcaId);
    }
  }, [matches.length, autoPickSingle, onPick, ds.persons, matches]);

  return (
    <>
      <div className="nemesizer-search">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder ?? (isZh ? '搜索 WCA ID、姓名、国家或年份' : 'Search WCA ID, name, country or year')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
        />
        <button
          className="nemesizer-btn-pink"
          onClick={doSearch}
          disabled={!query.trim()}
          aria-label="search"
        >🔍</button>
      </div>

      {submittedQuery && matches.length > 0 && (
        <>
          <p className="nemesizer-results-summary">
            {isZh
              ? `找到 ${matches.length} 个匹配 "${submittedQuery}"`
              : `Found ${matches.length} matches for "${submittedQuery}"`}
          </p>
          <div className="nemesizer-table-wrap">
            <table className="nemesizer-table">
              <thead>
                <tr>
                  <th>{isZh ? 'WCA ID' : 'WCA ID'}</th>
                  <th>{isZh ? '姓名' : 'Name'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 30).map(pi => {
                  const p = ds.persons[pi];
                  return (
                    <tr key={p.wcaId}>
                      <td>{p.wcaId}</td>
                      <td><PersonCell person={p} isZh={isZh} /></td>
                      <td>
                        <button
                          className="nemesizer-btn-blue"
                          onClick={() => onPick(p.wcaId)}
                        >{isZh ? '选择' : 'Select'}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {submittedQuery && matches.length === 0 && (
        <p className="nemesizer-results-summary nemesizer-small-muted">
          {isZh ? `未找到 "${submittedQuery}"` : `No match for "${submittedQuery}"`}
        </p>
      )}
    </>
  );
}
