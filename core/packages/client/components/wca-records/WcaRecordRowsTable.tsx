'use client';

import { useMemo } from 'react';
import AppLink from '@/components/AppLink';
import { CompCell } from '@/components/CompCell/CompCell';
import { EventIcon } from '@/components/EventIcon';
import { Flag } from '@/components/Flag';
import PersonLink from '@/components/PersonLink';
import { RecordBadge } from '@/components/RecordBadge';
import {
  WcaTeacherCell,
  WcaTeacherColumnHeader,
  type WcaTeacherDirectory,
} from '@/components/WcaTeacherCell';
import { AttemptCells, AttemptHeaderCells } from '@/components/wca-results/AttemptsGrid';
import { tr } from '@/i18n/tr';
import { compLinkProps } from '@/lib/comp-link';
import { personFlagIso2 } from '@/lib/country-flags';
import { eventDisplayName } from '@/lib/wca-events';
import { formatDateRangeIso } from '@/lib/wca-date';
import { formatWcaResult } from '@/lib/wca-format-result';

export interface WcaRecordRowsTableRow {
  /** WCA event id. */
  e: string;
  /** Single or average. */
  t: 's' | 'a';
  /** Raw WCA result value. */
  v: number;
  /** Exact record marker. */
  l: string;
  /** WCA person id and raw name. */
  p: string;
  pn: string;
  /** Optional ISO2 override; otherwise the shared person flag index is used. */
  pc?: string;
  /** WCA competition id and raw name. */
  c: string;
  cn: string;
  /** ISO start and optional end date. */
  d: string;
  de?: string;
  /** Ordered round attempts. */
  a: number[] | null;
}

interface WcaRecordRowsTableProps {
  rows: WcaRecordRowsTableRow[];
  isZh: boolean;
  showEvent: boolean;
  showRank?: boolean;
  teacherDirectory: WcaTeacherDirectory;
}

export function WcaRecordRowsTable({
  rows,
  isZh,
  showEvent,
  showRank = true,
  teacherDirectory,
}: WcaRecordRowsTableProps) {
  const ranks = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.e}-${row.t}`;
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    return rows.map((row) => {
      const key = `${row.e}-${row.t}`;
      const previous = seen.get(key) ?? 0;
      seen.set(key, previous + 1);
      return (totals.get(key) ?? 0) - previous;
    });
  }, [rows]);
  const attemptCols = useMemo(
    () => Math.min(5, rows.reduce((max, row) => Math.max(max, row.a?.length ?? 0), 0)),
    [rows],
  );

  return (
    <table className={`wse-table wca-record-rows-table sticky-thead${showEvent ? ' wse-multi-event' : ''}`}>
      <thead>
        <tr>
          <th>{tr({ zh: '类型', en: 'Type' })}</th>
          {showEvent && <th>{tr({ zh: '项目', en: 'Event' })}</th>}
          <th className="wse-value-col">{tr({ zh: '单次', en: 'Single' })}</th>
          <th className="wse-value-col">{tr({ zh: '平均', en: 'Average' })}</th>
          <th>{tr({ zh: '选手', en: 'Person' })}</th>
          <WcaTeacherColumnHeader />
          <th>{tr({ zh: '比赛', en: 'Competition' })}</th>
          <th>{tr({ zh: '日期', en: 'Date' })}</th>
          <AttemptHeaderCells count={attemptCols} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const personIso2 = row.pc || personFlagIso2(row.p);
          return (
            <tr key={`${row.p}-${row.c}-${row.e}-${row.t}-${index}`}>
              <td>
                <RecordBadge record={row.l} />
                {showRank && <>{' '}<span className="wca-record-rank">#{ranks[index]}</span></>}
              </td>
              {showEvent && (
                <td>
                  <EventIcon event={row.e} />{' '}
                  <span>{eventDisplayName(row.e, isZh)}</span>
                </td>
              )}
              <td className="wse-value-col">
                {row.t === 's' ? formatWcaResult(row.v, row.e, 'single') : ''}
              </td>
              <td className="wse-value-col">
                {row.t === 'a' ? formatWcaResult(row.v, row.e, 'average') : ''}
              </td>
              <td>
                {personIso2 && (
                  <Flag iso2={personIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />
                )}{' '}
                <PersonLink wcaId={row.p} name={row.pn} isZh={isZh} />
              </td>
              <td>
                <WcaTeacherCell
                  studentWcaId={row.p}
                  eventIds={[row.e]}
                  directory={teacherDirectory}
                  isZh={isZh}
                />
              </td>
              <td>
                <AppLink {...compLinkProps(row.c)}>
                  <CompCell compId={row.c} compName={row.cn} isZh={isZh} date={row.d} />
                </AppLink>
              </td>
              <td className="wse-detail-cell">{formatDateRangeIso(row.d, row.de ?? row.d)}</td>
              <AttemptCells attempts={row.a} eventId={row.e} count={attemptCols} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
