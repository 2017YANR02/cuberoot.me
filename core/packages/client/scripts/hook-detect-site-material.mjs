#!/usr/bin/env node
// One scanner for write-time fragments and CI full CSS; partial rules fail open.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MATERIAL_FILE = 'components/glass-material.css';
const LEGACY_OVERRIDES = {
  'app/[lang]/home-background.css': new Set(['--glass-background:var(--card)', '--glass-filter:none']), // Existing print/accessibility fallback.
  'components/scroll-diagnostics.css': new Set(['--glass-filter:blur(6px)!important']), // Deliberate opt-in A/B diagnostic.
};

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

export function violationsFromHookPayload(payload) {
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
    if (violationsFromHookPayload(payload).length) process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse', permissionDecision: 'deny',
        permissionDecisionReason: '场景背景复用 glass-material.css 的 --glass-surface-bg / --glass-popover-bg / --glass-filter；共享适配放 site-surfaces.css，禁止页面另定义材质。确有独立语义在声明同一行注明 /* allow-site-material: 具体理由 */；CI 使用同一扫描器。',
      },
    }));
    process.exit(0);
  });
}
