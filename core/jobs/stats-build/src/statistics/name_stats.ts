// NOTE: 姓名统计——八面板 = {词数, 字符长度} × {英文名, 全名, 本地名, 含曾用名}
//   英文名:去掉 "Latin (本地名)" 末尾括号后的拉丁名(默认,无后缀);
//   全名(_full):完整 WCA 名(拉丁名 + 括号);本地名(_local):仅括号内本地名(无本地名者剔除);
//   含曾用名(_aka):现名(全名)+ sub_id>1 历史曾用名拼成一个整体。
//   前端用四态切换(id 后缀 ''/_full/_local/_aka)。
// 八面板共用 sub_id=1 的 persons 查询(曾用名另查 sub_id>1),各自分桶 + top 国家 + 选手名单。
import { Statistic } from '../core/statistic.js';
import { headerZh } from '../core/events.js';
import { query } from '../core/database.js';
import type { StatJson, StatPanel, StatSection, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// current / former 仅含曾用名(_aka)面板用:name=合并串(供分桶按总长算),
// 显示时 current=现名(全名)、former=各曾用名,前端分开渲染避免一串连读。
interface Person { name: string; countryName: string; wcaId: string; current?: string; former?: string[]; }

// NOTE: 选手名单——某桶人数 ≤ FULL_MAX 全列(覆盖长名俱乐部),更多的取前 SAMPLE。
const FULL_MAX = 100;
const SAMPLE = 30;

export class NameStats extends Statistic {
  constructor() {
    super();
    this.title = 'Name statistics';
    this.titleZh = '姓名统计';
    this.note = 'Switch between the Latin name, the full name, the local name (inside parentheses), and the full name plus former names. For large groups only a sample of competitors is shown.';
    this.noteZh = '可在英文名、全名、本地名(括号内)、含曾用名(全名 + 曾用名)之间切换。人数较多的分组仅列出部分选手。';
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
      const items = sample.map(p =>
        p.former && p.former.length
          ? { n: p.current ?? p.name, id: p.wcaId, former: p.former }
          : { n: p.name, id: p.wcaId },
      );

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

    // 曾用名:同一 wca_id 的 sub_id>1 历史记录(改名 / 改国籍都会留行),只取与现名不同的姓名。
    let formerRows: RowDataPacket[] | null = await query('SELECT wca_id, name FROM persons WHERE sub_id > 1 ORDER BY wca_id, sub_id');
    const formerByWcaId = new Map<string, string[]>();
    for (const r of formerRows) {
      const id = r['wca_id'] as string;
      const arr = formerByWcaId.get(id) ?? [];
      arr.push(r['name'] as string);
      formerByWcaId.set(id, arr);
    }
    formerRows = null;
    if (global.gc) global.gc();

    const deparen = (s: string) => s.replace(/ \(.*\)/, '');
    const full = (s: string) => s;
    // 本地名:末尾括号内的内容(WCA "Latin (本地名)" 形式);无括号者本地名为空。
    const localOnly = (s: string) => { const m = s.match(/\(([^)]*)\)\s*$/); return m ? m[1].trim() : ''; };
    // 本地名面板只统计真有本地名的选手(否则空名挤进 0 词/0 字桶,毫无意义)。
    const peopleWithLocal = people.filter(p => localOnly(p.name) !== '');
    const wordCount = (d: string) => d.split(/\s+/).filter(Boolean).length;
    // 含曾用名:现名(全名)+ 各曾用名(去重、剔除与现名相同的改国籍行)拼成一个整体;无曾用名者等同全名。
    const peopleAka: Person[] = people.map(p => {
      const formers = formerByWcaId.get(p.wcaId);
      if (!formers) return p;
      const distinct = formers.filter((n, i, a) => n !== p.name && a.indexOf(n) === i);
      // name=合并串(分桶按总长);current/former 给前端拆开显示
      return distinct.length ? { ...p, name: `${p.name} ${distinct.join(' ')}`, current: p.name, former: distinct } : p;
    });
    // ① 词数:按空格拆,降序(多名 → 单名,长名俱乐部在前)。英文名 / 全名 / 本地名 / 含曾用名四套。
    const partsRows = this.buildRows(people, deparen, wordCount, true);
    const partsFullRows = this.buildRows(people, full, wordCount, true);
    const partsLocalRows = this.buildRows(peopleWithLocal, localOnly, wordCount, true);
    const partsAkaRows = this.buildRows(peopleAka, full, wordCount, true);
    // ② 字符长度:字符数(含空格),降序(最长名在前)。英文名 / 全名 / 本地名 / 含曾用名四套。
    const lengthRows = this.buildRows(people, deparen, d => [...d].length, true);
    const lengthFullRows = this.buildRows(people, full, d => [...d].length, true);
    const lengthLocalRows = this.buildRows(peopleWithLocal, localOnly, d => [...d].length, true);
    const lengthAkaRows = this.buildRows(peopleAka, full, d => [...d].length, true);

    const partsHeader: TableHeader = {
      'Parts': 'center', 'People': 'right', 'Countries of origin': 'left', 'Names': 'left',
    };
    const lengthHeader: TableHeader = {
      'Length': 'center', 'People': 'right', 'Countries of origin': 'left', 'Names': 'left',
    };

    const section = (rows: unknown[][]): StatSection[] => [{ title: '', titleZh: '', rows }];

    // 英文名(默认,无后缀)+ 全名(_full)+ 本地名(_local)+ 含曾用名(_aka),前端四态切换
    const panels: StatPanel[] = [
      { id: 'parts', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsRows) },
      { id: 'length', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthRows) },
      { id: 'parts_full', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsFullRows) },
      { id: 'length_full', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthFullRows) },
      { id: 'parts_local', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsLocalRows) },
      { id: 'length_local', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthLocalRows) },
      { id: 'parts_aka', labelEn: 'Word count', labelZh: '词数', header: this.buildHeader(partsHeader), sections: section(partsAkaRows) },
      { id: 'length_aka', labelEn: 'Name length', labelZh: '字符长度', header: this.buildHeader(lengthHeader), sections: section(lengthAkaRows) },
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
