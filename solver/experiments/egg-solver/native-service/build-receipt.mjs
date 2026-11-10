import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [source, output] = process.argv.slice(2);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const upstream = run('git', ['-C', source, 'rev-parse', 'HEAD']);
if (upstream !== '947c20d93564f150aad9c292486ab730a329b86c') throw new Error('Wrong upstream');
if (run('git', ['-C', source, 'diff', '--name-only'])) throw new Error('Tracked upstream code changed');
const files = Object.fromEntries(['cuberoot-egg', 'solve'].map(name => {
  const bytes = readFileSync(resolve(output, name));
  if (bytes.subarray(0, 6).toString('hex') !== '7f454c460201') throw new Error('Expected ELF64');
  return [name, { bytes: bytes.length, sha256: sha256(bytes) }];
}));
const protocol = JSON.parse(run(resolve(output, 'cuberoot-egg'), ['--server-info']));
const metadata = { schema: 'cuberoot.egg-native-build/v1', revision: process.env.SOURCE_REVISION,
  upstream, target: 'x86_64-unknown-linux-musl', rustflags: '-C target-cpu=x86-64-v3',
  toolchain: '1.98.1', rustc: run('rustup', ['run', '1.98.1', 'rustc', '-vV']),
  adapterSha256: sha256(readFileSync(resolve(source, 'src/bin/cuberoot-egg.rs'))),
  lockSha256: sha256(readFileSync(resolve(source, 'Cargo.lock'))), protocol, files,
  validation: 'bounded adapter tests passed; no h8 table loaded or generated in CI' };
writeFileSync(resolve(output, 'build.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
