// NOTE: 完全比赛冠军
// 与 Ruby _stats_build/statistics/complete_competition_winners.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class CompleteCompetitionWinners extends Statistic {
  constructor() {
    super();
    this.title = 'Complete competition winners';
    this.titleZh = '完全比赛冠军';
    this.note = 'A complete win means taking the first place in every event on the given competition.';
    this.noteZh = '完全冠军指在某场比赛的所有项目中均获得第一名。';
    this.tableHeader = {
      'Events count': 'right', 'Person': 'left', 'Citizen of': 'left', 'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        events_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        country.name,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link
      FROM (
        SELECT
          competition_id,
          GROUP_CONCAT(DISTINCT person_id) person_id,
          COUNT(DISTINCT event_id) events_count
        FROM results
        WHERE round_type_id IN ('c', 'f') AND pos = 1 AND best > 0
        GROUP BY competition_id
        HAVING COUNT(DISTINCT person_id) = 1
      ) AS competitions_with_complete_winners
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = person.country_id
      ORDER BY events_count DESC, person.name
    `;
  }
}
