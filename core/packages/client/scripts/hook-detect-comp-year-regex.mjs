#!/usr/bin/env node
// PreToolUse detector: block hand-rolled "strip the trailing 4-digit year off a competition
// name" regexes in client source. Reads the hook payload on stdin ({tool_name, tool_input}),
// scans normalized newly added content and DENIES
// (JSON permissionDecision=deny on stdout + exit 0; exit 2 is ignored in auto mode).
//
// Why: issue #65 — the same rule ("year already shown on the page → don't repeat it in the
// comp name") had three different hand-written implementations and still missed the person
// page. The single source is lib/comp-localize.ts's stripCompYear, reached via
// localizeCompName(id, name, isZh, { date }) or <CompCell date={…} />.
// Mirrors the CI guard tests/comp-year-single-source.test.ts (which is authoritative).

// A `$`-anchored year-shaped regex (20\d\d / 19|20 / \d{2,4}) inside a .replace( — date-string
// munging (/^\d{4}-/, /20\d\d-/g, no `$` anchor) is deliberately NOT matched.
const AD_HOC_YEAR = /\.replace\(\s*\/[^/\n]*(?:20\\d\\d|19\|20|\\d\{\d(?:,\d)?\})[^/\n]*\$\s*\//;
// Only judge payloads that are actually handling a competition name.
const COMP_CONTEXT = /localizeCompName|CompCell|compName|comp\.name/;

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let ti;
  try { ti = (JSON.parse(raw).tool_input) || {}; } catch { process.exit(0); }
  const fp = String(ti.file_path || '').replace(/\\/g, '/');
  // Client source only; the single source itself and tests are exempt.
  if (!/packages\/client\/(app|components|lib|hooks)\//.test(fp) || !/\.tsx?$/.test(fp)) process.exit(0);
  if (/\.test\.tsx?$/.test(fp) || /lib\/comp-localize\.ts$/.test(fp)) process.exit(0);

  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  const text = parts.join('\n');

  if (AD_HOC_YEAR.test(text) && COMP_CONTEXT.test(text)) {
    deny(
      '手搓「剥比赛名尾部年号」正则被禁止(issue #65):全站只有一个实现 —— ' +
        "lib/comp-localize.ts 的 stripCompYear。调用点这样写:localizeCompName(id, name, isZh, { date: comp.start_date })," +
        '或 <CompCell compId={…} compName={…} isZh={isZh} date={comp.start_date} />。' +
        '规则:比赛年份已经显示在页面上(同行日期列 / 卡片日期 / 年份分组标题)才剥;' +
        '页面上没写年份的地方(搜索下拉、无日期列的榜单)传 date={null} 保留年号。' +
        'CI 同款守卫 tests/comp-year-single-source.test.ts。',
    );
  }
  process.exit(0);
});
