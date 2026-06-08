'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import NemesizerPersonPicker from '../_components/NemesizerPersonPicker';
import PersonCell from '../_components/PersonCell';
import { formatWcaResultK } from '@/lib/wca-format-result';
import { eventDisplayName } from '@/lib/wca-events';
import { fetchH2H, type H2HResponse } from '../_data/nemesizerApi';

interface Props { isZh: boolean; }

type Show = 'ranks' | 'results';

export default function H2HMode({ isZh }: Props) {
  // 两位选手 + 展示口径均为页内瞬时态 → replace,不堆历史
  const [q, setQ] = useQueryStates(
    { p1: parseAsString, p2: parseAsString, show: parseAsString },
    { history: 'replace', scroll: false },
  );

  const p1 = (q.p1 ?? '').toUpperCase();
  const p2 = (q.p2 ?? '').toUpperCase();
  const show: Show = (q.show as Show) || 'results';

  const setParam = (key: string, value: string) => {
    setQ({ [key]: value || null });
  };

  const [data, setData] = useState<H2HResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!p1 || !p2) { setData(null); setErr(null); return; }
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setLoading(true);
    setErr(null);
    fetchH2H(p1, p2, ctl.signal)
      .then(r => { if (!ctl.signal.aborted) { setData(r); setLoading(false); } })
      .catch(e => {
        if (ctl.signal.aborted) return;
        setLoading(false);
        setErr(e instanceof Error ? e.message : String(e));
      });
    return () => ctl.abort();
  }, [p1, p2]);

  if (!p1) {
    return (
      <div>
        <h2 style={{ textAlign: 'center' }}>{isZh ? '正面对决' : 'Head to head!'}</h2>
        <NemesizerPersonPicker
          isZh={isZh}
          onPick={id => setParam('p1', id)}
          placeholder={isZh ? '选手 1：WCA ID 或姓名' : 'Person 1: WCA ID or name'}
        />
      </div>
    );
  }

  if (err && err.startsWith('404')) {
    return (
      <div>
        <h2 style={{ textAlign: 'center' }}>{isZh ? '正面对决' : 'Head to head!'}</h2>
        <NemesizerPersonPicker
          isZh={isZh}
          initialQuery={p1}
          onPick={id => setParam('p1', id)}
          placeholder={isZh ? '没找到该选手' : 'Person not found'}
        />
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
      {data && (
        <div className="nemesizer-results-summary">
          {isZh ? '选手 1' : 'Compare'}:{' '}
          <PersonCell person={{ wcaId: data.p1.wcaId, name: data.p1.name, countryIso2: data.p1.iso2, continentIdx: 0 }} isZh={isZh} />
          {' '}({data.p1.wcaId})
        </div>
      )}
      <NemesizerPersonPicker
        isZh={isZh}
        initialQuery={p2}
        onPick={id => setParam('p2', id)}
        placeholder={isZh ? '对手：WCA ID 或姓名' : 'With: WCA ID or name'}
      />
      {loading && !data && <div className="nemesizer-loading">{isZh ? '加载中…' : 'Loading…'}</div>}
      {data && p2 && <Comparison data={data} isZh={isZh} show={show} />}
    </div>
  );
}

function Comparison({ data, isZh, show }: { data: H2HResponse; isZh: boolean; show: Show }) {
  return (
    <div className="nemesizer-table-wrap">
      <table className="nemesizer-table">
        <thead>
          <tr>
            <th>{isZh ? '项目' : 'Event'}</th>
            <th><PersonCell person={{ wcaId: data.p1.wcaId, name: data.p1.name, countryIso2: data.p1.iso2, continentIdx: 0 }} isZh={isZh} /></th>
            <th><PersonCell person={{ wcaId: data.p2.wcaId, name: data.p2.name, countryIso2: data.p2.iso2, continentIdx: 0 }} isZh={isZh} /></th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => {
            const v1 = show === 'ranks' ? r.r1 : r.b1;
            const v2 = show === 'ranks' ? r.r2 : r.b2;
            const class1 = cellClass(v1, v2);
            const class2 = cellClass(v2, v1);
            const fmt = (v: number) => show === 'ranks' ? String(v) : formatWcaResultK(v, r.event, r.kind as 0 | 1);
            return (
              <tr key={i}>
                <td>{labelEk(r.event, r.kind, isZh)}</td>
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
