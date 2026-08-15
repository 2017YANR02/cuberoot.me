#!/usr/bin/env node
// Write-time half of the puzzle-image state-parity contract. The CI test scans the
// complete sources; this detector catches new PuzzleImageStudio hosts and new static
// renderer fallbacks before they can omit the explicit exactness declaration.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT_TSX = /(?:^|\/)core\/packages\/client\/(?:app|components)\/.*\.tsx$/i;
const STUDIO_SOURCE = /\/components\/puzzle-image\/PuzzleImageStudio\.tsx$/i;
const STUDIO_TAG = /<PuzzleImageStudio\b[\s\S]*?(?:\/>|>)/g;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

export function scanPuzzleImageStateParity(filePath, source) {
  const normalized = normalizePath(filePath);
  if (!CLIENT_TSX.test(normalized)) return [];
  const violations = [];
  for (const match of String(source || '').matchAll(STUDIO_TAG)) {
    if (!/\bstaticFallbackExact\s*=/.test(match[0])) {
      violations.push({ ruleId: 'host-capability', filePath: normalized, index: match.index ?? 0 });
    }
  }
  if (STUDIO_SOURCE.test(normalized)
    && /renderSpecSvg\s*\(/.test(source)
    && !/staticFallbackExact/.test(source)) {
    violations.push({ ruleId: 'unguarded-static-fallback', filePath: normalized, index: 0 });
  }
  return violations;
}

function writesFromPayload(payload) {
  const input = payload?.tool_input;
  if (!input || typeof input !== 'object') return [];
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

export function violationsFromHookPayload(payload) {
  return writesFromPayload(payload).flatMap(({ filePath, content }) =>
    scanPuzzleImageStateParity(filePath, content));
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
    const [violation] = violationsFromHookPayload(payload);
    if (violation) {
      deny(
        violation.ruleId === 'host-capability'
          ? 'PuzzleImageStudio 宿主必须显式传 staticFallbackExact。只有静态 spec 能完整表达当前可见状态时才传 true;否则传 false 并提供 engineSvg,精确帧未到前必须等待。'
          : 'renderSpecSvg 只能作为经过 staticFallbackExact 能力判断的回退,禁止在实时状态导出链里无条件使用静态渲染器。',
      );
    }
    process.exit(0);
  });
}
