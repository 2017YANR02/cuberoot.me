#!/usr/bin/env node
// Runs through adapt-codex-write-payload; all paths derive from this module.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspacePath } from '../../core/scripts/resolve-workspace-path.mjs';
import { inScope, positionViolationsFromHookPayload, type Source } from '../../core/packages/client/scripts/css-position-guard.mts';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '../../core');
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
try {
  const payload = JSON.parse(raw || '{}');
  if (!inScope(String(payload?.tool_input?.file_path ?? ''))) process.exit(0);
  const sources: Source[] = [];
  for (const [name, dirs] of [
    ['@cuberoot/client', ['app', 'components']],
    ['@cuberoot/app-ui', ['src']],
    ['@cuberoot/timer-ui', ['src']],
    ['@cuberoot/shared', ['src']],
  ] as const) {
    const workspace = join(CORE, resolveWorkspacePath(name, CORE));
    for (const dir of dirs) {
      const root = join(workspace, dir);
      for (const entry of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
        const filePath = join(root, entry).replaceAll('\\', '/');
        if (inScope(filePath)) sources.push({ filePath, content: readFileSync(filePath, 'utf8') });
      }
    }
  }
  const violations = positionViolationsFromHookPayload(payload, sources);
  if (violations.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: '定位样式会随 CSS 加载顺序变化或保留桌面偏移，可能使手机控件错位、撑宽页面。' +
      violations.slice(0, 4).map(hit => `${hit.filePath}:${hit.line} ${hit.selector}: ${hit.detail}`).join('\n') +
      '独立语义需在该 CSS 规则内写 /* allow-css-position: 具体理由 */；CI 使用同一扫描器。',
  } }));
} catch {
  // Invalid payloads, unreadable source trees and unmatched partial patches fail
  // open. CI scans complete source independently of local hook availability.
}
