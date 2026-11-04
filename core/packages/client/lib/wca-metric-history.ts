import type { StatHeader, StatSection } from '@/components/wca-stats/WcaStatView.types';
import { EVENT_NAME_TO_ID } from './event-constants';

/** Change presentation only: keep every record, every cell and every tie. */
export function mixedMetricHistory(header: StatHeader[], sections: StatSection[], event: string | undefined, isZh: boolean) {
  const dateIndex = header.findIndex(column => column.key === 'date');
  const rows = sections
    .filter(section => !event || EVENT_NAME_TO_ID[section.title] === event)
    .flatMap(section => section.rows.map(row => ({ section, row })))
    .sort((a, b) => dateIndex < 0 ? 0 : String(b.row[dateIndex]).localeCompare(String(a.row[dateIndex])))
    .map(({ section, row }) => event ? row : [isZh ? section.titleZh ?? section.title : section.title, ...row]);
  return {
    header: event ? header : [{ key: 'event', label: 'Event', labelZh: '项目', align: 'left' } as StatHeader, ...header],
    rows,
  };
}
