#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let request;
try { request = JSON.parse(raw || '{}'); } catch { process.exit(0); }
const command = String(request?.tool_input?.command ?? '');
if (!/(?:^|\s)git(?:\.exe)?(?:\s+-C\s+(?:"[^"]+"|'[^']+'|\S+))?\s+commit\b/i.test(command)) process.exit(0);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workdir = request?.tool_input?.workdir ?? request?.tool_input?.cwd ?? request?.cwd;
let inRepo = false;
if (workdir) {
  try {
    const resolved = resolve(String(workdir));
    inRepo = resolved.toLowerCase() === repoRoot.toLowerCase()
      || resolved.toLowerCase().startsWith(`${repoRoot.toLowerCase()}${sep}`);
  } catch { process.exit(0); }
} else {
  inRepo = command.replaceAll('\\', '/').toLowerCase().includes(repoRoot.replaceAll('\\', '/').toLowerCase());
}
if (!inRepo) process.exit(0);

const gate = resolve(repoRoot, 'core/packages/client/scripts/recon-ground-truth-gate.mjs');
if (!existsSync(gate)) process.exit(0);
const result = spawnSync(process.execPath, [gate, 'check-staged', '--preflight'], { cwd: repoRoot, encoding: 'utf8' });
if (result.status === 0) process.exit(0);
const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
let reason = '提交已拦截：自动复盘检查的准备条件不满足。请按下面的原因修正；准备好后 Git 会自动检查全部样本，无需另行手动启动测试。';
if (detail) reason += ` 检查结果：${detail}`;
process.stdout.write(JSON.stringify({ hookSpecificOutput: {
  hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason,
} }));
