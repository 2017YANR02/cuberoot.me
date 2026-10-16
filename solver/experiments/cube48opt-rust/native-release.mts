/** Promote an exact measured native Opt9/Opt10 artifact. Never starts a solver. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, openSync, closeSync, fstatSync, readFileSync, mkdirSync, existsSync,
  copyFileSync, chmodSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function read(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    assert(info.isFile() && info.size <= 8 * 1024 ** 2, `Expected bounded release artifact: ${path}`);
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
function child(base: string, name: string) {
  assert(typeof name === 'string' && !isAbsolute(name));
  const path = resolve(base, name), rel = relative(base, path);
  assert(rel && rel !== '..' && !rel.startsWith('../'), 'Release artifact must stay within its directory');
  return path;
}
export function readNativeRelease(variant: 9 | 10) {
  assert(variant === 9 || variant === 10);
  const manifest = JSON.parse(read(resolve(HERE, `opt${variant}-release.json`)).toString());
  assert.equal(manifest.schema, `cuberoot.opt${variant}-native-release.v1`);
  assert.equal(manifest.status, 'official');
  assert.equal(manifest.candidate, variant === 9 ? 'fixed' : 'coset');
  assert.equal(manifest.command, variant === 9 ? 'solve' : 'solve-opt10');
  assert.equal(manifest.threads, 16); assert.equal(manifest.contexts, 8);
  const snapshot = child(ROOT, manifest.snapshot.path);
  return { manifest, executable: child(HERE, manifest.executable.path), snapshot,
    report: child(snapshot, manifest.benchmark.report) };
}
function verifySource(variant: 9 | 10) {
  const release = readNativeRelease(variant), { manifest, snapshot, report } = release;
  const snapshotBytes = read(resolve(snapshot, 'manifest.json'));
  assert.equal(hash(snapshotBytes), manifest.snapshot.manifestSha256, 'Frozen snapshot changed');
  const frozen = JSON.parse(snapshotBytes.toString());
  assert.equal(frozen.candidate, manifest.candidate);
  const entries = Object.entries(frozen.files) as [string, string | { sha256: string }][];
  assert(entries.length > 0);
  for (const [path, expected] of entries) assert.equal(hash(read(child(snapshot, path))), typeof expected === 'string' ? expected : expected.sha256, path);
  const reportBytes = read(report);
  assert.equal(hash(reportBytes), manifest.benchmark.sha256);
  const measured = JSON.parse(reportBytes.toString());
  for (const [key, expected] of Object.entries({ experiment: manifest.candidate,
    cases: manifest.benchmark.cases, threads: manifest.threads, batchThreads: 1,
    measuredPasses: 1, warmupCases: 0, totalSeconds: manifest.benchmark.seconds,
    peakRssBytes: manifest.benchmark.peakRssBytes, corpusSha256: manifest.benchmark.corpusSha256,
    verifiedSolutions: 1000, optimalLengthsMatched: 1000,
    ...(variant === 10 ? { opt10BaselineOptimalLengthsMatched: 1000, hotpathOptimalLengthsMatched: 1000 } : { dynamicOptimalLengthsMatched: 1000 }) }))
    assert.equal(measured[key], expected, `Release benchmark ${key}`);
  const source = child(snapshot, `${manifest.candidate}-native`);
  assert.equal(hash(read(source)), manifest.executable.sha256);
  assert.equal(measured.build.binary.sha256, manifest.executable.sha256);
  return { ...release, source, verifiedFiles: entries.length };
}
export function verifyNativeRelease(variant: 9 | 10) {
  const release = verifySource(variant);
  assert.equal(hash(read(release.executable)), release.manifest.executable.sha256,
    'Official executable must be the exact measured artifact');
  return release;
}
export function installNativeRelease(variant: 9 | 10) {
  const release = verifySource(variant), { manifest, executable, source } = release;
  assert.equal(process.platform, manifest.platform); assert.equal(process.arch, manifest.arch);
  mkdirSync(dirname(executable), { recursive: true });
  if (existsSync(executable)) assert.equal(hash(read(executable)), manifest.executable.sha256,
    'Refusing to replace an unexpected official executable');
  else {
    copyFileSync(source, executable, constants.COPYFILE_EXCL);
    chmodSync(executable, 0o755);
  }
  const receipt = resolve(dirname(dirname(executable)), 'release-install.json');
  if (!existsSync(receipt)) writeFileSync(receipt, JSON.stringify({
    schema: `cuberoot.opt${variant}-native-install.v1`, releaseId: manifest.id,
    installedAt: new Date().toISOString(), source, executable,
    executableSha256: manifest.executable.sha256,
    snapshotManifestSha256: manifest.snapshot.manifestSha256,
    benchmarkSha256: manifest.benchmark.sha256, engineStarted: false,
  }, null, 2) + '\n', { flag: 'wx' });
  return verifyNativeRelease(variant);
}
export function nativeReleaseCli(variant: 9 | 10) {
  const [mode, ...extra] = process.argv.slice(2);
  assert(extra.length === 0 && ['install', 'verify', 'status'].includes(mode),
    `Usage: opt${variant}-release.mts install|verify|status`);
  const release = mode === 'install' ? installNativeRelease(variant) : verifyNativeRelease(variant);
  console.log(JSON.stringify({ release: release.manifest.id, status: 'official',
    executable: release.executable, sha256: release.manifest.executable.sha256,
    benchmarkSeconds: release.manifest.benchmark.seconds,
    verifiedSnapshotFiles: release.verifiedFiles, engineStarted: false }, null, 2));
}
