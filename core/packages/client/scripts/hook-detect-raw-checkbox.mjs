#!/usr/bin/env node
// PreToolUse detector: block raw <input type="checkbox"> (☑) in client .tsx writes.
// Reads the hook payload on stdin ({tool_name, tool_input}), scans the NEW content
// (Write.content / Edit.new_string / MultiEdit.edits[]) and DENIES (JSON
// permissionDecision=deny on stdout + exit 0; exit 2 is ignored in auto mode) when it
// adds a `type="checkbox"`. Boolean toggles must use <BoolToggle> (knob left, label
// right); genuine multi-select grids can opt out with an inline `allow-checkbox: reason`.
// Mirrors the CI ratchet tests/no-raw-checkbox.test.ts (which is authoritative).
const CHECKBOX = /type=["']checkbox["']/;

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
  // Only client app/components source .tsx; skip tests/scripts.
  if (!/client\/(app|components)\//.test(fp) || !/\.tsx$/.test(fp) || /\.test\.tsx$/.test(fp)) {
    process.exit(0);
  }
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  const text = parts.join('\n');

  if (CHECKBOX.test(text) && !/allow-checkbox/.test(text)) {
    deny(
      '裸 <input type="checkbox">(☑)被禁止:布尔开关一律用 <BoolToggle>(左滑钮 + 右文字,' +
        "import BoolToggle from '@/components/BoolToggle')。二选一用 PillToggle 的 onLabel/offLabel。" +
        '确属多选网格/列表的特例:在该处加行内注释 allow-checkbox: <理由>。详见 /code/components。',
    );
  }
  process.exit(0);
});
