import assert from 'node:assert/strict';
import test from 'node:test';
import { resumePolicy, resumeRequest } from './original-resume-policy.mts';
import { parseWasmBenchmarkArguments } from './wasm-benchmark.mjs';
test('resume permits only the exact original Opt9 suffix command',()=>{
  const r=resumeRequest(); const p=resumePolicy(r);
  assert.equal(p.wasmThreads,16);assert.equal(p.originalResume,true);
  assert.equal(parseWasmBenchmarkArguments(r.args.slice(1)).engine,'original');
  for(const changed of [{...r,label:r.label+'again'},{...r,args:r.args.slice(0,-4)},
    {...r,env:{...r.env,CUBEOPT_SEARCH_THREADS:'8'}}]) assert.throws(()=>resumePolicy(changed));
  const a=r.args.slice(1);a[a.indexOf('--engine')+1]='rust';
  assert.throws(()=>parseWasmBenchmarkArguments(a));
});
