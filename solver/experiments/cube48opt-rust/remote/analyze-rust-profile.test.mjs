import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnalysisArguments, parseSelfTicks, parseWasmDisassembly, PcAccumulator } from './analyze-rust-profile.mjs';

const dump = `--- WebAssembly code ---
name: search_loop
index: 12
kind: wasm function
compiler: TurboFan
Body (size = 80 = 75 + 5 padding)
Instructions (size = 70)
0x1000     0  55  push rbp
0x1001     1  4889e5  movq rbp,rsp
0x1040    40  c3  retl
Source positions:
 pc offset  position
        40        123  statement

--- End code ---
`;
test('same-run native body parses hexadecimal offsets and exact function index', () => {
  const v = parseWasmDisassembly(dump)[0]; assert.equal(v.start,'0x1000'); assert.equal(v.size,80);
  assert.equal(v.instructions[2].offset,64); assert.deepEqual(v.sourcePositions,[{nativeOffset:64,v8Position:123}]);
  assert.throws(()=>parseWasmDisassembly(dump,13)); assert.throws(()=>parseWasmDisassembly(dump.replace('0x1040','0x1041')));
});
test('PC bins require already registered exact body, expire on address reuse, and refuse ambiguous/moved code', () => {
  const versions = parseWasmDisassembly(dump), pc = new PcAccumulator(versions);
  for(const line of ['tick,0x1001,1,0,0x0,0','code-creation,JS,4,2,0x1000,80,search_loop,0x9,*',
    'tick,0x1001,3,0,0x0,0','tick,0x1040,4,0,0x0,0','code-creation,JS,1,5,0x1000,80,other,0x9,*','tick,0x1001,6,0,0x0,0']) pc.accept(line);
  assert.equal(pc.result().totalRawTicks,4); assert.equal(pc.result().functionSelfTicks,2); assert.equal(pc.result().bins.length,2);
  const moved = new PcAccumulator(versions); moved.accept('code-creation,JS,4,2,0x1000,80,search_loop,0x9,*');
  moved.accept('code-move,0x1000,0x2000'); moved.accept('tick,0x1001,6,0,0x0,0');
  assert.equal(moved.result().movedTargetCode,1); assert.equal(moved.result().functionSelfTicks,0);
  const ambiguous = new PcAccumulator([...versions,{...versions[0],id:1,compiler:'Liftoff'}]);
  ambiguous.accept('code-creation,JS,4,2,0x1000,80,search_loop,0x9,*');
  assert.equal(ambiguous.result().ambiguousCreations,1);
});
test('CLI is report-only and tick summary excludes bottom-up duplicate counts', () => {
  assert.equal(parseAnalysisArguments(['--input','/old','--out','/new']).processed,null);
  assert.throws(()=>parseAnalysisArguments(['--input','/old','--solve','/new']));
  const result = parseSelfTicks(`Statistical profiling result (10 ticks, 1 unaccounted, 0 excluded).
 [JavaScript]:
 ticks total nonlib name
      8   80.0%   88.9%  JS: *search_loop
 [C++]:
 [Bottom up (heavy) profile]:
      8   80.0% JS: *search_loop
`);
  assert.equal(result.topSelfTicks.length,1); assert.equal(result.topSelfTicks[0].ticks,8);
});
