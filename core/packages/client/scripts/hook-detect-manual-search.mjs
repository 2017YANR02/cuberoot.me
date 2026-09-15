// Shared static search wiring check for write-time hooks and CI.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { prospectiveWritesFromHookPayload } from './hook-detect-nested-links.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const EXEMPTION = 'allow-manual-search';
const SEARCH = /search|搜索|查找/i;
export function inScope(path) {
  const normalized = path.replace(/\\/g, '/');
  return /(?:^|\/)core\/packages\/client\/(app|components)\/.*\.tsx$/.test(normalized)
    && !/(?:^|\/)(?:tests?|node_modules|\.next|dist|build)\//.test(normalized);
}

export function scanManualSearch(source, filePath = 'source.tsx') {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const definitions = new Map();
  const searchTags = new Set(['SearchInput']);
  const openings = [];
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) definitions.set(node.name.text, node.initializer);
    if (ts.isFunctionDeclaration(node) && node.name) definitions.set(node.name.text, node);
    if (ts.isImportDeclaration(node) && /\/SearchInput/.test(node.moduleSpecifier.getText(sf))) {
      if (node.importClause?.name) searchTags.add(node.importClause.name.text);
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) {
        if ((entry.propertyName ?? entry.name).text === 'SearchInput') searchTags.add(entry.name.text);
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) openings.push(node);
    ts.forEachChild(node, collect);
  }
  collect(sf);
  const attr = (node, name) => node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
  const attrText = (node, name) => attr(node, name)?.initializer?.getText(sf) ?? '';
  const tag = node => node.tagName.getText(sf);
  const isSearch = node => searchTags.has(tag(node)) || (['input', 'textarea'].includes(tag(node))
    && ['type', 'placeholder', 'aria-label', 'name', 'id', 'className'].some(name => SEARCH.test(attrText(node, name))));
  const fields = openings.filter(isSearch);
  const containsField = node => fields.some(field => field.pos >= node.pos && field.end <= node.end);
  const handlerText = (node, name) => {
    const initializer = attr(node, name)?.initializer;
    const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : undefined;
    return expression && ts.isIdentifier(expression) ? (definitions.get(expression.text) ?? expression).getText(sf) : attrText(node, name);
  };
  const exempt = node => {
    const prefix = source.slice(0, node.getStart(sf));
    // Only the immediately preceding comment applies, and a reason is required.
    return /(?:\/\/\s*allow-manual-search:[^\S\r\n]*[^\s\r\n][^\r\n]*|\/\*\s*allow-manual-search:[^\S\r\n]*[^\s*][^*]*\*\/\})\s*$/.test(prefix);
  };
  const violations = [];
  for (const node of openings) {
    let kind;
    if (isSearch(node) && ['onKeyDown', 'onKeyUp', 'onKeyPress'].some(name => /['"]Enter['"]/.test(handlerText(node, name)))) kind = 'enter';
    if (tag(node) === 'form' && attr(node, 'onSubmit') && containsField(node.parent)) kind = 'submit';
    if (tag(node) === 'button' && attr(node, 'onClick')) {
      const element = ts.isJsxOpeningElement(node) ? node.parent : node;
      const label = ['aria-label', 'title'].map(name => attrText(node, name)).join(' ') +
        (ts.isJsxElement(element) ? element.children.map(child => child.getText(sf)).join(' ') : '');
      if (SEARCH.test(label) && containsField(element.parent)) kind = 'button';
    }
    if (kind && !exempt(node)) violations.push({ kind, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  }
  return violations;
}

export function isAllowlisted(filePath) {
  let lines;
  try { lines = readFileSync(resolve(ROOT, '.codex/manual-search-allowlist.txt'), 'utf8').split(/\r?\n/); } catch { return false; }
  const normalized = filePath.replace(/\\/g, '/');
  return lines.some(line => {
    const match = line.match(/^([^#]+?)\s+#\s+\S.+$/);
    return match && normalized === resolve(ROOT, match[1].trim()).replace(/\\/g, '/');
  });
}

export function violationsFromHookPayload(payload, readSource) {
  const ti = payload?.tool_input;
  const patch = typeof ti === 'string' ? ti : ti?.command ?? ti?.patch ?? ti?.input;
  if (typeof patch === 'string' && patch.includes('*** Begin Patch')) {
    const absolutePatch = patch.replace(/^(\*\*\* (?:Add|Update|Delete) File: )(.+)$/gm,
      (_, prefix, path) => prefix + resolve(payload.cwd || ROOT, path.trim()));
    payload = { ...payload, tool_input: { patch: absolutePatch } };
  }
  const hits = [];
  for (const write of prospectiveWritesFromHookPayload(payload, readSource)) {
    if (!inScope(write.filePath) || isAllowlisted(write.filePath)) continue;
    const before = scanManualSearch(write.before, write.filePath);
    const after = scanManualSearch(write.after, write.filePath);
    for (const kind of ['enter', 'submit', 'button']) {
      const previousCount = before.filter(hit => hit.kind === kind).length;
      hits.push(...after.filter(hit => hit.kind === kind).slice(previousCount).map(hit => ({ ...hit, filePath: write.filePath })));
    }
  }
  return hits;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const hits = violationsFromHookPayload(JSON.parse(raw || '{}'));
      if (hits.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: {
        hookEventName: 'PreToolUse', permissionDecision: 'deny',
        permissionDecisionReason: `${hits[0].filePath}:${hits[0].line}: 搜索默认随输入更新，不能只靠回车或按钮提交。复用 SearchInput 的 onChange，远程查询用 debounceMs={300}；保留中文合成、立即清空和旧请求取消。已实时搜索的附加操作或重计算，在对应标签前加 allow-manual-search: <具体理由>。`,
      } }));
    } catch { /* Fail open; CI runs the same scanner without suppressing errors. */ }
  });
}
