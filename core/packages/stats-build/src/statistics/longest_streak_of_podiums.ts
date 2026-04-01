// NOTE: 最长连续登台记录
// 与 Ruby _stats_build/statistics/longest_streak_of_podiums.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class LongestStreakOfPodiums extends Statistic {
  constructor() {
    super();
    this.title = 'Longest streak of podiums';
    this.titleZh = '最长连续登台记录';
    this.note = 'All competitions that did not hold the given event are ignored. '
      + 'Results without any completed attempt are not eligible for podium. '
      + 'Only finals are taken into account.';
    this.noteZh = '忽略未举办指定项目的比赛。无有效成绩的结果不计入领奖台。仅统计决赛。';
    this.tableHeader = {
      'Count': 'right',
      'Person': 'left',
      'Event': 'left',
      'Started at': 'left',
      'Ended at': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        event.name event_name,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        round_type.final is_final,
        pos place,
        best single
      FROM results
      JOIN events event ON event.id = event_id
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      ORDER BY competition.start_date, round_type.rank
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——按选手→按(比赛+项目)追踪连续登台记录
  transform(rows: RowDataPacket[]): unknown[][] {
    interface Streak {
      eventName: string; count: number; personLink: string;
      firstCompetition: string; lastCompetition: string | null;
    }

    // NOTE: 按选手分组
    const byPerson = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const key = row['person_link'] as string;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(row);
    }

    const allStreaks: Streak[] = [];

    for (const [personLink, personRows] of byPerson) {
      const podiumsStreaks: Streak[] = [];
      const currentByEvent = new Map<string, Streak>();

      // NOTE: 按 (比赛, 项目) 分组
      const groups = new Map<string, RowDataPacket[]>();
      const groupOrder: string[] = [];
      for (const row of personRows) {
        const key = `${row['competition_link']}|||${row['event_name']}`;
        if (!groups.has(key)) {
          groups.set(key, []);
          groupOrder.push(key);
        }
        groups.get(key)!.push(row);
      }

      for (const groupKey of groupOrder) {
        const groupRows = groups.get(groupKey)!;
        const compLink = groupRows[0]['competition_link'] as string;
        const eventName = groupRows[0]['event_name'] as string;

        if (!currentByEvent.has(eventName)) {
          currentByEvent.set(eventName, {
            eventName, count: 0, personLink, firstCompetition: compLink, lastCompetition: null,
          });
        }
        const current = currentByEvent.get(eventName)!;

        // NOTE: 取该比赛中该项目的最后一轮结果
        const lastRound = groupRows[groupRows.length - 1];
        if (lastRound['is_final'] === 1 && Number(lastRound['place']) <= 3 && Number(lastRound['single']) > 0) {
          current.count += 1;
        } else {
          current.lastCompetition = compLink;
          podiumsStreaks.push(current);
          currentByEvent.delete(eventName);
        }
      }

      // NOTE: 加入仍在进行中的连续记录
      for (const streak of currentByEvent.values()) {
        podiumsStreaks.push(streak);
      }

      allStreaks.push(...podiumsStreaks);
    }

    return allStreaks
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map(s => [s.count, s.personLink, s.eventName, s.firstCompetition, s.lastCompetition]);
  }
}
