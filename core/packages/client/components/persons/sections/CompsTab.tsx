'use client';
// 赛事 tab:全部参赛比赛列表.每行 (序号 / 时间 / 比赛名 / 项目图标条).
// 项目图标:选手在该比赛参加过 → 实色;比赛设了但选手没参 → 灰色.

import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { formatDateRangeIso } from '@/lib/wca-date';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import i18n from "@/i18n/i18n-client";

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

type SortBy = 'date' | 'name';
type SortDir = 'asc' | 'desc';

export default function CompsTab({ profile, results, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [dir, setDir] = useState<SortDir>('desc');

  const eventsByComp = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (results) {
      for (const r of results) {
        const s = m.get(r.competition_id);
        if (s) s.add(r.event_id);
        else m.set(r.competition_id, new Set([r.event_id]));
      }
    }
    return m;
  }, [results]);

  const sorted = useMemo(() => {
    if (!comps) return null;
    const arr = comps.slice();
    arr.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * (dir === 'asc' ? 1 : -1);
      return a.start_date.localeCompare(b.start_date) * (dir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [comps, sortBy, dir]);

  if (!comps) return <div className="wp-loading-inline">{t('加载比赛历史…', 'Loading competitions…')}</div>;
  if (comps.length === 0) return <div className="wp-empty">{t('暂无比赛记录', 'No competitions')}</div>;

  const total = comps.length;
  const toggleSort = (col: SortBy) => {
    if (sortBy === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setDir(col === 'date' ? 'desc' : 'asc'); }
  };
  const SortArrow = ({ col }: { col: SortBy }) => sortBy !== col ? null
    : dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;

  return (
    <div className="wp-table-scroll">
      <table className="wp-comps-table">
        <thead>
          <tr>
            <th className="wp-th-narrow">{t('序号', '#')}</th>
            <th className="wp-th-sortable" onClick={() => toggleSort('date')}>
              {t('时间', 'Date')} <SortArrow col="date" />
            </th>
            <th className="wp-th-sortable" onClick={() => toggleSort('name')}>
              {t('比赛名称', 'Competition')} <SortArrow col="name" />
            </th>
            <th>{t('项目', 'Events')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted!.map((c, i) => {
            const idx = dir === 'desc' ? i + 1 : (total - i);
            const entered = eventsByComp.get(c.id) ?? new Set();
            return (
              <tr key={c.id}>
                <td className="wp-cell-narrow wp-cell-mono">{idx}</td>
                <td className="wp-cell-mono wp-cell-date">{formatDateRangeIso(c.start_date, c.end_date)}</td>
                <td className="wp-cell-comp">
                  <Link
                    {...compLinkProps(c.id)}
                    className="wp-link-comp"
                  ><CompCell compId={c.id} compName={c.name} isZh={isZh} /></Link>
                </td>
                <td className="wp-cell-events">
                  <span className="wp-event-strip">
                    {ALL_EVENT_IDS.map((eid) =>
                      entered.has(eid)
                        ? <EventIcon key={eid} event={eid} className="wp-event-icon-sm" title={eid} />
                        : null,
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="wp-table-footer">
        {t(`共 ${total} 场`, `${total} competitions total`)} · {t('选手 WCA ID', 'WCA ID')} {profile.person.wca_id}
      </div>
    </div>
  );
}
