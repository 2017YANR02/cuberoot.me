#!/usr/bin/env node
// Exact dependency ratchet for active CubeRoot workspaces.
//
// The committed baseline is debt, not permission: deleting a legacy edge is allowed,
// while adding a different edge fails. Manual contracts cover runtime/artifact/deploy
// relationships that cannot be recovered reliably from module syntax alone.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CORE_ROOT = resolve(HERE, '..');
export const REPO_ROOT = resolve(CORE_ROOT, '..');
export const MANIFEST_PATH = join(CORE_ROOT, 'architecture-boundaries.json');
const requireFromClient = createRequire(join(CORE_ROOT, 'packages/client/package.json'));
const ts = requireFromClient('typescript');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', 'out', 'target', 'coverage', '.turbo',
  '.tmp', 'android', 'ios', 'public', 'pkg', 'pkg-web', 'pkg-node',
]);
const BUILD_PACKAGES = new Set(['alg-build', 'scramble-stats-build', 'stats-build', 'wb-build']);
const APP_JOB_PACKAGES = new Set([
  'alg-build', 'client', 'miniprogram', 'mobile', 'scramble-stats-build', 'server', 'stats-build', 'wb-build',
]);
const SUBPROCESS_APIS = new Set(['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);

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

function activePackages() {
  const workspaceSource = readFileSync(join(CORE_ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const workspacePatterns = [...workspaceSource.matchAll(/^\s*-\s*['"]([^'"]+)['"]\s*$/gm)]
    .map((match) => match[1]);
  if (!workspacePatterns.includes('packages/*')) {
    throw new Error('architecture scanner requires pnpm-workspace.yaml to include packages/*');
  }
  const excluded = new Set(workspacePatterns
    .filter((pattern) => pattern.startsWith('!packages/'))
    .map((pattern) => pattern.slice('!packages/'.length)));
  const packagesRoot = join(CORE_ROOT, 'packages');
  const result = [];
  for (const dirent of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory() || excluded.has(dirent.name)) continue;
    const root = join(packagesRoot, dirent.name);
    const packageJson = join(root, 'package.json');
    if (!existsSync(packageJson)) continue;
    const json = readJson(packageJson);
    result.push({
      dir: dirent.name,
      name: json.name ?? dirent.name,
      root,
      exports: json.exports ?? null,
    });
  }
  return result.sort((a, b) => a.dir.localeCompare(b.dir));
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
  if (BUILD_PACKAGES.has(owner.dir) || /\/scripts?\/|\/(?:build|gen|generate|sync|update)[^/]*\.[cm]?[jt]s$/.test(normalized)) return 'build';
  return 'runtime';
}

function packageForPath(packages, absolute) {
  const normalized = `${resolve(absolute)}${sep}`.toLowerCase();
  return packages.find((item) => normalized.startsWith(`${resolve(item.root)}${sep}`.toLowerCase())) ?? null;
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

function exportedSubpath(pkg, subpath) {
  if (!pkg.exports || typeof pkg.exports !== 'object') return false;
  const requested = `./${subpath}`;
  if (Object.hasOwn(pkg.exports, requested)) return true;
  return Object.keys(pkg.exports).some((key) => key.includes('*') && (
    requested.startsWith(key.slice(0, key.indexOf('*')))
    && requested.endsWith(key.slice(key.indexOf('*') + 1))
  ));
}

function exportUsesWildcard(pkg, subpath) {
  if (!pkg.exports || typeof pkg.exports !== 'object') return false;
  const requested = `./${subpath}`;
  return Object.keys(pkg.exports).some((key) => key.includes('*') && (
    requested.startsWith(key.slice(0, key.indexOf('*')))
    && requested.endsWith(key.slice(key.indexOf('*') + 1))
  ));
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
  const explicit = normalized.match(/(?:^|\/)packages\/([a-z0-9-]+)(?:\/|$)/i)?.[1];
  if (explicit) {
    if (explicit === owner.dir) return null;
    return packages.find((item) => item.dir === explicit) ?? null;
  }
  if (!/^(?:\.\.?\/|\/?(?:core\/)?packages\/)/.test(normalized)) return null;
  const candidate = resolve(dirname(file), text);
  const resolved = packageForPath(packages, candidate);
  if (resolved && resolved.dir !== owner.dir) return resolved;
  const segment = normalized.match(/(?:^|\/)(client|server|mobile|miniprogram|shared|visualcube|stack-kernel|vendor-sr-puzzlegen|alg-build|scramble-stats-build|stats-build|wb-build)(?:\/|$)/)?.[1];
  if (!segment || segment === owner.dir) return null;
  return packages.find((item) => item.dir === segment) ?? null;
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
  if (!subpath) {
    if (target.dir !== owner.dir && APP_JOB_PACKAGES.has(target.dir)) {
      return { ...common, rule: 'workspace-app-root-import', target: target.dir };
    }
    return null;
  }
  if (!exportedSubpath(target, subpath)) {
    return { ...common, rule: 'workspace-unexported-import', target: target.dir };
  }
  if (exportUsesWildcard(target, subpath)) {
    return { ...common, rule: 'workspace-wildcard-import', target: target.dir };
  }
  return null;
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
      recordModule(node.moduleSpecifier, literalText(node.moduleSpecifier), 'runtime', 'static-export');
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

export function collectFindings() {
  const packages = activePackages();
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
  const currentKeys = new Map(current.map((finding) => [findingIdentity(finding), finding]));
  const baselineKeys = new Map(baseline.map((finding) => [findingIdentity(finding), finding]));
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

export function violationsFromHookPayload(payload) {
  const input = payload?.tool_input;
  if (!input || typeof input !== 'object') return [];
  const filePath = slash(input.file_path ?? '');
  const source = String(input.content ?? '');
  if (!/\/core\/packages\/(?!platform\/)[a-z0-9-]+\//i.test(`/${filePath}`)) return [];
  const ownerDir = filePath.match(/\/core\/packages\/([a-z0-9-]+)\//i)?.[1]
    ?? filePath.match(/^core\/packages\/([a-z0-9-]+)\//i)?.[1];
  if (!ownerDir || ownerDir === 'platform') return [];
  const packages = activePackages();
  const owner = packages.find((item) => item.dir === ownerDir);
  if (!owner) return [];
  const absoluteFile = resolve(REPO_ROOT, filePath);
  return scanSourceText(packages, owner, absoluteFile, source);
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
  const manifest = readJson(MANIFEST_PATH);
  const schemaErrors = validateManifestSchema(manifest);
  for (const error of schemaErrors) process.stderr.write(`Architecture manifest schema error: ${error}\n`);
  if (schemaErrors.length) {
    process.exitCode = 1;
    return;
  }
  const current = collectFindings();
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
