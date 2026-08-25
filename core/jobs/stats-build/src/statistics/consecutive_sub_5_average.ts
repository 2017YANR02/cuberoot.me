// NOTE: 最多连续 sub-5 average（333 项目）
// 双视图：Ranking（每人最长 streak，top 100）+ History（WR 演变，倒序）
import { formatDate } from '../core/format_date.js';
import { Statistic } from '../core/statistic.js';
import { headerZh } from '../core/events.js';
import type { StatJson, StatPanel, Alignment, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: sub-5 的阈值，500 = 5.00 秒（WCA 用厘秒存储）
const SUB_X_THRESHOLD = 500;

// NOTE: Ranking 表头
const RANKING_HEADER: TableHeader = {
  'Streak': 'right', 'Person': 'left', 'Started at': 'left', 'Ended at': 'left',
};

// NOTE: History 表头
const HISTORY_HEADER: TableHeader = {
  'Streak': 'right', 'Person': 'left', 'Period': 'left',
};

// NOTE: 连续 sub-5 段的数据结构
interface StreakInfo {
  count: number;
  personId: string;
  personLink: string;
  startComp: string;       // 比赛名
  startCompId: string;     // 比赛 ID（用于构造链接）
  endComp: string;
  endCompId: string;
  endDate: string;         // 结束日期（用于 History 排序）
}

export class ConsecutiveSub5Average extends Statistic {
  constructor() {
    super();
    this.title = 'Most consecutive sub-5 averages in 3x3x3';
    this.titleZh = '3x3x3 最多连续 sub-5 平均';
    this.note = 'Only official 3x3x3 averages are considered. Computed across all rounds in chronological order.';
    this.noteZh = '仅考虑官方 3x3x3 平均成绩。按所有轮次的时间顺序计算。';
    // NOTE: 不使用基类的 tableHeader，自定义输出
    this.tableHeader = {};
  }

  query(): string {
    return `
      SELECT
        result.person_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        result.average,
        competition.cell_name competition_name,
        competition.id competition_id,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      JOIN round_types round_type ON round_type.id = result.round_type_id
      WHERE result.event_id = '333'
      ORDER BY result.person_id, competition.start_date, round_type.rank
    `;
  }

  // NOTE: 覆写 toJson——输出 panels（Ranking + History）
  async toJson(): Promise<StatJson> {
    let rawRows: RowDataPacket[] | null = await this.queryResults();
    const allStreaks = this.collectAllStreaks(rawRows);
    // NOTE: 内存管理——collectAllStreaks 完成后释放原始查询结果
    rawRows = null;
    if (global.gc) global.gc();

    // 视图 1: Ranking（每人只取最长 streak，按 streak 降序，top 100）
    const bestByPerson = new Map<string, StreakInfo>();
    for (const s of allStreaks) {
      const existing = bestByPerson.get(s.personId);
      if (!existing || s.count > existing.count) {
        bestByPerson.set(s.personId, s);
      }
    }
    const ranking = [...bestByPerson.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map(s => [
        s.count,
        s.personLink,
        this.compLink(s.startComp, s.startCompId),
        this.compLink(s.endComp, s.endCompId),
      ]);

    // 视图 2: History（按结束日期排序，只保留打破/追平纪录的行，最终倒序）
    const wrHistory = this.buildWrHistory(allStreaks);
    const historyRows = wrHistory.map(s => {
      const period = `${this.compLink(s.startComp, s.startCompId)} → ${this.compLink(s.endComp, s.endCompId)}`;
      return [s.count, s.personLink, period];
    });

    // NOTE: 构建 panels
    const buildHeader = (header: TableHeader) =>
      Object.entries(header).map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label, labelZh: headerZh(label), align,
      }));

    const panels: StatPanel[] = [
      {
        id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
        header: buildHeader(RANKING_HEADER),
        sections: [{ title: '', titleZh: '', rows: ranking }],
      },
      {
        id: 'history', labelEn: 'History', labelZh: '历史',
        header: buildHeader(HISTORY_HEADER),
        sections: [{ title: '', titleZh: '', rows: historyRows }],
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

  // NOTE: 从所有原始行中收集所有选手的连续 sub-5 段
  private collectAllStreaks(rows: RowDataPacket[]): StreakInfo[] {
    const allStreaks: StreakInfo[] = [];

    // NOTE: 按 person_id 分组（rows 已按 person_id 排序）
    const byPerson = new Map<string, RowDataPacket[]>();
    for (const r of rows) {
      const pid = String(r['person_id']);
      const existing = byPerson.get(pid);
      if (existing) existing.push(r);
      else byPerson.set(pid, [r]);
    }

    for (const [, personRows] of byPerson) {
      this.collectStreaksForPerson(personRows, allStreaks);
    }

    return allStreaks;
  }

  // NOTE: 找出一个选手的所有连续 sub-5 average 段（count > 1）
  private collectStreaksForPerson(rows: RowDataPacket[], result: StreakInfo[]): void {
    const personId = String(rows[0]['person_id']);
    const personLink = String(rows[0]['person_link']);
    let current = this.newStreak();

    for (const r of rows) {
      const avg = Number(r['average']);
      if (avg > 0 && avg < SUB_X_THRESHOLD) {
        if (current.count === 0) {
          current.startComp = String(r['competition_name']);
          current.startCompId = String(r['competition_id']);
        }
        current.count += 1;
        current.endComp = String(r['competition_name']);
        current.endCompId = String(r['competition_id']);
        current.endDate = formatDate(r['start_date']);
      } else {
        if (current.count > 1) {
          result.push({ ...current, personId, personLink });
        }
        current = this.newStreak();
      }
    }

    // NOTE: 最后一段（仍在进行中的 streak）
    if (current.count > 1) {
      result.push({ ...current, personId, personLink });
    }
  }

  private newStreak(): Omit<StreakInfo, 'personId' | 'personLink'> & { personId: string; personLink: string } {
    return {
      count: 0, startComp: '', startCompId: '',
      endComp: '', endCompId: '', endDate: '',
      personId: '', personLink: '',
    };
  }

  // NOTE: 构建 WR History——按结束日期排序，只保留 >= 当前最大值的行，最终倒序
  private buildWrHistory(streaks: StreakInfo[]): StreakInfo[] {
    // NOTE: 按 [endDate, count] 升序排序
    const sorted = [...streaks].sort((a, b) => {
      const dc = a.endDate.localeCompare(b.endDate);
      return dc !== 0 ? dc : a.count - b.count;
    });

    let maxCount = 0;
    const history = sorted.filter(s => {
      if (s.count >= maxCount && s.count > 1) {
        maxCount = s.count;
        return true;
      }
      return false;
    });

    return history.reverse();
  }

  // NOTE: 构建比赛链接的 Markdown 格式
  private compLink(name: string, id: string): string {
    return `[${name}](https://www.worldcubeassociation.org/competitions/${id})`;
  }
}
