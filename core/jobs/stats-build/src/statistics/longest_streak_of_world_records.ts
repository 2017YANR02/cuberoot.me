// NOTE: 最长连续世界纪录
import { Statistic, type StatJson } from '../core/statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import { query as dbQuery } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: WCA 已停办项目（脚拧 / 八板 / 十二板 / 旧多盲）
// 这些项目的最后一次 WR streak 截止于该项目最后一场比赛，而非"至今"
const DISCONTINUED_EVENTS: readonly string[] = ['333ft', 'magic', 'mmagic', '333mbo'];

export class LongestStreakOfWorldRecords extends Statistic {
  private lastCompByEvent: Record<string, { compLink: string; date: Date }> = {};

  constructor() {
    super();
    this.title = 'Longest streak of world records of the same type in the given event';
    this.titleZh = '同一项目同一类型最长连续世界纪录';
    this.tableHeader = {
      'Years': 'right',
      'Records': 'right',
      'Event': 'left',
      'Type': 'left',
      'Person': 'left',
      'Started at': 'left',
      'Ended at': 'left',
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

  // NOTE: 在 transform 之前预取停办项目的最后一场比赛
  async toJson(): Promise<StatJson> {
    const list = DISCONTINUED_EVENTS.map(e => `'${e}'`).join(',');
    const rows = await dbQuery<RowDataPacket[]>(`
      SELECT DISTINCT r.event_id, c.id AS comp_id, c.cell_name, c.start_date
      FROM results r
      JOIN competitions c ON c.id = r.competition_id
      WHERE r.event_id IN (${list})
      ORDER BY r.event_id, c.start_date DESC
    `);
    for (const row of rows) {
      const eid = row['event_id'] as string;
      if (!this.lastCompByEvent[eid]) {
        this.lastCompByEvent[eid] = {
          compLink: `[${row['cell_name']}](https://www.worldcubeassociation.org/competitions/${row['comp_id']})`,
          date: new Date(row['start_date'] as Date),
        };
      }
    }
    return super.toJson();
  }

  // NOTE: 按(项目, 类型)追踪同一选手连续 WR 数
  transform(rows: RowDataPacket[]): unknown[][] {
    interface WrStreak {
      count: number; eventId: string; event: string; type: string; personLink: string;
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
            // NOTE: 按日期正序，同日期内按成绩降序
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
              eventId,
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
      .map(s => {
        // NOTE: 进行中的 streak（无后续 WR）—— 停办项目截到该项目最后一场比赛；现役项目标"至今"
        let lastComp: string;
        let endDate = s.endDate;
        if (s.lastCompetition === null) {
          if (DISCONTINUED_EVENTS.includes(s.eventId) && this.lastCompByEvent[s.eventId]) {
            const last = this.lastCompByEvent[s.eventId];
            lastComp = last.compLink;
            endDate = last.date;
          } else {
            lastComp = 'Still active';
          }
        } else {
          lastComp = s.lastCompetition;
        }
        const years = (endDate.getTime() - s.startDate.getTime()) / (365.25 * 24 * 3600 * 1000);
        return { s, lastComp, years };
      })
      .sort((a, b) => b.years - a.years)
      .map(({ s, lastComp, years }) => [
        years.toFixed(2), s.count, s.event, s.type, s.personLink, s.firstCompetition, lastComp,
      ]);
  }
}
