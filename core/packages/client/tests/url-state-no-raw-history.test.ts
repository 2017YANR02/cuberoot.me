// URL 状态约定守卫:全站页内 URL 状态必须走 nuqs(useQueryState / useQueryStates),
// 禁裸 history.pushState / history.replaceState 和手写 popstate 监听。
// 约定见仓库根 CLAUDE.md「URL 状态 / 后退导航(全站统一 nuqs)」。
//
// 真正特殊的(maplibre / canvas / worker 序列化 / 全局非 React infra)走 ALLOWLIST,
// 各文件内已带 `// eslint-disable-next-line no-restricted-syntax, no-restricted-globals` + 理由注释。
//
// CI 跑 vitest(不跑 eslint,且无 TS eslint parser),故约定靠本测试当红灯:新页面想退回旧写法 → CI 直接挂。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks', 'i18n'];

// 相对 client 根的 posix 路径 → 豁免(各文件内已带 eslint-disable + 理由注释)
const ALLOWLIST = new Set([
  'i18n/i18n-client.ts',                              // 全局 i18n infra:非 React、无 hook,改语言在 render 之外跑
  'app/[lang]/wca/globe/GlobeMapClient.tsx',          // 重型 maplibre:URL 同步 + history.back 返回件刻意手写
  'app/[lang]/calc/_components/stores/calc_store.ts', // zustand store(无法用 hook)+ t0/t1.. 动态键成绩序列化,data-blob 例外
  'app/[lang]/recon/submit/ReconSubmitForm.tsx',      // cubedb 自定义编码(encodeUrlAlg)+ 编辑/?from 模式门控,nuqs 声明式 hook 无法复刻
  'app/[lang]/code/stack/_tools/react-router.tsx',    // 文档示例文本(<code> 里展示 API 名),非真实调用
]);

// 另一团队的 roux 实验 WIP,不在本约定范围内;落地后再纳入
const SKIP_PATH = /(^|[\\/])(roux|_roux|roux-smoke)([\\/]|$)/;

const FORBIDDEN: { re: RegExp; name: string }[] = [
  { re: /\bhistory\s*\.\s*pushState\s*\(/, name: 'history.pushState()' },
  { re: /\bhistory\s*\.\s*replaceState\s*\(/, name: 'history.replaceState()' },
  { re: /addEventListener\s*\(\s*['"]popstate['"]/, name: "addEventListener('popstate')" },
  { re: /\bwindow\s*\.\s*onpopstate\b/, name: 'window.onpopstate' },
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

describe('URL state convention — no raw history.* / popstate (use nuqs)', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no raw history URL mutation outside the allowlist', () => {
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
      '页内 URL 状态请用 nuqs(useQueryState / useQueryStates),勿裸调 history.* / popstate。\n' +
        '若确属特殊(maplibre / canvas / worker 序列化 / 全局非 React infra),把文件加进本测试的 ALLOWLIST 并在文件内写 eslint-disable + 理由。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
