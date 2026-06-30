// NOTE: 333mbf / 333mbo Mo3 平均值——数据引擎(非页面)
// 独立页 /wca/mbf_average 已退役(2026-06-10);此类不再产页面 JSON,只作数据提供者:
//   wr_average_history → rankingFor() / historyFor()(排名 + WR 历史)
//   records_build      → bestMo3Raw() / bestMboMo3Raw()(历史最佳 Mo3,注入 world.json 多盲平均行)
// 算法:WCA 不追踪多盲平均,从 DB 现算 Mo3。每把按数值大小分流解码(旧 1SSAATTTTT / 新 0DDTTTTTMM),
//   三段(DD/TTTTT/MM)各取均值再拼回(见 core/mbf_average.ts)。333mbf 永远新编码;333mbo 历史仅
//   极少数完成过 3 轮(混旧/新编码),同一套 mbfMo3 通吃,不再硬编码。
import { formatDate, calcDays, filterWrHistory } from '../core/format_date.js';
import { Statistic } from '../core/statistic.js';
import { EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { ATTEMPTS_SUBQUERY, query } from '../core/database.js';
import { mbfMo3 } from '../core/mbf_average.js';
import type { RowDataPacket } from 'mysql2';

type Computed = { row: RowDataPacket; metric: number; v1: number; v2: number; v3: number };

// records_build 注入 world.json 多盲平均行所需的原始最佳 Mo3 数据。
export interface BestMo3Raw {
  value: number; personId: string; personName: string; countryId: string;
  compId: string; compCell: string; compCountry: string; startDate: Date; attempts: number[];
}

// 某项目(333mbf / 333mbo)全部 result 行 + 三把 attempts,按比赛日期升序(WR 历史 / 并列取更早需要)。
function attemptsQuery(eventId: string): string {
  return `
      SELECT
        ${ATTEMPTS_SUBQUERY} AS attempts,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        result.person_id,
        person.country_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.id AS comp_id,
        competition.cell_name AS comp_cell,
        competition.country_id AS comp_country,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `;
}

export class MbfAverage extends Statistic {
  // 按 event 显示名缓存(供 historyFor / rankingFor 委托);_best 按 event id 缓存原始最佳。
  private _history: Record<string, unknown[][]> = {};
  private _ranking6: Record<string, unknown[][]> = {};
  private _best: Record<string, Computed | null> = {};
  private _computed = false;

  constructor() {
    super();
    this.title = '3x3x3 Multi-Blind Mo3';
    this.titleZh = '3x3x3 多盲 Mo3';
    this.note = 'Unofficial Mo3 for 333mbf / 333mbo (not tracked by WCA). ' +
      'Each attempt value is decoded by magnitude (old 1SSAATTTTT / new 0DDTTTTTMM) into ' +
      'DD (99 minus difference), TTTTT (time in seconds) and MM (missed). ' +
      'Each part is averaged across 3 attempts and rounded, then reassembled for ranking.';
    this.noteZh = '333mbf / 333mbo 的非官方 Mo3（WCA 不追踪此指标）。' +
      '每把成绩按数值大小解码(旧 1SSAATTTTT / 新 0DDTTTTTMM)为 DD（99 减差值）、TTTTT（秒数）、MM（失败数），' +
      '三次尝试各部分分别取均值并四舍五入后重新拼接,用于排名。';
  }

  // 基类 queryResults() 用此查询(333mbf);333mbo 在 computeData 里另查。
  query(): string {
    return attemptsQuery('333mbf');
  }

  private formatMo3(eventId: string, mo3Value: number): string {
    return new SolveTime(eventId, 'single', mo3Value).clockFormat();
  }

  // 单个项目:从 result 行算 Mo3 → WR 历史(7 列)+ 每人最佳排名(7 列)+ 整体最佳。
  private buildEvent(eventId: string, rows: RowDataPacket[]): {
    history7: unknown[][]; ranking7: unknown[][]; best: Computed | null;
  } {
    const computed: Computed[] = [];
    let best: Computed | null = null;
    for (const r of rows) {
      const vals = String(r['attempts'] || '').split(',').map(Number);
      // Mo3 需要恰好 3 个正值 attempt(全部成功)
      if (vals.length < 3 || vals[0] <= 0 || vals[1] <= 0 || vals[2] <= 0) continue;
      const [v1, v2, v3] = vals;
      const mo3 = mbfMo3(v1, v2, v3);
      computed.push({ row: r, metric: mo3, v1, v2, v3 });
      // 历史最佳(metric 越小越好);query 已按 start_date 升序,严格小于 → 并列保留更早者
      if (!best || mo3 < best.metric) best = { row: r, metric: mo3, v1, v2, v3 };
    }

    // WR 历史:filterWrHistory 内置日期排序 + <= minSoFar 过滤
    const wrRecords = filterWrHistory(computed, c => c.row['start_date'], c => c.metric);
    const history7 = wrRecords.map((c, i) => {
      const mo3Str = this.formatMo3(eventId, c.metric);
      // 进步列用 points 差值(百分比对复合编码无意义)
      const currPts = new SolveTime(eventId, 'single', c.metric).points;
      let gainStr = '';
      if (i > 0) {
        const prevPts = new SolveTime(eventId, 'single', wrRecords[i - 1].metric).points;
        gainStr = `+${currPts - prevPts} pts`;
      }
      const nextDateVal = i < wrRecords.length - 1 ? wrRecords[i + 1].row['start_date'] : null;
      const daysStr = calcDays(c.row['start_date'], nextDateVal);
      const dateStr = formatDate(c.row['start_date']);
      const details = [c.v1, c.v2, c.v3]
        .map(v => new SolveTime(eventId, 'single', v).clockFormat())
        .join(' ');
      return [mo3Str, gainStr, daysStr, c.row['person_link'], dateStr, c.row['competition_link'], details];
    }).reverse();

    // 排名:每人最佳 Mo3,前 10
    const bestByPerson = new Map<string, Computed>();
    for (const c of computed) {
      const pid = String(c.row['person_id']);
      const existing = bestByPerson.get(pid);
      if (!existing || c.metric < existing.metric) bestByPerson.set(pid, c);
    }
    const ranking7 = [...bestByPerson.values()]
      .sort((a, b) => a.metric - b.metric)
      .slice(0, 10)
      .map((v, i) => {
        const mo3Str = this.formatMo3(eventId, v.metric);
        const dateStr = formatDate(v.row['start_date']);
        const details = [v.v1, v.v2, v.v3]
          .map(val => new SolveTime(eventId, 'single', val).clockFormat())
          .join(' ');
        return [i + 1, v.row['person_link'], mo3Str, v.row['country_id'], dateStr, v.row['competition_link'], details];
      });

    return { history7, ranking7, best };
  }

  // NOTE: 执行核心计算——333mbf(基类查询)+ 333mbo(直查),各生成 ranking + history + best
  private async computeData(): Promise<void> {
    if (this._computed) return;

    let mbfRows: RowDataPacket[] | null = await this.queryResults();
    const mbf = this.buildEvent('333mbf', mbfRows);
    mbfRows = null;
    if (global.gc) global.gc();

    const mboRows = await query<RowDataPacket[]>(attemptsQuery('333mbo'));
    const mbo = this.buildEvent('333mbo', mboRows);

    const mbfName = EVENTS['333mbf'];
    const mboName = EVENTS['333mbo'];
    this._history = { [mbfName]: mbf.history7, [mboName]: mbo.history7 };
    // 去掉 Details 列(7 → 6)供 wr_average_history 的 RANKING_HEADER 对齐
    this._ranking6 = {
      [mbfName]: mbf.ranking7.map(row => row.slice(0, 6)),
      [mboName]: mbo.ranking7.map(row => row.slice(0, 6)),
    };
    this._best = { '333mbf': mbf.best, '333mbo': mbo.best };
    this._computed = true;
  }

  // NOTE: 供 WrAverageHistory 委托调用——history 数据(7 列)
  async historyFor(eventName: string): Promise<unknown[][]> {
    await this.computeData();
    return this._history[eventName] ?? [];
  }

  // NOTE: 供 WrAverageHistory 委托调用——ranking 数据(6 列,对齐 RANKING_HEADER)
  async rankingFor(eventName: string): Promise<unknown[][]> {
    await this.computeData();
    return this._ranking6[eventName] ?? [];
  }

  // 历史最佳 Mo3 的原始数据(未格式化),供 records 管道(records_build.ts)注入 world.json
  // 「当前世界纪录」多盲平均行复用。返回编码后 Mo3 值 + 原始 id/国家/三把成绩。
  private rawBestFor(eventId: string): BestMo3Raw | null {
    const best = this._best[eventId];
    if (!best) return null;
    const r = best.row;
    return {
      value: best.metric,
      personId: String(r['person_id']),
      personName: String(r['person_name']),
      countryId: String(r['country_id']),
      compId: String(r['comp_id']),
      compCell: String(r['comp_cell']),
      compCountry: String(r['comp_country']),
      startDate: r['start_date'] as Date,
      attempts: [best.v1, best.v2, best.v3],
    };
  }

  async bestMo3Raw(): Promise<BestMo3Raw | null> {
    await this.computeData();
    return this.rawBestFor('333mbf');
  }

  async bestMboMo3Raw(): Promise<BestMo3Raw | null> {
    await this.computeData();
    return this.rawBestFor('333mbo');
  }
}
