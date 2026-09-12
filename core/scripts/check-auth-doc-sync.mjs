// Repository-owned, read-only source inventory. Never imported by production apps.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOC_PATH = 'packages/client/app/[lang]/dev/auth/page.tsx';
const ROOTS = [
  'apps/api/src', 'apps/api/migrations', 'apps/miniprogram/src',
  'apps/mobile/src', 'apps/desktop/src', 'apps/desktop/src-tauri/src',
  'apps/harmony/src', 'apps/harmony/entry/src/main/ets',
  'packages/app-ui/src', 'packages/shared/src', 'packages/client/lib',
  'packages/client/components', 'packages/client/app/auth',
  'packages/client/app/[lang]/account', 'packages/client/app/api/google-verify',
];
const EXACT = new Set([
  'apps/api/src/db/schema.pg.sql', 'apps/api/src/index.ts',
  'apps/miniprogram/src/lib/navigation.ts', 'apps/miniprogram/src/lib/web-routes.ts',
  'apps/miniprogram/src/pages/web/index.ts',
  'packages/client/components/MobileEmbedBridge.tsx', 'packages/shared/src/mobile_embed.ts',
  'packages/app-ui/src/App.tsx', 'apps/mobile/src/capacitor-host.ts',
  'apps/mobile/src/native/secure-storage.ts', 'apps/desktop/src/tauri-host.ts',
  'apps/desktop/src-tauri/src/lib.rs', 'apps/harmony/src/harmony-host.ts',
  'apps/harmony/entry/src/main/ets/bridge/HarmonyBridge.ets',
  'apps/harmony/entry/src/main/ets/bridge/DeepLinkInbox.ets',
  'apps/harmony/entry/src/main/ets/entryability/EntryAbility.ets',
]);
const NATIVE = ['apps/mobile/ios/App/App', 'apps/mobile/android/app/src/main'];
const NATIVE_NAME = /^(?:AppDelegate\.swift|SceneDelegate\.swift|Info\.plist|AndroidManifest\.xml|MainActivity\.(?:java|kt))$/;
const CONFIG = [
  'packages/client/proxy.ts',
  'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/src-tauri/capabilities/default.json',
  'apps/harmony/entry/src/main/module.json5',
];
const NAME = /auth|account|identity|session|login|signin|oauth|apple|google|wechat|douyin|alipay|social|pkce|password|credential|logout|signout|revoke|token/i;
export function isAuthDocSource(path) {
  const normalized = path.replaceAll('\\', '/');
  if (/\.(?:test|spec)\.|\/(?:tests|fixtures)\//.test(normalized)) return false;
  const name = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (CONFIG.includes(normalized) || NATIVE.some(root => normalized.startsWith(`${root}/`) && NATIVE_NAME.test(name))) return true;
  if (!/\.(?:[cm]?[jt]sx?|css|json|wxml|wxss|sql|rs|ets)$/.test(normalized)) return false;
  if (EXACT.has(normalized)) return true;
  if (normalized.startsWith('packages/client/app/auth/')
    || normalized.startsWith('packages/client/app/[lang]/account/')
    || normalized.startsWith('packages/client/app/api/google-verify/')
    || normalized.startsWith('apps/miniprogram/src/pages/account/')
    || normalized.startsWith('packages/shared/src/auth/')
    || normalized.startsWith('packages/app-ui/src/auth/')) return true;
  return ROOTS.some(root => normalized.startsWith(`${root}/`)) && NAME.test(name);
}

export function collectAuthDocSources(root = CORE_ROOT) {
  const entries = new Map();
  function walk(path) {
    if (!existsSync(resolve(root, path))) throw new Error(`Missing auth source root: ${path}`);
    for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && isAuthDocSource(child)) entries.set(child, readFileSync(resolve(root, child), 'utf8'));
    }
  }
  for (const path of [...ROOTS, ...NATIVE]) walk(path);
  for (const path of CONFIG) entries.set(path, readFileSync(resolve(root, path), 'utf8'));
  return [...entries];
}

// Split only outside SQL strings, quoted identifiers, comments and dollar bodies.
// Incomplete input is kept whole: uncertainty may over-report, never hide a change.
function sqlStatements(source) {
  if (/standard_conforming_strings/i.test(source)) return [source];
  const statements = [];
  let start = 0, quote = '', dollar = '', block = 0, line = false, escapeString = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) {
      if (c === '/' && next === '*') { block++; i++; }
      else if (c === '*' && next === '/') { block--; i++; }
      continue;
    }
    if (dollar) {
      if (source.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ''; }
      continue;
    }
    if (quote) {
      if (escapeString && c === '\\') { i++; continue; }
      if (c === quote) { if (next === quote) i++; else quote = ''; }
      continue;
    }
    if (c === '-' && next === '-') { line = true; i++; }
    else if (c === '/' && next === '*') { block = 1; i++; }
    else if (c === "'" || c === '"') {
      quote = c;
      escapeString = c === "'" && /\bE$/i.test(source.slice(Math.max(0, i - 2), i));
    }
    else if (c === '$') {
      const tag = /^(?:\$[A-Za-z_]\w*\$|\$\$)/.exec(source.slice(i));
      if (tag) { dollar = tag[0]; i += dollar.length - 1; }
    } else if (c === ';') { statements.push(source.slice(start, i + 1)); start = i + 1; }
  }
  if (quote || dollar || block) return [source];
  statements.push(source.slice(start));
  return statements;
}

export function fingerprintAuthSources(entries) {
  const hash = createHash('sha256');
  const normalized = entries.map(([path, content]) => {
    path = path.replaceAll('\\', '/');
    content = content.replace(/\r\n/g, '\n');
    // The schema is shared with unrelated domains. Keep every statement referencing
    // canonical account tables, including constraints/indexes and later ALTERs.
    if (path === 'apps/api/src/db/schema.pg.sql') {
      content = sqlStatements(content).filter(statement => /\b(?:auth_\w+|app_users)\b/i.test(statement)).join('');
    }
    // This file also houses the unrelated admin toolbar. Retain imports + refresher;
    // if that explicit boundary disappears, conservatively hash the whole file.
    if (path === 'packages/client/components/AuthTokenRefresher.tsx') {
      const boundary = content.indexOf('\nexport function AdminTools(');
      const start = content.indexOf('export default function AuthTokenRefresher(');
      const additionalDeclarations = /\n(?:export\b|(?:async )?function\b|const\b|let\b|var\b|class\b|import\b)/.test(content.slice(boundary + 1));
      if (boundary !== -1 && start !== -1 && start < boundary && !additionalDeclarations) {
        const prefix = content.slice(0, boundary);
        const importPattern = /^import\s+([^;]+?)\s+from\s+['"][^'"]+['"];?\r?$/gm;
        // Ignore imports used only by the toolbar, but keep every import binding
        // referenced by the refresher (and all non-import declarations before it).
        const used = new Set(prefix.replace(importPattern, '').match(/[A-Za-z_$][\w$]*/g));
        content = prefix.replace(importPattern,
          (statement, bindings) => (bindings.match(/[A-Za-z_$][\w$]*/g) ?? []).some(name => used.has(name)) ? statement : '');
        content = content.replace(/^\s*\n/gm, '');
      }
    }
    return [path, content];
  });
  for (const [path, content] of normalized.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    hash.update(path); hash.update('\0'); hash.update(content); hash.update('\0');
  }
  return hash.digest('hex');
}

export function checkAuthDocReview(page, entries) {
  const match = /\/\* auth-doc-review\s*([\s\S]*?)\*\//.exec(page);
  let review;
  try { review = JSON.parse(match?.[1] ?? 'null'); } catch { /* invalid review below */ }
  if (!review || typeof review.reason !== 'string' || review.reason.trim().length < 20) {
    return ['Missing meaningful auth-doc-review reason in /dev/auth.'];
  }
  const fingerprint = fingerprintAuthSources(entries);
  return review.fingerprint === fingerprint ? [] : [
    '/dev/auth is stale: authentication sources changed without documentation review.',
    'Update the affected flow and bilingual text (or explain why behavior is unchanged), then update auth-doc-review.',
    `Reviewed source fingerprint: ${fingerprint}`,
    'Read AGENTS.md: 登录系统与流程图同步. Do not merely refresh the fingerprint.',
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = collectAuthDocSources();
  if (process.argv[2] === '--fingerprint') console.log(fingerprintAuthSources(entries));
  else {
    const errors = checkAuthDocReview(readFileSync(resolve(CORE_ROOT, DOC_PATH), 'utf8'), entries);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log(`/dev/auth review matches ${entries.length} source files.`);
  }
}
