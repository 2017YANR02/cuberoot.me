#!/usr/bin/env node
import { puzzleMenuLabelViolations } from '../../core/packages/client/scripts/puzzle-menu-label-guard.mts';
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const input = JSON.parse(raw || '{}').tool_input ?? {};
  const content = [input.content, input.new_string, ...(input.edits ?? []).map((edit: { new_string?: string }) => edit.new_string)]
    .filter((value): value is string => typeof value === 'string').join('\n');
  const violations = puzzleMenuLabelViolations(String(input.file_path ?? ''), content);
  if (violations.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: violations.join(' '),
  } }));
} catch { /* Invalid/incomplete payloads fail open; CI scans complete catalogs. */ }
