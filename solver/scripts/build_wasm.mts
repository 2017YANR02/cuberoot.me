/** Build the browser cross solver and gzip its local table assets. */
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'pkg-web');
const wasm = join(root, 'target', 'wasm32-unknown-unknown', 'release', 'cube_solver.wasm');
const names = [
  'pt_cross', 'pt_cross_C4E0', 'mt_edge2', 'mt_edge3', 'mt_edge4', 'mt_corn',
  'mt_corn2', 'mt_edge', 'pt_cross_ins_C4', 'pt_pair_C4E0', 'pt_ep4eo12',
  'mt_eo12', 'mt_eo12_alt', 'mt_ep4', 'pt_pscross', 'opt_first_layer',
];

async function run(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
  const code = await new Promise<number>((done, fail) => {
    child.on('error', fail);
    child.on('close', value => done(value ?? 1));
  });
  if (code !== 0) throw new Error(`${command} exited with ${code}`);
}

console.log('[1/4] cargo build wasm32 (release)...');
await run('cargo', ['build', '--lib', '--release', '--target', 'wasm32-unknown-unknown']);
await mkdir(out, { recursive: true });
for (const name of await readdir(out)) {
  if (name.startsWith('cross_solver')) await unlink(join(out, name));
}
console.log('[2/4] wasm-bindgen (target web)...');
await run('wasm-bindgen', [wasm, '--out-dir', out, '--target', 'web', '--out-name', 'cross_solver']);
console.log('[3/4] gzip tables...');
const tableOut = join(out, 'tables');
await mkdir(tableOut, { recursive: true });
for (const name of names) {
  await pipeline(
    createReadStream(join(root, 'tables', `${name}.bin`)),
    createGzip(),
    createWriteStream(join(tableOut, `${name}.bin.gz`)),
  );
}
console.log('[4/4] done. pkg-web/ ready.');
for (const name of await readdir(out)) {
  const path = join(out, name);
  if ((await stat(path)).isFile()) console.log(`${(await stat(path)).size.toLocaleString()}  ${name}`);
}
for (const name of await readdir(tableOut)) {
  const path = join(tableOut, name);
  console.log(`${(await stat(path)).size.toLocaleString()}  tables/${name}`);
}
