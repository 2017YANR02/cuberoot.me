import {test} from 'node:test';import assert from 'node:assert/strict';
import {deploymentState,deploymentProgress} from './deployments.ts';
const run=(name:string,headSha:string,conclusion:string,status='completed')=>({name,headSha,conclusion,status});
test('a failed API checkpoint can recover via a newer deployment without redeploying successful web jobs',()=>{
 const old=[run('API','old','failure'),run('Web','old','success')];
 assert.equal(deploymentState('old',['API','Web'],old,()=>false),'failure');
 assert.equal(deploymentState('old',['API','Web'],[...old,run('API','repair','','in_progress')],s=>s==='repair'),'pending');
 assert.equal(deploymentState('old',['API','Web'],[...old,run('API','repair','success')],s=>s==='repair'),'success');
 assert.equal(deploymentState('old',['API','Web'],[...old,run('API','unrelated','success')],()=>false),'failure');
 assert.equal(deploymentState('old',['API','Web'],[run('API','old','success')],()=>false),'pending');
});
test('progress uses the same successful or pending replacement as the deployment gate',()=>{
 const rows=[{...run('API','repair','','pending'),databaseId:2},{...run('API','old','failure'),databaseId:1}];
 assert.deepEqual(deploymentProgress('old',['API','Web'],rows,s=>s==='repair'),[
  {name:'API',runId:2,state:'queued'},{name:'Web',runId:null,state:'queued'}]);
 rows[0]={...run('API','repair','success'),databaseId:2};
 assert.equal(deploymentProgress('old',['API'],rows,s=>s==='repair')[0].state,'success');
});
