// zh-Hant 约定守卫:繁体中文一律由 OpenCC 生成,禁手敲(人 / AI 都不行)。
// 约定见仓库根 CLAUDE.md「繁简转换」+ packages/client-next/scripts/ZHHANT_RECIPE.md。
//
// 这是 codegen freshness gate(大厂标准的 regenerate-and-diff):直接以 --check 模式
// 跑两个权威生成器,任何「漏跑 codemod / 手写漂移」都会让它们非零退出 → CI 红。
//   - gen-zh-hant.mjs           : t() 目录 i18n/zh-Hant.json 必须 === OpenCC(zh.json)
//   - inject-zhhant.mjs         : 每个 {zh,en} 对象(tr() 入参 + 数据对象)的 zhHant 必须 === OpenCC(zh)
//   - check-handwritten-trad.mjs: 内联三路 i18n.language==='zh-Hant' ? 繁 : (isZh?简:en) 的繁体分支
//                                 必须 === conv(同一三路里的简体兄弟),抓内联手敲错字
//
// s2twp 不可逆(算法→演算法),故无法对三路分支做"再生成-比对";改为拿繁体分支跟它在同一
// 三目里的简体兄弟比(conv 只动汉字字形,${}/标签/英文不变),与 inject 的 zhHant:=conv(zh) 同理。
// PreToolUse 钩子 .claude/hooks/block-handwritten-trad.* 是写时左移兜底,本测试是权威红灯。
//
// CI 跑 vitest(不跑 eslint),故约定靠本测试当红灯。修复:cd packages/client-next && pnpm zh:gen && pnpm zh:inject
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client-next

function runCheck(script: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync(process.execPath, [join('scripts', script), '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() };
  }
}

describe('zh-Hant convention — Traditional is OpenCC-generated, never hand-authored', () => {
  it('i18n/zh-Hant.json is fresh (gen-zh-hant.mjs --check)', () => {
    const r = runCheck('gen-zh-hant.mjs');
    expect(r.ok, '\n' + r.out).toBe(true);
  }, 60_000);

  it('every {zh,en} object has canonical OpenCC zhHant (inject-zhhant.mjs --check)', () => {
    const r = runCheck('inject-zhhant.mjs');
    expect(r.ok, '\n' + r.out).toBe(true);
  }, 180_000); // ts-morph parses the whole app/components/lib/hooks tree

  it('inline 3-way Traditional branch === conv(zh sibling) (check-handwritten-trad.mjs --check)', () => {
    const r = runCheck('check-handwritten-trad.mjs');
    expect(r.ok, '\n' + r.out).toBe(true);
  }, 180_000);
});
