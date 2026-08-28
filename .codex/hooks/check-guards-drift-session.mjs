#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hooksPath = resolve(repoRoot, '.codex/hooks.json');
const guardsPath = resolve(repoRoot, 'core/packages/client/app/[lang]/dev/guards/_guards.ts');
if (!existsSync(hooksPath) || !existsSync(guardsPath)) process.exit(0);
let settings;
try { settings = JSON.parse(readFileSync(hooksPath, 'utf8')); } catch { process.exit(0); }

const registered = new Set();
for (const group of settings.hooks?.PreToolUse ?? []) {
  for (const hook of group.hooks ?? []) {
    for (const match of String(hook.command ?? '').matchAll(/[\w-]+\.(?:mjs|cjs)/g)) registered.add(match[0]);
  }
}
registered.delete('adapt-codex-write-payload.mjs');
registered.delete('adapt-codex-command-payload.mjs');

const documented = new Set();
const guardsSource = readFileSync(guardsPath, 'utf8');
for (const match of guardsSource.matchAll(/\{\s*id:\s*'[^']+',\s*scope:\s*'project',\s*hook:\s*'([^']+)'/gs)) {
  const registeredPart = match[1].split('→')[0];
  for (const file of registeredPart.matchAll(/[\w-]+\.(?:mjs|cjs)/g)) documented.add(file[0]);
}
const missing = [...documented].filter((name) => !registered.has(name));
const undocumented = [...registered].filter((name) => !documented.has(name));
if (missing.length === 0 && undocumented.length === 0) process.exit(0);
console.log('/dev/guards drift check (local, vs .codex/hooks.json):');
if (missing.length) console.log(`  documented on the page but not registered for Codex (renamed/removed?): ${missing.join(', ')}`);
if (undocumented.length) console.log(`  registered for Codex but missing from the page (forgot to document?): ${undocumented.join(', ')}`);
console.log('  -> review core/packages/client/app/[lang]/dev/guards/_guards.ts');
