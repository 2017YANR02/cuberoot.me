#!/usr/bin/env node
import { toggleSideViolations } from '../../core/packages/client/scripts/toggle-side-guard.mts';
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const input = JSON.parse(raw || '{}').tool_input ?? {};
  const content = [input.content, input.new_string, ...(input.edits ?? []).map((edit: { new_string?: string }) => edit.new_string)]
    .filter((value): value is string => typeof value === 'string').join('\n');
  const violations = toggleSideViolations(String(input.file_path ?? ''), content);
  if (violations.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: `开关统一在文字右侧。${violations.join(' ')}`,
  } }));
} catch { /* malformed/incomplete hook payloads fail open; CI checks full sources */ }
