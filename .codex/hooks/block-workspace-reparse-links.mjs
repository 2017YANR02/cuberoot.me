#!/usr/bin/env node
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function splitCommandSegments(command) {
  const segments = [];
  let current = '';
  let quote = '';
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) { current += char; escaped = false; continue; }
    if (quote) {
      current += char;
      if (quote === '"' && char === '`') { escaped = true; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"') { quote = char; current += char; continue; }
    const doubled = (char === '|' || char === '&') && command[index + 1] === char;
    if (char === '|' || char === ';' || char === '\r' || char === '\n' || doubled) {
      segments.push(current);
      current = '';
      if (doubled) index += 1;
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments;
}

export function decisionForPayload(payload) {
  const command = String(payload?.tool_input?.command ?? '');
  if (!command.trim()) return null;
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const workdir = payload?.tool_input?.workdir ?? payload?.tool_input?.cwd ?? payload?.cwd;
  let inRepo = false;
  if (workdir) {
    try {
      const resolved = resolve(String(workdir));
      inRepo = resolved.toLowerCase() === repoRoot.toLowerCase()
        || resolved.toLowerCase().startsWith(`${repoRoot.toLowerCase()}${sep}`);
    } catch { inRepo = false; }
  }
  if (!inRepo) inRepo = command.replaceAll('\\', '/').toLowerCase().includes(repoRoot.replaceAll('\\', '/').toLowerCase());
  if (!inRepo) return null;

  for (const rawSegment of splitCommandSegments(command)) {
    const segment = rawSegment.trim();
    if (!segment || /^(?:rg|grep|Select-String|Get-Content|Write-Output|Write-Host|echo|git\s+(?:grep|diff|show|status))\b/i.test(segment)) continue;
    const forbidden = /\bNew-Item\b[^;\r\n]{0,600}-(?:ItemType|Type)\s+(?:'|")?(?:Junction|SymbolicLink)\b/i.test(segment)
      || /(?:^|\s)mklink(?:\.exe)?\b/i.test(segment)
      || /^\s*(?:&\s*)?(?:junction|junction64)(?:\.exe)?\b/i.test(segment)
      || /^\s*(?:sudo\s+)?ln\s+[^\r\n;]*-[^\s]*s/i.test(segment)
      || /(?:CreateSymbolicLink|(?:^|\.)symlink(?:Sync)?|os\.symlink)\s*\(/i.test(segment);
    if (forbidden) return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'BLOCKED: CubeRoot 禁止用 Junction/SymbolicLink 让临时目录或 worktree 复用真实工作区。临时验证目录请独立运行 pnpm install --offline --frozen-lockfile；pnpm store 会安全去重。',
      },
    };
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  const decision = decisionForPayload(payload);
  if (decision) process.stdout.write(JSON.stringify(decision));
}
