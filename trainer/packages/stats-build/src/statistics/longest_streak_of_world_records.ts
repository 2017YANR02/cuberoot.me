// NOTE: 最长连续世界纪录
// 与 Ruby _stats_build/statistics/longest_streak_of_world_records.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

export class LongestStreakOfWorldRecords extends Statistic {
  constructor() {
    super();
    this.title = 'Longest streak of world records of the same type in the given event';
    this.titleZh = '同一项目同一类型最长连续世界纪录';
    this.tableHeader = {
      'Records': 'right',
      'Event': 'left',
      'Type': 'left',
      'Person': 'left',
      'Started at': 'left',
      'Ended at': 'left',
      'Years': 'right',
    };
  }

  query(): string {
    return `
      SELECT
        regional_single_record,
        regional_average_record,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date competition_date,
        event_id
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE regional_single_record = 'WR' OR regional_average_record = 'WR'
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——按(项目, 类型)追踪同一选手连续 WR 数
  transform(rows: RowDataPacket[]): unknown[][] {
    interface WrStreak {
      count: number; event: string; type: string; personLink: string;
      startDate: Date; endDate: Date;
      firstCompetition: string; lastCompetition: string | null;
    }

    const today = new Date();
    const allStreaks: WrStreak[] = [];

    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      for (const type of ['single', 'average']) {
        const recordField = type === 'single' ? 'regional_single_record' : 'regional_average_record';

        // NOTE: 筛选当前项目+类型的 WR 记录
        const eventRows = rows
          .filter(r => r['event_id'] === eventId && r[recordField] === 'WR')
          .sort((a, b) => {
            // NOTE: 按日期正序，同日期内按成绩降序（与 Ruby 一致）
            const dateA = new Date(a['competition_date'] as Date);
            const dateB = new Date(b['competition_date'] as Date);
            if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
            return Number(b[type]) - Number(a[type]);
          });

        // NOTE: reduce 追踪连续 WR 持有者
        const wrStreaks: WrStreak[] = [];
        for (const result of eventRows) {
          const current = wrStreaks[wrStreaks.length - 1];
          if (current && result['person_link'] === current.personLink) {
            current.count += 1;
          } else {
            if (current) {
              current.lastCompetition = result['competition_link'] as string;
              current.endDate = new Date(result['competition_date'] as Date);
            }
            wrStreaks.push({
              count: 1,
              event: eventName,
              type: type.charAt(0).toUpperCase() + type.slice(1),
              personLink: result['person_link'] as string,
              startDate: new Date(result['competition_date'] as Date),
              endDate: today,
              firstCompetition: result['competition_link'] as string,
              lastCompetition: null,
            });
          }
        }

        allStreaks.push(...wrStreaks);
      }
    }

    return allStreaks
      .filter(s => s.count > 1)
      .sort((a, b) => b.count - a.count)
      .map(s => {
        const years = (s.endDate.getTime() - s.startDate.getTime()) / (365.25 * 24 * 3600 * 1000);
        return [s.count, s.event, s.type, s.personLink, s.firstCompetition, s.lastCompetition, years.toFixed(2)];
      });
  }
}
