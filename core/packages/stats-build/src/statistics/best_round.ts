// NOTE: 最佳轮次——每个项目中 top 3 成绩之和最低的轮次
// 特殊性：逐项目执行参数化 SQL（query 含 %s 占位符），333mbf 用 points 之和降序排
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES, BLD_EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { query as dbQuery } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

export class BestRound extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Best round';
    this.titleZh = '最佳轮次';
    this.note = 'For each event, shows the rounds with the best sum of the top 3 results. For blind events the single is used, for other events the average is used.';
    this.noteZh = '每个项目中 top 3 成绩之和最低的轮次。盲拧用单次，其他用平均。';
    this.tableHeader = {
      'Competition': 'left',
      'Round': 'left',
      'Sum': 'right',
      '1st': 'left',
      'Result': 'right',
      '2nd': 'left',
      'Result ': 'right',
      '3rd': 'left',
      'Result  ': 'right',
    };
  }

  // NOTE: 参数化 SQL——%s 被替换为 event_id
  query(): string {
    return `
      SELECT
        pivoted.event_id,
        competition.id comp_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/all#e', pivoted.event_id, '_', pivoted.round_type_id, ')') comp_link,
        round_type.cell_name round_name,
        first_id, first_name, first_result,
        second_id, second_name, second_result,
        third_id, third_name, third_result,
        first_result + second_result + third_result result_sum
      FROM (
        SELECT
          competition_id,
          round_type_id,
          event_id,
          MAX(CASE WHEN row_num = 1 THEN person_id END) first_id,
          MAX(CASE WHEN row_num = 1 THEN person_name END) first_name,
          MAX(CASE WHEN row_num = 1 THEN best_result END) first_result,
          MAX(CASE WHEN row_num = 2 THEN person_id END) second_id,
          MAX(CASE WHEN row_num = 2 THEN person_name END) second_name,
          MAX(CASE WHEN row_num = 2 THEN best_result END) second_result,
          MAX(CASE WHEN row_num = 3 THEN person_id END) third_id,
          MAX(CASE WHEN row_num = 3 THEN person_name END) third_name,
          MAX(CASE WHEN row_num = 3 THEN best_result END) third_result
        FROM (
          SELECT
            competition_id, round_type_id, person_id, person_name, event_id,
            CASE WHEN event_id IN ('333bf', '444bf', '555bf', '333mbf') THEN best ELSE average END best_result,
            ROW_NUMBER() OVER (
              PARTITION BY competition_id, round_type_id
              ORDER BY CASE WHEN event_id IN ('333bf', '444bf', '555bf', '333mbf') THEN best ELSE average END
            ) row_num
          FROM results
          WHERE event_id = '%s'
            AND (CASE WHEN event_id IN ('333bf', '444bf', '555bf', '333mbf') THEN best ELSE average END) > 0
        ) ranked
        GROUP BY competition_id, round_type_id
      ) pivoted
      JOIN competitions competition ON competition.id = pivoted.competition_id
      JOIN round_types round_type ON round_type.id = pivoted.round_type_id
      WHERE third_result IS NOT NULL
      ORDER BY result_sum
      LIMIT 10
    `;
  }

  // NOTE: 覆写 queryResults——逐项目执行 SQL（333mbf 在 transform 中单独处理）
  async queryResults(): Promise<RowDataPacket[]> {
    const allResults: RowDataPacket[] = [];
    for (const eventId of Object.keys(EVENTS)) {
      if (eventId === '333mbf') continue; // NOTE: 333mbf 在 transform 中用 points 降序排
      const sql = this.query().replace('%s', eventId);
      const rows = await dbQuery<RowDataPacket[]>(sql);
      allResults.push(...rows);
    }
    return allResults;
  }

  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      let eventRows = rows.filter(r => r['event_id'] === eventId);
      if (eventRows.length === 0 && eventId !== '333mbf') {
        return [eventName, []] as [string, unknown[][]];
      }

      // NOTE: 333mbf 需要单独查询并按 points 降序排序
      // 因为 wca_value 编码特殊——值越小成绩越好，但"最佳轮次"要按 points 之和降序
      // 由于这里是同步的 transform，333mbf 的查询需要在 toJson 中预先处理
      // HACK: 利用 queryResults 已跳过 333mbf，此处 eventRows 为空
      // 333mbf 的逻辑将在 toJson 覆写中处理

      const field: 'single' | 'average' = BLD_EVENTS[eventId] ? 'single' : 'average';

      const results = eventRows.slice(0, 10).map(r => {
        const firstSt = new SolveTime(eventId, field, Number(r['first_result']));
        const secondSt = new SolveTime(eventId, field, Number(r['second_result']));
        const thirdSt = new SolveTime(eventId, field, Number(r['third_result']));

        const sumDisplay = SolveTime.centisecondsToClockFormat(Number(r['result_sum']));

        const firstLink = `[${r['first_name']}](https://www.worldcubeassociation.org/persons/${r['first_id']})`;
        const secondLink = `[${r['second_name']}](https://www.worldcubeassociation.org/persons/${r['second_id']})`;
        const thirdLink = `[${r['third_name']}](https://www.worldcubeassociation.org/persons/${r['third_id']})`;

        return [
          r['comp_link'], r['round_name'], sumDisplay,
          firstLink, firstSt.clockFormat(),
          secondLink, secondSt.clockFormat(),
          thirdLink, thirdSt.clockFormat(),
        ];
      });

      return [eventName, results] as [string, unknown[][]];
    });
  }

  // NOTE: 覆写 toJson——333mbf 需要在 transform 之前单独查询
  async toJson() {
    // NOTE: 先查询 333mbf 的数据
    const mbfSql = this.query().replace('%s', '333mbf');
    const mbfRows = await dbQuery<RowDataPacket[]>(mbfSql);

    // NOTE: 按 points 之和降序排序（而非 result_sum ASC）
    mbfRows.sort((a, b) => {
      const pa = SolveTime.multibldAttemptToPoints(Number(a['first_result']))
        + SolveTime.multibldAttemptToPoints(Number(a['second_result']))
        + SolveTime.multibldAttemptToPoints(Number(a['third_result']));
      const pb = SolveTime.multibldAttemptToPoints(Number(b['first_result']))
        + SolveTime.multibldAttemptToPoints(Number(b['second_result']))
        + SolveTime.multibldAttemptToPoints(Number(b['third_result']));
      return pb - pa;
    });

    // NOTE: 获取非 333mbf 的所有行
    let rawRows: RowDataPacket[] | null = await this.queryResults();

    // NOTE: 合并 333mbf 数据（带 event_id 标记）
    const enrichedMbf = mbfRows.map(r => ({ ...r, event_id: '333mbf' }));
    let allRows: RowDataPacket[] | null = [...rawRows, ...enrichedMbf] as RowDataPacket[];
    rawRows = null; // NOTE: rawRows 已被合并到 allRows，释放

    // NOTE: 调用 transform
    const grouped = this.transformWithMbf(allRows, mbfRows);
    // NOTE: 内存管理——transform 完成后释放原始数据
    allRows = null;
    if (global.gc) global.gc();

    const headerEntries = Object.entries(this.tableHeader);

    const { headerZh, eventZh } = await import('../core/events.js');
    const sections = grouped
      .filter(([, rows]) => rows.length > 0)
      .map(([title, rows]) => ({
        title,
        titleZh: eventZh(title),
        rows,
      }));

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: headerEntries.map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        labelZh: headerZh(label),
        align,
      })),
      sections,
    };
  }

  // NOTE: 在 toJson 中调用——333mbf 行已按 points 排好序
  private transformWithMbf(allRows: RowDataPacket[], mbfRows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      const eventRows = eventId === '333mbf' ? mbfRows : allRows.filter(r => r['event_id'] === eventId);
      if (eventRows.length === 0) return [eventName, []] as [string, unknown[][]];

      const field: 'single' | 'average' = BLD_EVENTS[eventId] ? 'single' : 'average';

      const results = eventRows.slice(0, 10).map(r => {
        const firstSt = new SolveTime(eventId, field, Number(r['first_result']));
        const secondSt = new SolveTime(eventId, field, Number(r['second_result']));
        const thirdSt = new SolveTime(eventId, field, Number(r['third_result']));

        // NOTE: 333mbf sum 用 points，其他用厘秒
        const sumDisplay = eventId === '333mbf'
          ? String(firstSt.points + secondSt.points + thirdSt.points)
          : SolveTime.centisecondsToClockFormat(Number(r['result_sum']));

        const firstLink = `[${r['first_name']}](https://www.worldcubeassociation.org/persons/${r['first_id']})`;
        const secondLink = `[${r['second_name']}](https://www.worldcubeassociation.org/persons/${r['second_id']})`;
        const thirdLink = `[${r['third_name']}](https://www.worldcubeassociation.org/persons/${r['third_id']})`;

        return [
          r['comp_link'], r['round_name'], sumDisplay,
          firstLink, firstSt.clockFormat(),
          secondLink, secondSt.clockFormat(),
          thirdLink, thirdSt.clockFormat(),
        ];
      });

      return [eventName, results] as [string, unknown[][]];
    });
  }
}
