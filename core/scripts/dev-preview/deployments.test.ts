import {test} from 'node:test';import assert from 'node:assert/strict';
import {deploymentState} from './deployments.ts';
const run=(name:string,headSha:string,conclusion:string,status='completed')=>({name,headSha,conclusion,status});
test('a failed API checkpoint can recover via a newer deployment without redeploying successful web jobs',()=>{
 const old=[run('API','old','failure'),run('Web','old','success')];
 assert.equal(deploymentState('old',['API','Web'],old,()=>false),'failure');
 assert.equal(deploymentState('old',['API','Web'],[...old,run('API','repair','','in_progress')],s=>s==='repair'),'pending');
 assert.equal(deploymentState('old',['API','Web'],[...old,run('API','repair','success')],s=>s==='repair'),'success');
 assert.equal(deploymentState('old',['API','Web'],[...old,run('API','unrelated','success')],()=>false),'failure');
 assert.equal(deploymentState('old',['API','Web'],[run('API','old','success')],()=>false),'pending');
});
