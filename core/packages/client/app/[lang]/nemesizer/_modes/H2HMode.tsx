'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import NemesizerPersonPicker from '../_components/NemesizerPersonPicker';
import PersonCell from '../_components/PersonCell';
import { formatWcaResultK } from '@/lib/wca-format-result';
import { eventDisplayName } from '@/lib/wca-events';
import { fetchH2H, type H2HResponse } from '../_data/nemesizerApi';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { tr } from '@/i18n/tr';
import { LoadingIndicator } from '@/components/LoadingIndicator';

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
    if (!p1 || !p2) { setData(null); setErr(null); setLoading(false); return; }
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

  const currentData = data?.p1.wcaId === p1 && data?.p2.wcaId === p2 ? data : null;
  return (
    <div className="nemesizer-h2h">
      <div className="nemesizer-filters">
        <LiquidGlassChips items={['ranks', 'results'] as const} value={show}
          onChange={v => setParam('show', v)} ariaLabel={tr({ zh: '显示', en: 'Show' })}
          getLabel={v => v === 'ranks' ? tr({ zh: '排名', en: 'Ranks' }) : tr({ zh: '成绩', en: 'Results' })} />
      </div>
      <div className="nemesizer-h2h-pickers">
        <NemesizerPersonPicker isZh={isZh} initialQuery={p1} showSelectedPerson
          onPick={id => setParam('p1', id)}
          placeholder={tr({ zh: '选手 1：WCA ID 或姓名', en: 'Person 1: WCA ID or name' })} />
        <div className="nemesizer-h2h-vs" aria-hidden="true">VS</div>
        <NemesizerPersonPicker isZh={isZh} initialQuery={p2} showSelectedPerson
          onPick={id => setParam('p2', id)}
          placeholder={tr({ zh: '选手 2：WCA ID 或姓名', en: 'Person 2: WCA ID or name' })} />
      </div>
      {err && <p role="alert" className="nemesizer-h2h-error">{tr({ zh: '无法加载对决，请检查所选选手后重试。', en: 'Could not load the comparison. Check the selected people and try again.' })}</p>}
      {loading && p1 && p2 && !currentData && <div className="nemesizer-loading"><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator></div>}
      {currentData && <Comparison data={currentData} isZh={isZh} show={show} />}
    </div>
  );
}

function Comparison({ data, isZh, show }: { data: H2HResponse; isZh: boolean; show: Show }) {
  const wins = [0, 0];
  let compared = 0;
  for (const row of data.rows) {
    const a = show === 'ranks' ? row.r1 : row.b1;
    const b = show === 'ranks' ? row.r2 : row.b2;
    if (a === undefined && b === undefined) continue;
    compared++;
    if (a !== undefined && (b === undefined || a < b)) wins[0]++;
    if (b !== undefined && (a === undefined || b < a)) wins[1]++;
  }
  return (
    <div className="wse-table-wrapper sticky-scroll nemesizer-table-wrap">
      <table className="wse-table sticky-thead nemesizer-h2h-table">
        <thead>
          <tr>
            <th>{tr({ zh: '项目', en: 'Event'
            })}</th>
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
                <td aria-label={labelEk(r.event, r.kind, isZh)}>
                  {data.rows[i - 1]?.event !== r.event && <span aria-hidden="true">{eventDisplayName(r.event, isZh)}</span>}
                </td>
                <td className={class1}>{v1 !== undefined ? fmt(v1) : ''}</td>
                <td className={class2}>{v2 !== undefined ? fmt(v2) : ''}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="nemesizer-h2h-score">
            <th scope="row">{tr({ zh: '比分', en: 'Score' })}</th>
            {wins.map((score, index) => {
              const outcome = score === wins[1 - index] ? 'draw' : score > wins[1 - index] ? 'win' : 'loss';
              return <td key={index}>
                <strong>{compared ? score : '—'}</strong>
                {compared > 0 && <span className={`nemesizer-h2h-outcome is-${outcome}`}>
                  {tr({ win: { zh: '胜', en: 'Win' }, loss: { zh: '负', en: 'Loss' }, draw: { zh: '平', en: 'Draw' } }[outcome])}
                </span>}
              </td>;
            })}
          </tr>
        </tfoot>
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
  const suffix = kind === 0 ? tr({ zh: '单次', en: 'single'
  }) : tr({ zh: '平均', en: 'average' });
  return `${eventDisplayName(ev, isZh)} ${suffix}`;
}
