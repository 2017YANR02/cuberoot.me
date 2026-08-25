// NOTE: 轮次前三成绩和——每个轮次(比赛×轮次)前三名成绩之和最小的轮次
//   排名 (ranking): 该项目全历史前三和最小的 10 个轮次
//   历史 (history): 前三和纪录随时间的演进(每次刷新全历史最小值)
// 三个维度:
//   1) 指标 (metric):   单次 (best) / 平均 (average)          → metricPanels
//   2) 轮次范围 (scope): 所有轮次 / 只看决赛(round_types.final) → sourcePanels(sourceBool 布尔开关)
//   3) 视图 (view):      排名 / 历史                            → panels
// 结构同 wr_dominance,多一层 sourcePanels 供「只看决赛」布尔开关。
// 333mbf/333mbo 编码特殊(和不线性),排除。
//
// ⚠️ 不用窗口函数(ROW_NUMBER OVER)——本机 mysql2 3.20.0 + MySQL 8.0.37 解析窗口函数派生列
//   的结果元数据会 desync 崩溃(best_round 同款查询本机也崩)。改用 GROUP_CONCAT + SUBSTRING_INDEX
//   在 SQL 侧取每轮 top-3(ORDER BY 值,best 在前),只回扁平字符串,mysql2 安全。
import { formatDate, calcDays, filterWrHistory } from '../core/format_date.js';
import { Statistic } from '../core/statistic.js';
import { EVENTS_ENTRIES, headerZh, eventZh } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { query as dbQuery } from '../core/database.js';
import { roundLabel } from '@cuberoot/shared/wca-round';
import type { StatJson, StatPanel, SourcePanel, MetricPanel, StatSection, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Sum': 'right',
  '1st': 'left', '2nd': 'left', '3rd': 'left',
  'Round': 'left', 'Competition': 'left', 'Date': 'left',
};

const HISTORY_HEADER: TableHeader = {
  'Sum': 'right', 'Improvement': 'right', 'Days': 'right',
  '1st': 'left', '2nd': 'left', '3rd': 'left',
  'Round': 'left', 'Competition': 'left', 'Date': 'left',
};

const METRICS = [
  { id: 'single', labelEn: 'Single', labelZh: '单次', col: 'best', type: 'single' as const },
  { id: 'average', labelEn: 'Average', labelZh: '平均', col: 'average', type: 'average' as const },
] as const;

// NOTE: 编码特殊(和不线性)——排除多盲
const SKIP_EVENTS = new Set(['333mbf', '333mbo']);

interface Round {
  roundName: string;
  isFinal: boolean;
  compLink: string;
  date: string;
  sum: number;
  podium: string[]; // 已格式化 [名字链接 + 成绩] ×3
}

export class RoundTop3Sum extends Statistic {
  private roundTypes = new Map<string, { name: string; final: boolean }>();
  private comps = new Map<string, { link: string; date: string }>();
  private persons = new Map<string, string>();

  constructor() {
    super();
    this.title = 'Round Top-3 Sum';
    this.titleZh = '轮次前三成绩和';
    this.note = 'For each round, the sum of its top 3 results. Ranking lists the rounds with the smallest sum; History shows how the all-time record progressed. Toggle Single/Average, Ranking/History, and whether to count only final rounds.';
    this.noteZh = '每个轮次前三名成绩之和。排名列出总和最小的轮次;历史展示全历史纪录随时间的演进。可切换 单次/平均、排名/历史、以及是否只看决赛轮次。';
  }

  query(): string { return ''; }

  // NOTE: 基类从类名推导 id 会得到 'round_top_3_sum'(数字前插下划线);钉死为 REGISTRY 键 / 文件名一致的 id
  get id(): string { return 'round_top3_sum'; }

  async toJson(): Promise<StatJson> {
    await this.loadMaps();

    const buildHeader = (header: TableHeader) =>
      Object.entries(header).map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label, labelZh: headerZh(label), align,
      }));

    const metricPanels: MetricPanel[] = [];

    for (const metric of METRICS) {
      const allRank: StatSection[] = [];
      const allHist: StatSection[] = [];
      const finRank: StatSection[] = [];
      const finHist: StatSection[] = [];

      for (const [eventId, eventName] of EVENTS_ENTRIES) {
        if (SKIP_EVENTS.has(eventId)) continue;
        let rounds: Round[] | null = await this.fetchRounds(eventId, metric.col, metric.type);
        if (rounds.length === 0) { rounds = null; continue; }

        const finals = rounds.filter(r => r.isFinal);

        pushSection(allRank, eventName, this.buildRanking(eventId, rounds, metric.type));
        pushSection(allHist, eventName, this.buildHistory(eventId, rounds, metric.type));
        pushSection(finRank, eventName, this.buildRanking(eventId, finals, metric.type));
        pushSection(finHist, eventName, this.buildHistory(eventId, finals, metric.type));

        rounds = null;
        if (global.gc) global.gc();
      }

      const rankingPanel = (sections: StatSection[]): StatPanel => ({
        id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
        header: buildHeader(RANKING_HEADER), sections,
      });
      const historyPanel = (sections: StatSection[]): StatPanel => ({
        id: 'history', labelEn: 'History', labelZh: '历史',
        header: buildHeader(HISTORY_HEADER), sections,
      });

      const sourcePanels: SourcePanel[] = [
        {
          id: `${metric.id}-all`, labelEn: 'All rounds', labelZh: '所有轮次',
          panels: [rankingPanel(allRank), historyPanel(allHist)],
        },
        {
          id: `${metric.id}-finals`, labelEn: 'Podiums only', labelZh: '仅领奖台',
          panels: [rankingPanel(finRank), historyPanel(finHist)],
        },
      ];

      metricPanels.push({
        id: metric.id, labelEn: metric.labelEn, labelZh: metric.labelZh,
        sourceBool: { labelEn: 'Podiums only', labelZh: '仅领奖台' },
        sourcePanels,
      });
    }

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],
      metricPanels,
    };
  }

  // NOTE: 一次性载入 round_types / competitions / persons 映射(扁平查询,mysql2 安全)
  private async loadMaps(): Promise<void> {
    const rt = await dbQuery<RowDataPacket[]>('SELECT id, name, final FROM round_types');
    for (const r of rt) this.roundTypes.set(String(r['id']), { name: String(r['name']), final: Number(r['final']) === 1 });

    const cs = await dbQuery<RowDataPacket[]>(
      "SELECT id, cell_name, DATE_FORMAT(start_date, '%Y-%m-%d') AS d FROM competitions");
    for (const c of cs) {
      this.comps.set(String(c['id']), {
        link: `[${c['cell_name']}](https://www.worldcubeassociation.org/competitions/${c['id']})`,
        date: String(c['d'] ?? ''),
      });
    }

    const ps = await dbQuery<RowDataPacket[]>('SELECT wca_id, name FROM persons WHERE sub_id = 1');
    for (const p of ps) this.persons.set(String(p['wca_id']), String(p['name']));
  }

  // NOTE: 逐项目取每轮 top-3——扁平查询(仅基表列)+ JS 分组保留前 3 小值
  //   ⚠️ 不用 GROUP_CONCAT:本机 mysql2 3.20.0 解析部分项目(444bf/555bf 单次、333bf/333fm 平均等)
  //   的 GROUP_CONCAT 计算列结果会 desync 挂起(query 永不返回 → 连接泄漏级联枯竭)。扁平基表列
  //   查询(同 wr_dominance,百万行可靠)不触发此问题,分组在 JS 侧做。
  private async fetchRounds(eventId: string, col: string, type: 'single' | 'average'): Promise<Round[]> {
    let rows: RowDataPacket[] | null = await dbQuery<RowDataPacket[]>(
      `SELECT competition_id, round_type_id, person_id, ${col} AS v
       FROM results WHERE event_id = '${eventId}' AND ${col} > 0`);

    // NOTE: 逐行归入 (比赛|轮次) 分组,只保留前 3 小的 {pid,v}(3 元数组插入即排序,O(1))
    const groups = new Map<string, { rt: string; comp: string; top: { pid: string; v: number }[] }>();
    for (const r of rows) {
      const rtId = String(r['round_type_id']);
      const compId = String(r['competition_id']);
      const key = `${compId}|${rtId}`;
      let g = groups.get(key);
      if (!g) { g = { rt: rtId, comp: compId, top: [] }; groups.set(key, g); }
      const v = Number(r['v']);
      const top = g.top;
      if (top.length < 3) {
        top.push({ pid: String(r['person_id']), v });
        top.sort((a, b) => a.v - b.v);
      } else if (v < top[2].v) {
        top[2] = { pid: String(r['person_id']), v };
        top.sort((a, b) => a.v - b.v);
      }
    }
    rows = null;
    if (global.gc) global.gc();

    const out: Round[] = [];
    for (const g of groups.values()) {
      if (g.top.length < 3) continue;
      const rt = this.roundTypes.get(g.rt);
      const comp = this.comps.get(g.comp);
      out.push({
        // NOTE: 精简轮次标签(R1/R2/R3/Fi),与选手页 wp-round-tag 同源(@cuberoot/shared roundLabel)
        roundName: roundLabel(g.rt),
        isFinal: rt?.final ?? false,
        compLink: comp?.link ?? g.comp,
        date: comp?.date ?? '',
        sum: g.top[0].v + g.top[1].v + g.top[2].v,
        podium: g.top.map(t => this.podiumCell(eventId, type, t.pid, t.v)),
      });
    }
    return out;
  }

  // NOTE: 排名——前三和最小的 10 个轮次
  private buildRanking(eventId: string, rounds: Round[], type: 'single' | 'average'): unknown[][] {
    return [...rounds]
      .sort((a, b) => a.sum - b.sum)
      .slice(0, 10)
      .map((r, i) => [
        i + 1, fmtSum(eventId, type, r.sum),
        r.podium[0], r.podium[1], r.podium[2],
        r.roundName, r.compLink, r.date,
      ]);
  }

  // NOTE: 历史——严格创新低的纪录序列(最新在上)
  private buildHistory(eventId: string, rounds: Round[], type: 'single' | 'average'): unknown[][] {
    const asc = filterWrHistory(rounds, r => r.date, r => r.sum, { strict: true });
    return asc.map((r, i) => {
      const improvement = i > 0 ? `-${fmtSum(eventId, type, asc[i - 1].sum - r.sum)}` : '';
      const days = calcDays(r.date, i < asc.length - 1 ? asc[i + 1].date : null);
      return [
        fmtSum(eventId, type, r.sum), improvement, days,
        r.podium[0], r.podium[1], r.podium[2],
        r.roundName, r.compLink, r.date,
      ];
    }).reverse();
  }

  // NOTE: podium 单元格——成绩 + 国旗(渲染层插入) + 名字内链;成绩放最前,不加括号
  private podiumCell(eventId: string, type: 'single' | 'average', pid: string, value: number): string {
    const name = this.persons.get(pid) ?? pid;
    const result = new SolveTime(eventId, type, value).clockFormat();
    return `${result} [${name}](https://www.worldcubeassociation.org/persons/${pid})`;
  }
}

function pushSection(target: StatSection[], eventName: string, rows: unknown[][]): void {
  if (rows.length > 0) target.push({ title: eventName, titleZh: eventZh(eventName), rows });
}

// NOTE: 和的显示——333fm 单次=步数,平均=步数×100;其余=厘秒
function fmtSum(eventId: string, type: 'single' | 'average', sum: number): string {
  if (eventId === '333fm') {
    return type === 'average' ? (sum / 100).toFixed(2) : String(sum);
  }
  return SolveTime.centisecondsToClockFormat(sum);
}
