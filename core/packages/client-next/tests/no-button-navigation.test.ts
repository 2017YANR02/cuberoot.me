// 链接导航约定守卫:站内"可点即跳 URL"的元素必须是真 <a> / AppLink(带 href),
// 禁在 onClick 里直接 router.push / router.replace 当导航 —— 否则鼠标中键 / Ctrl 点
// 开新标签页失效,复制链接 / SEO / 爬虫可达全丢。约定见仓库根 CLAUDE.md「链接支持中键新开」。
//
// 合理例外(提交后程序化重定向、disabled 门控的动作、纯动作按钮、已是真 <a href> 的
// 渐进增强)走 ALLOWLIST,每条带理由。
//
// CI 跑 vitest(不跑 eslint),故约定靠本测试当红灯:新页面想用 <button> + router.push
// 当导航 → CI 直接挂。
// 限制:只抓字面量 onClick={ ... router.push/replace( ... };经由命名函数间接调
// router.push 抓不到(与 tests/url-state-no-raw-history.test.ts 同限)。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client-next
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];

// 相对 client-next 根的 posix 路径 → 豁免(均非"链接伪装成按钮",理由附后)
const ALLOWLIST = new Set([
  // 危险区「删除」确认后程序化重定向到 /recon —— post-mutation redirect,无可点链接实体
  'app/[lang]/recon/submit/ReconSubmitForm.tsx',
  // 「开始」按钮带 disabled 门控(canStart),<a> 无法 disable;就绪后才跳 /run
  'app/[lang]/trainer/[puzzle]/[set]/TrainerSetClient.tsx',
  // 表单「取消」动作,与提交按钮成对,语义是 action 非链接
  'app/[lang]/recon/[id]/alt/AltSubmitForm.tsx',
  // 已是真 <a href> + 修饰键判断的渐进增强(中键/Ctrl/Cmd/Shift 保留浏览器默认) —— 正确范式
  'app/[lang]/scramble/gen/SheetView.tsx',
  // deskpet 工具栏 Home 图标:与 theme/lang/donate 等动作图标同排,靠 .deskpet-toolbar button
  // 元素选择器取样式 + 带 onClose() 副作用,作动作图标保留
  'components/DeskPetSearch.tsx',
]);

// 另一团队的 roux 实验 WIP,不在本约定范围内
const SKIP_PATH = /(^|[\\/])(roux|_roux|roux-smoke)([\\/]|$)/;

// onClick={ ... router.push( / router.replace( ... } —— [^}]* 跨行匹配到首个 }(单个 handler 内)
const FORBIDDEN = /onClick=\{[^}]*\brouter\s*\.\s*(?:push|replace)\s*\(/;

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
    } else if (/\.tsx$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

describe('Link navigation convention — no <button> + router.push (use real <a> / AppLink)', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no onClick router.push/replace navigation outside the allowlist', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (SKIP_PATH.test(rel) || ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      if (FORBIDDEN.test(src)) violations.push(rel);
    }
    expect(
      violations,
      '站内导航请用真 <a> / AppLink(带 href),勿在 onClick 里 router.push/replace 当跳转\n' +
        '(否则中键 / Ctrl 点开新标签页失效)。若确属例外(提交后程序化重定向 / disabled 门控 /\n' +
        '纯动作按钮 / 已是真 <a href> 渐进增强),把文件加进本测试 ALLOWLIST 并写理由。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
