// Sparse memory64 regression: reserve address space, touch only small snapshots
// and arenas. No pruning-table payload, lookup or full search is performed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instantiate } from './cube48opt-rust8-worker.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
const compiled=await WebAssembly.compile(readFileSync(process.argv[2]));
const snapshot=readFileSync(resolve(ROOT,'.tmp/cubeopt-reverse/opt8-generated/small-memory.bin'));
const corpus=JSON.parse(readFileSync(resolve(ROOT,'solver/testdata/benchmarks/wca-first100.json')));
assert.equal(corpus.cases.length,100);
const memory=new WebAssembly.Memory({initial:131072n,maximum:262144n,shared:true,address:'i64'});
const master=await instantiate(compiled,memory);
new Uint8Array(memory.buffer,Number(master.api.cubeopt_snapshot_ptr()),snapshot.length).set(snapshot);
const expected=[],regions=[16*2**20,2**32,7*2**30];
let checked=0;
for(const [regionIndex,region] of regions.entries()) {
  const {api}=await instantiate(compiled,memory,region);
  const handle=api.cubeopt_fixture_create(0,4,8);assert.notEqual(handle,0n);
  const output=()=>new TextDecoder().decode(new Uint8Array(memory.buffer,
    Number(api.cubeopt_output_ptr(handle)),Number(api.cubeopt_output_len(handle))));
  for(const [index,item] of corpus.cases.entries()) {
    const input=new TextEncoder().encode(item.scramble);
    new Uint8Array(memory.buffer,Number(api.cubeopt_input_ptr(handle)),input.length).set(input);
    assert.equal(api.cubeopt_begin(handle,BigInt(input.length)),0);
    assert.equal(api.cubeopt_fixture_coordinate(handle,BigInt(input.length)),0,`region=${region}, case=${item.id}: ${output()}`);
    if(regionIndex===0) expected.push(output());
    else assert.equal(output(),expected[index],`high-address coordinate differs for ${item.id}`);
    checked++;
  }
}
console.log(JSON.stringify({regions,checked,pdbBytes:0,execArgv:process.execArgv,maxRssBytes:process.resourceUsage().maxRSS*1024}));
