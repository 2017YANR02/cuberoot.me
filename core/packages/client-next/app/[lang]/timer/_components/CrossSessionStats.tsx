'use client';

import { useMemo } from 'react';
import type { EventId, Solve } from '../_lib/types';
import {
  bestSingle,
  averageOfN,
  meanOfAll,
  formatMs,
} from '../_lib/stats';
import { loadAllSessionData, getActiveSessionId } from '../_lib/storage/db';
import './cross_session.css';

interface Props {
  event: EventId;
  isZh: boolean;
}

interface Row {
  id: string;
  name: string;
  active: boolean;
  count: number;
  best: string;
  ao5: string;
  ao12: string;
  mean: string;
}

/** A formatted value counts as "empty" when it's a dash placeholder. */
function isEmptyVal(v: string): boolean {
  return v === '-' || v === '—';
}

function metricsOf(solves: Solve[]) {
  return {
    count: solves.length,
    best: formatMs(bestSingle(solves)),
    ao5: formatMs(averageOfN(solves, 5)),
    ao12: formatMs(averageOfN(solves, 12)),
    mean: formatMs(meanOfAll(solves)),
  };
}

export default function CrossSessionStats({ event, isZh }: Props) {
  const { rows, all } = useMemo(() => {
    const data = loadAllSessionData();
    const activeId = getActiveSessionId();

    const rows: Row[] = [];
    const combined: Solve[] = [];

    for (const { session, byEvent } of data) {
      const solves = byEvent[event] ?? [];
      if (solves.length === 0) continue;
      combined.push(...solves);
      const m = metricsOf(solves);
      rows.push({
        id: session.id,
        name: session.name,
        active: session.id === activeId,
        ...m,
      });
    }

    combined.sort((a, b) => a.ts - b.ts);
    const all = metricsOf(combined);
    return { rows, all };
  }, [event]);

  if (rows.length === 0) {
    return (
      <div className="xsess-empty">
        {isZh ? '暂无数据' : 'No data yet'}
      </div>
    );
  }

  return (
    <div className="xsess-scroll">
      <table className="xsess-table">
        <thead>
          <tr>
            <th className="xsess-name-col">{isZh ? '分组' : 'Session'}</th>
            <th className="xsess-num">n</th>
            <th className="xsess-num">best</th>
            <th className="xsess-num">ao5</th>
            <th className="xsess-num">ao12</th>
            <th className="xsess-num">{isZh ? '平均' : 'mean'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.active ? 'xsess-active' : ''}>
              <td className="xsess-name-col">{r.name}</td>
              <td className="xsess-num">{r.count}</td>
              <td className={`xsess-num${isEmptyVal(r.best) ? ' muted' : ''}`}>{r.best}</td>
              <td className={`xsess-num${isEmptyVal(r.ao5) ? ' muted' : ''}`}>{r.ao5}</td>
              <td className={`xsess-num${isEmptyVal(r.ao12) ? ' muted' : ''}`}>{r.ao12}</td>
              <td className={`xsess-num${isEmptyVal(r.mean) ? ' muted' : ''}`}>{r.mean}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="xsess-all">
            <td className="xsess-name-col">{isZh ? '合计' : 'All'}</td>
            <td className="xsess-num">{all.count}</td>
            <td className={`xsess-num${isEmptyVal(all.best) ? ' muted' : ''}`}>{all.best}</td>
            <td className={`xsess-num${isEmptyVal(all.ao5) ? ' muted' : ''}`}>{all.ao5}</td>
            <td className={`xsess-num${isEmptyVal(all.ao12) ? ' muted' : ''}`}>{all.ao12}</td>
            <td className={`xsess-num${isEmptyVal(all.mean) ? ' muted' : ''}`}>{all.mean}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
