#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
if (!/[㐀-䶿一-鿿]/.test(raw)) process.exit(0);

let request;
try { request = JSON.parse(raw || '{}'); } catch { process.exit(0); }
const input = request?.tool_input ?? {};
const filePath = String(input.file_path ?? '').replaceAll('\\', '/');
if (filePath.includes('/.codex/')) process.exit(0);
const content = [input.content, input.new_string, ...(input.edits ?? []).map((edit) => edit?.new_string)]
  .filter((value) => typeof value === 'string')
  .join('\n');
if (!content.trim() || content.includes('allow-banned-word')) process.exit(0);

let list;
try {
  const here = dirname(fileURLToPath(import.meta.url));
  list = JSON.parse(readFileSync(join(here, '..', 'banned-words.json'), 'utf8'));
} catch { process.exit(0); }
const hits = (list.words ?? [])
  .filter((entry) => entry?.word && content.includes(entry.word))
  .map((entry) => `「${entry.word}」→ 改用「${entry.use}」(${entry.why})`);
if (hits.length === 0) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `写入内容命中站内违禁词:\n${hits.join('\n')}\n改掉后重写。确有必要保留原词:该行加注释 allow-banned-word。\n词表在 .codex/banned-words.json(用户说「添加违禁词:xx」就是加到那里)。`,
  },
}));
