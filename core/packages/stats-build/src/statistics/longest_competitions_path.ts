// NOTE: 最长比赛路径（参赛选手总行程距离）
// 与 Ruby _stats_build/statistics/longest_competitions_path.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: Haversine 公式计算两点之间的距离（公里）
// 参考: http://www.movable-type.co.uk/scripts/latlong.html
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球半径（公里）
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class LongestCompetitionsPath extends Statistic {
  constructor() {
    super();
    this.title = 'Longest competitions path';
    this.titleZh = '最长比赛路径';
    this.note = 'Calculated as the sum of direct distance between subsequent competitions.';
    this.noteZh = '按连续参加比赛之间的直线距离之和计算。';
    this.tableHeader = {
      'Person': 'left',
      'Distance': 'right',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        RADIANS(latitude / 1000000) latitude_radians,
        RADIANS(longitude / 1000000) longitude_radians
      FROM (
        SELECT DISTINCT person_id, competition_id
        FROM results
      ) AS people_with_competitions
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE competition.country_id
        NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
      ORDER BY competition.start_date, competition.end_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 按选手分组 → 计算连续比赛间距离之和 → 降序排列 → 格式化为 "123 456 km"
  transform(rows: RowDataPacket[]): unknown[][] {
    // NOTE: 按选手分组
    const groups = new Map<string, Array<{ lat: number; lon: number }>>();
    for (const row of rows) {
      const key = row['person_link'] as string;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({
        lat: Number(row['latitude_radians']),
        lon: Number(row['longitude_radians']),
      });
    }

    // NOTE: 计算每个选手的总行程距离
    const results: [string, number][] = [];
    for (const [personLink, coords] of groups) {
      let total = 0;
      for (let i = 1; i < coords.length; i++) {
        total += distanceKm(coords[i - 1].lat, coords[i - 1].lon, coords[i].lat, coords[i].lon);
      }
      results.push([personLink, Math.round(total)]);
    }

    // NOTE: 降序排列，格式化距离为千位分隔符 + "km"
    return results
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1000)
      .map(([personLink, dist]) => {
        // NOTE: 与 Ruby gsub(/(\\d)(?=\\d{3}+$)/, '\\1 ') 一致——千位空格分隔
        const distStr = dist.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
        return [personLink, distStr];
      });
  }
}
