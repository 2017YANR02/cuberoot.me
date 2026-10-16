import assert from 'node:assert/strict';
import test from 'node:test';
import { openRequest, openPolicy, openEngines } from './open-benchmark-policy.mts';
import { resourceProtectionReasons } from './guard.mts';
import { parseWasmBenchmarkArguments } from './wasm-benchmark.mjs';

test('review is restricted to the three exact Opt9 single-pass commands',()=>{
  for(const engine of openEngines) {
    const request=openRequest(engine);assert.equal(openPolicy(request).variant,9);
    assert.throws(()=>openPolicy({...request,label:request.label+'-retry'}));
    assert.throws(()=>openPolicy({...request,env:{...request.env,CUBEOPT_SEARCH_THREADS:'18'}}));
    assert.throws(()=>openPolicy({...request,args:[...request.args,'extra']}));
    if(engine!=='rust-native') {
      const config=parseWasmBenchmarkArguments(request.args.slice(1));
      assert.equal(config.count,1000);assert.equal(config.threads,16);assert.equal(config.compiler,'turbofan');
    }
  }
});
test('the newly approved baseline still stops on the first additional swap-out',()=>{
  const before={boot:'same',swapouts:16,pressure:1,available:32*2**30};
  assert.equal(resourceProtectionReasons(before,before,16*2**30,20*2**30,10*2**30).length,0);
  assert(resourceProtectionReasons(before,{...before,swapouts:17},16*2**30,20*2**30,10*2**30).length>0);
});
