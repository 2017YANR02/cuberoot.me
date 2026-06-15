// NOTE: 姓名统计——四面板 = {词数, 字符长度} × {去本地名, 含本地名}
//   去本地名:去掉 "Latin (本地名)" 末尾括号后统计(默认);含本地名:按完整 WCA 名统计。
//   前端用 parens toggle 在两套之间切换(id 后缀 _full = 含本地名)。
// 四面板共用同一份 persons 查询,各自分桶 + top 国家 + 选手名单。
import { Statistic } from '../core/statistic.js';
import { headerZh } from '../core/events.js';
import type { StatJson, StatPanel, StatSection, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

interface Person { name: string; countryName: string; wcaId: string; }

// NOTE: 选手名单——某桶人数 ≤ FULL_MAX 全列(覆盖长名俱乐部),更多的取前 SAMPLE。
const FULL_MAX = 100;
const SAMPLE = 30;

export class NameStats extends Statistic {
  constructor() {
    super();
    this.title = 'Name statistics';
    this.titleZh = '姓名统计';
    this.note = 'Toggle whether to include the parenthesized local name. For large groups only a sample of competitors is shown.';
    this.noteZh = '可切换是否计入括号内的本地名。人数较多的分组仅列出部分选手。';
  }

  query(): string {
    return `
      SELECT
        person.name name,
        person.wca_id wca_id,
        country.name country_name
      FROM persons person
      JOIN countries country ON country.id = country_id
      WHERE sub_id = 1
    `;
  }

  private buildHeader(h: TableHeader) {
    return Object.entries(h).map(([label, align]) => ({
      key: label.toLowerCase().replace(/\s+/g, '_'),
      label,
      labelZh: headerZh(label),
      align,
    }));
  }

  // NOTE: 按 keyOf 分桶 → 每桶人数 + top5 国家 + 选手名单({_type:'people'})
  //   nameOf 决定按哪种名统计:去本地名(deparen)或完整名(identity)。
  private buildRows(people: Person[], nameOf: (raw: string) => string, keyOf: (s: string) => number, desc: boolean): unknown[][] {
    const groups = new Map<number, Person[]>();
    for (const p of people) {
      const k = keyOf(nameOf(p.name));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }

    const result: unknown[][] = [];
    for (const [key, grp] of groups) {
      const countryCount = new Map<string, number>();
      for (const p of grp) countryCount.set(p.countryName, (countryCount.get(p.countryName) ?? 0) + 1);
      // NOTE: top 8 国家 {c: 国家名, n: 人数, p: 百分比}(前端渲国旗 + 占比)
      const countries = [...countryCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([c, n]) => ({ c, n, p: (n / grp.length) * 100 }));

      // NOTE: 选手 {n: 名字, id: wcaId}(前端渲国旗 + 站内链接);≤FULL_MAX 全列,否则取前 SAMPLE
      const sorted = [...grp].sort((a, b) => a.name.localeCompare(b.name));
      const sample = sorted.length <= FULL_MAX ? sorted : sorted.slice(0, SAMPLE);
      const items = sample.map(p => ({ n: p.name, id: p.wcaId }));

      result.push([key, grp.length, countries, { total: grp.length, items }]);
    }

    result.sort((a, b) => desc ? (b[0] as number) - (a[0] as number) : (a[0] as number) - (b[0] as number));
    return result;
  }

  async toJson(): Promise<StatJson> {
    let rawRows: RowDataPacket[] | null = await this.queryResults();
    const people: Person[] = rawRows.map(r => ({
      name: r['name'] as string,
      countryName: r['country_name'] as string,
      wcaId: r['wca_id'] as string,
    }));
    rawRows = null;
    if (global.gc) global.gc();

    const deparen = (s: string) => s.replace(/ \(.*\)/, '');
    const full = (s: string) => s;
    // ① 词数:按空格拆,降序(多名 → 单名,长名俱乐部在前)。去本地名 + 含本地名两套。
    const partsRows = this.buildRows(people, deparen, d => d.split(' ').length, true);
    const partsFullRows = this.buildRows(people, full, d => d.split(' ').length, true);
    // ② 字符长度:字符数(含空格),降序(最长名在前)。去本地名 + 含本地名两套。
    const lengthRows = this.buildRows(people, deparen, d => [...d].length, true);
    const lengthFullRows = this.buildRows(people, full, d => [...d].length, true);

    const partsHeader: TableHeader = {
      'Parts': 'center', 'People': 'right', 'Countries of origin': 'left', 'Names': 'left',
    };
    const lengthHeader: TableHeader = {
      'Length': 'center', 'People': 'right', 'Countries of origin': 'left', 'Names': 'left',
    };

    const section = (rows: unknown[][]): StatSection[] => [{ title: '', titleZh: '', rows }];

    // 去本地名(默认)+ 含本地名(_full),前端 parens toggle 切换
    const panels: StatPanel[] = [
      { id: 'parts', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsRows) },
      { id: 'length', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthRows) },
      { id: 'parts_full', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsFullRows) },
      { id: 'length_full', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthFullRows) },
    ];

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],
      panels,
    };
  }
}
