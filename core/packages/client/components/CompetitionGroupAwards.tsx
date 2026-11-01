'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import { CompCell } from '@/components/CompCell/CompCell';
import { formatWcaResult } from '@/lib/wca-format-result';
import { formatDateRangeIso } from '@/lib/wca-date';
import { eventDisplayName } from '@/lib/wca-events';
import { useT } from '@/hooks/useT';
import type { CompetitionGroupAward } from '@/lib/competition-group-awards';
import { AttemptsInline } from '@/components/AttemptsInline';
import './competition-group-awards.css';

export function groupAwardAnchor(row: CompetitionGroupAward) {
  return 'group-award-' + row.eventId + '-' + row.groupKey.replaceAll(':', '-');
}
export default function CompetitionGroupAwards({ rows, isZh, personal = false, stale = false, error = false, renderTable }: {
  rows: CompetitionGroupAward[]; isZh: boolean; personal?: boolean; stale?: boolean; error?: boolean;
  renderTable?: (rows: CompetitionGroupAward[]) => ReactNode;
}) {
  const t = useT();
  const [event, setEvent] = useState('');
  const [category, setCategory] = useState('');
  const label = (r: CompetitionGroupAward) => r.group.type === 'age' ? (r.group.under ? 'U' : 'O') + r.group.age
    : r.group.type === 'female' ? t('女子组', 'Female') : t('新人组', 'Newcomer');
  const categoryId = (r: CompetitionGroupAward) => [r.group.type, r.group.age, r.group.under].join(':');
  const events = useMemo(() => new Set(rows.map(r => r.eventId)), [rows]);
  const categories = [...new Map(rows.filter(r => !event || r.eventId === event).map(r => [categoryId(r), r])).entries()];
  const filtered = rows.filter(r => (!event || r.eventId === event) && (!category || categoryId(r) === category));
  const grouped = new Map<string, CompetitionGroupAward[]>();
  for (const row of filtered) {
    const key = [row.competitionId, row.eventId, row.groupKey, row.roundNumber].join('/');
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  const groups = [...grouped.values()];
  const scrolledHash = useRef('');
  useEffect(() => {
    const hash = window.location.hash;
    if (personal || !hash.startsWith('#group-award-') || scrolledHash.current === hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) { target.scrollIntoView({ block: 'start' }); scrolledHash.current = hash; }
  }, [personal, rows]);
  const medals = [1, 2, 3].map(place => rows.filter(r => r.place === place && !r.provisional).length);
  if (!rows.length) return error ? <p role="status">{t('分组获奖暂时无法加载', 'Category awards are temporarily unavailable')}</p> : null;
  return <section className={`group-awards${renderTable ? ' comp-podiums' : ''}`} aria-label={t('分组获奖', 'Category awards')}>
    {!personal && <h2>{t('分组获奖', 'Category awards')}</h2>}
    <div className="group-awards-toolbar">
      {personal && <span>{t('已收录', 'Collected')} · {t('金', 'Gold')} {medals[0]} · {t('银', 'Silver')} {medals[1]} · {t('铜', 'Bronze')} {medals[2]}</span>}
      {events.size > 1 && <WcaEventSelector availableEvents={events} selectedEvent={event} onSelect={value => { setEvent(value); setCategory(''); }} allowAll isZh={isZh} />}
      {categories.length > 1 && <label>{t('组别', 'Category')} <select aria-label={t('组别', 'Category')} value={category} onChange={e => setCategory(e.target.value)}>
        <option value="">{t('全部', 'All')}</option>
        {categories.map(([key, row]) => <option key={key} value={key}>{label(row)}</option>)}
      </select></label>}
      {(stale || error) && <span role="status">{t('更新暂不可用，显示已保存记录', 'Update unavailable; showing saved records')}</span>}
    </div>
    {groups.map(group => {
      const first = group[0];
      const roundLabel = first.roundNumber === 1 ? t('首轮', 'Opening round') : t('第', 'Round ') + first.roundNumber + t('轮', '');
      return <section key={first.competitionId + groupAwardAnchor(first)} id={(personal ? first.competitionId + '-' : '') + groupAwardAnchor(first)} className="group-awards-group">
        {personal && <div className="group-awards-competition"><AppLink href={'/wca/comp/' + first.competitionId + '?view=podium#' + groupAwardAnchor(first)} prefetch={false}>
          <CompCell compId={first.competitionId} compName={first.competitionName} isZh={isZh} date={first.date} />
        </AppLink><time>{formatDateRangeIso(first.date, first.endDate)}</time></div>}
        <h3 className={renderTable ? 'comp-podium-event' : undefined}>{!personal && <><EventIcon event={first.eventId} className={renderTable ? 'comp-podium-icon' : undefined} /> {eventDisplayName(first.eventId, isZh)} · </>}{label(first)} <small>{roundLabel}{first.provisional ? ' · ' + t('暂定', 'Provisional') : ''}</small>
          <a href={first.sourceUrl} target="_blank" rel="noopener noreferrer">{t('来源', 'Source')}</a></h3>
        {renderTable ? renderTable(group) : <div className="wp-records sticky-scroll"><table className="wp-bycomp-table wp-podium-table sticky-thead"><thead><tr>
          <th scope="col">{t('项目', 'Event')}</th><th scope="col" className="wp-th-narrow">{t('名次', 'Place')}</th>
          <th scope="col">{t('单次', 'Single')}</th><th scope="col">{t('平均', 'Average')}</th><th scope="col" className="wp-th-attempts">{t('详细成绩', 'Solves')}</th>
        </tr></thead><tbody>{group.map(row => <tr key={row.sourcePersonId}>
          <th scope="row" className="wp-cell-event"><span className="wp-rec-event"><EventIcon event={row.eventId} className="wp-event-icon" title={eventDisplayName(row.eventId, isZh)} /></span></th>
          <td className={`wp-cell-pos wp-podium-place-${row.place}`}>{row.place}</td>
          <td className="wp-cell-result"><span className="record-num-cell">{formatWcaResult(row.best, row.eventId, 'single')}</span></td>
          <td className="wp-cell-result"><span className="record-num-cell">{row.average > 0 ? formatWcaResult(row.average, row.eventId, 'average') : '—'}</span></td>
          <td className="wp-cell-attempts"><AttemptsInline attempts={row.attempts} best={row.best} eventId={row.eventId} /></td>
        </tr>)}</tbody></table></div>}
      </section>;
    })}
  </section>;
}
