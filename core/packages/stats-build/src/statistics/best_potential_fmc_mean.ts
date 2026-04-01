// NOTE: 最佳潜在 FMC 平均
// 与 Ruby _stats_build/statistics/best_potential_fmc_mean.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class BestPotentialFmcMean extends Statistic {
  constructor() {
    super();
    this.title = 'Best potential FMC mean';
    this.titleZh = '最佳潜在 FMC 平均';
    this.note = 'The means are computed by taking the best result for each attempt in the given round.';
    this.noteZh = '平均值取该轮次每次尝试的最佳成绩计算。';
    this.tableHeader = {
      'Mean': 'center',
      'Attempt 1': 'center',
      'Attempt 2': 'center',
      'Attempt 3': 'center',
      'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        (best1 + best2 + best3) / 3 mean,
        best1, best2, best3,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/all#e333fm', '_', round_type_id, ')') round_link
      FROM (
        SELECT
          MIN(CASE WHEN ra.attempt_number = 1 AND ra.value > 0 THEN ra.value END) best1,
          MIN(CASE WHEN ra.attempt_number = 2 AND ra.value > 0 THEN ra.value END) best2,
          MIN(CASE WHEN ra.attempt_number = 3 AND ra.value > 0 THEN ra.value END) best3,
          r.competition_id,
          r.round_type_id
        FROM results r
        JOIN result_attempts ra ON ra.result_id = r.id
        WHERE r.event_id = '333fm'
        GROUP BY r.competition_id, r.round_type_id
      ) AS best_attempts_by_competition_and_round
      JOIN competitions competition ON competition.id = competition_id
      WHERE LEAST(best1, best2, best3) IS NOT NULL
      ORDER BY mean
      LIMIT 100
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      Number(r['mean']).toFixed(2),
      r['best1'],
      r['best2'],
      r['best3'],
      r['round_link'],
    ]);
  }
}
