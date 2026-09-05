#!/usr/bin/env node
// Shared write-time and CI detector for volatile React state initializers.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const EXEMPTION = 'allow-hydration-volatile-state';

const CLIENT_TSX = /(?:^|\/)core\/packages\/client\/(?:app|components)\/.*\.tsx$/i;
const VOLATILE = new Set([
  'Math.random',
  'Date.now',
  'localStorage.getItem',
  'sessionStorage.getItem',
]);

function memberName(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return '';
  const owner = node.expression.expression;
  return ts.isIdentifier(owner) ? `${owner.text}.${node.expression.name.text}` : '';
}

function volatileCall(node) {
  let found = null;
  const visit = (child) => {
    if (found) return;
    const name = memberName(child);
    if (VOLATILE.has(name)) {
      found = { node: child, name };
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function isUseStateCall(node) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === 'useState';
  return ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === 'React'
    && node.expression.name.text === 'useState';
}

export function scanVolatileStateInitializers(source, filePath = 'source.tsx') {
  if (source.slice(0, 500).includes(EXEMPTION)) return [];
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  const visit = (node) => {
    if (isUseStateCall(node) && node.arguments[0]) {
      const volatile = volatileCall(node.arguments[0]);
      if (volatile) {
        const start = node.getStart(sourceFile);
        const nearby = source.slice(Math.max(0, start - 200), node.getEnd());
        if (!nearby.includes(EXEMPTION)) {
          const at = sourceFile.getLineAndCharacterOfPosition(volatile.node.getStart(sourceFile));
          violations.push({ name: volatile.name, line: at.line + 1, column: at.character + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

export function violationsFromHookPayload(payload) {
  const input = payload?.tool_input ?? {};
  const filePath = String(input.file_path ?? '').replace(/\\/g, '/');
  if (!CLIENT_TSX.test(filePath)) return [];
  return scanVolatileStateInitializers(String(input.content ?? ''), filePath);
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
    const [hit] = violationsFromHookPayload(payload);
    if (hit) {
      deny(
        `BLOCKED: useState 首次渲染调用 ${hit.name}，服务端与客户端会得到不同 HTML。`
        + '请用固定初值，并在 hydration 后更新；外部存储状态用 useSyncExternalStore 的 server snapshot。'
        + `仅确定该子树不参与 SSR 时可注明 // ${EXEMPTION}: <具体理由>。`,
      );
    }
    process.exit(0);
  });
}
