#!/usr/bin/env node
// Codex write-hook adapter. Codex supplies apply_patch in tool_input.command
// (and older clients may embed it in an exec JavaScript string), while detectors expect
// { tool_input: { file_path, content } }. Convert every added fragment to
// that legacy-neutral shape and run the target hook once per affected file.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

export function parseApplyPatch(patch) {
  const writes = [];
  let filePath = '';
  let sourcePath = '';
  let added = [];
  const flush = () => {
    if (filePath) writes.push({
      filePath: normalizePath(filePath),
      sourcePath: normalizePath(sourcePath),
      content: added.join('\n'),
    });
    filePath = '';
    sourcePath = '';
    added = [];
  };
  for (const line of String(patch || '').split(/\r?\n/)) {
    const header = line.match(/^\*\*\* (?:Add|Update) File:\s*(.+)$/);
    if (header) {
      flush();
      filePath = header[1].trim();
      continue;
    }
    const move = line.match(/^\*\*\* Move to:\s*(.+)$/);
    if (move) {
      sourcePath = filePath;
      filePath = move[1].trim();
      continue;
    }
    if (/^\*\*\* Delete File:/.test(line) || line === '*** End Patch') {
      flush();
      continue;
    }
    if (filePath && line.startsWith('+')) added.push(line.slice(1));
  }
  flush();
  return writes;
}

function parseEmbeddedApplyPatch(source) {
  const raw = String(source || '');
  if (!raw.includes('*** Begin Patch')) return [];
  const stringLiteral = /(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*("(?:\\.|[^"\\])*")/gs;
  let match;
  while ((match = stringLiteral.exec(raw))) {
    try {
      const decoded = JSON.parse(match[1]);
      if (decoded.includes('*** Begin Patch')) return parseApplyPatch(decoded);
    } catch {
      // Keep looking; malformed unrelated strings fail open.
    }
  }
  return parseApplyPatch(raw);
}

export function writesFromPayload(payload) {
  const input = payload?.tool_input;
  if (typeof input === 'string') return parseEmbeddedApplyPatch(input);
  if (!input || typeof input !== 'object') return [];
  for (const key of ['command', 'patch', 'input', 'script', 'code']) {
    if (typeof input[key] === 'string' && input[key].includes('*** Begin Patch')) {
      return parseEmbeddedApplyPatch(input[key]);
    }
  }
  const filePath = normalizePath(input.file_path);
  if (!filePath) return [];
  const parts = [];
  if (typeof input.content === 'string') parts.push(input.content);
  if (typeof input.new_string === 'string') parts.push(input.new_string);
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (edit && typeof edit.new_string === 'string') parts.push(edit.new_string);
    }
  }
  return [{ filePath, content: parts.join('\n') }];
}

function targetCommand(target) {
  if (/\.ps1$/i.test(target)) return { command: 'pwsh', args: ['-NoProfile', '-File', target] };
  return { command: process.execPath, args: [target] };
}

function isArchitectureTarget(target) {
  return normalizePath(target).toLowerCase().endsWith('/block-architecture-boundaries.ps1');
}

function runTarget(target, payload, cwd) {
  const targetProcess = targetCommand(target);
  const result = spawnSync(targetProcess.command, targetProcess.args, {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    windowsHide: true,
  });
  return String(result.stdout || '').trim();
}

function mightMatch(target, content) {
  const name = normalizePath(target).split('/').pop()?.toLowerCase() ?? '';
  if (name.includes('raw-checkbox')) return /checkbox/.test(content);
  if (name.includes('unclamped-anchored-panel')) return /100%/.test(content);
  if (name.includes('handwritten-trad')) return /[㐀-䶿一-鿿豈-﫿]|i18n\.language|isZh/.test(content);
  if (name.includes('server-forwarded-for')) return /forwarded/i.test(content);
  if (name.includes('comp-name-year')) return /\.replace\(/.test(content);
  if (name.includes('banned-words')) return /[㐀-䶿一-鿿]/.test(content);
  if (name.includes('static-onclick')) return /onClick/.test(content);
  if (name.includes('button-navigation')) return /router\s*\./.test(content);
  if (name.includes('raw-history')) return /history|popstate/.test(content);
  if (name.includes('nuqs-ime')) return /<(?:input|textarea)\b|useQueryState/.test(content);
  if (name.includes('raw-localstorage')) return /localStorage\s*\.\s*setItem/.test(content);
  if (name.includes('webkit-no-webrtc')) return /\.\s*(?:launch|launchPersistentContext)\s*\(/.test(content);
  if (name.includes('browser-regexp-lookbehind')) return content.includes('(?<=') || content.includes('(?<!');
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
    const writes = writesFromPayload(payload);
    if (!writes.length) return;
    const cwd = String(payload.cwd || process.cwd());
    const preparedWrites = writes.map((write) => {
      const filePath = isAbsolute(write.filePath) ? write.filePath : resolve(cwd, write.filePath);
      let content = write.content;
      if (write.sourcePath) {
        const sourcePath = isAbsolute(write.sourcePath) ? write.sourcePath : resolve(cwd, write.sourcePath);
        try { content = `${readFileSync(sourcePath, 'utf8')}\n${content}`; } catch { /* fail open */ }
      }
      return { filePath, content };
    });

    const architectureTargets = targets.filter(isArchitectureTarget);
    if (architectureTargets.length) {
      const architecturePayload = {
        ...payload,
        tool_input: {
          writes: preparedWrites.map(({ filePath, content }) => ({ file_path: filePath, content })),
        },
      };
      for (const target of architectureTargets) {
        const output = runTarget(target, architecturePayload, cwd);
        if (output) {
          process.stdout.write(output);
          return;
        }
      }
    }

    const generalTargets = targets.filter((target) => !isArchitectureTarget(target));
    for (const { filePath, content } of preparedWrites) {
      const adapted = {
        ...payload,
        tool_input: { file_path: filePath, content },
      };
      for (const target of generalTargets) {
        if (!mightMatch(target, content)) continue;
        const output = runTarget(target, adapted, cwd);
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
