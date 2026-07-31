// 约束守卫:比赛名里的年号只有一个剥法 —— lib/comp-localize.ts 的 stripCompYear
// (经 localizeCompName 的 opts.date / <CompCell date=...> 触发)。
//
// 背景 issue #65:/wca/persons 的成绩表把「夹江公开赛2026」跟它下面的「2026-07-25」并排显示,
// 同一个年份在一行里出现两次。全站规则:比赛年份已经写在页面上(同行日期列 / 卡片日期 /
// 年份分组标题)时,比赛名里就不再重复年号;页面上没写年份的地方(搜索下拉、无日期列的榜单)
// 必须保留 —— 那里年号是唯一的区分信息。
//
// 这条规则原先被三处各抄一份正则实现(CompCard 的 /\s*20\d\d\s*$/、OngoingComps 的
// stripTrailingYear、CompDetailPage 的 stripCompYear),口径互不相同且都没覆盖到人物页。
// 现在统一收口:
//   - 写法层:<CompCell> 的 date 属性是**必填**(string | null),逼每个调用点表态;
//   - 实现层:任何调用点都不许再手搓「尾部四位年」正则(本测试扫描);
//   - 写入即拦:.claude/hooks/block-comp-name-year-regex.ps1 → hook-detect-comp-year-regex.mjs。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';
import { stripCompYear, localizeCompName } from '@/lib/comp-localize';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];
const SINGLE_SOURCE = 'lib/comp-localize.ts';

// 「比赛名尾部的年号」正则:落在 .replace( 里、以 $ 收尾、含年份形状(20\d\d / 19|20 / \d{2,4})。
// 日期串的加工(/^\d{4}-/、/20\d\d-/g 这类没有 $ 锚点的)不在此列,不会误伤。
const AD_HOC_YEAR_RE = /\.replace\(\s*\/[^/\n]*(?:20\\d\\d|19\|20|\\d\{\d(?:,\d)?\})[^/\n]*\$\s*\//g;
// 只在「确实在处理比赛名」的文件里判定,免得撞上别的领域里同形状的正则。
const COMP_CONTEXT_RE = /localizeCompName|CompCell|compName|comp\.name/;

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

describe('比赛名年号剥离只有一个实现', () => {
  it('没有调用点手搓「尾部四位年」正则', () => {
    const offenders: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (rel === SINGLE_SOURCE) continue;
        const src = readFileSync(file, 'utf8');
        if (!COMP_CONTEXT_RE.test(src)) continue;
        for (const m of src.matchAll(AD_HOC_YEAR_RE)) {
          const line = src.slice(0, m.index ?? 0).split('\n').length;
          offenders.push(`${rel}:${line}\t${m[0]}`);
        }
      }
    }
    expect(
      offenders,
      '比赛名的年号剥离必须走 lib/comp-localize.ts 的 stripCompYear —— 调用点传 ' +
        'localizeCompName(id, name, isZh, { date }) 或 <CompCell date={…} />,别再手写正则:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('CompCell 的 date 属性保持必填(逼调用点表态)', () => {
    const src = readFileSync(join(ROOT, 'components/CompCell/CompCell.tsx'), 'utf8');
    expect(
      /^\s*date:\s*string\s*\|\s*null;/m.test(src),
      'CompCell 的 date 必须是必填的 `date: string | null`(不是 date?:)—— 改成可选的话,' +
        '新调用点会默默漏传,人物页那种「名字里 2026 + 下面 2026-07-25」的重复就又回来了。',
    ).toBe(true);
  });
});

describe('stripCompYear', () => {
  it('年份对得上才剥,中英两种写法都剥', () => {
    expect(stripCompYear('夹江公开赛2026', '2026-07-25')).toBe('夹江公开赛');
    expect(stripCompYear('Jiajiang Open 2026', '2026-07-25')).toBe('Jiajiang Open');
    expect(stripCompYear('2026年夹江公开赛', '2026')).toBe('夹江公开赛');
    expect(stripCompYear('2026 Jiajiang Open', '2026-07-25')).toBe('Jiajiang Open');
  });

  it('年份对不上 / 没传日期时原样保留', () => {
    expect(stripCompYear('夹江公开赛2026', '2025-07-25')).toBe('夹江公开赛2026');
    expect(stripCompYear('夹江公开赛2026', null)).toBe('夹江公开赛2026');
    expect(stripCompYear('夹江公开赛2026', undefined)).toBe('夹江公开赛2026');
    expect(stripCompYear('夹江公开赛2026', '')).toBe('夹江公开赛2026');
  });

  it('名字里有意义的四位数不吃掉', () => {
    // 年号只在首尾锚点上剥,名字中段的四位数(会场编号 / 赛事代号)不动。
    expect(stripCompYear('Open 2026 Series Final', '2026-01-01')).toBe('Open 2026 Series Final');
    // 剥完只剩空串就退回原名(名字本身就是个年份)。
    expect(stripCompYear('2026', '2026-07-25')).toBe('2026');
  });
});

describe('localizeCompName 的 opts.date', () => {
  it('传日期就剥年号,不传就保留', () => {
    expect(localizeCompName('JiajiangOpen2026', 'Jiajiang Open 2026', false, { date: '2026-07-25' }))
      .toBe('Jiajiang Open');
    expect(localizeCompName('JiajiangOpen2026', 'Jiajiang Open 2026', false))
      .toBe('Jiajiang Open 2026');
  });

  it('中文名先 stripWcaPrefix 把年号移到尾部,再被 date 剥掉', () => {
    // 2026WCA黄冈魔方公开赛 → stripWcaPrefix → 黄冈公开赛2026 → stripCompYear → 黄冈公开赛
    expect(localizeCompName('HuanggangOpen2026', '2026WCA黄冈魔方公开赛', true, { date: '2026-07-25' }))
      .toBe('黄冈公开赛');
    expect(localizeCompName('HuanggangOpen2026', '2026WCA黄冈魔方公开赛', true))
      .toBe('黄冈公开赛2026');
  });
});
