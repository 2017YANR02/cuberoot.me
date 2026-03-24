// NOTE: AverageOfX 抽象基类——连续 X 次官方还原的裁剪均值
// 与 Ruby _stats_build/statistics/abstract/average_of_x.rb 1:1 对应
// 算法：滑动窗口，每人所有 attempt 按时间排列，窗口长度 = solveCount
// 支持双视图 JSON：Current Ranking + WR History
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES, headerZh, eventZh } from './events.js';
import { SolveTime } from './solve_time.js';
import { ATTEMPTS_SUBQUERY, query as dbQuery } from './database.js';
import type { StatJson, StatPanel } from './statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 各项目的候选选手筛选范围
const TOP_N_BY_EVENT: Record<string, number> = {
  '333': 15,
  '222': 30, '444': 30, '555': 30,
  '666': 30, '777': 30, '333ft': 30, 'skewb': 30,
  'sq1': 30, '333oh': 30, 'minx': 30,
  '333fm': 300, 'pyram': 300, 'clock': 300,
  '444bf': 300, '555bf': 300, 'magic': 300, 'mmagic': 300,
  '333bf': 2000,
};

// NOTE: AoX 排名表头
const RANKING_HEADER_AOX = {
  '#': 'right' as const, 'Person': 'left' as const, 'Result': 'right' as const,
  'Country': 'left' as const, 'Start Date': 'left' as const, 'Start Comp': 'left' as const,
  'Date': 'left' as const, 'Competition': 'left' as const, 'Details': 'left' as const,
};

// NOTE: WR History 表头
const HISTORY_HEADER_AOX = {
  'Result': 'right' as const, 'Improvement': 'right' as const, 'Days': 'right' as const,
  'Person': 'left' as const, 'Start Date': 'left' as const, 'Start Comp': 'left' as const,
  'Date': 'left' as const, 'Competition': 'left' as const, 'Details': 'left' as const,
};

// NOTE: DNF 标记值
const SKIPPED_VALUE = 0;

// NOTE: 懒加载阈值——超过此数量的 solves 用折叠方式展示
const LAZY_THRESHOLD = 12;

export abstract class AverageOfX extends GroupedStatistic {
  protected solveCount: number;

  constructor(solveCount: number) {
    super();
    this.solveCount = solveCount;
    this.title = `Average of ${solveCount}`;
    this.titleZh = `${solveCount} 次均值`;
    this.note = `${solveCount} consecutive official attempts are considered. ` +
      'Top N varies by event: 333 top 15, most events top 30, ' +
      '333fm/pyram/clock/444bf/555bf/magic/mmagic top 300, ' +
      '333bf top 2000. ' +
      'WR History candidates also include all single and average WR holders. ' +
      'Tied results are not shown in WR History.';
    this.noteZh = `考虑连续 ${solveCount} 次官方还原。` +
      '各项目 Top N：333 前 15，多数项目前 30，' +
      '333fm/pyram/clock/444bf/555bf/magic/mmagic 前 300，' +
      '333bf 前 2000。' +
      'WR 历史的候选人仅包括所有单次和平均 WR 获得者。' +
      'WR 历史不显示持平的成绩。';
    this.tableHeader = RANKING_HEADER_AOX;
  }

  // NOTE: toJson() 覆写了整个流程，transform 不被调用，提供空实现满足抽象类
  transform(): [string, unknown[][]][] { return []; }

  query(): string {
    // NOTE: 候选人 = TOP_N UNION WR 持有者
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.wca_id AS person_id,
        person.country_id,
        result.event_id,
        ${ATTEMPTS_SUBQUERY} AS attempts,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      JOIN (
        SELECT event_id, person_id
        FROM (
          SELECT r.event_id, r.person_id,
            RANK() OVER (PARTITION BY r.event_id ORDER BY MIN(r.average)) AS global_rank
          FROM results r
          WHERE r.average > 0
          GROUP BY r.event_id, r.person_id
        ) ranked
        WHERE global_rank <= CASE ranked.event_id
          WHEN '333' THEN 15
          WHEN '333fm' THEN 300
          WHEN 'pyram' THEN 300
          WHEN 'clock' THEN 300
          WHEN '444bf' THEN 300
          WHEN '555bf' THEN 300
          WHEN 'magic' THEN 300
          WHEN 'mmagic' THEN 300
          WHEN '333bf' THEN 2000
          ELSE 30
        END
        UNION
        SELECT DISTINCT event_id, person_id FROM results
        WHERE regional_single_record = 'WR' OR regional_average_record = 'WR'
      ) candidates ON candidates.event_id = result.event_id AND candidates.person_id = result.person_id
      WHERE result.event_id NOT IN ('333mbf', '333mbo')
      ORDER BY competition.start_date, round_type.rank
    `;
  }

  // NOTE: Trimmed Mean（WCA 标准裁剪均值）
  // 两端各去掉 ceil(n*5%) 个成绩
  private trimmedAverage(solves: number[], eventId: string): SolveTime {
    const trimPerSide = Math.ceil(solves.length * 0.05);
    const sorted = [...solves].sort((a, b) => a - b);
    const untrimmed = sorted.slice(trimPerSide, -trimPerSide);
    // NOTE: 如果裁剪后仍有 Infinity（DNF），整个均值 DNF
    if (untrimmed[untrimmed.length - 1] === Infinity) {
      return SolveTime.DNF_INSTANCE;
    }
    let meanValue = untrimmed.reduce((s, v) => s + v, 0) / untrimmed.length;
    // NOTE: FMC 成绩单位是 moves，乘 100 统一为厘秒
    if (eventId === '333fm') meanValue *= 100;
    return new SolveTime(eventId, 'average', Math.round(meanValue));
  }

  // NOTE: 滑动窗口核心——为指定 event 的每个人计算最佳 AoX
  private slidingWindowPerPerson(rows: RowDataPacket[], eventId: string) {
    // NOTE: 按 person_id 分组
    const byPerson = new Map<string, RowDataPacket[]>();
    for (const r of rows) {
      if (r['event_id'] !== eventId) continue;
      const pid = String(r['person_id']);
      const existing = byPerson.get(pid);
      if (existing) existing.push(r);
      else byPerson.set(pid, [r]);
    }

    type CompMeta = { compLink: string; date: string };
    type WindowResult = {
      aox: SolveTime;
      solves: number[];
      startMeta: CompMeta;
      endMeta: CompMeta;
    };

    const results: Array<{
      personId: string;
      personLink: string;
      country: string;
      best: WindowResult;
      pbHistory: Array<WindowResult & { personLink: string }>;
    }> = [];

    for (const [personId, personRows] of byPerson) {
      const solves: number[] = [];
      const meta: CompMeta[] = [];
      let best: WindowResult = {
        aox: SolveTime.DNF_INSTANCE,
        solves: [], startMeta: { compLink: '', date: '' }, endMeta: { compLink: '', date: '' },
      };
      const pbHistory: Array<WindowResult & { personLink: string }> = [];

      for (const row of personRows) {
        const compMeta: CompMeta = {
          compLink: String(row['competition_link']),
          date: String(row['start_date']),
        };
        const attempts = String(row['attempts'] || '').split(',').map(Number);
        for (const value of attempts) {
          if (value === SKIPPED_VALUE) continue;
          solves.push(value > 0 ? value : Infinity);
          meta.push(compMeta);

          if (solves.length === this.solveCount) {
            const currentAox = this.trimmedAverage(solves, eventId);
            if (currentAox.compareTo(best.aox) < 0) {
              best = {
                aox: currentAox,
                solves: [...solves],
                startMeta: meta[0],
                endMeta: meta[meta.length - 1],
              };
              pbHistory.push({
                ...best,
                personLink: String(personRows[0]['person_link']),
              });
            }
            solves.shift();
            meta.shift();
          }
        }
      }

      if (best.aox.isComplete()) {
        results.push({
          personId,
          personLink: String(personRows[0]['person_link']),
          country: String(personRows[0]['country_id']),
          best,
          pbHistory,
        });
      }
    }

    return results;
  }

  // NOTE: Details 格式化
  private detailsHtml(solves: number[], eventId: string): string {
    const formatted = solves.map(s =>
      s === Infinity ? 'DNF' : new SolveTime(eventId, 'single', s).clockFormat(),
    );

    if (formatted.length <= LAZY_THRESHOLD) {
      return formatted.join(' ');
    }
    // NOTE: 折叠展示
    return `${formatted.length} solves`;
  }

  private formatDate(d: unknown): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d || '').slice(0, 10);
  }

  // NOTE: 覆写 toJson——双视图 panels
  async toJson(): Promise<StatJson> {
    const rawRows = await this.queryResults();

    const rankingDataAll: [string, unknown[][]][] = [];
    const historyDataAll: [string, unknown[][]][] = [];

    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      if (['333mbf', '333mbo'].includes(eventId)) continue;
      const persons = this.slidingWindowPerPerson(rawRows, eventId);

      // NOTE: Current Ranking
      const top10 = persons
        .sort((a, b) => a.best.aox.compareTo(b.best.aox))
        .slice(0, 10)
        .map((p, i) => {
          const b = p.best;
          return [
            i + 1, p.personLink, b.aox.clockFormat(), p.country,
            this.formatDate(b.startMeta.date), b.startMeta.compLink,
            this.formatDate(b.endMeta.date), b.endMeta.compLink,
            this.detailsHtml(b.solves, eventId),
          ];
        });
      rankingDataAll.push([eventName, top10]);

      // NOTE: WR History
      const allPbs = persons.flatMap(p => p.pbHistory);
      allPbs.sort((a, b) => {
        const dc = a.endMeta.date.localeCompare(b.endMeta.date);
        if (dc !== 0) return dc;
        return b.aox.wca_value - a.aox.wca_value;
      });

      let minSoFar = SolveTime.DNF_INSTANCE;
      const wrRecords = allPbs.filter(pb => {
        if (pb.aox.compareTo(minSoFar) < 0) {
          minSoFar = pb.aox;
          return true;
        }
        return false;
      });

      const historyRows = wrRecords.map((r, i) => {
        const metricStr = r.aox.clockFormat();
        let gainStr = '';
        if (i > 0) {
          const prevVal = wrRecords[i - 1].aox.wca_value;
          const currVal = r.aox.wca_value;
          gainStr = `${((prevVal - currVal) / prevVal * 100).toFixed(1)}%`;
        }

        let daysStr: string;
        if (i < wrRecords.length - 1) {
          const nextDate = new Date(wrRecords[i + 1].endMeta.date);
          const currDate = new Date(r.endMeta.date);
          daysStr = String(Math.round((nextDate.getTime() - currDate.getTime()) / 86400000));
        } else {
          const currDate = new Date(r.endMeta.date);
          daysStr = String(Math.round((Date.now() - currDate.getTime()) / 86400000));
        }

        return [
          metricStr, gainStr, daysStr, r.personLink,
          this.formatDate(r.startMeta.date), r.startMeta.compLink,
          this.formatDate(r.endMeta.date), r.endMeta.compLink,
          this.detailsHtml(r.solves, eventId),
        ];
      });

      historyDataAll.push([eventName, historyRows.reverse()]);
    }

    // NOTE: 构建 panels
    const rankingHeaderEntries = Object.entries(RANKING_HEADER_AOX);
    const historyHeaderEntries = Object.entries(HISTORY_HEADER_AOX);

    const buildSections = (data: [string, unknown[][]][]) =>
      data.filter(([, rows]) => rows.length > 0)
        .map(([title, rows]) => ({ title, titleZh: eventZh(title), rows }));

    const panels: StatPanel[] = [
      {
        id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
        header: rankingHeaderEntries.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(rankingDataAll),
      },
      {
        id: 'history', labelEn: 'History', labelZh: '历史',
        header: historyHeaderEntries.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(historyDataAll),
      },
    ];

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],
      panels,
    };
  }
}
