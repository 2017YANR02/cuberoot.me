import { existsSync, readFileSync } from 'node:fs';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STRUCTURED_HEADER = '# Generated from docs/generated-artifacts.json. Do not edit.';
const VERSIONED_KINDS = new Set(['vendored-sync', 'upstream-fork-deploy']);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = resolve(repoRoot, 'docs/generated-artifacts.json');

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function normalizePattern(pattern) {
  return pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

function hasWildcard(pattern) {
  return pattern.includes('*');
}

function segmentPatternsIntersect(left, right) {
  const memo = new Map();

  function visit(leftIndex, rightIndex) {
    const key = `${leftIndex}:${rightIndex}`;
    if (memo.has(key)) return memo.get(key);

    let result;
    if (leftIndex === left.length && rightIndex === right.length) {
      result = true;
    } else if (leftIndex === left.length) {
      result = [...right.slice(rightIndex)].every((character) => character === '*');
    } else if (rightIndex === right.length) {
      result = [...left.slice(leftIndex)].every((character) => character === '*');
    } else if (left[leftIndex] === '*') {
      result = visit(leftIndex + 1, rightIndex) || visit(leftIndex, rightIndex + 1);
    } else if (right[rightIndex] === '*') {
      result = visit(leftIndex, rightIndex + 1) || visit(leftIndex + 1, rightIndex);
    } else {
      result = left[leftIndex] === right[rightIndex] && visit(leftIndex + 1, rightIndex + 1);
    }

    memo.set(key, result);
    return result;
  }

  return visit(0, 0);
}

export function pathPatternsIntersect(leftPattern, rightPattern) {
  const left = normalizePattern(leftPattern).split('/');
  const right = normalizePattern(rightPattern).split('/');
  const memo = new Map();

  function visit(leftIndex, rightIndex) {
    const key = `${leftIndex}:${rightIndex}`;
    if (memo.has(key)) return memo.get(key);

    let result;
    if (leftIndex === left.length && rightIndex === right.length) {
      result = true;
    } else if (leftIndex === left.length) {
      result = right.slice(rightIndex).every((segment) => segment === '**');
    } else if (rightIndex === right.length) {
      result = left.slice(leftIndex).every((segment) => segment === '**');
    } else if (left[leftIndex] === '**') {
      result = visit(leftIndex + 1, rightIndex) || visit(leftIndex, rightIndex + 1);
    } else if (right[rightIndex] === '**') {
      result = visit(leftIndex, rightIndex + 1) || visit(leftIndex + 1, rightIndex);
    } else {
      result = segmentPatternsIntersect(left[leftIndex], right[rightIndex])
        && visit(leftIndex + 1, rightIndex + 1);
    }

    memo.set(key, result);
    return result;
  }

  return visit(0, 0);
}

function pathBase(pattern) {
  const segments = normalizePattern(pattern).split('/');
  const wildcardIndex = segments.findIndex((segment) => hasWildcard(segment));
  if (wildcardIndex === -1) return segments.join('/') || '.';
  return segments.slice(0, wildcardIndex).join('/') || '.';
}

function isInside(root, candidate) {
  const relation = relative(root, candidate);
  return relation === '' || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith(`..${sep}`));
}

function assertLocalPath(path, context, root, fail, { mayBeAbsent = false } = {}) {
  if (typeof path !== 'string' || path.length === 0) {
    fail(`${context}: expected a non-empty repository-relative path`);
    return false;
  }
  if (path.includes('\\')) {
    fail(`${context}: repository paths must use forward slashes (${path})`);
    return false;
  }
  const normalized = normalizePattern(path);
  if (isAbsolute(normalized) || win32.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    fail(`${context}: path must stay inside the repository (${path})`);
    return false;
  }
  const resolvedBase = resolve(root, pathBase(normalized));
  if (!isInside(root, resolvedBase)) {
    fail(`${context}: resolved path escapes the repository (${path})`);
    return false;
  }
  if (!mayBeAbsent && !existsSync(resolvedBase)) {
    fail(`${context}: path does not exist (${path})`);
    return false;
  }
  return true;
}

function assertRuntimeLocator(locator, context, fail) {
  if (typeof locator !== 'string' || locator.length === 0) {
    fail(`${context}: expected a non-empty runtime locator`);
    return;
  }
  if (locator.includes('\\') || isAbsolute(locator) || win32.isAbsolute(locator)
      || normalizePattern(locator).split('/').includes('..')) {
    fail(`${context}: runtime locator must be clone-neutral and non-escaping (${locator})`);
  }
}

function equalStringArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function parseStructuredVersionRecord(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== STRUCTURED_HEADER) {
    throw new Error('missing structured-v1 generated header');
  }

  const fields = {};
  const sections = { 'Patch owners': [], Outputs: [] };
  let section = null;
  for (const line of lines.slice(1)) {
    if (line === 'Patch owners:' || line === 'Outputs:') {
      section = line.slice(0, -1);
      continue;
    }
    if (section && line.startsWith('- ')) {
      sections[section].push(line.slice(2));
      continue;
    }
    if (line === '') continue;
    section = null;
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`unrecognized structured-v1 line: ${line}`);
    fields[match[1]] = match[2];
  }

  return {
    artifact: fields.Artifact,
    source: fields.Source,
    ref: fields.Ref,
    commit: fields.Commit,
    date: fields.Date,
    license: fields.License,
    patchOwners: sections['Patch owners'],
    outputs: sections.Outputs,
  };
}

function validateStructuredVersionRecord(artifact, recordText, fail) {
  let record;
  try {
    record = parseStructuredVersionRecord(recordText);
  } catch (error) {
    fail(`${artifact.id}.versionRecord: ${error.message}`);
    return false;
  }

  let valid = true;
  const expect = (condition, message) => {
    if (!condition) {
      valid = false;
      fail(`${artifact.id}.versionRecord: ${message}`);
    }
  };
  expect(record.artifact === artifact.id, `Artifact mismatch (${record.artifact ?? 'missing'})`);
  expect(record.source === artifact.source.url, `Source mismatch (${record.source ?? 'missing'})`);
  expect(record.ref === `${artifact.source.ref.type} ${artifact.source.ref.value}`, `Ref mismatch (${record.ref ?? 'missing'})`);
  expect(/^[0-9a-fA-F]{40}$/.test(record.commit ?? ''), 'Commit must be a full 40-character SHA');
  expect(!Number.isNaN(Date.parse(record.date ?? '')), `Date is invalid (${record.date ?? 'missing'})`);
  expect(record.license === artifact.license.spdx, `License mismatch (${record.license ?? 'missing'})`);
  expect(equalStringArrays(record.patchOwners, asArray(artifact.patchOwner)), 'Patch owners do not match the ledger');
  expect(equalStringArrays(record.outputs, asArray(artifact.outputs)), 'Outputs do not match the ledger');
  return valid;
}

function validateVersionRecord(artifact, root, fail, warn) {
  const record = artifact.versionRecord;
  if (!record?.path || !record.writer || !record.mechanism || !record.format || !record.state) {
    fail(`${artifact.id}: incomplete versionRecord`);
    return;
  }
  assertLocalPath(record.writer, `${artifact.id}.versionRecord.writer`, root, fail);
  assertLocalPath(record.path, `${artifact.id}.versionRecord.path`, root, fail, { mayBeAbsent: true });

  const ownedByArtifact = asArray(artifact.outputs)
    .some((output) => pathPatternsIntersect(output, record.path));
  if (!ownedByArtifact) {
    fail(`${artifact.id}: versionRecord.path must be owned by the artifact outputs (${record.path})`);
  }

  const recordPath = resolve(root, normalizePattern(record.path));
  if (record.format === 'sha40') {
    if (record.state !== 'verified') fail(`${artifact.id}: sha40 records must be verified`);
    if (!existsSync(recordPath)) {
      fail(`${artifact.id}: verified version record is missing (${record.path})`);
    } else if (!/^[0-9a-fA-F]{40}$/.test(readFileSync(recordPath, 'utf8').trim())) {
      fail(`${artifact.id}: version record must contain exactly one full 40-character SHA`);
    }
    return;
  }

  if (record.format !== 'structured-v1') {
    fail(`${artifact.id}: unsupported versionRecord format (${record.format})`);
    return;
  }
  if (record.state !== 'verified' && record.state !== 'pending-next-successful-sync') {
    fail(`${artifact.id}: unsupported versionRecord state (${record.state})`);
    return;
  }
  if (record.state === 'pending-next-successful-sync' && !record.pendingReason) {
    fail(`${artifact.id}: pending provenance requires pendingReason`);
  }

  if (!existsSync(recordPath)) {
    if (record.state === 'verified') {
      fail(`${artifact.id}: verified structured version record is missing (${record.path})`);
    } else {
      warn(`${artifact.id}: upstream provenance pending; record will be created by the next successful reviewed sync`);
    }
    return;
  }

  const recordText = readFileSync(recordPath, 'utf8');
  if (recordText.replace(/\r\n/g, '\n').startsWith(`${STRUCTURED_HEADER}\n`)) {
    const valid = validateStructuredVersionRecord(artifact, recordText, fail);
    if (valid && record.state !== 'verified') {
      fail(`${artifact.id}: structured record is complete; ledger state must be changed to verified`);
    }
    return;
  }

  if (record.state === 'verified') {
    fail(`${artifact.id}: verified record is not structured-v1`);
    return;
  }
  const legacyCommit = /^Commit:\s+([0-9a-fA-F]{7,39})\s*$/m.exec(recordText);
  if (!legacyCommit) {
    fail(`${artifact.id}: pending legacy record must contain a 7-39 character abbreviated commit`);
    return;
  }
  warn(`${artifact.id}: upstream provenance pending; legacy ${legacyCommit[1].length}-character commit is not sufficient`);
}

function claimIsExcluded(owner, ownerClaim, otherClaim) {
  if (ownerClaim.category !== 'outputs' || hasWildcard(otherClaim.pattern)) return false;
  const otherPath = normalizePattern(otherClaim.pattern);
  return asArray(owner.outputExclusions).some((excluded) => normalizePattern(excluded) === otherPath);
}

function validatePatternEngine(fail) {
  const probes = [
    ['stats/*.json', 'stats/upcoming_comps.json', true],
    ['records/**', 'records/world/333.json', true],
    ['**/build/**', 'core/packages/mobile/android/app/build/output.apk', true],
    ['solver/pkg-*', 'solver/pkg-web', true],
    ['stats/*.json', 'stats/scramble/distribution.json', false],
    ['tools/cstimer/**', 'tools/cstimer-scramble/**', false],
  ];
  for (const [left, right, expected] of probes) {
    if (pathPatternsIntersect(left, right) !== expected || pathPatternsIntersect(right, left) !== expected) {
      fail(`path intersection invariant failed: ${left} <-> ${right} should be ${expected}`);
    }
  }
}

export function validateLedger(ledger, { root = repoRoot } = {}) {
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);
  validatePatternEngine(fail);

  if (ledger?.schemaVersion !== 1) fail(`unsupported schemaVersion: ${ledger?.schemaVersion}`);
  if (!Array.isArray(ledger?.artifacts)) {
    fail('artifacts must be an array');
    return { errors, warnings, byId: new Map(), pendingCount: 0 };
  }

  const byId = new Map();
  const claims = [];
  for (const artifact of ledger.artifacts) {
    if (!artifact || typeof artifact !== 'object' || typeof artifact.id !== 'string' || artifact.id.length === 0) {
      fail('artifact without a string id');
      continue;
    }
    if (byId.has(artifact.id)) fail(`duplicate artifact id: ${artifact.id}`);
    byId.set(artifact.id, artifact);

    if (!artifact.kind) fail(`${artifact.id}: missing kind`);
    if (!artifact.source || (!artifact.source.url && !artifact.source.locator)) {
      fail(`${artifact.id}: source must have url or locator`);
    }
    if (!artifact.license?.spdx || !artifact.license?.evidence) {
      fail(`${artifact.id}: missing license evidence`);
    }
    assertLocalPath(artifact.workingDirectory, `${artifact.id}.workingDirectory`, root, fail);
    if (!artifact.command || typeof artifact.command !== 'string') fail(`${artifact.id}: missing command`);
    if (asArray(artifact.owner).length === 0) fail(`${artifact.id}: missing owner`);
    for (const owner of asArray(artifact.owner)) assertLocalPath(owner, `${artifact.id}.owner`, root, fail);
    for (const sourceOwner of asArray(artifact.sourcePipeline)) {
      assertLocalPath(sourceOwner, `${artifact.id}.sourcePipeline`, root, fail);
    }
    for (const sourcePath of asArray(artifact.source?.paths)) {
      assertLocalPath(sourcePath, `${artifact.id}.source.paths`, root, fail);
    }

    const outputs = asArray(artifact.outputs);
    const transientOutputs = asArray(artifact.transientOutputs);
    const runtimeOutputs = asArray(artifact.runtimeOutputs);
    if (outputs.length + transientOutputs.length + runtimeOutputs.length === 0) {
      fail(`${artifact.id}: missing outputs, transientOutputs, or runtimeOutputs`);
    }
    for (const output of outputs) {
      const pendingVersionRecord = artifact.versionRecord?.state === 'pending-next-successful-sync'
        && normalizePattern(artifact.versionRecord.path ?? '') === normalizePattern(output);
      if (assertLocalPath(output, `${artifact.id}.outputs`, root, fail, { mayBeAbsent: pendingVersionRecord })) {
        claims.push({ artifact, category: 'outputs', pattern: normalizePattern(output) });
      }
    }
    for (const output of transientOutputs) {
      if (assertLocalPath(output, `${artifact.id}.transientOutputs`, root, fail, { mayBeAbsent: true })) {
        claims.push({ artifact, category: 'transientOutputs', pattern: normalizePattern(output) });
      }
    }
    for (const output of runtimeOutputs) {
      assertRuntimeLocator(output, `${artifact.id}.runtimeOutputs`, fail);
    }

    for (const excluded of asArray(artifact.outputExclusions)) {
      if (!assertLocalPath(excluded, `${artifact.id}.outputExclusions`, root, fail)) continue;
      if (hasWildcard(excluded)) {
        fail(`${artifact.id}.outputExclusions: exclusions must be exact paths (${excluded})`);
        continue;
      }
      if (!outputs.some((output) => pathPatternsIntersect(output, excluded))) {
        fail(`${artifact.id}.outputExclusions: exclusion is outside owned output patterns (${excluded})`);
      }
      if (outputs.some((output) => !hasWildcard(output) && normalizePattern(output) === normalizePattern(excluded))) {
        fail(`${artifact.id}.outputExclusions: exact output cannot exclude itself (${excluded})`);
      }
    }

    if (!Array.isArray(artifact.verification) || artifact.verification.length === 0) {
      fail(`${artifact.id}: missing verification`);
    }
    if (!artifact.driftPolicy || typeof artifact.driftPolicy !== 'string') {
      fail(`${artifact.id}: missing driftPolicy`);
    }

    if (VERSIONED_KINDS.has(artifact.kind)) {
      if (!/^https:\/\//.test(artifact.source?.url ?? '')) {
        fail(`${artifact.id}: versioned source URL must use https`);
      }
      if (!artifact.source?.ref?.type || !artifact.source?.ref?.value) {
        fail(`${artifact.id}: missing source ref`);
      }
      if (!Array.isArray(artifact.patchOwner) || artifact.patchOwner.length === 0) {
        fail(`${artifact.id}: missing patchOwner`);
      }
      validateVersionRecord(artifact, root, fail, warn);
    } else if (artifact.versionRecord) {
      fail(`${artifact.id}: versionRecord is only valid for a versioned artifact kind`);
    }
  }

  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    const left = claims[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const right = claims[rightIndex];
      if (left.artifact.id === right.artifact.id) continue;
      if (!pathPatternsIntersect(left.pattern, right.pattern)) continue;
      if (claimIsExcluded(left.artifact, left, right) || claimIsExcluded(right.artifact, right, left)) continue;
      fail(`${left.pattern} and ${right.pattern}: output ownership overlaps (${left.artifact.id}, ${right.artifact.id})`);
    }
  }

  for (const artifact of ledger.artifacts) {
    for (const excluded of asArray(artifact.outputExclusions)) {
      const normalized = normalizePattern(excluded);
      const hasExactOwner = claims.some((claim) => claim.artifact.id !== artifact.id
        && !hasWildcard(claim.pattern) && claim.pattern === normalized);
      if (!hasExactOwner) {
        fail(`${artifact.id}.outputExclusions: exact excluded path has no other declared owner (${excluded})`);
      }
    }
  }

  const best2x2Source = byId.get('client.best2x2-source');
  const best2x2Import = byId.get('client.best2x2-import');
  const best2x2Migration = byId.get('migration.best2x2');
  if (!best2x2Source || !best2x2Import || !best2x2Migration) {
    fail('Best2x2 lifecycle requires source snapshot, transient import, and immutable migration artifacts');
  } else {
    if (!best2x2Source.outputs?.includes('core/packages/client/scripts/best2x2/source-snapshot/**')) {
      fail('client.best2x2-source must own the checked-in source snapshot');
    }
    if (asArray(best2x2Import.outputs).length > 0
        || !best2x2Import.transientOutputs?.includes('.tmp/best2x2/**')) {
      fail('client.best2x2-import must own only the transient .tmp lifecycle');
    }
    if (best2x2Migration.source?.locator !== '.tmp/best2x2/import.json'
        || best2x2Migration.sourcePipeline
        || best2x2Migration.outputs?.some((output) => !output.startsWith('core/packages/server/migrations/'))) {
      fail('migration.best2x2 must consume the reviewed import and own only immutable migration outputs');
    }
  }

  const cubeopt = byId.get('server.cubeopt-runtime');
  for (const field of ['schema', 'bundle', 'variant', 'protocol', 'fixed filenames', 'source', 'bytes', 'SHA-256']) {
    if (!cubeopt?.schema?.manifestLocks?.includes(field)) {
      fail(`server.cubeopt-runtime: manifest schema no longer locks ${field}`);
    }
  }
  if (!byId.get('solver.tables-wasm')?.versioning) {
    fail('solver.tables-wasm: missing version and table hash recording policy');
  }

  const helperPath = resolve(root, '.sync/sync_utils.ps1');
  if (!existsSync(helperPath)) {
    fail('missing shared upstream sync helper');
  } else {
    const helperSource = readFileSync(helperPath, 'utf8');
    for (const marker of [
      'function Write-UpstreamVersionRecord',
      "'rev-parse', '--verify', 'HEAD'",
      '[System.IO.Path]::IsPathRooted',
      '[System.IO.Path]::GetFullPath',
      '.StartsWith($repoPrefix',
    ]) {
      if (!helperSource.includes(marker)) fail(`sync_utils.ps1 version writer is missing guard: ${marker}`);
    }
  }

  for (const artifact of ledger.artifacts.filter((item) => VERSIONED_KINDS.has(item.kind))) {
    if (!artifact.versionRecord?.writer) continue;
    const writerPath = resolve(root, normalizePattern(artifact.versionRecord.writer));
    if (!existsSync(writerPath)) continue;
    const writerSource = readFileSync(writerPath, 'utf8');
    if (artifact.kind === 'vendored-sync') {
      if (!writerSource.includes('Write-UpstreamVersionRecord')
          || !writerSource.includes(`'${artifact.id}'`)) {
        fail(`${artifact.id}: writer is not connected to the shared version-record helper`);
      }
    } else if (!writerSource.includes("'rev-parse', 'HEAD'")
        || !writerSource.includes('WriteAllText($refPath')) {
      fail(`${artifact.id}: writer no longer records the verified clone HEAD`);
    }
  }

  const tnoodle = byId.get('client.tnoodle-i18n');
  if (!tnoodle) {
    fail('client.tnoodle-i18n artifact is required');
  } else {
    const generator = asArray(tnoodle.owner)[0];
    const generatorPath = resolve(root, generator ?? '');
    if (generator && existsSync(generatorPath)) {
      const generatorSource = readFileSync(generatorPath, 'utf8');
      for (const flag of ['--input', '--write', '--check']) {
        if (!generatorSource.includes(flag)) fail(`client.tnoodle-i18n: generator is missing ${flag}`);
      }
    }
    const snapshotPath = resolve(root, asArray(tnoodle.outputs)[0] ?? '');
    if (existsSync(snapshotPath)) {
      const snapshot = readFileSync(snapshotPath, 'utf8');
      if (/Generated[^\n]*[A-Za-z]:[\\/]/.test(snapshot)) {
        fail('client.tnoodle-i18n: generated header leaks a machine-local absolute path');
      }
    }
  }

  const docsPath = resolve(root, 'docs/generated-artifacts.md');
  const agentsPath = resolve(root, 'AGENTS.md');
  if (existsSync(docsPath)) {
    const docs = readFileSync(docsPath, 'utf8');
    if (!docs.includes('./generated-artifacts.json')) fail('generated-artifacts.md must link the machine ledger');
    if (!/single source of truth|唯一事实源/i.test(docs)) {
      fail('generated-artifacts.md must identify the ledger as the sole engineering fact source');
    }
    if (!docs.includes('credits_data.json')) {
      fail('generated-artifacts.md must preserve the separate public credits source of truth');
    }
  }
  if (existsSync(agentsPath)) {
    const agents = readFileSync(agentsPath, 'utf8');
    if (!agents.includes('`docs/generated-artifacts.json` 定义生成物')
        || !agents.includes('`docs/generated-artifacts.md` 解释维护方式')) {
      fail('AGENTS.md must identify the JSON ledger as fact source and Markdown as guidance');
    }
  }

  return {
    errors,
    warnings,
    byId,
    pendingCount: ledger.artifacts.filter((artifact) => artifact.versionRecord?.state === 'pending-next-successful-sync').length,
  };
}

function run() {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch (error) {
    console.error(`generated-artifacts ledger is unreadable: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const result = validateLedger(ledger);
  for (const warning of result.warnings) console.warn(`generated-artifacts warning: ${warning}`);
  if (result.errors.length > 0) {
    console.error(`generated-artifacts check failed (${result.errors.length}):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  const pendingSuffix = result.pendingCount > 0
    ? `; ${result.pendingCount} upstream provenance records pending`
    : '';
  console.log(`generated-artifacts check passed (${result.byId.size} artifacts${pendingSuffix})`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) run();
