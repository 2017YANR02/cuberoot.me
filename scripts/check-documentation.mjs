#!/usr/bin/env node
/** Read-only documentation ownership, navigation and moved-path checks. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = 'docs/contributing/documentation-migrations.json';
const registry = JSON.parse(readFileSync(resolve(root, registryPath), 'utf8'));
const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean))];
const exists = p => existsSync(resolve(root, p));
const errors = [];
const headings = new Map();
const isManaged = p => p.endsWith('.md') && (
  p.startsWith('docs/') || /^core\/(?:apps|packages)\/[^/]+\/(?:README\.md|docs\/)/.test(p)
  || ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', 'core/README.md'].includes(p)
  || p.startsWith('.agents/skills/')
);
const slug = text => text.toLowerCase().replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-');
function anchors(path) {
  if (headings.has(path)) return headings.get(path);
  const text = readFileSync(resolve(root, path), 'utf8');
  const ids = new Set([...text.matchAll(/(?:id|name)=["']([^"']+)/g)].map(m => m[1]));
  const seen = new Map();
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;
    const base = slug(match[1]); const count = seen.get(base) ?? 0;
    ids.add(base + (count ? `-${count}` : '')); seen.set(base, count + 1);
  }
  headings.set(path, ids); return ids;
}
let documents = 0, links = 0;
for (const file of files.filter(isManaged)) {
  if (!exists(file)) continue;
  documents++;
  const text = readFileSync(resolve(root, file), 'utf8');
  let fence = false;
  for (const [lineIndex, line] of text.split('\n').entries()) {
    if (/^\s*(?:```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    for (const match of line.matchAll(/!?\[[^\n]*?\]\(([^\s\n]*?)\)/g)) {
      if ((line.slice(0, match.index).match(/`/g)?.length ?? 0) % 2) continue;
      const target = match[1].replace(/^<|>$/g, '');
      if (!target || /^(?:[a-z][\w+.-]*:|\/)/i.test(target)) continue;
      const hashIndex = target.indexOf('#');
      const rawPath = (hashIndex < 0 ? target : target.slice(0, hashIndex)).split('?')[0];
      const fragment = hashIndex < 0 ? '' : decodeURIComponent(target.slice(hashIndex + 1));
      const path = rawPath ? posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(rawPath))) : file;
      links++;
      if (!exists(path)) errors.push(`${file}:${lineIndex + 1}: missing ${target}`);
      else if (fragment && path.endsWith('.md') && !anchors(path).has(fragment)) errors.push(`${file}:${lineIndex + 1}: missing anchor ${target}`);
    }
  }
}
for (const [old, destination] of Object.entries(registry.moves)) {
  if (!exists(destination)) errors.push(`Migration target missing: ${old} -> ${destination}`);
  if (exists(old)) errors.push(`Retired documentation path still exists: ${old}`);
}
for (const [old, destination] of Object.entries(registry.anchors ?? {})) {
  const [path, anchor] = destination.split('#');
  if (!exists(path) || !anchors(path).has(anchor)) errors.push(`Anchor migration target missing: ${old} -> ${destination}`);
}
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const oldPaths = new RegExp('(?:^|[\\s\'"`(\\[=<>])(?:\\.{1,2}/|/)*(' + Object.keys(registry.moves).sort((a, b) => b.length - a.length).map(escape).join('|') + ')(?=$|[\\s\'"`)\\]#?:>,;/])', 'gm');
let candidates = [];
try {
  candidates = execFileSync('git', ['grep', '-Ilz', '-e', 'docs/'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0').filter(Boolean);
} catch (error) { if (error.status !== 1) throw error; }
for (const file of candidates) {
  if (file === registryPath || !exists(file) || statSync(resolve(root, file)).size > 2_000_000) continue;
  const allowed = new Set(registry.immutableReferences?.[file] ?? []);
  const text = readFileSync(resolve(root, file), 'utf8');
  for (const match of text.matchAll(oldPaths)) {
    const localTarget = posix.normalize(posix.join(posix.dirname(file), match[1]));
    // A module README may legitimately link to its own docs/foo.md.
    if (file.endsWith('.md') && localTarget !== match[1] && exists(localTarget)) continue;
    if (!allowed.has(match[1])) errors.push(`${file}: old path ${match[1]}`);
  }
}
const allowedRoot = new Set(['README.md', 'AGENTS.md']);
for (const file of files) {
  if (/^docs\/[^/]+\.md$/.test(file) && !allowedRoot.has(posix.basename(file))) errors.push(`Unowned root document: ${file}`);
  if (file.startsWith('core/docs/')) errors.push(`Retired core/docs entry: ${file}`);
}
if (errors.length) {
  console.error(`Documentation check failed (${errors.length}):\n${[...new Set(errors)].join('\n')}`); process.exitCode = 1;
} else console.log(`Documentation check passed: ${documents} Markdown files, ${links} local links, ${Object.keys(registry.moves).length} path mappings, ${Object.keys(registry.anchors ?? {}).length} anchor mappings.`);
