'use client';
// 项目统计 tab:每行一个项目,列 = 首次参赛 / 最后参赛 / 比赛次数 / 轮次次数 / 尝试 / 成功 / 失败.

import { useMemo, useState } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import i18n from "@/i18n/i18n-client";

interface Props {
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

type Col = 'event' | 'first' | 'last' | 'comps' | 'rounds' | 'attempts' | 'solves' | 'fails';

interface Row {
  eventId: string;
  first: string;
  last: string;
  comps: number;
  rounds: number;
  attempts: number;
  solves: number;
  fails: number;
}

export default function EventStatsTab({ results, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [sort, setSort] = useState<{ col: Col; dir: 'asc' | 'desc' }>({ col: 'event', dir: 'asc' });

  const rows = useMemo<Row[] | null>(() => {
    if (!results || !comps) return null;
    const compDate = new Map(comps.map((c) => [c.id, c.start_date]));
    const byEvent = new Map<string, {
      compIds: Set<string>;
      rounds: number;
      attempts: number;
      solves: number;
      fails: number;
      first: string; last: string;
    }>();
    for (const r of results) {
      const cur = byEvent.get(r.event_id) ?? {
        compIds: new Set<string>(), rounds: 0, attempts: 0, solves: 0, fails: 0,
        first: '', last: '',
      };
      cur.compIds.add(r.competition_id);
      cur.rounds++;
      const date = compDate.get(r.competition_id) ?? '';
      if (date && (cur.first === '' || date < cur.first)) cur.first = date;
      if (date && (cur.last === '' || date > cur.last)) cur.last = date;
      for (const a of r.attempts) {
        if (a === 0) continue;
        cur.attempts++;
        if (a > 0) cur.solves++;
        else cur.fails++; // -1 (DNF) and -2 (DNS) both count as fail attempt
      }
      byEvent.set(r.event_id, cur);
    }
    const out: Row[] = [];
    for (const eid of ALL_EVENT_IDS) {
      const v = byEvent.get(eid);
      if (!v) continue;
      out.push({
        eventId: eid,
        first: v.first, last: v.last,
        comps: v.compIds.size, rounds: v.rounds,
        attempts: v.attempts, solves: v.solves, fails: v.fails,
      });
    }
    return out;
  }, [results, comps]);

  if (!rows) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;
  if (rows.length === 0) return <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>;

  const sorted = rows.slice().sort((a, b) => {
    let cmp = 0;
    switch (sort.col) {
      case 'event':
        cmp = ALL_EVENT_IDS.indexOf(a.eventId) - ALL_EVENT_IDS.indexOf(b.eventId);
        break;
      case 'first': cmp = a.first.localeCompare(b.first); break;
      case 'last':  cmp = a.last.localeCompare(b.last); break;
      case 'comps': cmp = a.comps - b.comps; break;
      case 'rounds':cmp = a.rounds - b.rounds; break;
      case 'attempts':cmp = a.attempts - b.attempts; break;
      case 'solves':  cmp = a.solves - b.solves; break;
      case 'fails':   cmp = a.fails - b.fails; break;
    }
    return cmp * (sort.dir === 'asc' ? 1 : -1);
  });

  const toggle = (col: Col) => setSort((s) =>
    s.col === col
      ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: col === 'event' ? 'asc' : 'desc' });

  const Arrow = ({ col }: { col: Col }) => sort.col !== col ? null
    : sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;

  return (
    <div className="wp-table-scroll">
      <table className="wp-event-stats-table">
        <thead>
          <tr>
            <th onClick={() => toggle('event')} className="wp-th-sortable">{t('项目', 'Event')} <Arrow col="event" /></th>
            <th onClick={() => toggle('first')} className="wp-th-sortable">{t('首次参赛', 'First')} <Arrow col="first" /></th>
            <th onClick={() => toggle('last')} className="wp-th-sortable">{t('最后参赛', 'Last')} <Arrow col="last" /></th>
            <th onClick={() => toggle('comps')} className="wp-th-sortable">{t('比赛次数', 'Comps')} <Arrow col="comps" /></th>
            <th onClick={() => toggle('rounds')} className="wp-th-sortable">{t('轮次次数', 'Rounds')} <Arrow col="rounds" /></th>
            <th onClick={() => toggle('attempts')} className="wp-th-sortable">{t('尝试数', 'Attempts')} <Arrow col="attempts" /></th>
            <th onClick={() => toggle('solves')} className="wp-th-sortable">{t('成功数', 'Solves')} <Arrow col="solves" /></th>
            <th onClick={() => toggle('fails')} className="wp-th-sortable">{t('失败数', 'Fails')} <Arrow col="fails" /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.eventId}>
              <th scope="row" className="wp-cell-event">
                <EventIcon event={r.eventId} className="wp-event-icon" />
              </th>
              <td className="wp-cell-mono">{r.first || '—'}</td>
              <td className="wp-cell-mono">{r.last || '—'}</td>
              <td className="wp-cell-num">{r.comps}</td>
              <td className="wp-cell-num">{r.rounds}</td>
              <td className="wp-cell-num">{r.attempts}</td>
              <td className="wp-cell-num">{r.solves}</td>
              <td className="wp-cell-num wp-cell-fail">{r.fails}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
