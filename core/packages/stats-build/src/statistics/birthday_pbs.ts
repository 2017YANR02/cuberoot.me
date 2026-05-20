// NOTE: PR 成绩 = 比赛日期(M.DD 严格匹配,M=月 DD=日)
// 例:5.20 PR 创下于 5月20日;10.31 PR 创下于 10月31日
// - 历史 PR (含被自己后来刷掉的)
// - 仅时间类项目 (排 333fm/333mbf)
// - PR 创下当天: M月DD日 必须落在 [comp.start_date, comp.end_date] 内
//   (WCA dump 不存 round-level 日期,只有比赛起止)
// - 输出 panels: [ranking, history]
//     ranking — 每人每 (event, type) 只保留最快一条,按速度升序
//     history — "全世界最快生日 PR"的沿革:对每个 (event, type),按时间正序过滤
//               出 running min,即每次刷新历史最快生日 PR 的时刻(reverse 后新→旧)
//               跟 wr_bpa 等 RoundMetric 的 history 同语义
// - sections title = "EventName - Single/Average" → WcaStatsPage 自动启用项目选择器
//   + 单次/平均 pill bar(EVENT_NAME_TO_ID 反查 + ' - ' 后缀检测)
import { Statistic, type StatJson, type StatPanel } from '../core/statistic.js';
import { EVENTS_ENTRIES, eventZh } from '../core/events.js';
import { query as dbQuery } from '../core/database.js';
import { filterWrHistory, calcDays } from '../core/format_date.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 时间类项目 — events.format='time' (排除 333fm 步数 / 333mbf 多盲编码)
// 按 EVENTS_ENTRIES 顺序遍历,与 ALL_EVENT_IDS 选择器顺序一致
const TIME_EVENT_IDS = [
  '333','222','444','555','666','777','333oh','333bf',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333ft','magic','mmagic',
];
const TIME_EVENT_SET = new Set(TIME_EVENT_IDS);

export class BirthdayPbs extends Statistic {
  constructor() {
    super();
    this.title = 'Personal records where the time equals the date';
    this.titleZh = '个人纪录成绩等于当日日期';
    this.note = 'PRs where the result (formatted as M.DD seconds) matches the competition day (month M, day DD). Ranking shows each person\'s fastest birthday-PR per event and metric. History shows the running-best progression: each new fastest birthday-PR ever achieved worldwide.';
    this.noteZh = '历史上所有 PR 中,成绩格式化为 M.DD 秒时,恰好等于比赛当天的"M月DD日"。排名 = 每人每项目每类型只保留最快一条。历史 = 历史上"全世界最快生日 PR"被一步步刷新的沿革。';
  }

  // NOTE: 复合查询用 toJson 覆写,query() 不用
  query(): string {
    return 'SELECT 1';
  }

  override async toJson(): Promise<StatJson> {
    const events = TIME_EVENT_IDS.map(e => `'${e}'`).join(',');

    // NOTE: 两步过滤策略(实测全程 ~75s):
    //   Step A: r.best/average ∈ [101,1231] 且 M月DD日 ∈ [start_date, end_date]
    //   Step B: NOT EXISTS 校验该成绩在当时是 PR
    //   不用 window function over 全表(6.4M 行排序太慢)
    const buildSql = (col: 'best' | 'average') => `
      SELECT
        r.person_id,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', r.person_id, ')') person_link,
        r.event_id,
        r.${col} AS val,
        c.start_date,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link
      FROM results r
      JOIN competitions c ON c.id = r.competition_id
      JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      WHERE r.${col} BETWEEN 101 AND 1231
        AND r.event_id IN (${events})
        AND (r.${col} MOD 100) BETWEEN 1 AND 31
        AND FLOOR(r.${col} / 100) BETWEEN 1 AND 12
        AND STR_TO_DATE(
          CONCAT(YEAR(c.start_date), '-', FLOOR(r.${col} / 100), '-', r.${col} MOD 100),
          '%Y-%c-%e'
        ) BETWEEN c.start_date AND COALESCE(c.end_date, c.start_date)
        AND NOT EXISTS (
          SELECT 1 FROM results r2
          JOIN competitions c2 ON c2.id = r2.competition_id
          WHERE r2.person_id = r.person_id
            AND r2.event_id = r.event_id
            AND r2.${col} > 0
            AND r2.${col} <= r.${col}
            AND (
              c2.start_date < c.start_date
              OR (c2.start_date = c.start_date AND r2.id < r.id)
            )
        )
      ORDER BY r.${col} ASC, c.start_date ASC
    `;

    const singleRows = await dbQuery<RowDataPacket[]>(buildSql('best'));
    const averageRows = await dbQuery<RowDataPacket[]>(buildSql('average'));

    // NOTE: M.DD 成绩字符串(整数部分=月,两位小数=日)
    const fmtResult = (val: number) => `${Math.floor(val / 100)}.${String(val % 100).padStart(2, '0')}`;

    // NOTE: Date 列严格对应 Result 的 M.DD — 年份取自比赛 start_date(WCA dump
    // 不保留 round 粒度日期,多日比赛只能用比赛年定锚 YYYY)
    const fmtDate = (val: number, d: Date) =>
      `${d.getFullYear()}-${String(Math.floor(val / 100)).padStart(2, '0')}-${String(val % 100).padStart(2, '0')}`;

    // NOTE: 按 (event, type) 切分 — section title 走 "EventName - Single/Average" 格式,
    // 命中 SectionsView 的 metric 后缀检测(自动出 Single/Average pill bar)+
    // EVENT_NAME_TO_ID 反查(自动出项目选择器)
    const groupByEvent = (rows: RowDataPacket[]) => {
      const buckets = new Map<string, RowDataPacket[]>();
      for (const r of rows) {
        const eid = r['event_id'] as string;
        if (!TIME_EVENT_SET.has(eid)) continue;
        if (!buckets.has(eid)) buckets.set(eid, []);
        buckets.get(eid)!.push(r);
      }
      return buckets;
    };

    const singleBuckets = groupByEvent(singleRows);
    const averageBuckets = groupByEvent(averageRows);

    // NOTE: Ranking 视图 — 每人每 (event, type) 只保留最快一条,按速度升序
    const rankingRows = (rows: RowDataPacket[]): unknown[][] => {
      const best = new Map<string, RowDataPacket>();
      for (const r of rows) {
        const pid = r['person_id'] as string;
        const cur = best.get(pid);
        if (!cur || Number(r['val']) < Number(cur['val'])) best.set(pid, r);
      }
      return [...best.values()]
        .sort((a, b) => Number(a['val']) - Number(b['val']))
        .map((r, i) => {
          const val = Number(r['val']);
          return [
            i + 1,
            r['person_link'],
            fmtResult(val),
            fmtDate(val, r['start_date'] as Date),
            r['competition_link'],
          ];
        });
    };

    // NOTE: History 视图 — "全世界最快生日 PR" 沿革
    // filterWrHistory 按日期正序扫描,保留每次 metric 创历史新低的记录
    // 每行带 Improvement(对上次的提升 %)+ Days(距下次刷新天数,最新一条用 today)
    // reverse 后展示顺序新→旧(对齐 wr_bpa 等 RoundMetric history)
    const historyRows = (rows: RowDataPacket[]): unknown[][] => {
      const wr = filterWrHistory(
        rows,
        r => r['start_date'],
        r => Number(r['val']),
      );
      // 时间正序的 running min, wr 数组按日期 asc;先生成行(asc),再 reverse
      const out: unknown[][] = wr.map((r, i) => {
        const val = Number(r['val']);
        const resultStr = fmtResult(val);
        let imp = '';
        if (i > 0) {
          const prevVal = Number(wr[i - 1]['val']);
          imp = `${((prevVal - val) / prevVal * 100).toFixed(1)}%`;
        }
        const nextDate = i < wr.length - 1 ? wr[i + 1]['start_date'] : null;
        const days = calcDays(r['start_date'], nextDate);
        return [
          resultStr,
          imp,
          days,
          r['person_link'],
          fmtDate(val, r['start_date'] as Date),
          r['competition_link'],
        ];
      });
      return out.reverse();
    };

    const buildSections = (kind: 'ranking' | 'history') => {
      const sections: { title: string; titleZh: string; rows: unknown[][] }[] = [];
      for (const [eid, eventName] of EVENTS_ENTRIES) {
        if (!TIME_EVENT_SET.has(eid)) continue;
        const eventNameZh = eventZh(eventName);
        for (const [metricLabel, buckets] of [
          ['Single', singleBuckets],
          ['Average', averageBuckets],
        ] as const) {
          const raw = buckets.get(eid);
          if (!raw?.length) continue;
          const processed = kind === 'ranking' ? rankingRows(raw) : historyRows(raw);
          if (!processed.length) continue;
          sections.push({
            title: `${eventName} - ${metricLabel}`,
            titleZh: eventNameZh,
            rows: processed,
          });
        }
      }
      return sections;
    };

    // NOTE: ranking / history 各自独立 header
    type H = Array<{ key: string; label: string; labelZh: string; align: 'left' | 'right' | 'center' }>;
    const rankingHeader: H = [
      { key: '',            label: '#',           labelZh: '#',     align: 'right' },
      { key: 'person',      label: 'Person',      labelZh: '选手',  align: 'left'  },
      { key: 'result',      label: 'Result',      labelZh: '成绩',  align: 'right' },
      { key: 'date',        label: 'Date',        labelZh: '日期',  align: 'left'  },
      { key: 'competition', label: 'Competition', labelZh: '比赛',  align: 'left'  },
    ];
    const historyHeader: H = [
      { key: 'result',      label: 'Result',      labelZh: '成绩',  align: 'right' },
      { key: 'improvement', label: 'Improvement', labelZh: '提升',  align: 'right' },
      { key: 'days',        label: 'Days',        labelZh: '天数',  align: 'right' },
      { key: 'person',      label: 'Person',      labelZh: '选手',  align: 'left'  },
      { key: 'date',        label: 'Date',        labelZh: '日期',  align: 'left'  },
      { key: 'competition', label: 'Competition', labelZh: '比赛',  align: 'left'  },
    ];

    const panels: StatPanel[] = [
      {
        id: 'ranking',
        labelEn: 'Ranking',
        labelZh: '排名',
        header: rankingHeader,
        sections: buildSections('ranking'),
      },
      {
        id: 'history',
        labelEn: 'History',
        labelZh: '历史',
        header: historyHeader,
        sections: buildSections('history'),
      },
    ];

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh,
      note: this.note,
      noteZh: this.noteZh,
      header: [],  // NOTE: panels 各自带 header
      panels,
    };
  }
}
