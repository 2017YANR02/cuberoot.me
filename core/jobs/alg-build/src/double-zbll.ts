/** Complete Double ZBLL corpus; resume native H48 h10 solves, then verify/export. */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, fsyncSync, unlinkSync, createWriteStream, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import type { AlgCase, AlgFile } from '@cuberoot/shared/alg';
import { DOUBLE_ZBLL_MOVES, DOUBLE_ZBLL_RECORD_BYTES } from '@cuberoot/shared/double-zbll';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const work = resolve(root, '.tmp/double-zbll-v1');
const output = resolve(work, 'export');
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const atomic = (p: string, v: string | Uint8Array) => { writeFileSync(`${p}.tmp`, v); renameSync(`${p}.tmp`, p); };
const key = (c: AlgCase) => `${c.subgroup}|${c.name}`;
const moves = DOUBLE_ZBLL_MOVES;
const recordBytes = DOUBLE_ZBLL_RECORD_BYTES;
const aufs = ['', 'U', 'U2', "U'"];
const fail = (s: string): never => { throw new Error(s); };
mkdirSync(work, { recursive: true }); mkdirSync(output, { recursive: true });
const lock = resolve(work, 'owner.pid');
if (existsSync(lock)) {
  let alive = false;
  try { process.kill(Number(readFileSync(lock, 'utf8')), 0); alive = true; } catch { /* stale */ }
  if (alive) fail('Builder already running');
  unlinkSync(lock);
}
const fd = openSync(lock, 'wx'); writeFileSync(fd, String(process.pid)); closeSync(fd);
process.on('exit', () => { try { unlinkSync(lock); } catch { /* already cleaned */ } });
let completed = 0, total = 0, peakRss = 0, minHeadroom = Infinity;
const started = Date.now();
let baselineSwapouts: number | null = null;
function progress(status: string, extra: object = {}) {
  atomic(resolve(work, 'progress.json'), JSON.stringify({ status, completed, total, updatedAt: new Date().toISOString(),
    elapsedSeconds: (Date.now()-started)/1000, peakRssGiB: peakRss/2**30,
    minimumHeadroomGiB: Number.isFinite(minHeadroom) ? minHeadroom/2**30 : null, stopHeadroomGiB: 2, baselineSwapouts, ...extra }, null, 2));
}
function memory() {
  if (process.platform !== 'darwin') fail('Guarded runner requires macOS');
  const raw = execFileSync('vm_stat', { encoding: 'utf8' });
  const page = Number(/page size of (\d+)/.exec(raw)?.[1]) || fail('Cannot read page size');
  const n = (k: string) => Number(new RegExp(`${k}:\\s+(\\d+)`).exec(raw)?.[1] ?? fail(`Missing ${k}`));
  return { available: (n('Pages free')+n('File-backed pages'))*page, swapouts: n('Swapouts'),
    pressure: Number(execFileSync('sysctl', ['-n','kern.memorystatus_vm_pressure_level'], { encoding: 'utf8' })) };
}
try {
  const sourcePath = resolve(work, 'source.json');
  if (!existsSync(sourcePath)) {
    const response = await fetch('https://api.cuberoot.me/v1/alg/sets/3x3/zbll');
    if (!response.ok) fail(`ZBLL source HTTP ${response.status}`);
    atomic(sourcePath, await response.text());
  }
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as AlgFile;
  const cases = source.cases;
  if (cases.length !== 472 || new Set(cases.map(key)).size !== 472) fail('Expected 472 unique cases');
  total = cases.length**2;
  const kp = await cube3x3x3.kpuzzle();
  const home = (o: { pieces: number[]; orientation: number[] }, i: number) => o.pieces[i] === i && o.orientation[i] === 0;
  const bases = cases.map(c => {
    const base = normalizeWcaScramble(c.meta?.optimal?.htm?.scramble || c.setup) || fail(`Invalid case ${key(c)}`);
    const p = kp.defaultPattern().applyAlg(base).patternData;
    if (![4,5,6,7,8,9,10,11].every(i => home(p.EDGES,i)) || ![4,5,6,7].every(i => home(p.CORNERS,i)) || !p.EDGES.orientation.every(o => o===0)) fail(`Not ZBLL: ${key(c)}`);
    return base;
  });
  const identity = hash(JSON.stringify({ version:1, seed:20261009, cases:cases.map((c,i)=>[key(c),bases[i]]) }));
  const identityPath = resolve(work,'identity.txt');
  if (existsSync(identityPath) && readFileSync(identityPath,'utf8') !== identity) fail('Source changed; use a new corpus version');
  writeFileSync(identityPath,identity);
  function setup(id: number): string {
    let rng = (20261009 ^ Math.imul(id+1,0x9e3779b1)) >>> 0;
    const auf = () => { rng ^= rng<<13; rng ^= rng>>>17; rng ^= rng<<5; return aufs[(rng>>>0)%4]; };
    const top = `${auf()} ${bases[Math.floor(id/cases.length)]} ${auf()}`;
    const bottom = `${auf()} ${bases[id%cases.length]} ${auf()}`;
    return normalizeWcaScramble(`${top} x2 ${bottom} x2`) || fail(`Cannot normalize ${id}`);
  }
  const corpus = resolve(work,'corpus.csv'), results = resolve(work,'solutions.csv');
  if (!existsSync(corpus)) {
    progress('preparing'); const stream = createWriteStream(`${corpus}.tmp`);
    for (let i=0;i<total;i++) if (!stream.write(`${i},${setup(i)}\n`)) await once(stream,'drain');
    stream.end(); await once(stream,'finish'); renameSync(`${corpus}.tmp`,corpus);
  }
  if (existsSync(results)) {
    const saved = readFileSync(results, 'utf8');
    // A power loss may leave only the final record partially written. Preserve
    // that file as evidence, then resume from the last complete newline.
    if (saved && !saved.endsWith('\n')) {
      const boundary = saved.lastIndexOf('\n') + 1;
      atomic(resolve(work, `solutions-recovery-${Date.now()}.csv`), saved);
      atomic(results, saved.slice(0, boundary));
      console.log('Recovered a partial final record; complete results retained');
    }
    const ids = new Set<number>();
    for await (const line of createInterface({ input:createReadStream(results) })) {
      if (!line) continue;
      const match = /^(\d+),(\d+),(.+)$/.exec(line) || fail('Invalid saved result');
      const id = Number(match[1]), tokens = match[3].trim().split(/\s+/);
      if (id >= total || ids.has(id) || tokens.length !== Number(match[2]) || tokens.some(t => !moves.includes(t))) fail(`Invalid saved record ${id}`);
      ids.add(id);
    }
    completed = ids.size;
  }
  if (completed < total) {
    const before = memory(); baselineSwapouts = before.swapouts;
    if (before.available < 34*2**30 || before.pressure !== 1) fail('Insufficient memory headroom; not starting');
    const child = spawn(process.execPath,['--import',resolve(root,'core/node_modules/tsx/dist/loader.mjs'),resolve(root,'solver/333opt/solve_h10.mts'),'--no-counts'],{
      cwd:resolve(root,'core'),env:{...process.env,CORPUS:corpus,OUT:results},stdio:['ignore','pipe','pipe'],
    });
    let stopped: string | null = null, solverPid: number | null = null;
    const stop = (reason: string) => {
      if(stopped)return; stopped=reason;
      if(solverPid)try{process.kill(solverPid,'SIGTERM');}catch{/* exited */}
      child.kill('SIGTERM'); progress('stopped',{reason}); console.error(reason);
    };
    process.on('SIGTERM',()=>stop('Interrupted; results preserved')); process.on('SIGINT',()=>stop('Interrupted; results preserved'));
    const monitor=setInterval(()=>{
      try{
        const m=memory();
        if(m.swapouts>before.swapouts){stop('New system swap-out detected');return;}
        if(m.pressure!==1){stop('System memory pressure increased');return;}
        const rows=execFileSync('ps',['-axo','pid,ppid,rss,comm'],{encoding:'utf8'});
        for(const line of rows.split('\n')){
          const r=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line);
          if(r && Number(r[2])===child.pid && r[4].includes('solve_h48_h10')){
            solverPid=Number(r[1]);const rss=Number(r[3])*1024;
            peakRss=Math.max(peakRss,rss);minHeadroom=Math.min(minHeadroom,m.available-rss);
            if(rss>32*2**30 || m.available-rss<2*2**30)stop('RSS above 32 GiB or remaining headroom below 2 GiB');
          }
        }
      }catch{if(child.exitCode===null && !child.killed)stop('Memory monitoring failed');}
    },1000);
    child.stderr.pipe(process.stderr);
    const exited=new Promise<number|null>((res,rej)=>{child.on('error',rej);child.on('close',res);});
    for await(const line of createInterface({input:child.stdout})){
      console.log(line);const m=/^\[(\d+)\/(\d+)\]/.exec(line);
      if(m){
        // Bound durable checkpoint loss to the latest small batch, not hours.
        const checkpoint = openSync(results, 'r+');
        try { fsyncSync(checkpoint); } finally { closeSync(checkpoint); }
        completed=Number(m[1]);progress('solving');
      }
    }
    const code=await exited;clearInterval(monitor);
    if(stopped || code!==0)fail(stopped || `Solver exited ${code}`);
    if(memory().swapouts!==baselineSwapouts)fail('Swap-out counter changed');
  }
  progress('verifying');
  const bytes=new Uint8Array(total*recordBytes),seen=new Set<number>();
  const histogram:Record<number,number>={};
  for await(const line of createInterface({input:createReadStream(results)})){
    const m=/^(\d+),(\d+),(.+)$/.exec(line)||fail('Invalid result row');
    const id=Number(m[1]),length=Number(m[2]);
    if(id<0 || id>=total || seen.has(id) || length<1 || length>20)fail(`Invalid/duplicate id ${id}`);
    const scramble=normalizeWcaScramble(new Alg(m[3]).invert().toString()) || fail(`Invalid inverse ${id}`);
    const expected=kp.defaultPattern().applyAlg(setup(id)).patternData;
    const actual=kp.defaultPattern().applyAlg(scramble).patternData;
    for(const name of ['EDGES','CORNERS'])if(JSON.stringify(expected[name])!==JSON.stringify(actual[name]))fail(`State mismatch ${id}`);
    const tokens=scramble.split(/\s+/);
    if(tokens.length!==length || tokens.some(t=>!moves.includes(t)))fail(`Invalid HTM sequence ${id}`);
    bytes[id*recordBytes]=length;tokens.forEach((t,i)=>{bytes[id*recordBytes+1+i]=moves.indexOf(t);});seen.add(id);histogram[length]=(histogram[length]||0)+1;
    if(seen.size%5000===0){completed=seen.size;progress('verifying');}
  }
  if(seen.size!==total)fail(`Incomplete: ${seen.size}/${total}`);
  const binHash=hash(bytes),caseText=JSON.stringify(source),caseHash=hash(caseText);
  const dataFile=`pairs-${binHash.slice(0,16)}.bin`,casesFile=`cases-${caseHash.slice(0,16)}.json`;
  atomic(resolve(output,dataFile),bytes);atomic(resolve(output,casesFile),caseText);
  const manifest={schema:1,version:identity.slice(0,16),caseCount:cases.length,pairCount:total,recordBytes,moves,metric:'HTM',solver:'nissy-core H48 h10',
    phases:'One deterministic random pre/post AUF per layer and ordered pair',dataFile,dataBytes:bytes.length,dataSha256:binHash,casesFile,casesSha256:caseHash,generatedAt:new Date().toISOString(),histogram};
  atomic(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2));completed=total;progress('complete',{manifest});
  console.log(`Verified and exported ${total} pairs (${bytes.length} bytes)`);
}catch(error){progress('failed',{error:error instanceof Error?error.message:String(error)});throw error;}
