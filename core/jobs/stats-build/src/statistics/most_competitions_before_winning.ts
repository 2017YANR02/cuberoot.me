// NOTE: 首次获胜前参加最多比赛
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

export class MostCompetitionsBeforeWinning extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most competitions before winning';
    this.titleZh = '首次获胜前参加最多比赛';
    this.note = 'Only those competitions count, which held the given event.';
    this.noteZh = '仅统计举办了对应项目的比赛。';
    this.tableHeader = {
      'Competitions': 'right',
      'Person': 'left',
      'First win': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        event_id,
        pos place,
        round_type.final is_final,
        best
      FROM results
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      ORDER BY start_date
    `;
  }

  // NOTE: 按项目→选手→比赛找首次获胜的索引
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      const eventRows = rows.filter(r => r['event_id'] === eventId);

      // NOTE: 按选手分组
      const byPerson = new Map<string, RowDataPacket[]>();
      for (const r of eventRows) {
        const key = r['person_link'] as string;
        if (!byPerson.has(key)) byPerson.set(key, []);
        byPerson.get(key)!.push(r);
      }

      const results: [number, string, string][] = [];

      for (const [personLink, personRows] of byPerson) {
        // NOTE: 按比赛分组，判断每场比赛是否获胜
        const byComp = new Map<string, RowDataPacket[]>();
        const compOrder: string[] = [];
        for (const r of personRows) {
          const comp = r['competition_link'] as string;
          if (!byComp.has(comp)) {
            byComp.set(comp, []);
            compOrder.push(comp);
          }
          byComp.get(comp)!.push(r);
        }

        const compsWithOutcomes = compOrder.map(comp => {
          const compRows = byComp.get(comp)!;
          const won = compRows.some(r =>
            r['is_final'] === 1 && Number(r['place']) === 1 && Number(r['best']) > 0
          );
          return { comp, won };
        });

        const firstWinIdx = compsWithOutcomes.findIndex(c => c.won);
        if (firstWinIdx >= 0) {
          results.push([firstWinIdx, personLink, compsWithOutcomes[firstWinIdx].comp]);
        }
      }

      const sorted = results
        .sort((a, b) => b[0] - a[0])
        .slice(0, 10);

      return [eventName, sorted] as [string, unknown[][]];
    });
  }
}
