// NOTE: AoRounds 抽象基类——跨轮次 average of averages
// 与 Ruby _stats_build/statistics/abstract/ao_rounds.rb 1:1 对应
// AoXR = 一场比赛中某人恰好参加了 X 轮时，各轮 average 的均值
// 支持双视图 JSON：排名（ranking）+ WR 历史（history）
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS_WITH_AVERAGE, headerZh, eventZh } from './events.js';
import { SolveTime } from './solve_time.js';
import { query as dbQuery } from './database.js';
import { formatDate } from './format_date.js';
import type { StatJson, StatPanel, Alignment, TableHeader } from './statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 排名表头（与 Ruby StatPanel::RANKING_HEADER + Details 列对应）
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Result': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

// NOTE: round_type_id 排序权重
const ROUND_SORT_ORDER: Record<string, number> = {
  '1': 1, 'd': 1, '2': 2, 'e': 2, '3': 3, 'g': 3, 'c': 99, 'f': 99,
};

export abstract class AoRounds extends GroupedStatistic {
  // NOTE: 子类必须实现
  abstract roundCount(): number;

  constructor() {
    super();
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  // NOTE: 按 event_id 单独查询，避免全表加载
  private queryForEvent(eventId: string): string {
    return `
      SELECT
        result.event_id,
        result.average,
        result.round_type_id,
        result.competition_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.wca_id AS person_id,
        person.country_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.average > 0 AND result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `;
  }

  query(): string { return ''; }  // NOTE: 不使用统一 query，逐 event 查询

  // NOTE: toJson() 覆写了整个流程，transform 不被调用，提供空实现满足抽象类
  transform(): [string, unknown[][]][] { return []; }

  // NOTE: 覆写 toJson——双视图 panels 输出
  async toJson(): Promise<StatJson> {
    const events = EVENTS_WITH_AVERAGE;
    const rc = this.roundCount();
    const historyData: [string, unknown[][]][] = [];
    const rankingData: [string, unknown[][]][] = [];

    for (const [eventId, eventName] of Object.entries(events)) {
      const eventRows = await dbQuery<RowDataPacket[]>(this.queryForEvent(eventId));

      // NOTE: 按 (competition_id, person_id) 分组
      const grouped = new Map<string, { rows: RowDataPacket[]; meta: RowDataPacket }>();
      for (const r of eventRows) {
        const key = `${r['competition_id']}:${r['person_id']}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.rows.push(r);
        } else {
          grouped.set(key, { rows: [r], meta: r });
        }
      }

      // NOTE: 筛选恰好有 rc 轮的组，计算各轮 average 的均值
      const computed: Array<{ metric: number; roundValues: number[]; meta: RowDataPacket }> = [];
      for (const [, info] of grouped) {
        if (info.rows.length !== rc) continue;
        // NOTE: 按轮次排序
        const sorted = info.rows.sort((a, b) =>
          (ROUND_SORT_ORDER[String(a['round_type_id'])] ?? 50)
          - (ROUND_SORT_ORDER[String(b['round_type_id'])] ?? 50));
        const values = sorted.map(r => Number(r['average']));
        const avg = values.reduce((s, v) => s + v, 0) / rc;
        computed.push({ metric: avg, roundValues: values, meta: info.meta });
      }

      // NOTE: 排名——每人最佳 metric，top 10
      const bestByPerson = new Map<string, typeof computed[0]>();
      for (const c of computed) {
        const pid = String(c.meta['person_id']);
        const existing = bestByPerson.get(pid);
        if (!existing || c.metric < existing.metric) {
          bestByPerson.set(pid, c);
        }
      }

      const rankingRows = [...bestByPerson.values()]
        .sort((a, b) => a.metric - b.metric)
        .slice(0, 10)
        .map((v, i) => {
          const metricStr = new SolveTime(eventId, 'average', Math.round(v.metric)).clockFormat();
          const details = v.roundValues
            .map(val => new SolveTime(eventId, 'average', val).clockFormat())
            .join(', ');
          const dateStr = formatDate(v.meta['start_date']);
          return [i + 1, v.meta['person_link'], metricStr, v.meta['country_id'], dateStr, v.meta['competition_link'], details];
        });

      rankingData.push([eventName, rankingRows]);

      // NOTE: WR 历史——追踪全局最小值刷新
      computed.sort((a, b) => {
        const da = String(a.meta['start_date']);
        const db = String(b.meta['start_date']);
        return da.localeCompare(db) || b.metric - a.metric;
      });

      let minSoFar = Infinity;
      const wrRecords = computed.filter(c => {
        if (c.metric < minSoFar) {
          minSoFar = c.metric;
          return true;
        }
        return false;
      });

      const historyRows = wrRecords.map((c, i) => {
        const metricStr = new SolveTime(eventId, 'average', Math.round(c.metric)).clockFormat();
        const roundDetails = c.roundValues
          .map(v => new SolveTime(eventId, 'average', v).clockFormat())
          .join(', ');

        // NOTE: 进步百分比
        let gainStr = '';
        if (i > 0) {
          const prev = wrRecords[i - 1].metric;
          gainStr = `${((prev - c.metric) / prev * 100).toFixed(1)}%`;
        }

        // NOTE: 保持天数
        let daysStr: string;
        if (i < wrRecords.length - 1) {
          const nextDate = new Date(String(wrRecords[i + 1].meta['start_date']));
          const currDate = new Date(String(c.meta['start_date']));
          daysStr = String(Math.round((nextDate.getTime() - currDate.getTime()) / 86400000));
        } else {
          const currDate = new Date(String(c.meta['start_date']));
          daysStr = String(Math.round((Date.now() - currDate.getTime()) / 86400000));
        }

        const dateStr = formatDate(c.meta['start_date']);
        return [metricStr, gainStr, daysStr, c.meta['person_link'], dateStr, c.meta['competition_link'], roundDetails];
      });

      historyData.push([eventName, historyRows.reverse()]);
    }

    // NOTE: 构建 panels
    const historyHeaderEntries = Object.entries(this.tableHeader);
    const rankingHeaderEntries = Object.entries(RANKING_HEADER);

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
        sections: buildSections(rankingData),
      },
      {
        id: 'history', labelEn: 'History', labelZh: '历史',
        header: historyHeaderEntries.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(historyData),
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

  // NOTE: 使用共享 formatDate（修复 Date→String 截断 bug）
}
