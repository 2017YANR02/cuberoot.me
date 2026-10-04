/** Browser-only, in-memory XCross benchmark; never generates/replaces disk tables.
 * From core/: pnpm exec tsx ../solver/scripts/benchmark_xcross_table.mts [--runs 3] [--jsc]
 * Requires Chrome, the existing client Playwright dependency, Rust's wasm32 target,
 * and the matching wasm-bindgen CLI. Artifacts stay in ignored .tmp/.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cpus, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const solver = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(solver, '..');
const argv = process.argv.slice(2);
const runArg = argv.indexOf('--runs');
const runs = runArg < 0 ? 3 : Number(argv[runArg + 1]);
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw Error('--runs must be 1..20');
const jsc = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc';
if (argv.includes('--jsc') && !existsSync(jsc)) throw Error('System JavaScriptCore shell is unavailable');
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const expected = gunzipSync(await readFile(join(root, 'tools/solver/rust-cross/tables/pt_cross_C4E0.bin.gz')));
const referenceHash = '10f83b03eb6c1ed542a852697d627af00d8650fe1cd5fa30a1942c413124622e';
if (sha(expected) !== referenceHash) throw Error('Canonical table changed: review the reference before benchmarking');
const nativeTable = join(solver, 'tables/pt_cross_C4E0.bin');
if (existsSync(nativeTable) && !expected.equals(await readFile(nativeTable))) throw Error('Native and Web reference tables differ');
await mkdir(join(root, '.tmp'), { recursive: true });
const work = await mkdtemp(join(root, '.tmp/xcross-table-benchmark-'));
await mkdir(join(work, 'src'));
const source = await readFile(join(solver, 'src/prune_create.rs'), 'utf8');
const optimized = await readFile(join(solver, 'src/xcross_table_gen.rs'), 'utf8');
function extract(name: string): string {
  const start = source.indexOf(`fn ${name}(`);
  if (start < 0) throw Error(`Missing baseline function ${name}`);
  let end = source.indexOf('{', start) + 1;
  let depth = 1;
  for (; depth && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  if (depth) throw Error(`Cannot extract ${name}`);
  return source.slice(start, end);
}
const cargo = await readFile(join(solver, 'Cargo.toml'), 'utf8');
const bindgen = cargo.match(/wasm-bindgen\s*=\s*"=([^"]+)"/)?.[1];
if (!bindgen) throw Error('Expected an exact wasm-bindgen version');
await writeFile(join(work, 'Cargo.toml'), `[package]
name = "xcross_table_benchmark"
version = "0.1.0"
edition = "2021"
[lib]
crate-type = ["cdylib"]
[dependencies]
cube_solver = { path = ${JSON.stringify(solver)}, default-features = false, features = ["wasm-small"] }
wasm-bindgen = "=${bindgen}"
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
`);
// Baseline comes from the canonical source. Only Rayon dispatch becomes serial
// for ordinary browser WASM; progress callbacks do not affect graph traversal.
await writeFile(join(work, 'src/lib.rs'), `use std::sync::atomic::{AtomicU8, Ordering};
use wasm_bindgen::prelude::*;
use cube_solver::{mt_gen, cube_common::state_space};
#[wasm_bindgen] extern "C" { #[wasm_bindgen(js_namespace = globalThis)] fn progress(depth:u32, count:u64); }
${extract('cas_unvisited')}
${extract('pack_atomics_inplace')}
${extract('create_pt_cross_ce').replaceAll('.into_par_iter()', '.into_iter()').replace('        if cnt == 0 {', '        progress(d, cnt);\n        if cnt == 0 {')}
#[wasm_bindgen] pub fn baseline() -> Vec<u8> {
 let e4=mt_gen::get("mt_edge4"); let cn=mt_gen::get("mt_corn"); let ed=mt_gen::get("mt_edge");
 let (n,mut b)=create_pt_cross_ce(state_space::CROSS_SOLVED as u64,12,0,state_space::CROSS as u64,24,24,11,e4.as_u32(),cn.as_u32(),ed.as_u32(),false);
 let len=b.len(); b.resize(len+16,0);b.copy_within(0..len,16);b[..8].copy_from_slice(b"CUBEPT01");b[8..16].copy_from_slice(&n.to_le_bytes());b
}
#[wasm_bindgen] pub fn optimized() -> Vec<u8> {cube_solver::xcross_table_gen::generate(|d,n|progress(d as u32,n as u64))}
`);
async function command(exe: string, args: string[], capture = false): Promise<string> {
  const child = spawn(exe, args, { cwd: work, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  let stdout = '', stderr = '';
  child.stdout?.on('data', b => { stdout += b; });
  child.stderr?.on('data', b => { stderr += b; });
  const timeout = setTimeout(() => child.kill(), 180_000);
  try {
    await new Promise<void>((done, fail) => {
      child.once('error', fail);
      child.once('close', code => code === 0 ? done() : fail(Error(`${exe} exited ${code}\n${stdout}\n${stderr}`)));
    });
  } finally { clearTimeout(timeout); }
  return stdout;
}
const target = join(solver, 'target/xcross-table-benchmark');
await command('cargo', ['build', '--lib', '--release', '--offline', '--target', 'wasm32-unknown-unknown', '--target-dir', target]);
await command('wasm-bindgen', [join(target, 'wasm32-unknown-unknown/release/xcross_table_benchmark.wasm'), '--out-dir', join(work, 'pkg'), '--target', 'web', '--out-name', 'bench']);

const results: Record<string, unknown> = {
  timestamp: new Date().toISOString(), machine: cpus()[0]?.model,
  logicalCpus: cpus().length, physicalMemoryBytes: totalmem(), referenceBytes: expected.length,
  referenceSha256: referenceHash, baselineSourceSha256: sha(source), optimizedSourceSha256: sha(optimized),
  scope: 'Fresh worker/instance per run. Generation includes move tables, output and JS copy; excludes module load, verification and solving. WASM bytes are linear memory, not process RSS.',
};
const records: Record<string, unknown>[] = [];
results.records = records;
const save = () => writeFile(join(work, 'results.json'), JSON.stringify(results, null, 2));
const worker = `self.onmessage=async({data:name})=>{try{
 const m=await import('/bench.js');const wasm=await m.default({module_or_path:'/bench_bg.wasm'});
 const phases=[];const t=performance.now();globalThis.progress=(depth,count)=>phases.push({depth,count:Number(count),ms:performance.now()-t});
 const bytes=m[name]();const ms=performance.now()-t;const wasmBytes=wasm.memory.buffer.byteLength;
 const verification=await(await fetch('/verify',{method:'POST',body:bytes})).json();
 postMessage({name,ms,wasmBytes,phases,verification});
}catch(e){postMessage({error:String(e)});}};`;
const server = createServer((req, res) => {
  const path = new URL(req.url!, 'http://localhost').pathname;
  if (path === '/verify' && req.method === 'POST') {
    let offset = 0, firstMismatch = -1;
    const hash = createHash('sha256');
    req.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      if (firstMismatch === -1 && !chunk.equals(expected.subarray(offset, offset + chunk.length))) {
        for (let i = 0; i < chunk.length; i++) if (chunk[i] !== expected[offset + i]) { firstMismatch = offset + i; break; }
      }
      offset += chunk.length;
    });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ bytesCompared: offset, firstMismatch, identical: firstMismatch === -1 && offset === expected.length, sha256: hash.digest('hex') }));
    });
  } else if (path === '/') {
    res.setHeader('Content-Type', 'text/html'); res.end('<title>XCross benchmark</title>');
  } else if (path === '/worker.js') {
    res.setHeader('Content-Type', 'text/javascript'); res.end(worker);
  } else if (path === '/bench.js' || path === '/bench_bg.wasm') {
    res.setHeader('Content-Type', path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
    createReadStream(join(work, 'pkg', path.slice(1))).pipe(res);
  } else { res.writeHead(404); res.end(); }
});
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const clientRequire = createRequire(join(root, 'core/packages/client/package.json'));
const { chromium } = clientRequire('@playwright/test');
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  results.chrome = browser.version();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
  for (let run = 1; run <= runs; run++) for (const name of run % 2 ? ['baseline', 'optimized'] : ['optimized', 'baseline']) {
    const record = await page.evaluate((name: string) => new Promise((done, fail) => {
      const w = new Worker('/worker.js', { type: 'module' });
      const timeout = setTimeout(() => { w.terminate(); fail(Error('Generation timeout')); }, 120_000);
      w.onerror = e => { clearTimeout(timeout); w.terminate(); fail(Error(e.message)); };
      w.onmessage = ({ data }) => { clearTimeout(timeout); w.terminate(); data.error ? fail(Error(data.error)) : done(data); };
      w.postMessage(name);
    }), name);
    records.push({ engine: 'Chrome worker', run, ...record });
    await save();
    if (!record.verification.identical || record.verification.sha256 !== referenceHash) throw Error('Full table mismatch');
    console.log(`${name}: ${record.ms.toFixed(1)} ms, ${(record.wasmBytes / 1048576).toFixed(3)} MiB; all ${expected.length} bytes identical`);
  }
} finally {
  await browser?.close();
  await new Promise<void>(done => server.close(() => done()));
}
if (argv.includes('--jsc')) {
  await writeFile(join(work, 'reference.bin'), expected); // Copy the reference; never persist generated table output.
  const glue = (await readFile(join(work, 'pkg/bench.js'), 'utf8'))
    .replace(/^export (class|function) /gm, '$1 ').replace(/^export \{.*\};$/gm, '')
    .replaceAll('import.meta.url', JSON.stringify('file://' + join(work, 'pkg/bench.js')));
  // Shell-only UTF-8 shims. The generator has no string inputs or outputs.
  const shim = `class TextDecoder {decode(b){if(!b)return '';return decodeURIComponent(Array.from(b,v=>'%'+v.toString(16).padStart(2,'0')).join(''));}}
class TextEncoder {encode(s){return Uint8Array.from(unescape(encodeURIComponent(s)),c=>c.charCodeAt(0));}encodeInto(s,b){const a=this.encode(s);b.set(a);return {read:s.length,written:a.length};}}\n`;
  for (let run = 1; run <= runs; run++) for (const name of run % 2 ? ['baseline', 'optimized'] : ['optimized', 'baseline']) {
    const body = `\nconst phases=[];globalThis.progress=(depth,count)=>phases.push({depth,count:Number(count),ms:performance.now()-t});
initSync({module:readFile(${JSON.stringify(join(work, 'pkg/bench_bg.wasm'))},'binary')});
const t=performance.now();const bytes=${name}();const ms=performance.now()-t;const wasmBytes=wasm.memory.buffer.byteLength;
const expected=readFile(${JSON.stringify(join(work, 'reference.bin'))},'binary');let firstMismatch=-1;
for(let i=0;i<bytes.length;i++)if(bytes[i]!==expected[i]){firstMismatch=i;break;}
print(JSON.stringify({ms,wasmBytes,phases,verification:{bytesCompared:bytes.length,firstMismatch,identical:bytes.length===expected.length&&firstMismatch===-1}}));`;
    await writeFile(join(work, 'jsc.js'), shim + glue + body);
    const record = JSON.parse((await command(jsc, [join(work, 'jsc.js')], true)).trim());
    records.push({ engine: 'System JavaScriptCore shell (not Safari/device acceptance)', name, run, ...record });
    await save();
    if (!record.verification.identical) throw Error('JavaScriptCore full table mismatch');
    console.log(`JavaScriptCore ${name}: ${record.ms.toFixed(1)} ms; all bytes identical`);
  }
}
console.log(`Results: ${join(work, 'results.json')}`);
