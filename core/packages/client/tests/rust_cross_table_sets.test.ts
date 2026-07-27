/**
 * rust-cross 表清单的契约锁。
 *
 * 三条不变量,任一破了都会让浏览器端悄悄多下几十 MB、或者拿不到表直接 panic:
 *
 *  1. `TABLE_SETS` 只列 pt_ / opt_ 前缀的表(BFS 产物,必须下载)。mt_(移动表)由 WASM 现场生成
 *     (solver/src/mt_gen.rs),再出现在清单里就是白下载 —— mt_edge4 一张 gz 8.3MB。
 *  2. 清单与 worker 的 init 分支一一对应:worker 是手维护源,两边不同步 = 表缺失 panic
 *     或多下无用表。
 *  3. std 的 20MB pt_cross_C4E0 不在 `TABLE_SETS.cross` 里(它归 `XCROSS_TABLES`,
 *     由 ensureXCross 惰性补)—— 放回去就等于所有人打开计时器先下 20MB。
 *
 * worker 是仓库根的静态产物(非本包源码),用文件文本核对。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLE_SETS, TABLE_BYTES, XCROSS_TABLES } from '@/lib/rust-cross-client';

const WORKER = readFileSync(
  path.resolve(__dirname, '../../../../tools/solver/rust-cross/cross-solver-worker.js'),
  'utf8',
);

/** worker init 里某个 need 分支实际 fetch 的表名(get('x') / buildOpt(_, 'x', _))。 */
function workerTablesFor(need: string): string[] {
  // 取 `need === '<need>'` 到下一个 `} else if (need ===` / 函数结束之间的片段。
  // std 是 else 兜底分支,单独处理。
  const start = need === 'cross'
    ? WORKER.indexOf('} else {\n    // std')
    : WORKER.indexOf(`need === '${need}'`);
  expect(start, `worker has no branch for need=${need}`).toBeGreaterThan(-1);
  const rest = WORKER.slice(start + 1);
  // 分支到下一个 `} else if (need ===` / `} else {`(std 兜底)/ 函数尾 为止。
  // 少了 `} else {` 这一项,最后一个 else-if(skewb)会一路吃进 std 分支的 get('pt_cross')。
  const end = rest.search(/\}\s*else\s*(if\s*\(need ===|\{)|\n\}\n/);
  const body = rest.slice(0, end === -1 ? rest.length : end);
  const names = new Set<string>();
  for (const m of body.matchAll(/get\('([a-z0-9_]+)'\)/gi)) names.add(m[1]);
  for (const m of body.matchAll(/\bbuildOpt\([^,]+,\s*'([a-z0-9_]+)'/gi)) names.add(m[1]);
  // 数组字面量形式:['pt_a', 'pt_b'].map(get)
  for (const m of body.matchAll(/\[([^\]]*)\]\.map\(get\)/g)) {
    for (const q of m[1].matchAll(/'([a-z0-9_]+)'/gi)) names.add(q[1]);
  }
  return [...names];
}

describe('rust-cross table sets', () => {
  it('never lists a move table — those are generated in-WASM', () => {
    for (const [need, tables] of Object.entries(TABLE_SETS)) {
      const mt = tables.filter((t) => t.startsWith('mt_'));
      expect(mt, `TABLE_SETS.${need} must not download move tables`).toEqual([]);
    }
    expect(XCROSS_TABLES.filter((t) => t.startsWith('mt_'))).toEqual([]);
  });

  it('matches what the worker actually fetches, need by need', () => {
    for (const need of Object.keys(TABLE_SETS)) {
      // 零表 need 在 worker 里没有 get(...) 调用,两边都应为空。
      const declared = [...TABLE_SETS[need as keyof typeof TABLE_SETS]].sort();
      if (declared.length === 0) continue;
      const actual = workerTablesFor(need).filter((t) => !t.startsWith('mt_')).sort();
      // std 分支的 pt_cross_C4E0 走 attachXCross,不在 init 里 —— 单独由下面那条断言管。
      expect(actual, `need=${need}`).toEqual(declared);
    }
  });

  it('keeps the 20MB xcross table out of the default cross set', () => {
    expect(TABLE_SETS.cross).toEqual(['pt_cross']);
    expect(XCROSS_TABLES).toEqual(['pt_cross_C4E0']);
    // 默认视图的下载量:一张 50KB gz 的表(这里断言的是解压后字节,gz 约 1/3)。
    expect(TABLE_BYTES.pt_cross).toBe(139408);
    expect(TABLE_BYTES.pt_cross_C4E0).toBe(54743056);
    // attachXCross 拉的就是这张,worker 侧硬编码,别改名后忘了同步。
    expect(WORKER).toContain("tableUrl(crossTablesBase, 'pt_cross_C4E0')");
  });

  it('decides gzip by pathname so the ?tv= version query cannot break inflation', () => {
    // 曾经按整个 URL 判后缀:带 ?tv=1 时为 false,gzip 原字节喂进 WASM → magic 校验
    // 失败 panic('unreachable')。断言只看代码行(注释里提到旧写法不算)。
    expect(WORKER).toContain("new URL(url, self.location.href).pathname.endsWith('.gz')");
    const code = WORKER.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/if\s*\(url\.endsWith/);
  });
});
