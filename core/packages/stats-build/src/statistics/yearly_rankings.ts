// NOTE: 年度排名——仅包含当年比赛结果
// 与 Ruby _stats_build/statistics/yearly_rankings.rb 1:1 对应
import { Rankings } from '../core/rankings.js';

export class YearlyRankings extends Rankings {
  constructor() {
    super(
      'Yearly rankings',
      '年度排名',
      'By definition these rankings include only results from the current year.',
      '按定义，此排名仅包含当年的比赛成绩。',
      'WHERE YEAR(competition.start_date) = YEAR(CURDATE())',
    );
  }
}
