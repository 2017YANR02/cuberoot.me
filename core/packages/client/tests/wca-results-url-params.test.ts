// /wca/results URL 参数守卫:被「全参数常驻 URL」effect 托管的筛选参数,禁写 null。
//
// 背景(真实 bug):该页把「显示」toggle 的 results 态写成 `setQuery({ show: null })`,
// 但派生规则是 `query.show === 'results' ? 'results' : 'persons'` —— 参数缺省时派生成 persons,
// 于是 toggle 看起来点不动(点了立刻弹回「选手」)。根因是「写 null 想表达的值」≠「缺省时的派生值」。
//
// 这页有个 effect 会把缺省的筛选参数补成派生值(show/type/country/gender/basis/year/month/q),
// 意味着这批键在 URL 里恒常驻 —— 对它们写 null 最好情况是多一次无用 replace,最坏情况就是上面那个
// 「控件点不动」。所以规则很干净:**这批键一律写显式值**(要「全部/全年」就写 'all'/'0',不是 null)。
//
// 静态分析看不出「null 想表达什么」,所以这里不试图判断语义,直接禁止 null 出现在这批键的值里 ——
// 前提是页面已按上述约定把所有 null 写入换成了显式默认值,故本守卫零豁免。若将来确有必要,请先在
// 页面里说明理由,再在这里加豁免,而不是反过来放宽规则。
//
// 覆盖不到的地方(已知,故意):动态键写入(`setQuery({ [k]: v })`)静态看不出键名。该页唯一的动态
// 写入口是 `update()` 帮助函数,所以本文件额外锁死它不做 `|| null` 折叠(折叠 = 把用户选择丢回派生规则)。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const PAGE = join(ROOT, 'app', '[lang]', 'wca', 'results', 'page.tsx');
const src = readFileSync(PAGE, 'utf8');

/** backfill effect 托管的键 —— 从源码里现推,页面加参数时守卫自动跟着扩。 */
function backfilledKeys(source: string): string[] {
  const keys = new Set<string>();
  const re = /if \(query\.(\w+) == null\) patch\.(\w+) =/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m[1] === m[2]) keys.add(m[1]!);
  }
  return [...keys];
}

/** 从 `setQuery(` 起做括号配平,取出实参文本;非对象字面量(如 `setQuery(patch as ...)`)返回 null。 */
function setQueryArgs(source: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  const call = /\bsetQuery\(/g;
  for (let m = call.exec(source); m; m = call.exec(source)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, quote = '', end = -1;
    for (let i = open; i < source.length; i++) {
      const c = source[i]!;
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    const text = source.slice(open + 1, end);
    if (!text.trimStart().startsWith('{')) continue; // 非字面量:跳过
    out.push({ text, line: source.slice(0, m.index).split('\n').length });
  }
  return out;
}

/**
 * 取对象字面量里的 `键: 值表达式` 对。只认前面紧跟 `{` 或 `,` 的标识符冒号 —— 这样
 * 三元的 `cond ? a : b` 不会被误当成键;spread 里的嵌套对象(`...(c ? {} : { year: x })`)
 * 天然一并覆盖,因为它内部的 `{`/`,` 同样满足前缀条件。
 */
function entries(objText: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  const re = /([{,])\s*(\w+)\s*:/g;
  for (let m = re.exec(objText); m; m = re.exec(objText)) {
    const start = m.index + m[0].length;
    let depth = 0, quote = '', end = objText.length;
    for (let i = start; i < objText.length; i++) {
      const c = objText[i]!;
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) { end = i; break; } depth--; }
      else if (c === ',' && depth === 0) { end = i; break; }
    }
    out.push({ key: m[2]!, value: objText.slice(start, end).trim() });
  }
  return out;
}

describe('/wca/results — backfill 托管的 URL 参数一律写显式值', () => {
  const keys = backfilledKeys(src);
  const calls = setQueryArgs(src);

  it('守卫本身没有失效(键与 setQuery 调用都还找得到)', () => {
    // 页面重构导致任一为空 → 守卫会静默全绿,故先锁下界。
    expect(keys.length, 'backfill effect 里没解析出任何 `if (query.X == null) patch.X =`').toBeGreaterThanOrEqual(5);
    expect(calls.length, '没解析出任何 setQuery({...}) 字面量调用').toBeGreaterThanOrEqual(8);
    expect(keys).toContain('show');
  });

  it('没有任何 backfill 托管键被写成 null', () => {
    const managed = new Set(keys);
    const violations: string[] = [];
    for (const call of calls) {
      for (const { key, value } of entries(call.text)) {
        if (!managed.has(key)) continue;              // 未托管的键(view/page/ssort...)可以写 null
        if (!/\bnull\b/.test(value)) continue;
        violations.push(`page.tsx:${call.line} → ${key}: ${value}`);
      }
    }
    expect(
      violations,
      '这些键由「全参数常驻 URL」effect 托管,缺省时会被补成派生值,而派生值不一定等于你写 null 想表达的意思\n' +
        '(show 缺省 = persons,不是 results;year 缺省 + persons = 当年,不是「全部年份」)。\n' +
        `请改写显式默认值:${keys.join(' / ')} → 如 gender:'all'、month:'0'、q:''、type:'single'。\n` +
        '命中:\n' + violations.join('\n'),
    ).toEqual([]);
  });

  it('update() 帮助函数不做 `|| null` 折叠', () => {
    const m = /const update = \([^)]*\) => \{([\s\S]*?)\n  \};/.exec(src);
    expect(m, 'update() 帮助函数没找到(改名了?请同步本守卫)').not.toBeNull();
    expect(
      /\|\|\s*null/.test(m![1]!),
      'update() 里的 `v || null` 会把空串折成 null —— 对 country(空 = 全部)、gender(all)、year/month(0) ' +
        '这些托管键等于把用户的选择丢回派生规则。要清除参数请由调用方显式传 null(仅限未托管的键)。',
    ).toBe(false);
  });
});
