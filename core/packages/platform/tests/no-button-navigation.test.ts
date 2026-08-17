// 链接导航约定守卫(CI 兜底层):站内"可点即跳 URL"的元素必须是真 <a> / next <Link>(带 href),
// 禁在 onClick 里直接 router.push / router.replace 当导航 —— 否则鼠标中键 / Ctrl 点开新标签页
// 失效,复制链接 / SEO / 爬虫可达全丢。约定见 CLAUDE.md「链接支持中键新开」。
//
// 分层:写入即拦由全局 hook(~/.claude/hooks/block-button-navigation.ps1)负责;本测试是任何
// 来源(其他 AI / 手改 / web 改的代码)绕过 hook 时的最终红灯。两层共用同一条正则。
//
// 合理例外(提交后程序化重定向 / disabled 门控的动作 / 纯动作按钮 / 已是真 <a href> 渐进增强)
// 走 ALLOWLIST,每条带理由;源码处另有 `allow-button-nav: <理由>` 注释供 hook 放行。
//
// 限制:只抓字面量 onClick={ ... router.push/replace( ... }(单个 handler 内,[^}]* 匹配到首个
// })。经命名函数间接调 router.push(form onSubmit / 模态 close 等不在 onClick 字面量内)抓不到。
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative, sep } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."); // 项目根
const SCAN_DIRS = ["app", "components", "lib", "hooks"];

// 相对项目根的 posix 路径 → 豁免(均为合法动作 / 程序化跳转,非"链接伪装成按钮")。
// 注:当前两文件都不命中下方正则(logout 的 fetch 选项对象里有 } 截断了 [^}]*,close 是命名函数),
// 列此是为与源码 allow-button-nav 注释保持同一组例外:日后若重构成字面量命中,两层一致放行。
const ALLOWLIST = new Set<string>([
  // 退出登录:POST /api/auth/logout 后程序化跳首页 —— post-mutation 动作按钮,无可点链接实体
  "components/SiteHeader.tsx",
  // 支付二维码弹窗:close() 关闭模态 + 轮询付款成功后程序化跳订单页 —— 动作 / 程序化重定向
  "components/QrCodeModal.tsx",
]);

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
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.tsx$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

describe("Link navigation convention — no <button> + router.push (use real <a> / <Link>)", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it("scans a meaningful number of source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no onClick router.push/replace navigation outside the allowlist", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (FORBIDDEN.test(src)) violations.push(rel);
    }
    expect(
      violations,
      "站内导航请用真 <a> / <Link>(带 href),勿在 onClick 里 router.push/replace 当跳转\n" +
        "(否则中键 / Ctrl 点开新标签页失效)。若确属例外(提交后程序化重定向 / disabled 门控 /\n" +
        "纯动作按钮 / 已是真 <a href> 渐进增强),把文件加进本测试 ALLOWLIST 并写理由。\n" +
        "命中:\n" +
        violations.join("\n"),
    ).toEqual([]);
  });
});
