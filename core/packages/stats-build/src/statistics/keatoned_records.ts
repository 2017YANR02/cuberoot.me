// NOTE: 日掩纪录 —— 够到世界纪录却因同日有更快成绩而不被认定的成绩(WCA Reg 9i2)
//
// Reg 9i2:「同一日历日多次达成某地区纪录时,只认定其中最好的一条」。所以一个平了或破了
// 当时世界纪录的成绩,只要那天别处(或同场后面一轮)出现更快的,官方记录里就什么都不会留下。
//
// 圈内管这个叫 keatoned:2015-11-21 River Hill Fall 2015,Keaton Ellis 用 5.09 破了当时
// 5.25 的三阶单次世界纪录,几小时后同场的 Lucas Etter 打出 4.90 —— WCA 库里 Keaton 那条
// regional_single_record 是 NULL,连美国纪录都没留下(Lucas 也是美国人)。
//
// 算法:按项目 + 单次/平均各自重建「世界纪录日线」(截至前一日的累计最小值),命中条件是
//   ① 不差于前一日的纪录线(平纪录也算,Reg 9i1a)
//   ② 不是当日最好
//   ③ 官方 regional_*_record 为空
// ③ 同时兼作校正:轮次日期在 dump 里拿不到,只能用比赛末日近似,多日赛会把不同日的轮次
// 压成一天;凡是官方真给了纪录标记的,说明并没有被掩,直接排除 —— 官方标记就是判据。
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS_ENTRIES } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { query as dbQuery } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: mysql2 把 DATE 列解成 JS Date;String(date) 会变成 "Sun Aug 24 …",
// toISOString() 又会按 UTC 位移把日期挪一天。只能取本地日期分量。
function ymd(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

const METRICS = [
  { col: 'best', tag: 'regional_single_record', isAvg: false },
  { col: 'average', tag: 'regional_average_record', isAvg: true },
] as const;

export class KeatonedRecords extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Keatoned records';
    this.titleZh = '日掩纪录';
    this.note = 'World records that were never recognized: a faster result of the same kind landed on the same calendar date, so under Regulation 9i2 only that one counted. Named after Keaton Ellis, whose 5.09 at River Hill Fall 2015 was erased hours later by Lucas Etter\'s 4.90.';
    this.noteZh = '够到了世界纪录却从未被认定的成绩:同一日历日出现了更快的同类成绩,按规则 9i2 只认最好的那条。「日掩」一词源自 Keaton Ellis —— 他在 2015 年 River Hill Fall 打出的 5.09 破了当时的世界纪录,几小时后被同场 Lucas Etter 的 4.90 抹掉。';
    this.tableHeader = {
      'Person': 'left',
      'Result': 'right',
      'Type': 'center',
      'Competition': 'left',
      'Beaten by': 'left',
      'Date': 'center',
    };
  }

  // NOTE: 基类只发一条 SQL;这里按 (项目 × 单次/平均) 分批发 —— 一条覆盖全项目的窗口查询要
  // 物化 1100 万行两次(实测 >2min),分批后每批的 CTE 只有该项目的量,全部跑完约 100s。
  override async queryResults(): Promise<RowDataPacket[]> {
    const out: RowDataPacket[] = [];
    for (const [eventId] of EVENTS_ENTRIES) {
      for (const m of METRICS) {
        const hits = await dbQuery(`
          WITH r AS (
            SELECT c.end_date d, res.person_id, res.competition_id, res.${m.col} v
            FROM results res
            JOIN competitions c ON c.id = res.competition_id
            WHERE res.event_id = '${eventId}' AND res.${m.col} > 0
              AND (res.${m.tag} IS NULL OR res.${m.tag} = '')
          ),
          allv AS (
            SELECT c.end_date d, res.${m.col} v
            FROM results res
            JOIN competitions c ON c.id = res.competition_id
            WHERE res.event_id = '${eventId}' AND res.${m.col} > 0
          ),
          day AS (SELECT d, MIN(v) dm FROM allv GROUP BY d),
          line AS (
            SELECT d, dm,
                   MIN(dm) OVER (ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) pw
            FROM day
          )
          SELECT
            '${eventId}' event_id,
            ${m.isAvg ? 1 : 0} is_avg,
            r.d date,
            r.v value,
            l.pw old_record,
            l.dm day_best,
            person.name person_name,
            r.person_id,
            comp.cell_name comp_name,
            r.competition_id
          FROM r
          JOIN line l ON l.d = r.d
          JOIN persons person ON person.wca_id = r.person_id AND person.sub_id = 1
          JOIN competitions comp ON comp.id = r.competition_id
          WHERE l.pw IS NOT NULL AND r.v <= l.pw AND r.v > l.dm
          ORDER BY r.d
        `);
        // NOTE: 谁抹掉的 —— 只对命中的 (日期, 当日最好) 逐条回查,走索引,几十次单行查询。
        for (const h of hits) {
          const winner = await dbQuery(`
            SELECT person.name person_name, comp.cell_name comp_name, res.competition_id
            FROM results res
            JOIN competitions c ON c.id = res.competition_id
            JOIN persons person ON person.wca_id = res.person_id AND person.sub_id = 1
            JOIN competitions comp ON comp.id = res.competition_id
            WHERE res.event_id = '${eventId}' AND res.${m.col} = ${Number(h['day_best'])}
              AND c.end_date = '${ymd(h['date'])}'
            LIMIT 1
          `);
          h['beater_name'] = winner[0]?.['person_name'] ?? '';
          h['beater_comp'] = winner[0]?.['comp_name'] ?? '';
          h['beater_comp_id'] = winner[0]?.['competition_id'] ?? '';
          out.push(h);
        }
      }
    }
    return out;
  }

  query(): string {
    // NOTE: queryResults() 已覆写,这里不会被调用。
    return 'SELECT 1';
  }

  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      // 倒序:最近发生的排在最前(同日多条保持 queryResults 的次序,Array#sort 稳定)。
      const hits = rows
        .filter(r => r['event_id'] === eventId)
        .sort((a, b) => ymd(b['date']).localeCompare(ymd(a['date'])));

      const results = hits.map(r => {
        const isAvg = Number(r['is_avg']) === 1;
        const kind = isAvg ? 'average' : 'single';
        const value = new SolveTime(eventId, kind, Number(r['value'])).clockFormat();
        const beat = new SolveTime(eventId, kind, Number(r['day_best'])).clockFormat();
        return [
          `[${r['person_name']}](https://www.worldcubeassociation.org/persons/${r['person_id']})`,
          `**${value}**`,
          isAvg ? 'Average' : 'Single',
          `[${r['comp_name']}](https://www.worldcubeassociation.org/competitions/${r['competition_id']})`,
          r['beater_comp_id']
            ? `${r['beater_name']} ${beat} — [${r['beater_comp']}](https://www.worldcubeassociation.org/competitions/${r['beater_comp_id']})`
            : `${r['beater_name']} ${beat}`,
          ymd(r['date']),
        ];
      });

      return [eventName, results] as [string, unknown[][]];
    });
  }
}
