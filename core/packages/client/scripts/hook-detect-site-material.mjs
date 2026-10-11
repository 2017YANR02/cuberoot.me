#!/usr/bin/env node
// One scanner for proposed writes and CI full CSS.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prospectiveWritesFromHookPayload } from './hook-detect-nested-links.mjs';

const MATERIAL_FILE = 'components/glass-material.css';
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LEGACY_OVERRIDES = {
  'app/[lang]/home-background.css': new Set(['--glass-background:var(--card)', '--glass-filter:none']), // Existing print/accessibility fallback.
  'components/scroll-diagnostics.css': new Set(['--glass-filter:blur(6px)!important']), // Deliberate opt-in A/B diagnostic.
};

// These containers host non-portaled menus. Their glass belongs on ::before,
// otherwise the browser stops sampling the page at the ancestor backdrop root.
// Unknown/dynamic containers are covered by audit-glass-menus.mts in a browser.
const MENU_HOST = /\.(?:toolbar|shell-topbar|sor-race-bar|space-top-tools)(?![\w-])/;

function splitSelectors(value) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if ('(['.includes(value[i])) depth++;
    else if (')]'.includes(value[i])) depth--;
    else if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  return [...parts, value.slice(start)];
}

function expandedSelectors(value) {
  return splitSelectors(value).flatMap(selector => {
    const match = /:(?:is|where)\(/.exec(selector);
    if (!match) return [selector];
    let end = match.index + match[0].length, depth = 1;
    for (; end < selector.length && depth; end++) {
      if (selector[end] === '(') depth++;
      if (selector[end] === ')') depth--;
    }
    if (depth) return [selector];
    return splitSelectors(selector.slice(match.index + match[0].length, end - 1))
      .flatMap(option => expandedSelectors(selector.slice(0, match.index) + option.trim() + selector.slice(end)));
  });
}

function filtersMenuHost(selector) {
  return expandedSelectors(selector).some(value => {
    // Ignore pseudo-elements and functional state arguments (e.g. :has(menu)).
    if (/::[\w-]+/.test(value)) return false;
    let simple = value;
    while (/\([^()]*\)/.test(simple)) simple = simple.replace(/\([^()]*\)/g, '');
    const leaf = simple.trim().split(/[\s>+~]+/).at(-1) ?? '';
    return MENU_HOST.test(leaf)
      || /\.space-top-tools\s*>\s*(?:\*|\.space-row)(?:[.:#\[][\w\W]*)?$/.test(simple.trim());
  });
}

export function scanSiteMaterial(source, filePath) {
  const path = String(filePath).replaceAll('\\', '/').replace(/^.*packages\/client\//, '');
  if (!/^(app|components)\/.+\.css$/.test(path) || path === MATERIAL_FILE) return [];
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
  const hits = [];
  for (const rule of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim();
    const bodyStart = rule.index + rule[0].indexOf('{') + 1;
    for (const decl of rule[2].matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;{}]+)/g)) {
      const property = decl[1], value = decl[2].trim();
      const index = bodyStart + decl.index + decl[0].indexOf(property);
      const line = source.slice(source.lastIndexOf('\n', index) + 1, source.indexOf('\n', index + 1) < 0 ? source.length : source.indexOf('\n', index + 1));
      if (/\/\*\s*allow-site-material:\s*[^*\s][^*]+\*\//.test(line)) continue;
      if (property === 'content' && /\battr\(\s*(?:data-(?:tooltip|tip)|title)\s*\)/i.test(value)) {
        hits.push({ selector, property, value, reason: 'tooltip-reimplementation' });
      }
      if (/^(?:-webkit-)?backdrop-filter$/.test(property)
        && !/^(?:none|initial|unset)(?:\s*!important)?$/.test(value)
        && filtersMenuHost(selector)) {
        hits.push({ selector, property, value, reason: 'menu-backdrop-root' });
      }
      if (property.startsWith('--glass-')) {
        const identity = `${property}:${value}`.replace(/\s/g, '');
        if (!LEGACY_OVERRIDES[path]?.has(identity)) hits.push({ selector, property, value, reason: 'material-definition' });
      }
      if (!selector.includes('data-site-scenery') || path === 'components/site-surfaces.css') continue;
      const customBlur = /^(?:-webkit-)?backdrop-filter$/.test(property) && /\bblur\s*\(/.test(value);
      const customFill = /^background(?:-color)?$/.test(property)
        && (/^(?:#[\da-f]{3,8}\b|rgba?\(|hsla?\(|oklch\()/i.test(value)
          || /var\(\s*--(?:card|popover|background|muted|secondary)\s*\)/.test(value));
      if (customBlur || customFill) hits.push({ selector, property, value, reason: 'scenery-material' });
    }
  }
  return hits;
}

export function violationsFromHookPayload(payload, readSource) {
  const original = payload?.original_tool_input ?? payload?.tool_input;
  const patch = typeof original === 'string' ? original : original?.command ?? original?.patch ?? original?.input;
  const normalized = typeof patch === 'string' && patch.includes('*** Begin Patch')
    ? { ...payload, tool_input: { patch: patch.replace(/^(\*\*\* (?:Add|Update|Delete) File: )(.+)$/gm,
      (_match, prefix, path) => prefix + resolve(payload.cwd || REPO_ROOT, path.trim())) } }
    : payload;
  const writes = prospectiveWritesFromHookPayload(normalized, readSource);
  if (writes.length) return writes.flatMap(write => {
    const identity = hit => JSON.stringify(hit);
    const before = new Set(scanSiteMaterial(write.before, write.filePath).map(identity));
    return scanSiteMaterial(write.after, write.filePath).filter(hit => !before.has(identity(hit)));
  });
  const input = payload?.tool_input || {};
  const source = [input.content, input.new_string, ...(Array.isArray(input.edits) ? input.edits.map((edit) => edit?.new_string) : [])]
    .filter((part) => typeof part === 'string').join('\n');
  return scanSiteMaterial(source, input.file_path || '');
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }
    const violations = violationsFromHookPayload(payload);
    if (violations.length) process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse', permissionDecision: 'deny',
        permissionDecisionReason: violations.some(hit => hit.reason === 'tooltip-reimplementation')
          ? '不要用 content: attr(data-tooltip/data-tip/title) 重造悬停气泡。请复用 components/Tooltip，组件统一处理毛玻璃、Portal、焦点和视口钳制。独立语义须在声明同一行注明 /* allow-site-material: 具体理由 */；CI 使用同一扫描器。'
          : '复用 glass-material.css 的材质 token；承载菜单的工具栏不能直接设置 backdrop-filter，否则菜单无法模糊栏外内容。把工具栏材质画在不承载菜单的 ::before 上，并核对菜单层级。独立语义须在声明同一行注明 /* allow-site-material: 具体理由 */；CI 使用同一扫描器。',
      },
    }));
    process.exit(0);
  });
}
