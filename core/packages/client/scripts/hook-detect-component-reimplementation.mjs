#!/usr/bin/env node
// Shared component-reuse detector for PreToolUse and CI.
//
// A universal "is this semantically duplicated?" check would be noisy. This file is
// deliberately a registry of narrow, high-confidence source patterns. Each rule must
// name the canonical component, provide a copyable replacement, and support an
// explicit escape hatch. Add rules only after a real duplicate has been consolidated.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXEMPTION = 'allow-component-reimplementation';

const CLIENT_TSX = /(?:^|\/)core\/packages\/client\/(?:app|components)\/.*\.tsx$/i;
const SKIP_PATH = /(?:^|\/)(?:tests?|node_modules|\.next)(?:\/|$)|\/components\/ClearButton\.tsx$/i;
const BUTTON_BLOCK = /<button\b[\s\S]{0,1600}?<\/button\s*>/gi;
const CROSS = /<X\b|[×✕]/;
const CLOSE_OR_CLEAR =
  /(?:aria-label|ariaLabel|title|className|class)\s*=\s*[\s\S]{0,260}?(?:关闭|清除|close|clear|dismiss)|\bonClose\b/i;

export const COMPONENT_REUSE_RULES = [
  {
    id: 'clear-button',
    component: 'ClearButton',
    importStatement: "import { ClearButton } from '@/components/ClearButton';",
    replacement:
      '<ClearButton variant="standalone" ariaLabel={tr({ zh: \'关闭\', en: \'Close\' })} onClick={onClose} />',
    reason:
      '检测到手写的关闭/清除叉号按钮。统一复用 ClearButton，保留全站一致的尺寸、主题、hover 与无障碍语义。',
  },
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function exemptionNear(source, index, block) {
  const before = source.slice(Math.max(0, index - 260), index);
  return before.includes(EXEMPTION) || block.includes(EXEMPTION);
}

export function scanComponentReimplementations(source) {
  const violations = [];
  BUTTON_BLOCK.lastIndex = 0;
  let match;
  while ((match = BUTTON_BLOCK.exec(source))) {
    const block = match[0];
    if (!CROSS.test(block) || !CLOSE_OR_CLEAR.test(block)) continue;
    if (exemptionNear(source, match.index, block)) continue;
    violations.push({
      ruleId: 'clear-button',
      index: match.index,
      snippet: block.replace(/\s+/g, ' ').slice(0, 180),
    });
  }
  return violations;
}

function parseApplyPatch(patch) {
  const writes = [];
  let filePath = '';
  let added = [];
  const flush = () => {
    if (filePath) writes.push({ filePath: normalizePath(filePath), content: added.join('\n') });
    filePath = '';
    added = [];
  };
  for (const line of String(patch || '').split(/\r?\n/)) {
    const header = line.match(/^\*\*\* (?:Add|Update) File:\s*(.+)$/);
    if (header) {
      flush();
      filePath = header[1].trim();
      continue;
    }
    if (/^\*\*\* (?:Delete|Move to) File:/.test(line) || line === '*** End Patch') {
      flush();
      continue;
    }
    if (filePath && line.startsWith('+') && !line.startsWith('+++')) added.push(line.slice(1));
  }
  flush();
  return writes;
}

export function writesFromHookPayload(payload) {
  const ti = payload?.tool_input;
  if (typeof ti === 'string') return parseApplyPatch(ti);
  if (!ti || typeof ti !== 'object') return [];

  for (const key of ['patch', 'input']) {
    if (typeof ti[key] === 'string' && ti[key].includes('*** Begin Patch')) {
      return parseApplyPatch(ti[key]);
    }
  }

  const filePath = normalizePath(ti.file_path);
  if (!filePath) return [];
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) {
    for (const edit of ti.edits) {
      if (edit && typeof edit.new_string === 'string') parts.push(edit.new_string);
    }
  }
  return [{ filePath, content: parts.join('\n') }];
}

function loadPathAllowlist() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const file = resolve(here, '../../../../.Codex/component-reimplementation-allowlist.txt');
    return new Set(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => normalizePath(line.split('\t')[0].trim())),
    );
  } catch {
    return new Set();
  }
}

function inScope(filePath) {
  const normalized = normalizePath(filePath);
  return CLIENT_TSX.test(normalized) && !SKIP_PATH.test(normalized);
}

export function violationsFromHookPayload(payload, pathAllowlist = loadPathAllowlist()) {
  const violations = [];
  for (const write of writesFromHookPayload(payload)) {
    if (!inScope(write.filePath)) continue;
    const repoRelative = write.filePath.replace(/^.*?(core\/packages\/client\/)/i, '$1');
    if (pathAllowlist.has(repoRelative)) continue;
    for (const violation of scanComponentReimplementations(write.content)) {
      violations.push({ ...violation, filePath: write.filePath });
    }
  }
  return violations;
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

const isMain = process.argv[1]
  && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }
    const violations = violationsFromHookPayload(payload);
    if (violations.length) {
      const rule = COMPONENT_REUSE_RULES.find((item) => item.id === violations[0].ruleId);
      deny(
        `${rule.reason}\n${rule.importStatement}\n替换为: ${rule.replacement}\n` +
        `确属不同交互时，在该按钮前注明 // ${EXEMPTION}: <具体理由>。详见 /code/components。`,
      );
    }
    process.exit(0);
  });
}
