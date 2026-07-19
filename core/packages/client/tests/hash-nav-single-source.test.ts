// 「点某项 → URL 片段 → 滚到它并高亮」这一模式的单一实现守卫。
//
// 全站原本有六处各自手搓这套逻辑(/wiki 词条、person 两张成绩表、/alg 公式卡、
// /wca/prediction 项目段、论坛帖子),ByCompList / ByEventView 更是逐字复制。已抽成
// hooks/useHashHighlight.ts(见 /code/utils 登记表)。这条测试防回潮:除该 hook 外,
// 任何文件再自己挂 `hashchange` 监听(这套模式的标志动作)= CI 直接红,指回该 hook。
//
// 真属另一类用途的 hashchange(如 OAuth 回调、i18n infra)加进 ALLOWLIST 并写理由——
// 目前一个都没有(全站仅 useHashHighlight 一处),所以是「闭集 = 0」而非棘轮。
//
// CI 跑 vitest,故约定靠本测试当红灯。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];

// 相对 client 根的 posix 路径 → 豁免。
const ALLOWLIST = new Set([
  'hooks/useHashHighlight.ts', // 唯一合法处:全站 hash 锚点滚动+高亮的单一实现
]);

// 另一团队的 roux 实验 WIP,不在本约定范围内。
const SKIP_PATH = /(^|[\\/])(roux|_roux|roux-smoke)([\\/]|$)/;

const FORBIDDEN: { re: RegExp; name: string }[] = [
  { re: /addEventListener\s*\(\s*['"]hashchange['"]/, name: "addEventListener('hashchange')" },
  { re: /\bwindow\s*\.\s*onhashchange\b/, name: 'window.onhashchange' },
];

function safeReaddir(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

describe('hash-nav convention — anchor scroll+highlight goes through useHashHighlight', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no hand-rolled hashchange listener outside useHashHighlight', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (SKIP_PATH.test(rel) || ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      for (const f of FORBIDDEN) {
        if (f.re.test(src)) violations.push(`${rel} → ${f.name}`);
      }
    }
    expect(
      violations,
      '「点某项→URL 片段→滚到它并高亮」请用 hooks/useHashHighlight（见 /code/utils）,勿再自己挂 hashchange 监听。\n' +
        '差异点(解析元素 / 滚前预处理 / 持续 vs 闪一下 / 就绪信号)都是它的 options。\n' +
        '若确属另一类用途(OAuth 回调 / 全局 infra),把文件加进本测试的 ALLOWLIST 并写理由。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
