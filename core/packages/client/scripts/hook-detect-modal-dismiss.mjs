import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { prospectiveWritesFromHookPayload } from './hook-detect-nested-links.mjs';

// Wiring check, not proof that an arbitrary event handler really closes a modal.
export function scanModalDismiss(source, filePath = 'source.tsx') {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const backdropBindings = new Set();
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && node.initializer && ts.isCallExpression(node.initializer)
      && /^(useModalBackdrop|useModalDismiss)$/.test(node.initializer.expression.getText(sf))) {
      backdropBindings.add(node.name.text);
    }
    ts.forEachChild(node, collect);
  }
  collect(sf);
  const hits = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = node.attributes.properties;
      const className = attrs.find(a => a.name?.getText(sf) === 'className')?.initializer?.getText(sf) ?? '';
      const element = ts.isJsxOpeningElement(node) ? node.parent : node;
      const isBackdrop = /(?:backdrop|scrim|modal-overlay|dialog-layer)(?:\b|_)/.test(className)
        || (/overlay/.test(className) && /(?:aria-modal|role=["']dialog["'])/.test(element.getText(sf)));
      const wired = attrs.some(a =>
        /^(onClick|onMouseDown|onPointerDown)$/.test(a.name?.getText(sf) ?? '')
          ? !!a.initializer && !/^(?:\{(?:undefined|null|false)\})$/.test(a.initializer.getText(sf))
          : ts.isJsxSpreadAttribute(a) && backdropBindings.has(a.expression.getText(sf)));
      if (isBackdrop && /^[a-z]/.test(node.tagName.getText(sf)) && !wired) {
        hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, className });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return hits;
}

export function violationsFromHookPayload(payload, readSource = path => {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}) {
  return prospectiveWritesFromHookPayload(payload, readSource).flatMap(write => {
    const path = write.filePath.replaceAll('\\', '/');
    if (!/\/core\/packages\/client\/(app|components)\/.*\.tsx$/.test(path)
      || /\/(?:tests|node_modules|\.next)\//.test(path)) return [];
    const before = scanModalDismiss(write.before, path);
    const after = scanModalDismiss(write.after, path);
    return after.slice(before.length).map(hit => ({ ...hit, filePath: path }));
  });
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const hits = violationsFromHookPayload(JSON.parse(raw || '{}'));
      if (hits.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: {
        hookEventName: 'PreToolUse', permissionDecision: 'deny',
        permissionDecisionReason: '弹窗遮罩缺少外部点击关闭。将 useModalDismiss / useModalBackdrop 返回的 props 展开到遮罩；内部操作与拖出不能误关，关闭不能隐式提交。',
      } }));
    } catch { /* Invalid payload or unavailable parser: CI remains the fallback. */ }
  });
}
