#!/usr/bin/env node
// PreToolUse detector: block NEW anchored dropdown panels (position:absolute/fixed +
// top:~100%) written without a viewport-clamp declaration — the trigger can sit near the
// right viewport edge and the panel gets clipped (issue #29, homepage pickers on phones).
// Reads the hook payload on stdin ({tool_name, tool_input}), scans NEW content
// (Write.content / Edit.new_string / MultiEdit.edits[]) for complete CSS rule blocks in
// that shape and DENIES (JSON permissionDecision=deny on stdout + exit 0) unless the
// content carries an `anchored-panel:` declaration. Auto-safe shapes (left+right pinned,
// width:100%, ::before/::after decorations) pass. Partial edits without a full {...}
// block fail open — the CI ratchet tests/anchored-panel-clamp.test.ts is authoritative.
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
  if (!/client\/(app|components)\//.test(fp) || !/\.css$/.test(fp)) process.exit(0);
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  const text = parts.join('\n');
  if (text.includes('anchored-panel:')) process.exit(0); // 声明随写随过

  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length));
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(clean))) {
    const sel = m[1].trim(), body = m[2];
    if (/::(before|after)/.test(sel)) continue;
    if (!/position:\s*(absolute|fixed)/.test(body)) continue;
    if (!/top:\s*(calc\(\s*)?100%/.test(body)) continue;
    if (/(^|[;{\s])left:/.test(body) && /(^|[;{\s])right:/.test(body)) continue;
    if (/width:\s*100%/.test(body)) continue;
    deny(
      `锚定下拉面板「${sel.slice(0, 60)}」(position:absolute + top:~100%)未声明视口钳位:` +
        '触发钮靠右时面板右缘会越出视口被裁(issue #29)。组件里给面板挂 ' +
        "usePanelClamp(open, panelRef)(import { usePanelClamp } from '@/hooks/usePanelClamp')," +
        'CSS 规则内注明 /* anchored-panel: clamped (usePanelClamp in <组件>) */;' +
        '确证不会越界(如触发钮贴容器左缘)则注明 /* anchored-panel: safe (<理由>) */。' +
        'CI 权威口径:tests/anchored-panel-clamp.test.ts。',
    );
  }
  process.exit(0);
});
