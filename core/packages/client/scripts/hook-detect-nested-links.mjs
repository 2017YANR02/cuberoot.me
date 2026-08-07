#!/usr/bin/env node
// Shared nested-link detector for PreToolUse and CI.
// A link cannot contain another link. React reports that only at runtime, while
// typecheck stays green, so parse JSX before writes and again across the repo in CI.
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const EXEMPTION = 'allow-nested-link';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const CLIENT_TSX = /(?:^|\/)core\/packages\/client\/(?:app|components)\/.*\.tsx$/i;
const SKIP_PATH = /(?:^|\/)(?:tests?|node_modules|\.next|dist|build|out|coverage)(?:\/|$)/i;
const KNOWN_LINK_TAGS = new Set(['a', 'Link', 'AppLink', 'PersonLink']);
const LINK_MODULE = /(?:^next\/link$|react-router(?:-dom)?$|\/AppLink$|\/PersonLink$)/;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function linkTagNames(sourceFile) {
  const names = new Set(KNOWN_LINK_TAGS);
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!LINK_MODULE.test(stmt.moduleSpecifier.text)) continue;
    const clause = stmt.importClause;
    if (clause?.name) names.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const spec of clause.namedBindings.elements) {
        if ((spec.propertyName ?? spec.name).text === 'Link') names.add(spec.name.text);
      }
    }
  }
  return names;
}

function tagName(node, sourceFile) {
  return node.tagName.getText(sourceFile);
}

function exemptNear(source, outerStart, innerStart) {
  const start = Math.max(0, Math.min(outerStart, innerStart) - 300);
  const end = Math.min(source.length, innerStart + 160);
  return source.slice(start, end).includes(EXEMPTION);
}

export function scanNestedLinks(source, filePath = 'source.tsx') {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const linkNames = linkTagNames(sourceFile);
  const violations = [];

  function visit(node, linkAncestors) {
    if (ts.isJsxElement(node)) {
      const tag = tagName(node.openingElement, sourceFile);
      const isLink = linkNames.has(tag);
      if (isLink && linkAncestors.length > 0) {
        const outer = linkAncestors[linkAncestors.length - 1];
        const innerStart = node.getStart(sourceFile);
        if (!exemptNear(source, outer.start, innerStart)) {
          const at = sourceFile.getLineAndCharacterOfPosition(innerStart);
          violations.push({
            outerTag: outer.tag,
            innerTag: tag,
            index: innerStart,
            line: at.line + 1,
            column: at.character + 1,
          });
        }
      }
      const next = isLink
        ? [...linkAncestors, { tag, start: node.getStart(sourceFile) }]
        : linkAncestors;
      for (const child of node.children) visit(child, next);
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node, sourceFile);
      if (linkNames.has(tag) && linkAncestors.length > 0) {
        const outer = linkAncestors[linkAncestors.length - 1];
        const innerStart = node.getStart(sourceFile);
        if (!exemptNear(source, outer.start, innerStart)) {
          const at = sourceFile.getLineAndCharacterOfPosition(innerStart);
          violations.push({
            outerTag: outer.tag,
            innerTag: tag,
            index: innerStart,
            line: at.line + 1,
            column: at.character + 1,
          });
        }
      }
      return;
    }

    ts.forEachChild(node, (child) => visit(child, linkAncestors));
  }

  visit(sourceFile, []);
  return violations;
}

function resolveFilePath(filePath) {
  return isAbsolute(filePath) ? resolve(filePath) : resolve(REPO_ROOT, filePath);
}

function findSequence(lines, needle) {
  if (needle.length === 0) return 0;
  outer: for (let i = 0; i <= lines.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (lines[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function applyHunks(source, hunks) {
  let lines = source.replace(/\r\n/g, '\n').split('\n');
  for (const hunk of hunks) {
    const oldLines = [];
    const newLines = [];
    for (const line of hunk) {
      if (line.startsWith('+')) newLines.push(line.slice(1));
      else if (line.startsWith('-')) oldLines.push(line.slice(1));
      else {
        const value = line.startsWith(' ') ? line.slice(1) : line;
        oldLines.push(value);
        newLines.push(value);
      }
    }
    const index = findSequence(lines, oldLines);
    if (index < 0) return null;
    lines.splice(index, oldLines.length, ...newLines);
  }
  return lines.join('\n');
}

function parseApplyPatch(patch, readSource) {
  const writes = [];
  let action = '';
  let filePath = '';
  let hunks = [];
  let hunk = null;

  const flushHunk = () => {
    if (hunk) hunks.push(hunk);
    hunk = null;
  };
  const flushFile = () => {
    flushHunk();
    if (!filePath || action === 'Delete') {
      action = '';
      filePath = '';
      hunks = [];
      return;
    }
    const absolute = resolveFilePath(filePath);
    const before = action === 'Add' ? '' : readSource(absolute);
    if (before == null) return;
    const after = action === 'Add'
      ? hunks.flat().filter((line) => line.startsWith('+')).map((line) => line.slice(1)).join('\n')
      : applyHunks(before, hunks);
    if (after != null) writes.push({ filePath: absolute, before, after });
    action = '';
    filePath = '';
    hunks = [];
  };

  for (const line of String(patch || '').split(/\r?\n/)) {
    const header = line.match(/^\*\*\* (Add|Update|Delete) File:\s*(.+)$/);
    if (header) {
      flushFile();
      action = header[1];
      filePath = header[2].trim();
      if (action === 'Add') hunk = [];
      continue;
    }
    if (line.startsWith('*** Move to:')) continue;
    if (line === '*** End Patch') {
      flushFile();
      continue;
    }
    if (!filePath) continue;
    if (line.startsWith('@@')) {
      flushHunk();
      hunk = [];
      continue;
    }
    if (hunk) hunk.push(line);
  }
  flushFile();
  return writes;
}

function defaultReadSource(filePath) {
  try { return readFileSync(filePath, 'utf8'); } catch { return null; }
}

export function prospectiveWritesFromHookPayload(payload, readSource = defaultReadSource) {
  const ti = payload?.tool_input;
  if (typeof ti === 'string') return parseApplyPatch(ti, readSource);
  if (!ti || typeof ti !== 'object') return [];

  for (const key of ['patch', 'input']) {
    if (typeof ti[key] === 'string' && ti[key].includes('*** Begin Patch')) {
      return parseApplyPatch(ti[key], readSource);
    }
  }

  const filePath = normalizePath(ti.file_path);
  if (!filePath) return [];
  const absolute = resolveFilePath(filePath);
  const before = readSource(absolute) ?? '';
  if (typeof ti.content === 'string') return [{ filePath: absolute, before, after: ti.content }];

  let after = before;
  const edits = Array.isArray(ti.edits) ? ti.edits : [ti];
  for (const edit of edits) {
    if (typeof edit?.old_string !== 'string' || typeof edit?.new_string !== 'string') return [];
    if (!after.includes(edit.old_string)) return [];
    after = edit.replace_all
      ? after.split(edit.old_string).join(edit.new_string)
      : after.replace(edit.old_string, edit.new_string);
  }
  return [{ filePath: absolute, before, after }];
}

function inScope(filePath) {
  const normalized = normalizePath(filePath);
  return CLIENT_TSX.test(normalized) && !SKIP_PATH.test(normalized);
}

export function violationsFromHookPayload(payload, readSource = defaultReadSource) {
  const violations = [];
  for (const write of prospectiveWritesFromHookPayload(payload, readSource)) {
    if (!inScope(write.filePath)) continue;
    const before = scanNestedLinks(write.before, write.filePath);
    const after = scanNestedLinks(write.after, write.filePath);
    if (after.length <= before.length) continue;
    for (const violation of after.slice(before.length)) {
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
      const hit = violations[0];
      deny(
        `BLOCKED: ${hit.outerTag} 内嵌 ${hit.innerTag} 会生成 <a> 套 <a>，导致 React hydration error。` +
        '请把整行链接改为独立覆盖链接，或让两个链接成为同级元素。' +
        `确属静态分析误报时，在内层链接前注明 // ${EXEMPTION}: <具体理由>。`,
      );
    }
    process.exit(0);
  });
}
