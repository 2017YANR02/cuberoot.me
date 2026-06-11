// zh-Hant 约定守卫:繁体中文一律由 OpenCC 生成,禁手敲(人 / AI 都不行)。
// 约定见仓库根 CLAUDE.md「繁简转换」+ packages/client-next/scripts/ZHHANT_RECIPE.md。
//
// 这是 codegen freshness gate(大厂标准的 regenerate-and-diff):直接以 --check 模式
// 跑两个权威生成器,任何「漏跑 codemod / 手写漂移」都会让它们非零退出 → CI 红。
//   - gen-zh-hant.mjs           : t() 目录 i18n/zh-Hant.json 必须 === OpenCC(zh.json)
//   - inject-zhhant.mjs         : 每个 {zh,en} 对象(tr() 入参 + 数据对象)的 zhHant 必须 === OpenCC(zh)
//   - gen-ternary-zhhant.mjs    : 内联三路 i18n.language==='zh-Hant' ? 繁 : (isZh?简:en) 的繁体分支
//                                 必须 === conv(同一三路里的简体兄弟),整支全文严格比对(无 stripBraces)
//   - gen-localt-zhhant.mjs     : 局部 t(zh,en,zhHant?) helper 调用的第三参,必须 === conv(第一参)
//                                 (简繁同形时不带第三参);抓缺失/过期/手写的局部 t 繁体
//
// 三者都是"简体唯一源 + 再生成-比对"的生成器:gen-ternary 拿繁支跟同三目里的简体兄弟比
// (conv 只动汉字字形,${}/标签/英文不变;简支必须是纯简体源,不嵌套 t()/tr()、不用预算的
// 语言变量,否则 conv(简)≠繁)。写时另有 PreToolUse 钩子 .claude/hooks/block-handwritten-trad.*
// 绝对拦截 AI 在 UI 源码里手敲/搬运任何繁体字符(繁体只能由上述生成器经 fs 写入),本测试是权威红灯。
//
// CI 跑 vitest(不跑 eslint),故约定靠本测试当红灯。修复:cd packages/client-next && pnpm zh:gen && pnpm zh:inject && pnpm zh:gen-ternary
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

  it('inline 3-way Traditional branch === conv(zh sibling) (gen-ternary-zhhant.mjs --check)', () => {
    const r = runCheck('gen-ternary-zhhant.mjs');
    expect(r.ok, '\n' + r.out).toBe(true);
  }, 180_000);

  it('local t() 3rd arg === conv(1st arg) (gen-localt-zhhant.mjs --check)', () => {
    const r = runCheck('gen-localt-zhhant.mjs');
    expect(r.ok, '\n' + r.out).toBe(true);
  }, 180_000);
});
