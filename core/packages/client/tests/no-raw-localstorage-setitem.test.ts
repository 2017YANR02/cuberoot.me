// 存储约定守卫:全站 localStorage 写入必须走 lib/safe-storage 的 persistItem,
// 禁裸 localStorage.setItem / window.localStorage.setItem。
//
// 缘由:线上源的 ~5MB localStorage 常被 timer 自动备份塞满,裸 setItem 在事件
// 处理器里抛 QuotaExceededError 会把后续状态更新一起炸掉(2026-07 trainer 全选
// 线上点了没反应就是这个)。persistItem 捕获配额错、驱逐可再生缓存后重试、永不抛。
//
// CI 跑 vitest(不跑 eslint),故约定靠本测试当红灯:新代码想裸写 → CI 直接挂。
// 真正需要裸写的(自带驱逐-重试循环的 legacy 兜底)在该行或上一行标
// `allow-raw-localstorage: <理由>`;helper 本体走整文件 ALLOWLIST。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks', 'i18n'];

// 相对 client 根的 posix 路径 → 整文件豁免
const ALLOWLIST = new Set([
  'lib/safe-storage.ts', // persistItem 本体:唯一允许调 localStorage.setItem 的地方
]);

// 另一团队 vendored 的 roux 实验代码,不在本约定范围内
const SKIP_PATH = /(^|[\\/])(roux|_roux|roux-smoke)([\\/]|$)/;

// window.localStorage.setItem 也含子串 localStorage.setItem,一并命中
const RE = /\blocalStorage\s*\.\s*setItem\s*\(/;
const EXEMPT = /allow-raw-localstorage/;

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

describe('storage convention — no raw localStorage.setItem (use persistItem)', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no raw localStorage.setItem outside the allowlist / exemptions', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (SKIP_PATH.test(rel) || ALLOWLIST.has(rel)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!RE.test(line)) return;
        const prev = lines[i - 1] ?? '';
        if (EXEMPT.test(line) || EXEMPT.test(prev)) return; // 行级豁免
        violations.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      violations,
      'localStorage 写入请走 lib/safe-storage 的 persistItem(配额满时驱逐重试、永不抛)。\n' +
        '确需裸写(自带驱逐循环的兜底)在该行或上一行标 `allow-raw-localstorage: <理由>`。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
