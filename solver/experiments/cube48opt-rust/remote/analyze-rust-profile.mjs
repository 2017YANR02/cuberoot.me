#!/usr/bin/env node
// Offline diagnostics only: never instantiates WASM, opens a PDB, or solves.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, copyFileSync, constants, createReadStream, existsSync, lstatSync, mkdirSync,
  openSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const hex = value => `0x${value.toString(16)}`;
export function parseAnalysisArguments(argv) {
  const values = {};
  assert(argv.length === 4 || argv.length === 6,
    'usage: analyze-rust-profile.mjs --input ABS_FINISHED_RUN --out ABS_NEW_ANALYSIS [--processed-dir ABS_TEXTS]');
  for (let i = 0; i < argv.length; i += 2) {
    assert(['--input', '--out', '--processed-dir'].includes(argv[i]) && !Object.hasOwn(values, argv[i]));
    assert(isAbsolute(argv[i + 1])); values[argv[i]] = argv[i + 1];
  }
  assert(values['--input'] && values['--out']);
  return { input: values['--input'], out: values['--out'], processed: values['--processed-dir'] ?? null };
}

export function parseWasmDisassembly(text, functionIndex = 12) {
  const versions = [];
  for (const match of text.matchAll(/^--- WebAssembly code ---\r?\n([\s\S]*?)^--- End code ---/gm)) {
    const block = match[1];
    if (Number(block.match(/^index: (\d+)$/m)?.[1]) !== functionIndex) continue;
    const name = block.match(/^name: (.+)$/m)?.[1], compiler = block.match(/^compiler: (.+)$/m)?.[1];
    const size = Number(block.match(/^Body \(size = (\d+) /m)?.[1]);
    const instructionBytes = Number(block.match(/^Instructions \(size = (\d+)\)/m)?.[1]);
    assert(name && compiler && size > 0 && instructionBytes > 0);
    const body = block.split(/^Instructions \(size = \d+\)\r?\n/m)[1].split(/^(?:Source positions:|Safepoints |RelocInfo |Protected instructions:|Handler Table)/m)[0];
    const instructions = [...body.matchAll(/^(0x[\da-f]+)\s+([\da-f]+)\s+([\da-f]+)\s+(.+)$/gmi)]
      .map(row => ({ address: row[1].toLowerCase(), offset: parseInt(row[2], 16), bytes: row[3], assembly: row[4].trim() }));
    assert(instructions.length && instructions[0].offset === 0, 'Missing complete native instruction body');
    const start = BigInt(instructions[0].address);
    for (const [i, row] of instructions.entries()) {
      assert.equal(BigInt(row.address) - start, BigInt(row.offset));
      assert(row.offset < instructionBytes); if (i) assert(row.offset > instructions[i - 1].offset);
    }
    const positionsText = block.split('Source positions:')[1]?.split(/\n\n/)[0] ?? '';
    const sourcePositions = [...positionsText.matchAll(/^\s+([\da-f]+)\s+(\d+)(?:\s+.*)?$/gmi)]
      .map(row => ({ nativeOffset: parseInt(row[1], 16), v8Position: Number(row[2]) }));
    const version = { id: versions.length, functionIndex, name, compiler, start: hex(start), size, instructionBytes,
      bodySha256: hash(Buffer.from(block)), instructions, sourcePositions };
    if (!versions.some(old => old.bodySha256 === version.bodySha256)) versions.push(version);
  }
  assert(versions.length, `No complete same-run function ${functionIndex} disassembly`);
  return versions;
}

export class PcAccumulator {
  constructor(versions, binBytes = 64) {
    this.versions = versions; this.binBytes = binBytes; this.active = new Map(); this.counts = new Map();
    this.totalTicks = 0; this.mappedTicks = 0; this.ambiguousCreations = 0; this.movedTargetCode = 0;
    this.matchedCreations = 0;
  }
  accept(line) {
    const parts = line.split(',');
    if (parts[0] === 'code-creation') {
      const start = BigInt(parts[4]), size = Number(parts[5]), end = start + BigInt(size);
      for (const [key, old] of this.active) if (start < old.end && end > old.start) this.active.delete(key);
      const matches = this.versions.filter(v => BigInt(v.start) === start && v.size === size && v.name === parts[6]);
      if (matches.length === 1) {
        const v = matches[0]; this.active.set(v.start, { start, end, version: v }); this.matchedCreations++;
      } else if (matches.length > 1) this.ambiguousCreations++;
    } else if (parts[0] === 'code-delete' || parts[0] === 'code-move') {
      const key = hex(BigInt(parts[1]));
      // A moved body has no dump at its new address. Refuse to manufacture a
      // mapping instead of assuming the old PC range still belongs to it.
      if (this.active.has(key) && parts[0] === 'code-move') this.movedTargetCode++;
      this.active.delete(key);
    } else if (parts[0] === 'tick') {
      this.totalTicks++;
      const pc = BigInt(parts[1]);
      const code = [...this.active.values()].find(c => pc >= c.start && pc < c.end);
      if (!code) return;
      this.mappedTicks++;
      const offset = Number(pc - code.start), key = `${code.version.id}:${offset}`;
      const count = this.counts.get(key) ?? { version: code.version.id, offset, ticks: 0 };
      count.ticks++; this.counts.set(key, count);
    }
  }
  result() {
    const bins = new Map();
    for (const row of this.counts.values()) {
      const offset = Math.floor(row.offset / this.binBytes) * this.binBytes, key = `${row.version}:${offset}`;
      const bin = bins.get(key) ?? { version: row.version, offset, endOffsetExclusive: offset + this.binBytes, ticks: 0, pcs: [] };
      bin.ticks += row.ticks; bin.pcs.push({ offset: row.offset, ticks: row.ticks }); bins.set(key, bin);
    }
    return { totalRawTicks: this.totalTicks, functionSelfTicks: this.mappedTicks, matchedCreations: this.matchedCreations,
      ambiguousCreations: this.ambiguousCreations, movedTargetCode: this.movedTargetCode,
      binBytes: this.binBytes, bins: [...bins.values()].sort((a, b) => b.ticks - a.ticks).map(bin => ({ ...bin, pcs: bin.pcs.sort((a, b) => b.ticks - a.ticks) })) };
  }
}

export function parseSelfTicks(text) {
  const head = text.match(/\((\d+) ticks, (\d+) unaccounted, (\d+) excluded\)/);
  assert(head, 'Not a completed Node --prof-process report');
  const rows = [];
  for (const section of ['Shared libraries', 'JavaScript', 'C++']) {
    const body = text.split(` [${section}]:`)[1]?.split(/\n \[/)[0] ?? '';
    for (const row of body.matchAll(/^\s+(\d+)\s+([\d.]+)%\s+(?:([\d.]+)%\s+)?(.+)$/gm))
      rows.push({ section, ticks: Number(row[1]), totalPercent: Number(row[2]), name: row[4] });
  }
  return { totalTicks: Number(head[1]), unaccounted: Number(head[2]), excluded: Number(head[3]),
    topSelfTicks: rows.sort((a, b) => b.ticks - a.ticks).slice(0, 30) };
}

async function processIsolate(log, output, reused) {
  if (reused) {
    copyFileSync(resolve(reused, `${basename(log)}.txt`), output, constants.COPYFILE_EXCL);
    return { reused: true, nativeSymbols: 'as provided by preserved external processor output' };
  }
  // Cross-host logs must not resolve Linux addresses using unrelated Mac
  // libraries. Keep native symbols unresolved; WASM/JS names come from the log.
  const args = ['--prof-process', '--linux', '--nm=/usr/bin/true', '--objdump=/usr/bin/true', '--readelf=/usr/bin/true', log];
  const stdout = openSync(output, 'wx'), stderr = openSync(`${output}.stderr`, 'wx');
  try {
    await new Promise((done, fail) => {
      const child = spawn(process.execPath, args, { stdio: ['ignore', stdout, stderr] });
      let spawnError;
      const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
      child.once('error', error => { spawnError = error; });
      child.once('close', (code, signal) => { clearTimeout(timer);
        if (spawnError || code !== 0 || signal) fail(spawnError ?? Error(`prof-process failed: ${code}/${signal}`)); else done(); });
    });
  } finally { closeSync(stdout); closeSync(stderr); }
  return { reused: false, node: process.version, args, nativeSymbols: 'intentionally unresolved for cross-host safety' };
}

function annotateBin(bin, versions) {
  const version = versions.find(v => v.id === bin.version), peak = bin.pcs[0];
  let instruction = -1;
  for (let i = 0; i < version.instructions.length && version.instructions[i].offset <= peak.offset; i++) instruction = i;
  const source = version.sourcePositions.filter(p => p.nativeOffset <= peak.offset).at(-1) ?? null;
  return { ...bin, compiler: version.compiler, codeStart: version.start, name: version.name,
    peakPc: hex(BigInt(version.start) + BigInt(peak.offset)), nearestPrecedingV8SourceAnchor: source,
    instructionContext: version.instructions.slice(Math.max(0, instruction - 2), instruction + 4) };
}

export async function analyzeProfile(config) {
  assert(!existsSync(config.out), 'Analysis output must be new');
  assert(!existsSync(resolve(config.input, 'failure.json')) && !existsSync(resolve(config.input, 'rust/failure.json')));
  const reportPath = resolve(config.input, 'report.json'), reportBytes = readFileSync(reportPath), report = JSON.parse(reportBytes);
  assert.equal(report.schema, 'cuberoot.opt8.production-profile.v1'); assert.equal(report.complete, true);
  assert.equal(report.diagnostic, true); assert.equal(report.performanceEligible, false);
  const exit = json(resolve(config.input, 'rust/exit.json')); assert.equal(exit.code, 0); assert.equal(exit.signal, null);
  assert.equal(report.profiler.logsClosedAfterExit, true); assert.equal(report.profiler.disassemblyFunctionIndex, 12);
  assert.equal(hash(readFileSync(resolve(config.input, 'input.json'))), report.inputSha256);
  const dumpBytes = readFileSync(resolve(config.input, 'rust/stdout.log'));
  const versions = parseWasmDisassembly(dumpBytes.toString(), 12);
  mkdirSync(config.out); mkdirSync(resolve(config.out, 'processed'));
  const isolates = [], aggregate = new Map();
  for (const log of report.profiler.logs) {
    assert(/^isolate-[0-9a-fx]+-\d+-v8\.log$/.test(log.name));
    const path = resolve(config.input, 'profiles', log.name), stat = lstatSync(path);
    assert(stat.isFile() && stat.size === log.bytes);
    const digest = createHash('sha256'), accumulator = new PcAccumulator(versions);
    const stream = createReadStream(path); stream.on('data', chunk => digest.update(chunk));
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) accumulator.accept(line);
    assert.equal(digest.digest('hex'), log.sha256, `Profile log differs: ${log.name}`);
    const processed = resolve(config.out, 'processed', `${log.name}.txt`), processor = await processIsolate(path, processed, config.processed);
    const text = readFileSync(processed, 'utf8'), self = parseSelfTicks(text), pc = accumulator.result();
    for (const bin of pc.bins) {
      const key = `${bin.version}:${bin.offset}`, old = aggregate.get(key) ?? { ...bin, ticks: 0, pcs: [] };
      old.ticks += bin.ticks;
      for (const point of bin.pcs) { const existing = old.pcs.find(p => p.offset === point.offset);
        if (existing) existing.ticks += point.ticks; else old.pcs.push({ ...point }); }
      aggregate.set(key, old);
    }
    const full = { name: log.name, sha256: log.sha256, processor, processedSha256: hash(Buffer.from(text)), ...self, ...pc };
    save(resolve(config.out, `${log.name}.json`), full);
    isolates.push({ ...full, bins: pc.bins.slice(0, 15).map(bin => annotateBin(bin, versions)) });
  }
  const result = { schema: 'cuberoot.opt8.profile-analysis.v1', diagnostic: true, performanceEligible: false,
    reportSha256: hash(reportBytes), stdoutSha256: hash(dumpBytes), wasmSha256: report.artifacts.rust.sha256.wasm,
    sourceNode: report.profiler.node, analysisNode: process.version, functionIndex: 12,
    codeVersions: versions.map(({ instructions, ...version }) => ({ ...version, instructionCount: instructions.length })), isolates,
    aggregatePcBins: [...aggregate.values()].sort((a,b)=>b.ticks-a.ticks).slice(0,40)
      .map(bin => annotateBin({ ...bin, pcs: bin.pcs.sort((a,b)=>b.ticks-a.ticks) }, versions)),
    limitations: ['Raw PC bins count only leaf PC self samples, not caller stack entries or wall time.',
      'V8 labels WASM as JS in profiler tables. Inline operations share the compiled function name.',
      'PC mapping requires exact same-run code start, byte size and name at the log event. Ambiguous/reused or moved bodies are not guessed.',
      'Nearest source positions are V8 anchors, not exact Rust source lines. Isolate IDs are not worker indices.',
      'Instruction samples alone do not prove cache misses, memory bandwidth saturation or an optimization speedup.'] };
  save(resolve(config.out, 'analysis.json'), result); return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  analyzeProfile(parseAnalysisArguments(process.argv.slice(2))).then(result => console.log(JSON.stringify({
    isolates: result.isolates.length, codeVersions: result.codeVersions.length, functionSelfTicks: result.isolates.reduce((s,i)=>s+i.functionSelfTicks,0) })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
