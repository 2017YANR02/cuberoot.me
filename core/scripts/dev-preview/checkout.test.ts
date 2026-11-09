import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {syncCheckout} from './checkout.ts';

test('worker updates before executing, preserves unknown work and only resumes recorded artifacts',()=>{
  const base=mkdtempSync(join(tmpdir(),'preview-checkout-'));
  const remote=join(base,'remote'),source=join(base,'source'),worker=join(base,'worker'),state=join(base,'state');
  const git=(cwd:string,...args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    mkdirSync(remote);mkdirSync(source);mkdirSync(state);
    git(remote,'init','--bare','--initial-branch=main');git(source,'init','--initial-branch=main');
    git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'runtime'),'old');git(source,'add','.');git(source,'commit','-m','initial');
    git(source,'remote','add','origin',remote);git(source,'push','-u','origin','main');git(base,'clone',remote,worker);
    git(worker,'config','user.email','test@example.com');git(worker,'config','user.name','Test');
    writeFileSync(join(source,'runtime'),'new');git(source,'commit','-am','runtime update');git(source,'push');
    assert.equal(syncCheckout(worker,state,'test-pc'),true);
    assert.equal(readFileSync(join(worker,'runtime'),'utf8'),'new');
    assert.equal(syncCheckout(worker,state,'test-pc'),false);
    writeFileSync(join(worker,'runtime'),'uncommitted');
    assert.throws(()=>syncCheckout(worker,state,'test-pc'),/Unexpected changed/);
    assert.equal(readFileSync(join(worker,'runtime'),'utf8'),'uncommitted');
    git(worker,'commit','-am','local unrelated change');
    const divergent=git(worker,'rev-parse','HEAD');
    assert.throws(()=>syncCheckout(worker,state,'test-pc'),/history conflicts/);
    assert.equal(git(worker,'rev-parse','HEAD'),divergent);
    writeFileSync(join(state,'test-pc-http.sha'),divergent);
    assert.throws(()=>syncCheckout(worker,state,'test-pc'),/unexpected files/);
    // Fresh worker for a legitimate, unpublished artifact checkpoint.
    const pending=join(base,'pending');git(base,'clone',remote,pending);
    git(pending,'config','user.email','test@example.com');git(pending,'config','user.name','Test');
    mkdirSync(join(pending,'ops/dev-preview'),{recursive:true});writeFileSync(join(pending,'ops/dev-preview/machines.json'),'{}');
    git(pending,'add','.');git(pending,'commit','-m','provision device');
    writeFileSync(join(state,'test-pc-http.sha'),git(pending,'rev-parse','HEAD'));
    assert.equal(syncCheckout(pending,state,'test-pc'),false);
  }finally{rmSync(base,{recursive:true,force:true});}
});
