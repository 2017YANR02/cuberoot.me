#!/usr/bin/env node
// Exact dependency ratchet for active CubeRoot workspaces.
//
// The committed baseline is debt, not permission: deleting a legacy edge is allowed,
// while adding a different edge fails. Manual contracts cover runtime/artifact/deploy
// relationships that cannot be recovered reliably from module syntax alone.
import { existsSync, globSync, readFileSync, readdirSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CORE_ROOT = resolve(HERE, '..');
export const REPO_ROOT = resolve(CORE_ROOT, '..');
export const MANIFEST_PATH = join(CORE_ROOT, 'architecture-boundaries.json');
const typescriptWorkspace = activePackages()
  .find((pkg) => ['@cuberoot/client', '@cuberoot/web'].includes(pkg.name));
if (!typescriptWorkspace) throw new Error('active Web workspace is required by the architecture scanner');
const requireFromWeb = createRequire(join(typescriptWorkspace.root, 'package.json'));
const ts = requireFromWeb('typescript');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', 'out', 'target', 'coverage', '.turbo',
  '.tmp', 'android', 'ios', 'public', 'pkg', 'pkg-web', 'pkg-node',
]);
const SUBPROCESS_APIS = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
const PACKAGE_KINDS = new Set(['app', 'job', 'library']);
const RUNTIME_CLASSES = new Set(['asset', 'browser', 'mixed', 'node', 'react-dom', 'runtime-neutral']);
const NODE_MODULES = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const NODE_GLOBALS = new Set(['process', 'Buffer', '__dirname', '__filename', 'require', 'module', 'exports', 'global']);
const DOM_GLOBALS = new Set([
  'document', 'window', 'self', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia',
  'location', 'history', 'screen',
  'HTMLElement', 'HTMLCanvasElement', 'SVGElement', 'CanvasRenderingContext2D', 'CSSStyleSheet',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'Worker', 'SharedWorker', 'WebSocket', 'EventSource', 'XMLHttpRequest', 'DOMParser',
  'File', 'FileReader', 'Image', 'Audio', 'alert', 'confirm', 'prompt',
]);
const WECHAT_GLOBALS = new Set(['wx', 'WeixinJSBridge', 'getApp', 'getCurrentPages']);
const OTHER_HOST_GLOBALS = new Set(['Bun', 'Deno']);

function slash(value) {
  return String(value).replaceAll('\\', '/');
}

function repoRelative(value) {
  return slash(relative(CORE_ROOT, value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function findingIdentity(finding) {
  const { occurrences: _occurrences, ...identity } = finding;
  return JSON.stringify(stable(identity));
}

function occurrenceCount(finding) {
  return finding.occurrences ?? 1;
}

function findingKey(finding) {
  return JSON.stringify(stable(finding));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseWorkspaceScalar(raw, lineNumber) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`pnpm-workspace.yaml:${lineNumber}: empty package pattern`);
  if (trimmed.startsWith("'")) {
    const match = trimmed.match(/^'((?:[^']|'')*)'\s*(?:#.*)?$/);
    if (!match) throw new Error(`pnpm-workspace.yaml:${lineNumber}: unsupported quoted package pattern`);
    return match[1].replaceAll("''", "'");
  }
  if (trimmed.startsWith('"')) {
    const match = trimmed.match(/^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);
    if (!match) throw new Error(`pnpm-workspace.yaml:${lineNumber}: unsupported quoted package pattern`);
    try { return JSON.parse(match[1]); } catch {
      throw new Error(`pnpm-workspace.yaml:${lineNumber}: invalid quoted package pattern`);
    }
  }
  const value = trimmed.replace(/\s+#.*$/, '').trim();
  if (!value || /:\s/.test(value) || /^[\[\]{},&*?|>]/.test(value)) {
    throw new Error(`pnpm-workspace.yaml:${lineNumber}: package patterns must be scalar strings`);
  }
  return value;
}

export function parseWorkspacePackagePatterns(source) {
  const lines = String(source).replaceAll('\r\n', '\n').split('\n');
  const patterns = [];
  let packagesIndent = null;
  let found = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^ *\t/.test(line)) throw new Error(`pnpm-workspace.yaml:${index + 1}: tabs are not valid indentation`);
    const indent = line.length - line.trimStart().length;
    if (packagesIndent === null) {
      if (indent === 0 && /^packages\s*:/.test(line.trimStart())) {
        if (found) throw new Error('pnpm-workspace.yaml: duplicate packages key');
        if (!/^packages\s*:\s*(?:#.*)?$/.test(line.trimStart())) {
          throw new Error(`pnpm-workspace.yaml:${index + 1}: packages must be a block sequence`);
        }
        packagesIndent = indent;
        found = true;
      }
      continue;
    }
    if (indent <= packagesIndent) {
      packagesIndent = null;
      index -= 1;
      continue;
    }
    const item = line.trimStart();
    if (!item.startsWith('- ')) {
      throw new Error(`pnpm-workspace.yaml:${index + 1}: packages must contain only scalar patterns`);
    }
    patterns.push(parseWorkspaceScalar(item.slice(2), index + 1));
  }
  if (!found) throw new Error('pnpm-workspace.yaml: missing packages block');
  if (patterns.length === 0) throw new Error('pnpm-workspace.yaml: packages block is empty');
  if (!patterns.some((pattern) => !pattern.startsWith('!'))) {
    throw new Error('pnpm-workspace.yaml: packages block has no include pattern');
  }
  return patterns;
}

function workspacePackageRoots(patterns, coreRoot) {
  const included = new Map();
  const excluded = new Set();
  for (const rawPattern of patterns) {
    const negative = rawPattern.startsWith('!');
    const pattern = negative ? rawPattern.slice(1) : rawPattern;
    if (!pattern || pattern.includes('\\') || /^(?:[a-z]:|\/|\.\.(?:\/|$))/i.test(pattern)) {
      throw new Error(`unsupported workspace package pattern: ${JSON.stringify(rawPattern)}`);
    }
    let matches;
    try {
      matches = globSync(pattern, { cwd: coreRoot });
    } catch (error) {
      throw new Error(`invalid workspace package pattern ${JSON.stringify(rawPattern)}: ${error.message}`);
    }
    for (const match of matches) {
      const absolute = resolve(coreRoot, match);
      if (!`${absolute}${sep}`.toLowerCase().startsWith(`${resolve(coreRoot)}${sep}`.toLowerCase())) {
        throw new Error(`workspace package pattern escaped core root: ${JSON.stringify(rawPattern)}`);
      }
      const key = absolute.toLowerCase();
      if (negative) excluded.add(key);
      else included.set(key, absolute);
    }
  }
  const roots = [...included.entries()]
    .filter(([key, root]) => !excluded.has(key) && existsSync(join(root, 'package.json')))
    .map(([, root]) => root)
    .sort((a, b) => a.localeCompare(b));
  if (roots.length === 0) throw new Error('workspace package patterns matched no active packages');
  return roots;
}

export function activePackages({
  coreRoot = CORE_ROOT,
  workspaceSource = readFileSync(join(coreRoot, 'pnpm-workspace.yaml'), 'utf8'),
} = {}) {
  const roots = workspacePackageRoots(parseWorkspacePackagePatterns(workspaceSource), coreRoot);
  const result = roots.map((root) => {
    const json = readJson(join(root, 'package.json'));
    const workspacePath = slash(relative(coreRoot, root));
    const scopedName = typeof json.name === 'string' ? json.name.match(/^@cuberoot\/([a-z0-9-]+)$/) : null;
    const identity = scopedName?.[1] ?? workspacePath.split('/').at(-1);
    return {
      cuberoot: json.cuberoot ?? null,
      dir: identity,
      json,
      name: json.name ?? identity,
      root,
      exports: json.exports ?? null,
      workspacePath,
    };
  });
  const names = new Set();
  const identities = new Set();
  for (const pkg of result) {
    if (names.has(pkg.name)) throw new Error(`duplicate workspace package name: ${pkg.name}`);
    if (identities.has(pkg.dir)) throw new Error(`duplicate workspace package identity: ${pkg.dir}`);
    names.add(pkg.name);
    identities.add(pkg.dir);
  }
  return result.sort((a, b) => a.dir.localeCompare(b.dir));
}

function productionDependencies(pkg) {
  return new Map(Object.entries({
    ...(pkg.json.peerDependencies ?? {}),
    ...(pkg.json.optionalDependencies ?? {}),
    ...(pkg.json.dependencies ?? {}),
  }));
}

function workspaceAliasName(reference) {
  if (!reference || reference === '*' || reference === '^' || reference === '~') return null;
  if (reference.startsWith('@')) {
    const separator = reference.indexOf('@', reference.indexOf('/') + 1);
    return separator < 0 ? reference : reference.slice(0, separator);
  }
  const separator = reference.indexOf('@');
  return separator < 0 ? reference : reference.slice(0, separator);
}

function dependencyWorkspaceTarget(pkg, dependency, specifier, packages, workspaceByName) {
  const direct = workspaceByName.get(dependency) ?? null;
  if (typeof specifier !== 'string') return direct;
  const localProtocol = specifier.match(/^(?:file|link):(.+)$/);
  if (localProtocol) {
    return packageForPath(packages, resolve(pkg.root, localProtocol[1])) ?? direct;
  }
  if (!specifier.startsWith('workspace:')) return direct;
  const reference = specifier.slice('workspace:'.length);
  if (reference.startsWith('./') || reference.startsWith('../')) {
    return packageForPath(packages, resolve(pkg.root, reference)) ?? direct;
  }
  return workspaceByName.get(workspaceAliasName(reference)) ?? direct;
}

function exportEntries(exportsField) {
  if (typeof exportsField === 'string' || Array.isArray(exportsField) || exportsField === null) {
    return exportsField === null ? [] : [['.', exportsField]];
  }
  if (!exportsField || typeof exportsField !== 'object') return [];
  const keys = Object.keys(exportsField);
  if (keys.length === 0) return [];
  if (keys.some((key) => key.startsWith('.') && key !== '.' && !key.startsWith('./'))) return null;
  const subpathKeys = keys.filter((key) => key === '.' || key.startsWith('./'));
  if (subpathKeys.length === 0) return [['.', exportsField]];
  if (subpathKeys.length !== keys.length) return null;
  return Object.entries(exportsField);
}

export function validatePackageMetadata(packages = activePackages()) {
  const errors = [];
  const workspaceByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  if (packages.length !== 14) errors.push(`expected 14 active workspaces, found ${packages.length}`);
  const kindCounts = new Map([...PACKAGE_KINDS].map((kind) => [kind, 0]));
  for (const pkg of packages) {
    const metadata = pkg.cuberoot;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      errors.push(`${pkg.dir}: missing cuberoot metadata`);
      continue;
    }
    if (!PACKAGE_KINDS.has(metadata.kind)) {
      errors.push(`${pkg.dir}: unknown cuberoot.kind ${JSON.stringify(metadata.kind)}`);
      continue;
    }
    kindCounts.set(metadata.kind, kindCounts.get(metadata.kind) + 1);
    const workspaceGroup = pkg.workspacePath?.split('/')[0];
    if (workspaceGroup === 'apps' && metadata.kind !== 'app') {
      errors.push(`${pkg.dir}: apps workspace must declare cuberoot.kind app`);
    } else if (workspaceGroup === 'jobs' && metadata.kind !== 'job') {
      errors.push(`${pkg.dir}: jobs workspace must declare cuberoot.kind job`);
    } else if (workspaceGroup && !['apps', 'jobs', 'packages'].includes(workspaceGroup)) {
      errors.push(`${pkg.dir}: workspace must live under apps, packages or jobs`);
    }
    const dependencies = productionDependencies(pkg);
    const dependencyTargets = new Map();
    for (const [dependency, specifier] of dependencies) {
      const target = dependencyWorkspaceTarget(pkg, dependency, specifier, packages, workspaceByName);
      dependencyTargets.set(dependency, target);
      if (target && target.dir !== pkg.dir && target.cuberoot?.kind !== 'library') {
        errors.push(`${pkg.dir}: production dependency ${dependency} targets ${target.cuberoot?.kind ?? 'unclassified'} workspace ${target.dir}`);
      }
    }
    if (metadata.kind !== 'library') {
      if (metadata.runtime !== undefined) errors.push(`${pkg.dir}: cuberoot.runtime is only valid for libraries`);
      if (metadata.externalRuntime !== undefined) errors.push(`${pkg.dir}: cuberoot.externalRuntime is only valid for libraries`);
      continue;
    }
    const entries = exportEntries(pkg.exports);
    if (entries === null) {
      errors.push(`${pkg.dir}: exports cannot mix subpath and condition keys`);
      continue;
    }
    const exportKeys = entries
      .map(([key]) => key)
      .filter((key) => resolvePackageExport(pkg.exports, key).status === 'resolved');
    if (exportKeys.length === 0) {
      errors.push(`${pkg.dir}: library must declare at least one usable public export`);
      continue;
    }
    const runtime = metadata.runtime;
    if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
      errors.push(`${pkg.dir}: library must map every export in cuberoot.runtime`);
      continue;
    }
    const runtimeKeys = Object.keys(runtime);
    for (const key of exportKeys) {
      if (!Object.hasOwn(runtime, key)) errors.push(`${pkg.dir}: missing runtime class for export ${key}`);
    }
    for (const key of runtimeKeys) {
      if (!exportKeys.includes(key)) errors.push(`${pkg.dir}: stale runtime class for non-export ${key}`);
      else if (!RUNTIME_CLASSES.has(runtime[key])) {
        errors.push(`${pkg.dir}: unknown runtime class ${JSON.stringify(runtime[key])} for export ${key}`);
      }
    }
    const externalRuntime = metadata.externalRuntime;
    if (!externalRuntime || typeof externalRuntime !== 'object' || Array.isArray(externalRuntime)) {
      if ([...dependencies.keys()].some((name) => !dependencyTargets.get(name))) {
        errors.push(`${pkg.dir}: library must classify every external production dependency in cuberoot.externalRuntime`);
      }
      continue;
    }
    const externalDependencies = [...dependencies.keys()].filter((name) => !dependencyTargets.get(name));
    for (const dependency of externalDependencies) {
      if (!Object.hasOwn(externalRuntime, dependency)) {
        errors.push(`${pkg.dir}: missing external runtime class for dependency ${dependency}`);
      }
    }
    for (const [dependency, runtimeClass] of Object.entries(externalRuntime)) {
      if (!externalDependencies.includes(dependency)) {
        errors.push(`${pkg.dir}: stale external runtime class for non-dependency ${dependency}`);
      } else if (!RUNTIME_CLASSES.has(runtimeClass)) {
        errors.push(`${pkg.dir}: unknown external runtime class ${JSON.stringify(runtimeClass)} for dependency ${dependency}`);
      }
    }
  }
  for (const [kind, expected] of [['app', 4], ['job', 4], ['library', 6]]) {
    const actual = kindCounts.get(kind);
    if (actual !== expected) errors.push(`expected ${expected} ${kind} workspaces, found ${actual}`);
  }
  return errors.sort();
}

function filesUnder(root) {
  const out = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) out.push(absolute);
    }
  };
  walk(root);
  return out;
}

function sourceKind(owner, file) {
  const normalized = slash(file);
  if (/\/(?:tests?|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return 'test';
  if (owner.cuberoot?.kind === 'job'
      || /\/scripts?\/|\/[^/]+\.config\.[cm]?[jt]s$|\/(?:build|gen|generate|sync|update)[^/]*\.[cm]?[jt]s$/.test(normalized)) return 'build';
  return 'runtime';
}

function packageForPath(packages, absolute) {
  const normalized = `${resolve(absolute)}${sep}`.toLowerCase();
  return packages
    .filter((item) => normalized.startsWith(`${resolve(item.root)}${sep}`.toLowerCase()))
    .sort((a, b) => resolve(b.root).length - resolve(a.root).length)[0] ?? null;
}

function importKind(node) {
  const clause = node.importClause;
  if (!clause) return 'runtime';
  if (clause.isTypeOnly) return 'type-only';
  if (!clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
      && clause.namedBindings.elements.length > 0
      && clause.namedBindings.elements.every((element) => element.isTypeOnly)) return 'type-only';
  return 'runtime';
}

function exportKind(node) {
  if (node.isTypeOnly) return 'type-only';
  if (node.exportClause && ts.isNamedExports(node.exportClause)
      && node.exportClause.elements.length > 0
      && node.exportClause.elements.every((element) => element.isTypeOnly)) return 'type-only';
  return 'runtime';
}

function validPackageTarget(target) {
  if (typeof target !== 'string' || !target.startsWith('./')) return false;
  const segments = target.slice(2).split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..' && segment !== 'node_modules');
}

function resolvePackageTarget(value, {
  allowExternal = false,
  conditions = null,
  includeTypes = false,
  replacement = '',
} = {}) {
  if (value === null) return { status: 'blocked', targets: [], fallthrough: true };
  if (typeof value === 'string') {
    const target = value.replaceAll('*', replacement);
    return validPackageTarget(target) || (allowExternal && validExternalPackageTarget(target))
      ? { status: 'resolved', targets: [target], fallthrough: false }
      : { status: 'invalid', targets: [], fallthrough: true };
  }
  if (Array.isArray(value)) {
    const targets = [];
    let fallthrough = true;
    let lastStatus = 'blocked';
    for (const alternative of value) {
      if (!fallthrough) break;
      const result = resolvePackageTarget(alternative, {
        allowExternal, conditions, includeTypes, replacement,
      });
      targets.push(...result.targets);
      if (result.status !== 'unresolved') lastStatus = result.status;
      fallthrough = result.fallthrough;
    }
    return {
      status: targets.length ? 'resolved' : lastStatus,
      targets: [...new Set(targets)],
      fallthrough,
    };
  }
  if (!value || typeof value !== 'object') return { status: 'invalid', targets: [], fallthrough: true };
  if (conditions) {
    for (const [condition, conditionalTarget] of Object.entries(value)) {
      if (condition.startsWith('.')) return { status: 'invalid', targets: [], fallthrough: true };
      if (condition === 'types' ? !includeTypes : condition !== 'default' && !conditions.has(condition)) continue;
      const result = resolvePackageTarget(conditionalTarget, {
        allowExternal, conditions, includeTypes, replacement,
      });
      if (result.status !== 'unresolved') return result;
    }
    return { status: 'unresolved', targets: [], fallthrough: true };
  }
  const targets = [];
  let sawBlocked = false;
  let sawInvalid = false;
  let sawRuntimeCondition = false;
  let sawDefault = false;
  let fallthrough = false;
  for (const [condition, conditionalTarget] of Object.entries(value)) {
    if (condition.startsWith('.')) return { status: 'invalid', targets: [], fallthrough: true };
    if (condition === 'types' && !includeTypes) continue;
    sawRuntimeCondition = true;
    const result = resolvePackageTarget(conditionalTarget, {
      allowExternal, conditions, includeTypes, replacement,
    });
    targets.push(...result.targets);
    sawBlocked ||= result.status === 'blocked';
    sawInvalid ||= result.status === 'invalid';
    fallthrough ||= result.fallthrough;
    if (condition === 'default') {
      sawDefault = true;
      break;
    }
  }
  return {
    status: targets.length ? 'resolved' : sawBlocked ? 'blocked' : sawInvalid || sawRuntimeCondition ? 'invalid' : 'unresolved',
    targets: [...new Set(targets)],
    fallthrough: !sawDefault || fallthrough,
  };
}

function wildcardReplacement(key, requested) {
  const star = key.indexOf('*');
  if (star < 0 || key.indexOf('*', star + 1) >= 0) return null;
  const prefix = key.slice(0, star);
  const suffix = key.slice(star + 1);
  if (!requested.startsWith(prefix) || !requested.endsWith(suffix)) return null;
  if (requested.length < prefix.length + suffix.length) return null;
  return requested.slice(prefix.length, requested.length - suffix.length);
}

export function resolvePackageExport(exportsField, requested = '.', { includeTypes = false, conditions = null } = {}) {
  const entries = exportEntries(exportsField);
  const conditionSet = conditions ? new Set(conditions) : null;
  if (entries === null) return { status: 'invalid', key: null, targets: [], wildcard: false };
  const byKey = new Map(entries);
  if (byKey.has(requested)) {
    const { fallthrough: _fallthrough, ...result } = resolvePackageTarget(byKey.get(requested), {
      conditions: conditionSet,
      includeTypes,
    });
    return {
      ...result,
      key: requested,
      wildcard: false,
    };
  }
  const matches = entries
    .map(([key, value]) => ({ key, value, replacement: wildcardReplacement(key, requested) }))
    .filter((entry) => entry.replacement !== null)
    .sort((a, b) => {
      const aPrefix = a.key.indexOf('*');
      const bPrefix = b.key.indexOf('*');
      return bPrefix - aPrefix || b.key.length - a.key.length || a.key.localeCompare(b.key);
    });
  if (matches.length === 0) return { status: 'unresolved', key: null, targets: [], wildcard: false };
  const match = matches[0];
  const { fallthrough: _fallthrough, ...result } = resolvePackageTarget(match.value, {
    conditions: conditionSet,
    includeTypes,
    replacement: match.replacement,
  });
  return {
    ...result,
    key: match.key,
    wildcard: true,
  };
}

function literalText(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

function calleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return '';
}

function targetPackageFromPathLiteral(packages, owner, file, text) {
  const normalized = slash(text);
  if (/\s|^https?:\/\//i.test(normalized)) return null;
  const explicitPath = normalized.match(/(?:^|\/)((?:apps|packages|jobs)\/[a-z0-9-]+)(?:\/|$)/i)?.[1];
  if (explicitPath) {
    const target = packages.find((item) => item.workspacePath.toLowerCase() === explicitPath.toLowerCase()) ?? null;
    if (target?.dir === owner.dir) return null;
    if (target) return target;
  }
  if (!/^(?:\.\.?\/|\/?(?:core\/)?(?:apps|packages|jobs)\/)/.test(normalized)) return null;
  const candidate = resolve(dirname(file), text);
  const resolved = packageForPath(packages, candidate);
  if (resolved && resolved.dir !== owner.dir) return resolved;
  const segments = new Set(normalized.toLowerCase().split('/'));
  return packages.find((item) => item.dir !== owner.dir
    && (segments.has(item.dir.toLowerCase()) || segments.has(item.workspacePath.split('/').at(-1).toLowerCase()))) ?? null;
}

function declaresWorkspaceDependency(owner, target, sourceType) {
  const production = productionDependencies(owner);
  if (production.has(target.name)) return true;
  if (sourceType === 'runtime') return false;
  return Object.hasOwn(owner.json.devDependencies ?? {}, target.name);
}

function moduleFinding(packages, owner, file, specifier, kind, mechanism) {
  const common = {
    file: repoRelative(file),
    importKind: kind,
    mechanism,
    sourceKind: sourceKind(owner, file),
    specifier,
  };

  if (specifier === '@cuberoot/shared') {
    return { ...common, rule: 'shared-root-import', target: 'shared' };
  }

  if (specifier.startsWith('@/') && owner.dir === 'server') {
    return { ...common, rule: 'cross-package-alias-import', target: 'client' };
  }

  if (specifier.startsWith('.')) {
    const target = packageForPath(packages, resolve(dirname(file), specifier));
    if (target && target.dir !== owner.dir) {
      return { ...common, rule: 'cross-package-relative-module', target: target.dir };
    }
    return null;
  }

  const target = packages.find((item) => specifier === item.name || specifier.startsWith(`${item.name}/`));
  if (!target) return null;
  const subpath = specifier === target.name ? '' : specifier.slice(target.name.length + 1);
  if (target.dir !== owner.dir && target.cuberoot?.kind !== 'library') {
    return { ...common, rule: 'workspace-app-root-import', target: target.dir };
  }
  const requested = subpath ? `./${subpath}` : '.';
  const resolvedExport = resolvePackageExport(target.exports, requested, { includeTypes: kind === 'type-only' });
  if (resolvedExport.status !== 'resolved') {
    return { ...common, rule: 'workspace-unexported-import', target: target.dir };
  }
  if (resolvedExport.wildcard) {
    return { ...common, rule: 'workspace-wildcard-import', target: target.dir };
  }
  if (target.dir !== owner.dir && !declaresWorkspaceDependency(owner, target, common.sourceKind)) {
    return { ...common, rule: 'workspace-undeclared-import', target: target.dir };
  }
  return null;
}

function workspaceExportKey(pkg, specifier) {
  const requested = specifier === pkg.name
    ? '.'
    : specifier.startsWith(`${pkg.name}/`) ? `./${specifier.slice(pkg.name.length + 1)}` : null;
  if (!requested) return null;
  const result = resolvePackageExport(pkg.exports, requested);
  return result.status === 'resolved' ? result.key : null;
}

function sourceProgram(file, source) {
  const scriptKind = file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const options = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const canonicalFile = resolve(file).toLowerCase();
  const host = {
    fileExists: (candidate) => resolve(candidate).toLowerCase() === canonicalFile,
    getCanonicalFileName: (candidate) => candidate.toLowerCase(),
    getCurrentDirectory: () => dirname(file),
    getDefaultLibFileName: () => 'lib.d.ts',
    getDirectories: () => [],
    getNewLine: () => '\n',
    getSourceFile: (candidate) => resolve(candidate).toLowerCase() === canonicalFile ? sourceFile : undefined,
    readFile: (candidate) => resolve(candidate).toLowerCase() === canonicalFile ? source : undefined,
    useCaseSensitiveFileNames: () => false,
    writeFile: () => {},
  };
  const program = ts.createProgram([file], options, host);
  return { ast: program.getSourceFile(file) ?? sourceFile, checker: program.getTypeChecker() };
}

function isTypePosition(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isTypeNode(current)) return true;
    if (ts.isExpression(current) || ts.isStatement(current) || ts.isSourceFile(current)) return false;
  }
  return false;
}

function isReferenceIdentifier(node) {
  const parent = node.parent;
  if (!parent || isTypePosition(node)) return false;
  if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent)
      || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isArrowFunction(parent)
      || ts.isClassDeclaration(parent) || ts.isClassExpression(parent) || ts.isInterfaceDeclaration(parent)
      || ts.isTypeAliasDeclaration(parent) || ts.isEnumDeclaration(parent) || ts.isImportClause(parent)
      || ts.isNamespaceImport(parent) || ts.isImportSpecifier(parent)) && parent.name === node) return false;
  if ((ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) && parent.name === node) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)
      || ts.isPropertySignature(parent) || ts.isMethodSignature(parent) || ts.isEnumMember(parent))
      && parent.name === node) return false;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent) || ts.isJsxAttribute(parent)) return false;
  return true;
}

function unwrapExpression(node) {
  let current = node;
  while (current && (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isSatisfiesExpression(current)
  )) current = current.expression;
  return current;
}

function packageSpecifierRoot(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? (parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null) : parts[0];
}

function pathInside(root, candidate) {
  const normalizedRoot = `${resolve(root)}${sep}`.toLowerCase();
  return `${resolve(candidate)}${sep}`.toLowerCase().startsWith(normalizedRoot);
}

function directRuntimeNeutralScan(packages, owner, file, source) {
  const { ast, checker } = sourceProgram(file, source);
  const specifiers = new Map();
  const violations = [];
  let hasJsx = false;
  const record = (rule, detail) => violations.push({ file: repoRelative(file), rule, detail });
  const addSpecifier = (specifier, runtime) => {
    if (specifier !== null) specifiers.set(specifier, (specifiers.get(specifier) ?? false) || runtime);
  };
  const runtimeDeclaration = (declaration) => {
    for (let current = declaration; current && current !== ast; current = current.parent) {
      if (current.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)) return false;
    }
    if (ts.isImportClause(declaration)) return !declaration.isTypeOnly;
    if (ts.isNamespaceImport(declaration)) return !declaration.parent.isTypeOnly;
    if (ts.isImportSpecifier(declaration)) {
      return !declaration.isTypeOnly && !declaration.parent.parent.isTypeOnly;
    }
    if (ts.isImportEqualsDeclaration(declaration)) return !declaration.isTypeOnly;
    return !ts.isInterfaceDeclaration(declaration) && !ts.isTypeAliasDeclaration(declaration);
  };
  const locallyBound = (identifier) => checker.getSymbolAtLocation(identifier)?.declarations
    ?.some((declaration) => declaration.getSourceFile() === ast && runtimeDeclaration(declaration)) ?? false;
  const unbound = (identifier) => ts.isIdentifier(identifier) && !locallyBound(identifier);

  const collect = (node) => {
    if (ts.isImportDeclaration(node) && literalText(node.moduleSpecifier) !== null) {
      addSpecifier(literalText(node.moduleSpecifier), importKind(node) !== 'type-only');
    } else if (ts.isImportEqualsDeclaration(node)
        && ts.isExternalModuleReference(node.moduleReference)
        && literalText(node.moduleReference.expression) !== null) {
      addSpecifier(literalText(node.moduleReference.expression), !node.isTypeOnly);
    } else if (ts.isExportDeclaration(node) && literalText(node.moduleSpecifier) !== null) {
      addSpecifier(literalText(node.moduleSpecifier), exportKind(node) !== 'type-only');
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
        && literalText(node.argument.literal) !== null) {
      addSpecifier(literalText(node.argument.literal), false);
    } else if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const globalRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require' && unbound(node.expression);
      if (dynamicImport || globalRequire) {
        const specifier = literalText(node.arguments[0]);
        if (specifier === null) record('runtime-neutral-dynamic-import', node.getText(ast));
        else addSpecifier(specifier, true);
      }
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) hasJsx = true;
    ts.forEachChild(node, collect);
  };
  collect(ast);

  for (const [specifier, runtime] of specifiers) {
    if (!runtime) continue;
    if (specifier.startsWith('#')) {
      for (const target of runtimePackageImportTargets(owner, specifier)) {
        if (!target.startsWith('./')) addSpecifier(target, true);
      }
      continue;
    }
    if (specifier === 'react' || specifier.startsWith('react/') || specifier === 'react-dom' || specifier.startsWith('react-dom/')) {
      record('runtime-neutral-react-dom', specifier);
    } else if (specifier === 'next' || specifier.startsWith('next/')) {
      record('runtime-neutral-next', specifier);
    } else if (specifier === '@capacitor/core' || specifier.startsWith('@capacitor/')) {
      record('runtime-neutral-capacitor', specifier);
    } else if (NODE_MODULES.has(specifier) || specifier.startsWith('node:')) {
      record('runtime-neutral-node-module', specifier);
    } else if (/\.(?:css|scss|sass|less)$/.test(specifier)) {
      record('runtime-neutral-browser-api', specifier);
    }

    if (specifier.startsWith('@/')) record('runtime-neutral-app-source', specifier);
    if (specifier.startsWith('.')) {
      const candidate = resolve(dirname(file), specifier);
      if (!pathInside(owner.root, candidate)) {
        record('runtime-neutral-package-outside-relative', specifier);
        continue;
      }
      const target = packageForPath(packages, candidate);
      if (target && target.dir !== owner.dir) record('runtime-neutral-app-source', specifier);
      continue;
    }
    const target = packages.find((item) => specifier === item.name || specifier.startsWith(`${item.name}/`));
    if (target) {
      const exportKey = workspaceExportKey(target, specifier);
      if (target.dir === owner.dir) {
        if (!exportKey) record('runtime-neutral-unexported-dependency', specifier);
        else if (target.cuberoot?.runtime?.[exportKey] !== 'runtime-neutral') {
          record('runtime-neutral-non-neutral-dependency', `${specifier} (${target.cuberoot?.runtime?.[exportKey] ?? 'unclassified'})`);
        }
        continue;
      }
      if (target.cuberoot?.kind !== 'library') {
        record('runtime-neutral-app-source', specifier);
        continue;
      }
      if (!exportKey) record('runtime-neutral-unexported-dependency', specifier);
      else if (target.cuberoot?.runtime?.[exportKey] !== 'runtime-neutral') {
        record('runtime-neutral-non-neutral-dependency', `${specifier} (${target.cuberoot?.runtime?.[exportKey] ?? 'unclassified'})`);
      }
      continue;
    }
    const external = packageSpecifierRoot(specifier);
    if (external && !NODE_MODULES.has(specifier) && !specifier.startsWith('node:')) {
      const runtimeClass = owner.cuberoot?.externalRuntime?.[external];
      if (runtimeClass !== 'runtime-neutral') {
        record('runtime-neutral-non-neutral-dependency', `${specifier} (${runtimeClass ?? 'unclassified'})`);
      }
    }
  }
  if (hasJsx) record('runtime-neutral-react-dom', '<jsx>');

  const recordGlobalUse = (name) => {
    if (DOM_GLOBALS.has(name)) record('runtime-neutral-browser-api', name);
    else if (WECHAT_GLOBALS.has(name)) record('runtime-neutral-wechat-api', name);
    else if (NODE_GLOBALS.has(name)) record('runtime-neutral-node-module', name);
    else if (OTHER_HOST_GLOBALS.has(name)) record('runtime-neutral-host-api', name);
  };
  const globalObject = (node, seen = new Set()) => {
    const expression = unwrapExpression(node);
    if (!ts.isIdentifier(expression)) return false;
    if (!locallyBound(expression)) {
      return ['globalThis', 'self', 'window', 'global'].includes(expression.text);
    }
    const symbol = checker.getSymbolAtLocation(expression);
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    return symbol.declarations?.some((declaration) => (
      ts.isVariableDeclaration(declaration)
      && ts.isIdentifier(declaration.name)
      && declaration.initializer
      && globalObject(declaration.initializer, nextSeen)
    )) ?? false;
  };
  const findGlobals = (node) => {
    if (ts.isVariableDeclaration(node)
        && ts.isObjectBindingPattern(node.name)
        && node.initializer
        && globalObject(node.initializer)) {
      for (const element of node.name.elements) {
        const property = element.propertyName ?? element.name;
        if (ts.isIdentifier(property) || ts.isStringLiteral(property)) recordGlobalUse(property.text);
      }
    } else if (ts.isIdentifier(node) && isReferenceIdentifier(node) && unbound(node)) {
      recordGlobalUse(node.text);
    } else if (ts.isPropertyAccessExpression(node)
        && globalObject(node.expression)) {
      recordGlobalUse(node.name.text);
    } else if (ts.isElementAccessExpression(node)
        && globalObject(node.expression)) {
      recordGlobalUse(literalText(node.argumentExpression));
    }
    ts.forEachChild(node, findGlobals);
  };
  findGlobals(ast);
  return { specifiers: [...specifiers].map(([specifier, runtime]) => ({ specifier, runtime })), violations };
}

export function runtimeNeutralSourceViolations(source, {
  file = join(CORE_ROOT, 'packages/shared/src/__runtime_probe__.ts'),
  ownerDir = 'shared',
  packages = activePackages(),
} = {}) {
  const owner = packages.find((pkg) => pkg.dir === ownerDir);
  if (!owner) throw new Error(`unknown workspace package: ${ownerDir}`);
  return directRuntimeNeutralScan(packages, owner, file, source).violations;
}

function validExternalPackageTarget(target) {
  if (!packageSpecifierRoot(target) || target.includes('\\')) return false;
  return target.split('/').every((segment) => segment && segment !== '.' && segment !== '..' && segment !== 'node_modules');
}

function runtimeExportTargets(value) {
  return resolvePackageTarget(value).targets;
}

function validPackageImportKey(key) {
  if (typeof key !== 'string' || !key.startsWith('#') || key === '#' || key.startsWith('#/')) return false;
  if (key.indexOf('*') !== key.lastIndexOf('*')) return false;
  return key.split('/').every((segment) => segment && segment !== '.' && segment !== '..' && segment !== 'node_modules');
}

function runtimePackageImportTargets(pkg, requested) {
  const imports = pkg.json.imports;
  if (!imports || typeof imports !== 'object' || Array.isArray(imports) || !validPackageImportKey(requested)) return [];
  const entries = Object.entries(imports);
  if (entries.some(([key]) => !validPackageImportKey(key))) return [];
  const exact = entries.find(([key]) => key === requested);
  if (exact) return resolvePackageTarget(exact[1], { allowExternal: true }).targets;
  const matches = entries
    .map(([key, value]) => ({ key, value, replacement: wildcardReplacement(key, requested) }))
    .filter((entry) => entry.replacement !== null)
    .sort((a, b) => {
      const aPrefix = a.key.indexOf('*');
      const bPrefix = b.key.indexOf('*');
      return bPrefix - aPrefix || b.key.length - a.key.length || a.key.localeCompare(b.key);
  });
  if (matches.length === 0) return [];
  return resolvePackageTarget(matches[0].value, {
    allowExternal: true,
    replacement: matches[0].replacement,
  }).targets;
}

function exportEntryValue(pkg, exportKey) {
  return new Map(exportEntries(pkg.exports) ?? []).get(exportKey);
}

function resolveSourceCandidate(absolute) {
  const candidates = [absolute];
  const extension = extname(absolute);
  if (extension) {
    const stem = absolute.slice(0, -extension.length);
    for (const suffix of SOURCE_EXTENSIONS) candidates.push(`${stem}${suffix}`);
  } else {
    for (const suffix of SOURCE_EXTENSIONS) candidates.push(`${absolute}${suffix}`);
    for (const suffix of SOURCE_EXTENSIONS) candidates.push(join(absolute, `index${suffix}`));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate) && SOURCE_EXTENSIONS.has(extname(candidate))) return candidate;
  }
  return null;
}

function runtimeExportFiles(pkg, exportKey) {
  if (exportKey.includes('*')) {
    const sourceRoot = join(pkg.root, 'src');
    return existsSync(sourceRoot) ? filesUnder(sourceRoot) : [];
  }
  const files = [];
  for (const target of runtimeExportTargets(exportEntryValue(pkg, exportKey))) {
    if (target.includes('*')) continue;
    let candidate = resolve(pkg.root, target);
    if (slash(candidate).includes('/dist/')) candidate = resolve(pkg.root, target.replace(/^\.\/dist\//, './src/'));
    const source = resolveSourceCandidate(candidate);
    if (source) files.push(source);
  }
  return [...new Set(files)];
}

function resolveRelativeSource(file, specifier) {
  return resolveSourceCandidate(resolve(dirname(file), specifier));
}

export function validateRuntimeNeutralExports(packages = activePackages()) {
  const violations = [];
  const visitedFiles = new Set();
  const visitedEntries = new Set();
  const record = (pkg, exportKey, finding) => violations.push({
    package: pkg.name,
    export: exportKey,
    ...finding,
  });

  const visitFile = (pkg, exportKey, file) => {
    const fileKey = `${pkg.dir}:${exportKey}:${resolve(file).toLowerCase()}`;
    if (visitedFiles.has(fileKey)) return;
    visitedFiles.add(fileKey);
    const source = readFileSync(file, 'utf8');
    const scan = directRuntimeNeutralScan(packages, pkg, file, source);
    for (const finding of scan.violations) record(pkg, exportKey, finding);
    for (const { specifier, runtime } of scan.specifiers) {
      if (!runtime) continue;
      if (specifier.startsWith('#')) {
        for (const target of runtimePackageImportTargets(pkg, specifier)) {
          if (!target.startsWith('./')) continue;
          let candidate = resolve(pkg.root, target);
          if (slash(candidate).includes('/dist/')) candidate = resolve(pkg.root, target.replace(/^\.\/dist\//, './src/'));
          const source = resolveSourceCandidate(candidate);
          if (source) visitFile(pkg, exportKey, source);
        }
        continue;
      }
      if (specifier.startsWith('.')) {
        const target = resolveRelativeSource(file, specifier);
        if (target && packageForPath(packages, target)?.dir === pkg.dir) visitFile(pkg, exportKey, target);
        continue;
      }
      const targetPackage = packages.find((item) => specifier === item.name || specifier.startsWith(`${item.name}/`));
      if (!targetPackage || targetPackage.cuberoot?.kind !== 'library') continue;
      const targetExport = workspaceExportKey(targetPackage, specifier);
      if (targetExport && targetPackage.cuberoot?.runtime?.[targetExport] === 'runtime-neutral') {
        visitEntry(targetPackage, targetExport);
      }
    }
  };

  const visitEntry = (pkg, exportKey) => {
    const entryKey = `${pkg.dir}:${exportKey}`;
    if (visitedEntries.has(entryKey)) return;
    visitedEntries.add(entryKey);
    const files = runtimeExportFiles(pkg, exportKey);
    if (files.length === 0) {
      record(pkg, exportKey, {
        file: repoRelative(pkg.root),
        rule: 'runtime-neutral-entry-missing',
        detail: runtimeExportTargets(exportEntryValue(pkg, exportKey)).join(', ') || '<missing>',
      });
      return;
    }
    for (const file of files) visitFile(pkg, exportKey, file);
  };

  for (const pkg of packages) {
    if (pkg.cuberoot?.kind !== 'library') continue;
    for (const [exportKey, runtimeClass] of Object.entries(pkg.cuberoot.runtime ?? {})) {
      if (runtimeClass === 'runtime-neutral') visitEntry(pkg, exportKey);
    }
  }
  const deduplicated = new Map();
  for (const violation of violations) {
    const key = JSON.stringify(stable(violation));
    if (!deduplicated.has(key)) deduplicated.set(key, violation);
  }
  return [...deduplicated.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function scanSourceText(packages, owner, file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, (
    file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  ));
  const findings = [];
  const childProcessNames = new Set();
  const childProcessNamespaces = new Set();
  const moduleNodes = new Set();
  const joinedPathNodes = new Set();

  const recordModule = (node, specifier, kind, mechanism) => {
    moduleNodes.add(node);
    const finding = moduleFinding(packages, owner, file, specifier, kind, mechanism);
    if (finding) findings.push(finding);
  };

  const firstPass = (node) => {
    if (ts.isImportDeclaration(node) && literalText(node.moduleSpecifier) !== null) {
      const specifier = literalText(node.moduleSpecifier);
      recordModule(node.moduleSpecifier, specifier, importKind(node), 'static-import');
      if (specifier === 'node:child_process' || specifier === 'child_process') {
        if (node.importClause?.name) childProcessNamespaces.add(node.importClause.name.text);
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            if (SUBPROCESS_APIS.has(element.propertyName?.text ?? element.name.text)) childProcessNames.add(element.name.text);
          }
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          childProcessNamespaces.add(bindings.name.text);
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)
        && ts.isExternalModuleReference(node.moduleReference)
        && literalText(node.moduleReference.expression) !== null) {
      const specifier = literalText(node.moduleReference.expression);
      recordModule(
        node.moduleReference.expression,
        specifier,
        node.isTypeOnly ? 'type-only' : 'runtime',
        'import-equals',
      );
      if (specifier === 'node:child_process' || specifier === 'child_process') {
        childProcessNamespaces.add(node.name.text);
      }
    } else if (ts.isExportDeclaration(node) && literalText(node.moduleSpecifier) !== null) {
      recordModule(node.moduleSpecifier, literalText(node.moduleSpecifier), exportKind(node), 'static-export');
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
        && literalText(node.argument.literal) !== null) {
      recordModule(node.argument.literal, literalText(node.argument.literal), 'type-only', 'import-type');
    } else if (ts.isCallExpression(node)) {
      const specifier = literalText(node.arguments[0]);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && specifier !== null) {
        recordModule(node.arguments[0], specifier, 'runtime', 'dynamic-import');
      } else if (calleeName(node.expression) === 'require' && specifier !== null) {
        recordModule(node.arguments[0], specifier, 'runtime', 'require');
      } else if (specifier !== null && ['vi.mock', 'vi.doMock', 'vi.importActual', 'import.meta.glob'].includes(node.expression.getText(ast))) {
        recordModule(node.arguments[0], specifier, 'runtime', node.expression.getText(ast));
      }
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = ts.isAwaitExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isCallExpression(initializer)) {
        const specifier = literalText(initializer.arguments[0]);
        const isChildProcess = ['node:child_process', 'child_process'].includes(specifier);
        const isLoader = initializer.expression.kind === ts.SyntaxKind.ImportKeyword
          || calleeName(initializer.expression) === 'require';
        if (isChildProcess && isLoader) {
          if (ts.isIdentifier(node.name)) childProcessNamespaces.add(node.name.text);
          if (ts.isObjectBindingPattern(node.name)) {
            for (const element of node.name.elements) {
              const imported = element.propertyName?.getText(ast) ?? element.name.getText(ast);
              if (SUBPROCESS_APIS.has(imported) && ts.isIdentifier(element.name)) {
                childProcessNames.add(element.name.text);
              }
            }
          }
        }
        if (ts.isIdentifier(node.name)
            && calleeName(initializer.expression) === 'promisify'
            && ts.isIdentifier(initializer.arguments[0])
            && childProcessNames.has(initializer.arguments[0].text)) {
          childProcessNames.add(node.name.text);
        }
      } else if (ts.isIdentifier(node.name)
          && ts.isIdentifier(initializer)
          && childProcessNames.has(initializer.text)) {
        childProcessNames.add(node.name.text);
      }
    }
    ts.forEachChild(node, firstPass);
  };
  firstPass(ast);

  const secondPass = (node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      const namespaceCall = ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && childProcessNamespaces.has(node.expression.expression.text)
        && SUBPROCESS_APIS.has(node.expression.name.text);
      if (childProcessNames.has(name) || namespaceCall) {
        findings.push({
          file: repoRelative(file),
          mechanism: namespaceCall ? node.expression.name.text : name,
          rule: 'subprocess-call',
          sourceKind: 'subprocess',
          target: literalText(node.arguments[0]) ?? '<dynamic>',
        });
      }
      if ((name === 'join' || name === 'resolve')
          && node.arguments.length > 0
          && node.arguments.every((argument) => literalText(argument) !== null)) {
        const parts = node.arguments.map((argument) => literalText(argument));
        const specifier = parts.join('/');
        const target = targetPackageFromPathLiteral(packages, owner, file, specifier);
        if (target) {
          for (const argument of node.arguments) joinedPathNodes.add(argument);
          findings.push({
            file: repoRelative(file),
            mechanism: `path-${name}`,
            rule: 'cross-package-path',
            sourceKind: sourceKind(owner, file),
            specifier,
            target: target.dir,
          });
        }
      }
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        && !moduleNodes.has(node)
        && !joinedPathNodes.has(node)) {
      const target = targetPackageFromPathLiteral(packages, owner, file, node.text);
      if (target) {
        const kind = sourceKind(owner, file);
        let parent = node.parent;
        let mechanism = 'path-literal';
        for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parent) {
          if (!ts.isCallExpression(parent)) continue;
          const name = calleeName(parent.expression);
          if (/^(?:read|write|copy|rename|open|access|stat|readdir|mkdir|rm|unlink)/.test(name)) mechanism = name;
          else if (parent.expression.kind === ts.SyntaxKind.ImportKeyword) mechanism = 'dynamic-import-path';
          else if (name === 'pathToFileURL') mechanism = 'dynamic-import-path';
          break;
        }
        // Runtime UI files often show repository paths as documentation. They are not
        // dependency edges. Runtime server paths remain relevant because they can pull
        // Web assets into the deployed API; build/test sources retain all path findings.
        if (mechanism === 'path-literal' && kind === 'runtime' && owner.dir !== 'server') {
          ts.forEachChild(node, secondPass);
          return;
        }
        findings.push({
          file: repoRelative(file),
          mechanism,
          rule: 'cross-package-path',
          sourceKind: /^(?:write|copy|rename)/.test(mechanism) ? 'artifact' : kind,
          specifier: node.text,
          target: target.dir,
        });
      }
    }
    ts.forEachChild(node, secondPass);
  };
  secondPass(ast);
  return findings;
}

function scanSourceFile(packages, owner, file) {
  return scanSourceText(packages, owner, file, readFileSync(file, 'utf8'));
}

function scanTsconfigAliases(packages, owner) {
  const tsconfig = join(owner.root, 'tsconfig.json');
  if (!existsSync(tsconfig)) return [];
  const parsed = ts.parseConfigFileTextToJson(tsconfig, readFileSync(tsconfig, 'utf8'));
  const paths = parsed.config?.compilerOptions?.paths ?? {};
  const findings = [];
  for (const [alias, targets] of Object.entries(paths)) {
    for (const targetText of targets) {
      const target = packageForPath(packages, resolve(owner.root, targetText.replace(/\*.*$/, '')));
      if (!target || target.dir === owner.dir) continue;
      findings.push({
        file: repoRelative(tsconfig),
        mechanism: 'tsconfig-path',
        rule: 'cross-package-alias-definition',
        sourceKind: 'runtime',
        specifier: `${alias}=${targetText}`,
        target: target.dir,
      });
    }
  }
  return findings;
}

export function collectFindings(packages = activePackages()) {
  const findings = [];
  for (const owner of packages) {
    findings.push(...scanTsconfigAliases(packages, owner));
    for (const file of filesUnder(owner.root)) findings.push(...scanSourceFile(packages, owner, file));
  }
  const grouped = new Map();
  for (const finding of findings) {
    const key = findingIdentity(finding);
    const previous = grouped.get(key);
    if (!previous) grouped.set(key, { ...finding, occurrences: 1 });
    else previous.occurrences += 1;
  }
  return [...grouped.values()]
    .map((finding) => {
      if (finding.occurrences > 1) return finding;
      const { occurrences: _occurrences, ...single } = finding;
      return single;
    })
    .sort((a, b) => findingIdentity(a).localeCompare(findingIdentity(b)));
}

export function compareFindings(current, baseline) {
  const packages = activePackages();
  const comparableIdentity = (finding) => {
    if (!finding.file) return findingIdentity(finding);
    const normalized = slash(finding.file);
    const owner = packages.find((pkg) => normalized === pkg.workspacePath || normalized.startsWith(`${pkg.workspacePath}/`));
    if (!owner) return findingIdentity(finding);
    const suffix = normalized.slice(owner.workspacePath.length);
    return findingIdentity({ ...finding, file: `packages/${owner.dir}${suffix}` });
  };
  const currentKeys = new Map(current.map((finding) => [comparableIdentity(finding), finding]));
  const baselineKeys = new Map(baseline.map((finding) => [comparableIdentity(finding), finding]));
  return {
    additions: [...currentKeys.entries()]
      .filter(([key, finding]) => !baselineKeys.has(key)
        || occurrenceCount(finding) > occurrenceCount(baselineKeys.get(key)))
      .map(([, finding]) => finding),
    stale: [...baselineKeys.entries()]
      .filter(([key, finding]) => !currentKeys.has(key)
        || occurrenceCount(finding) > occurrenceCount(currentKeys.get(key)))
      .map(([, finding]) => finding),
  };
}

export function validateManifestSchema(manifest) {
  const schema = readJson(join(CORE_ROOT, 'architecture-boundaries.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (validate(manifest)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`);
}

export function validateManualContracts(contracts) {
  const errors = [];
  const ids = new Set();
  for (const contract of contracts) {
    if (ids.has(contract.id)) errors.push(`duplicate manual contract id: ${contract.id}`);
    ids.add(contract.id);
    for (const field of ['id', 'from', 'to', 'phase', 'mechanism', 'owner', 'rationale', 'replacement']) {
      if (!contract[field]) errors.push(`${contract.id ?? '<missing-id>'}: missing ${field}`);
    }
    if (!Array.isArray(contract.evidence) || contract.evidence.length === 0) {
      errors.push(`${contract.id ?? '<missing-id>'}: missing evidence`);
      continue;
    }
    for (const evidence of contract.evidence) {
      const path = resolve(REPO_ROOT, evidence.file ?? '');
      if (!existsSync(path)) {
        errors.push(`${contract.id}: evidence file missing: ${evidence.file}`);
        continue;
      }
      if (evidence.contains && !readFileSync(path, 'utf8').includes(evidence.contains)) {
        errors.push(`${contract.id}: evidence marker missing in ${evidence.file}: ${evidence.contains}`);
      }
    }
  }
  return errors;
}

export function violationsFromHookPayload(payload, packages = activePackages()) {
  const input = payload?.tool_input;
  if (!input || typeof input !== 'object') return [];
  const writes = Array.isArray(input.writes) ? input.writes : [input];
  const violations = [];
  for (const write of writes) {
    if (!write || typeof write !== 'object') continue;
    const filePath = slash(write.file_path ?? '');
    const source = String(write.content ?? '');
    const absoluteFile = resolve(REPO_ROOT, filePath);
    if (!SOURCE_EXTENSIONS.has(extname(absoluteFile))) continue;
    const owner = packageForPath(packages, absoluteFile);
    if (!owner) continue;
    violations.push(...scanSourceText(packages, owner, absoluteFile, source));
  }
  return violations;
}

function printFindings(title, findings) {
  if (!findings.length) return;
  process.stderr.write(`${title} (${findings.length}):\n`);
  for (const finding of findings) process.stderr.write(`  ${findingKey(finding)}\n`);
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

async function runHook() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try { payload = JSON.parse(raw || '{}'); } catch { return; }
  const violations = violationsFromHookPayload(payload);
  if (!violations.length) return;
  const rules = [...new Set(violations.map((item) => item.rule))].join(', ');
  deny(`检测到新的架构边界违规: ${rules}。源码依赖必须改用公开 package subpath；只有无法由语法表达的例外契约才可经 reviewer 登记。`);
}

function run() {
  const packages = activePackages();
  const packageMetadataErrors = validatePackageMetadata(packages);
  for (const error of packageMetadataErrors) process.stderr.write(`Package metadata error: ${error}\n`);
  if (packageMetadataErrors.length) {
    process.exitCode = 1;
    return;
  }
  const runtimeNeutralViolations = validateRuntimeNeutralExports(packages);
  printFindings('Runtime-neutral export violations', runtimeNeutralViolations);
  if (runtimeNeutralViolations.length) {
    process.exitCode = 1;
    return;
  }
  const manifest = readJson(MANIFEST_PATH);
  const schemaErrors = validateManifestSchema(manifest);
  for (const error of schemaErrors) process.stderr.write(`Architecture manifest schema error: ${error}\n`);
  if (schemaErrors.length) {
    process.exitCode = 1;
    return;
  }
  const current = collectFindings(packages);
  if (process.argv.includes('--snapshot')) {
    process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
    return;
  }
  const comparison = compareFindings(current, manifest.legacyFindings ?? []);
  const contractErrors = validateManualContracts(manifest.manualContracts ?? []);
  printFindings('Unregistered architecture edges', comparison.additions);
  if (comparison.stale.length) {
    process.stdout.write(`Architecture debt reduced: ${comparison.stale.length} baseline entries can be removed or have occurrences lowered to match the current scan.\n`);
  }
  for (const error of contractErrors) process.stderr.write(`Manual contract error: ${error}\n`);
  if (comparison.additions.length || contractErrors.length) process.exitCode = 1;
  else {
    const occurrences = current.reduce((sum, finding) => sum + occurrenceCount(finding), 0);
    process.stdout.write(`Architecture boundary guard passed: ${current.length} exact legacy identities (${occurrences} occurrences), ${manifest.manualContracts.length} manual contracts.\n`);
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  if (process.argv.includes('--hook')) await runHook();
  else run();
}
