#!/usr/bin/env node
// Codex command-hook adapter. The hook harness supplies canonical Bash calls as
// { tool_input: { command } }; older code-mode clients may embed it in an exec
// JavaScript body. Normalize either form before running migrated command hooks.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';

function parseStringLiteral(literal) {
  if (literal.startsWith('"')) {
    try { return JSON.parse(literal); } catch { return ''; }
  }
  if (literal.startsWith('`') && literal.endsWith('`') && !literal.includes('${')) {
    return literal.slice(1, -1).replace(/\\`/g, '`');
  }
  return '';
}

export function commandsFromPayload(payload) {
  const input = payload?.tool_input;
  if (input && typeof input === 'object' && typeof input.command === 'string') {
    return [input.command];
  }
  if (typeof input !== 'string') return [];
  const commands = [];
  const commandLiteral = /\bcommand\s*:\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/gs;
  for (const match of input.matchAll(commandLiteral)) {
    const command = parseStringLiteral(match[1]);
    if (command) commands.push(command);
  }
  return commands;
}

function targetCommand(target) {
  return { command: process.execPath, args: [target] };
}

function mightMatch(target, command) {
  const name = target.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
  if (name.includes('recon-ground-truth')) return /git(?:\.exe)?\b[\s\S]*\bcommit\b/i.test(command);
  if (name.includes('browser-launch')) return /chrome|chromium|msedge|brave|ms-playwright/i.test(command);
  if (name.includes('next-build')) return /\bbuild\b/.test(command);
  if (name.includes('repo-image-write')) return /png|jpe?g|webp|gif|bmp|avif/i.test(command);
  // Deletion APIs have too many spellings (`::Delete`, `find -delete`, wrappers)
  // for a safe fast gate. Let the dedicated guard make the decision.
  if (name.includes('rm-use-trash')) return true;
  return true;
}

function run() {
  const targets = process.argv.slice(2).map((target) => (
    isAbsolute(target) ? target : resolve(process.cwd(), target)
  ));
  if (!targets.length) return;
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { return; }
    const commands = commandsFromPayload(payload);
    const cwd = String(payload.cwd || process.cwd());
    for (const command of commands) {
      const adapted = JSON.stringify({
        ...payload,
        tool_name: 'Bash',
        tool_input: { command, cwd, workdir: cwd },
      });
      for (const target of targets) {
        if (!mightMatch(target, command)) continue;
        const targetProcess = targetCommand(target);
        const result = spawnSync(targetProcess.command, targetProcess.args, {
          cwd,
          input: adapted,
          encoding: 'utf8',
          windowsHide: true,
        });
        const output = String(result.stdout || '').trim();
        if (output) {
          process.stdout.write(output);
          return;
        }
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  run();
}
