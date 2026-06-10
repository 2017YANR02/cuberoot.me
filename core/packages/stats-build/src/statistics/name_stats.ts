// NOTE: 姓名统计——双面板:① 词数(按空格 part 数) ② 字符长度(去括号本地名后的字符数)
// 两面板共用同一份 persons 查询,各自分桶 + top5 国家 + 选手名单。
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
    this.note = 'Local names within parentheses are ignored. For large groups only a sample of competitors is shown.';
    this.noteZh = '括号内的本地名称被忽略。人数较多的分组仅列出部分选手。';
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
  private buildRows(people: Person[], keyOf: (deparen: string) => number, desc: boolean): unknown[][] {
    const groups = new Map<number, Person[]>();
    for (const p of people) {
      const deparen = p.name.replace(/ \(.*\)/, '');
      const k = keyOf(deparen);
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

    // ① 词数:按空格拆,降序(多名 → 单名,长名俱乐部在前)
    const partsRows = this.buildRows(people, d => d.split(' ').length, true);
    // ② 字符长度:去括号本地名后的字符数(含空格),降序(最长名在前)
    const lengthRows = this.buildRows(people, d => [...d].length, true);

    const partsHeader: TableHeader = {
      'Parts': 'center', 'People': 'right', 'Countries of origin': 'left', 'Names': 'left',
    };
    const lengthHeader: TableHeader = {
      'Length': 'center', 'People': 'right', 'Countries of origin': 'left', 'Names': 'left',
    };

    const section = (rows: unknown[][]): StatSection[] => [{ title: '', titleZh: '', rows }];

    const panels: StatPanel[] = [
      { id: 'parts', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsRows) },
      { id: 'length', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthRows) },
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
