import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [source, output, cpu = 'x86-64-v3'] = process.argv.slice(2);
if (!['x86-64-v3', 'skylake-avx512'].includes(cpu)) throw new Error('Unsupported CPU target');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const upstream = run('git', ['-C', source, 'rev-parse', 'HEAD']);
if (upstream !== '947c20d93564f150aad9c292486ab730a329b86c') throw new Error('Wrong upstream');
const changed = run('git', ['-C', source, 'diff', '--name-only']);
let patch;
if (cpu === 'skylake-avx512') {
  if (changed !== 'src/prefetch.rs') throw new Error('Unexpected upstream changes');
  const original = execFileSync('git', ['-C', source, 'show', 'HEAD:src/prefetch.rs'], { encoding: 'utf8' });
  const actual = readFileSync(resolve(source, 'src/prefetch.rs'), 'utf8');
  if (original.replaceAll('_MM_HINT_NTA', '_MM_HINT_T0') !== actual) throw new Error('Expected only NTA to T0 change');
  patch = { path: 'patches/linux-table-prefetch-t0.patch', sha256: sha256(readFileSync(new URL('./patches/linux-table-prefetch-t0.patch', import.meta.url))) };
} else if (changed) throw new Error('Tracked upstream code changed');
const files = Object.fromEntries(['cuberoot-egg', 'solve'].map(name => {
  const bytes = readFileSync(resolve(output, name));
  if (bytes.subarray(0, 6).toString('hex') !== '7f454c460201') throw new Error('Expected ELF64');
  return [name, { bytes: bytes.length, sha256: sha256(bytes) }];
}));
// Do not execute an AVX-512 binary on an arbitrary hosted runner. The artifact
// loader probes --server-info after checking every production CPU's flags.
const protocol = cpu === 'x86-64-v3' ? JSON.parse(run(resolve(output, 'cuberoot-egg'), ['--server-info'])) : null;
const metadata = { schema: 'cuberoot.egg-native-build/v2', revision: process.env.SOURCE_REVISION,
  upstream, target: 'x86_64-unknown-linux-musl', cpu, rustflags: `-C target-cpu=${cpu}`, ...(patch ? { patch } : {}),
  toolchain: '1.98.1', rustc: run('rustup', ['run', '1.98.1', 'rustc', '-vV']),
  adapterSha256: sha256(readFileSync(resolve(source, 'src/bin/cuberoot-egg.rs'))),
  lockSha256: sha256(readFileSync(resolve(source, 'Cargo.lock'))), protocol, files,
  validation: 'bounded adapter tests passed using x86-64-v3; target binary probe deferred to a compatible host; no h8 table loaded or generated in CI' };
writeFileSync(resolve(output, 'build.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
