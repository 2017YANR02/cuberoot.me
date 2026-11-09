import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root, temporaryReferences, temporaryWrite, checkRepository} from './check.mjs';
import {relocatedArtifactPath} from './paths.mjs';
test('persistent runtime dependencies fail; ephemeral and atomic writes remain valid',()=>{
 assert.equal(temporaryReferences('solver/new.mts',"readFileSync('.tmp/new-engine/table.dat')").length,1);
 assert.equal(temporaryReferences('solver/new.mts',"readFileSync('.tmp/cache/table.dat')").length,1);
 assert.equal(temporaryReferences('core/scripts/job.ts',"resolve(root, '.tmp', 'checkpoint.json')").length,1);
 assert.deepEqual(temporaryReferences('core/scripts/job.ts',"writeFileSync(path + '.tmp', data); renameSync(path + '.tmp', path)"),[]);
 assert.deepEqual(temporaryReferences('core/scripts/job.ts',"writeFileSync('.tmp/scratch/request.txt', data)"),[]);
 assert(temporaryWrite('.tmp/scratch/checkpoint.json'));
 assert(temporaryWrite('.tmp/runtime/table.dat'));
 assert.equal(temporaryWrite('.tmp/png/preview.png'),null);
 assert.equal(temporaryWrite('.local-data/jobs/checkpoint.json'),null);
});
test('frozen paths resolve on both machines without accepting arbitrary relative traversal',()=>{
 assert.throws(()=>relocatedArtifactPath('../../outside'));
 assert.throws(()=>relocatedArtifactPath('.tmp/cubeopt-reverse/../../../outside'));
 const expected=resolve(root,'.local-data/cubeopt-reverse/opt9-generated/small-memory.bin');
 assert.equal(relocatedArtifactPath('/Users/eula/Developer/cuberoot.me/.tmp/cubeopt-reverse/opt9-generated/small-memory.bin'),expected);
 assert.equal(relocatedArtifactPath('/Users/cuberoot/Developer/cuberoot.me/.tmp/cubeopt-reverse/opt9-generated/small-memory.bin'),expected);
});
test('write adapter receives a deny with exit zero',()=>{
 const result=spawnSync(process.execPath,['.codex/hooks/adapt-codex-write-payload.mts','.codex/hooks/block-persistent-temp.mts'],{
  cwd:root,encoding:'utf8',input:JSON.stringify({tool_input:{command:'*** Begin Patch\n*** Add File: .tmp/official-table.dat\n+bad\n*** End Patch'}})});
 assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision,'deny');
});
test('tracked runtime paths comply with the reviewed lifecycle policy',()=>assert.deepEqual(checkRepository(),[]));
