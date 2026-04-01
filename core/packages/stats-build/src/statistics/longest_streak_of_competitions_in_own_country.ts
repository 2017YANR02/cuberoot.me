// NOTE: 在本国最长连续参赛
// 与 Ruby _stats_build/statistics/longest_streak_of_competitions_in_own_country.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class LongestStreakOfCompetitionsInOwnCountry extends Statistic {
  constructor() {
    super();
    this.title = 'Longest streak of competitions in own country';
    this.titleZh = '在本国最长连续参赛';
    this.note = "The streak ends whenever the person doesn't participate in a competition in own country.";
    this.noteZh = '当选手未参加本国某场比赛时，连续记录中断。';
    this.tableHeader = {
      'Competitions': 'right',
      'Person': 'left',
      'Country': 'left',
      'Started at': 'left',
      'Missed': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        country.name country
      FROM (
        SELECT DISTINCT person_id, competition_id
        FROM results
      ) AS people_with_competitions
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = competition.country_id
      WHERE competition.country_id = person.country_id
      ORDER BY competition.start_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——按国家分组、追踪每人连续参赛记录
  transform(rows: RowDataPacket[]): unknown[][] {
    interface Streak { count: number; firstCompetition: string | null; lastCompetition: string | null; country: string }

    // NOTE: 按国家分组
    const byCountry = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const country = row['country'] as string;
      if (!byCountry.has(country)) byCountry.set(country, []);
      byCountry.get(country)!.push(row);
    }

    const allStreaks: [string, Streak][] = [];

    for (const [country, countryRows] of byCountry) {
      const longestByPerson = new Map<string, Streak>();
      const currentByPerson = new Map<string, Streak>();

      // NOTE: 按比赛分组（同一比赛的所有选手）
      const byCompetition = new Map<string, string[]>();
      const competitionOrder: string[] = [];
      for (const row of countryRows) {
        const comp = row['competition_link'] as string;
        const person = row['person_link'] as string;
        if (!byCompetition.has(comp)) {
          byCompetition.set(comp, []);
          competitionOrder.push(comp);
        }
        if (!byCompetition.get(comp)!.includes(person)) {
          byCompetition.get(comp)!.push(person);
        }
      }

      for (const compLink of competitionOrder) {
        const people = byCompetition.get(compLink)!;

        // NOTE: 初始化新出现的选手
        for (const person of people) {
          if (!currentByPerson.has(person)) {
            currentByPerson.set(person, { count: 0, firstCompetition: compLink, lastCompetition: null, country });
          }
        }

        // NOTE: 检查每个正在追踪的选手
        for (const [person, current] of currentByPerson) {
          if (people.includes(person)) {
            current.count += 1;
            const longest = longestByPerson.get(person);
            if (!longest || current.count > longest.count) {
              longestByPerson.set(person, { ...current });
            }
          } else if (current) {
            current.lastCompetition = compLink;
            currentByPerson.delete(person);
          }
        }
      }

      // NOTE: 收集所有选手的最长连续记录
      for (const [person, streak] of longestByPerson) {
        allStreaks.push([person, streak]);
      }
    }

    return allStreaks
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 100)
      .map(([personLink, streak]) => [
        streak.count,
        personLink,
        streak.country,
        streak.firstCompetition,
        streak.lastCompetition,
      ]);
  }
}
