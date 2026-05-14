// NOTE: AverageOfX 抽象基类——连续 X 次官方还原的裁剪均值
// 算法：滑动窗口，每人所有 attempt 按时间排列，窗口长度 = solveCount
// 支持双视图 JSON：Current Ranking + WR History
//
// NOTE: 共享查询模式——7 个子类（Ao3~Ao1000）共用同一份大 SQL 查询结果
// 第一个子类执行查询后缓存，后续 6 个子类直接复用
// 避免 6 次重复查询（每次 ~60s）
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES, headerZh, eventZh } from './events.js';
import { SolveTime } from './solve_time.js';
import { ATTEMPTS_SUBQUERY, query as dbQuery } from './database.js';
import { formatDate } from './format_date.js';
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


// --- 共享查询结果缓存 ---
// NOTE: 7 个子类共享同一份大 SQL 查询结果，避免 6 次重复查询
let sharedQueryRows: RowDataPacket[] | null = null;

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

  // NOTE: 共享查询——第一个子类执行 SQL 后缓存，后续子类复用
  private async getSharedQueryRows(): Promise<RowDataPacket[]> {
    if (!sharedQueryRows) {
      sharedQueryRows = await this.queryResults();
    }
    return sharedQueryRows;
  }

  // NOTE: 缓存清理——average_of 聚合完成后调用
  static clearSharedCache(): void {
    sharedQueryRows = null;
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
    // NOTE: pbHistory 不存 solves 数组——Ao1000 每次 PB 拷贝 1000 numbers = 8KB，
    // 2000 候选人 × 20 PB = 40000 份 = 320MB。改为预格式化 csv 字符串（~6KB 紧凑存储）。
    type PbEntry = {
      aox: SolveTime;
      detailsCsv: string;
      startMeta: CompMeta;
      endMeta: CompMeta;
      personLink: string;
    };

    const results: Array<{
      personId: string;
      personLink: string;
      country: string;
      best: WindowResult;
      pbHistory: PbEntry[];
    }> = [];

    for (const [personId, personRows] of byPerson) {
      const solves: number[] = [];
      const meta: CompMeta[] = [];
      let best: WindowResult = {
        aox: SolveTime.DNF_INSTANCE,
        solves: [], startMeta: { compLink: '', date: '' }, endMeta: { compLink: '', date: '' },
      };
      const pbHistory: PbEntry[] = [];

      for (const row of personRows) {
        const compMeta: CompMeta = {
          compLink: String(row['competition_link']),
          // NOTE: ⚠️ 必须用 formatDate 而非 String —— mysql2 返回 JS Date 对象，
          // String(Date) 产生 "Sat Jan 15 2005..." 非 ISO 格式，localeCompare 排序出错
          date: formatDate(row['start_date']),
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
              // NOTE: ⚠️ pbHistory 存 csv 而非 solves——立即格式化后 formatted 数组可被 GC
              const formatted = solves.map(s =>
                s === Infinity ? 'DNF' : new SolveTime(eventId, 'single', s).clockFormat(),
              );
              pbHistory.push({
                aox: currentAox,
                detailsCsv: formatted.join(','),
                startMeta: meta[0],
                endMeta: meta[meta.length - 1],
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

  // NOTE: Details 结构化输出——带类型判别器的对象
  // 前端通过 _type === 'solves' 识别并决定渲染方式（行内/折叠）
  // csv: 逗号分隔的格式化成绩（前端 split 渲染 + 图表 parseFloat）
  // ⚠️ 不存 items 数组——JSON 数组每元素有 ""+, 开销，Ao1000 会爆内存
  private detailsCell(solves: number[], eventId: string): { _type: 'solves'; csv: string } {
    const formatted = solves.map(s =>
      s === Infinity ? 'DNF' : new SolveTime(eventId, 'single', s).clockFormat(),
    );
    return { _type: 'solves', csv: formatted.join(',') };
  }

  // NOTE: 覆写 toJson——双视图 panels
  async toJson(): Promise<StatJson> {
    // NOTE: 使用共享查询缓存——第一个子类查完后缓存，后续复用
    const rawRows = await this.getSharedQueryRows();

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
            formatDate(b.startMeta.date), b.startMeta.compLink,
            formatDate(b.endMeta.date), b.endMeta.compLink,
            this.detailsCell(b.solves, eventId),
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
          formatDate(r.startMeta.date), r.startMeta.compLink,
          formatDate(r.endMeta.date), r.endMeta.compLink,
          { _type: 'solves' as const, csv: r.detailsCsv },
        ];
      });

      historyDataAll.push([eventName, historyRows.reverse()]);
    }

    // NOTE: 不再释放 rawRows——它是共享缓存，由 clearSharedCache 统一清理

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
