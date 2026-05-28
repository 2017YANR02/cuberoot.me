#!/usr/bin/env node
// Sync the DeskPet (Clawd / Calico / Cloudling) assets from the upstream
// clawd-on-desk clone, and report mapping/behavior drift that needs a human.
//
// Three layers, three levels of automation (see project_deskpet memory):
//   assets   — re-copied automatically (redraws, new frames, new art)
//   mapping  — diffed and printed; you hand-edit THEMES in DeskPet.tsx
//   behavior — `git log` of src/ printed; you decide what to port
//
// Usage:
//   node scripts/sync-deskpet.mjs            # pull + copy + diff + record
//   node scripts/sync-deskpet.mjs --no-pull  # skip git pull, copy + diff
//   node scripts/sync-deskpet.mjs --dry      # diff only: no pull/copy/write
//
// Upstream location: env CLAWD_UPSTREAM, else D:/clawd-on-desk.

import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync,
  statSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_NEXT = resolve(HERE, '..');
const PUBLIC = join(CLIENT_NEXT, 'public');
const DESKPET_TSX = join(CLIENT_NEXT, 'components', 'DeskPet.tsx');
const STAMP = join(HERE, 'deskpet-upstream.json');

const UPSTREAM = resolve(process.env.CLAWD_UPSTREAM || 'D:/clawd-on-desk');

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const NO_PULL = args.has('--no-pull') || DRY;
const NO_COPY = args.has('--no-copy') || DRY;

// id → { from: upstream asset dir, to: public subdir, prefix, exts }
const SOURCES = [
  { id: 'clawd', from: 'assets/svg', to: 'deskpet', prefix: 'clawd-', exts: ['.svg'] },
  { id: 'calico', from: 'themes/calico/assets', to: 'deskpet/calico', prefix: 'calico-', exts: ['.svg', '.apng'] },
  { id: 'cloudling', from: 'themes/cloudling/assets', to: 'deskpet/cloudling', prefix: 'cloudling-', exts: ['.svg', '.apng'] },
];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function git(cwd, ...a) {
  return execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim();
}

function hash(file) {
  return createHash('sha1').update(readFileSync(file)).digest('hex');
}

function dieIfNoUpstream() {
  if (!existsSync(UPSTREAM) || !existsSync(join(UPSTREAM, '.git'))) {
    console.error(c.red(`Upstream clone not found at ${UPSTREAM}`));
    console.error(c.dim('Clone it first, or set CLAWD_UPSTREAM:'));
    console.error(c.dim('  git clone https://github.com/rullerzhou-afk/clawd-on-desk D:/clawd-on-desk'));
    process.exit(1);
  }
}

// ── 1. upstream commit + pull ────────────────────────────────────────────
dieIfNoUpstream();

const prevCommit = existsSync(STAMP)
  ? JSON.parse(readFileSync(STAMP, 'utf8')).commit
  : null;

if (!NO_PULL) {
  console.log(c.cyan('› git pull') + c.dim(` (${UPSTREAM})`));
  try {
    console.log(c.dim(git(UPSTREAM, 'pull', '--ff-only')));
  } catch (e) {
    console.error(c.red('git pull failed (uncommitted changes or non-ff?). Resolve manually.'));
    console.error(c.dim(String(e.stdout || e.message)));
    process.exit(1);
  }
}
const newCommit = git(UPSTREAM, 'rev-parse', 'HEAD');
console.log(c.dim(`upstream @ ${newCommit.slice(0, 9)}${prevCommit ? ` (was ${prevCommit.slice(0, 9)})` : ' (first sync)'}`));

// ── 2. copy assets ───────────────────────────────────────────────────────
function copyAssets() {
  let added = 0, changed = 0, same = 0;
  for (const src of SOURCES) {
    const fromDir = join(UPSTREAM, src.from);
    const toDir = join(PUBLIC, src.to);
    if (!existsSync(fromDir)) { console.warn(c.yellow(`skip ${src.id}: ${fromDir} missing`)); continue; }
    mkdirSync(toDir, { recursive: true });
    for (const f of readdirSync(fromDir)) {
      if (!f.startsWith(src.prefix)) continue;
      if (!src.exts.some((e) => f.endsWith(e))) continue;
      const a = join(fromDir, f);
      if (!statSync(a).isFile()) continue;
      const b = join(toDir, f);
      const exists = existsSync(b);
      const diff = exists ? hash(a) !== hash(b) : true;
      if (!exists) added++;
      else if (diff) changed++;
      else { same++; continue; }
      cpSync(a, b);
    }
  }
  console.log(c.green(`✓ assets: ${added} added, ${changed} changed, ${same} unchanged`));
}
if (!NO_COPY) copyAssets();
else console.log(c.dim('· skip copy'));

// ── 3. mapping drift: theme.json vs THEMES registry vs disk ───────────────
// Every asset filename a theme.json references, anywhere. Walks the whole
// object: states/reactions/tiers/idleAnimations/miniMode/transitions/... all
// hold filenames in different shapes, and displayHintMap/fileHitBoxes/
// fileViewBoxes key BY filename. Sounds (.wav/.mp3) don't match the ext.
function upstreamFiles(themeJsonPath) {
  const j = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
  const out = new Set();
  const re = /\.(svg|apng)$/;
  const walk = (v) => {
    if (typeof v === 'string') { if (re.test(v)) out.add(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) { if (re.test(k)) out.add(k); walk(val); }
    }
  };
  walk(j);
  return out;
}

// Filenames the DeskPet THEMES registry references, per character.
function registryFiles() {
  const tsx = readFileSync(DESKPET_TSX, 'utf8');
  const byId = {};
  for (const id of SOURCES.map((s) => s.id)) {
    const m = new RegExp(`${id}:\\s*\\{[\\s\\S]*?files:\\s*\\{([\\s\\S]*?)\\}`).exec(tsx);
    const set = new Set();
    if (m) for (const f of m[1].match(/[\w-]+\.(?:svg|apng)/g) || []) set.add(f);
    byId[id] = set;
  }
  return byId;
}

function diskFiles(toDir) {
  const d = join(PUBLIC, toDir);
  return new Set(existsSync(d) ? readdirSync(d).filter((f) => /\.(svg|apng)$/.test(f)) : []);
}

console.log('\n' + c.bold('Mapping drift') + c.dim(' (theme.json ↔ DeskPet THEMES ↔ disk)'));
const reg = registryFiles();
let needsHand = false;
for (const src of SOURCES) {
  // theme.json lives at themes/<id>/theme.json for all three characters.
  const tj = join(UPSTREAM, 'themes', src.id, 'theme.json');
  if (!existsSync(tj)) { console.warn(c.yellow(`  ${src.id}: theme.json missing`)); continue; }
  // displayHintMap cross-references clawd filenames in every theme; keep only
  // this character's own-prefixed assets.
  const up = new Set([...upstreamFiles(tj)].filter((f) => f.startsWith(src.prefix)));
  const used = reg[src.id] || new Set();
  const disk = diskFiles(src.to);

  const dead = [...used].filter((f) => !disk.has(f)); // registry → missing file on disk
  const dropped = [...used].filter((f) => disk.has(f) && !up.has(f)); // registry ref upstream no longer mentions → renamed/removed
  const newArt = [...up].filter((f) => !used.has(f)); // upstream has, we don't use
  const unused = [...disk].filter((f) => !used.has(f) && !up.has(f)); // on disk, nobody refs

  console.log('  ' + c.bold(src.id));
  if (dead.length) {
    needsHand = true;
    console.log(c.red(`    ✗ dead refs (${dead.length}) — registry points at files not on disk:`));
    dead.forEach((f) => console.log(c.red(`        ${f}`)));
  }
  if (dropped.length) {
    needsHand = true;
    console.log(c.red(`    ✗ dropped upstream (${dropped.length}) — registry uses a file upstream's theme.json no longer references; likely renamed:`));
    dropped.forEach((f) => console.log(c.red(`        ${f}`)));
  }
  // mini-mode sprites are the Electron taskbar dock — N/A to the web widget.
  const mini = newArt.filter((f) => f.includes('-mini-'));
  const realNew = newArt.filter((f) => !f.includes('-mini-'));
  if (realNew.length) {
    needsHand = true;
    console.log(c.yellow(`    ⚠ upstream-only (${realNew.length}) — new state/art not wired into THEMES:`));
    realNew.forEach((f) => console.log(c.yellow(`        ${f}`)));
  }
  if (mini.length) {
    console.log(c.dim(`    · mini-mode sprites (${mini.length}) — Electron taskbar dock, N/A to web widget`));
  }
  if (unused.length) {
    console.log(c.dim(`    · on disk, unreferenced (${unused.length}): ${unused.join(', ')}`));
  }
  if (!dead.length && !dropped.length && !realNew.length) console.log(c.green('    ✓ in sync'));
}

// ── 4. behavior changelog (renderer / src) ───────────────────────────────
console.log('\n' + c.bold('Behavior changes') + c.dim(' (src/ — decide manually what to port)'));
if (prevCommit && prevCommit !== newCommit) {
  const log = git(UPSTREAM, 'log', '--oneline', `${prevCommit}..${newCommit}`, '--', 'src', 'assets', 'themes');
  console.log(log ? c.dim(log) : c.green('  none in src/assets/themes'));
} else if (!prevCommit) {
  console.log(c.dim('  first sync — no baseline to diff. Review src/renderer.js if porting new interactions.'));
} else {
  console.log(c.green('  no upstream commits since last sync'));
}

// ── 5. record stamp ──────────────────────────────────────────────────────
if (!DRY) {
  writeFileSync(STAMP, JSON.stringify({
    commit: newCommit,
    syncedAt: new Date().toISOString(),
    note: 'Upstream clawd-on-desk commit last synced into public/deskpet. Managed by scripts/sync-deskpet.mjs.',
  }, null, 2) + '\n');
  console.log('\n' + c.green(`✓ recorded ${newCommit.slice(0, 9)} → ${STAMP.replace(CLIENT_NEXT, '.')}`));
} else {
  console.log('\n' + c.dim('· dry run, stamp not written'));
}

if (needsHand) {
  console.log(c.yellow('\n→ Hand-edit THEMES in components/DeskPet.tsx for the items above, then re-run.'));
}
