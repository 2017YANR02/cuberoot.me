import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { openBase } from './open-benchmark-policy.mts';
import { candidateRequest,candidatePolicy } from './opt9-wasm-candidate-policy.mts';
test('candidate cannot rerun original, alter protocol, or evade shared-memory budget',()=>{
  const r=candidateRequest(resolve(openBase,'rust-wasm-shared-builds/build-fixture/cube48opt-rust8.wasm'));
  const p=candidatePolicy(r);assert.equal(p.wasmThreads,16);assert.equal(p.rssLimit,19778730352);
  for(const [flag,value] of [['--engine','original'],['--threads','4'],['--cases','100'],['--out','/tmp/elsewhere']]) {
    const args=[...r.args];args[args.indexOf(flag)+1]=value;assert.throws(()=>candidatePolicy({...r,args}));
  }
  assert.throws(()=>candidatePolicy({...r,label:r.label+'-again'}));
  assert.throws(()=>candidatePolicy({...r,env:{...r.env,CUBEOPT_SEARCH_THREADS:'16'}}));
});
