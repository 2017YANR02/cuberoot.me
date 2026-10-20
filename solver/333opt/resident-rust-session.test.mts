import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { ResidentRustSession } from './resident-rust-session.mts';

const script = `
const rl = require('node:readline').createInterface({input:process.stdin});
rl.on('line', line => {
  const [id,mode]=line.split('\\t');
  if(mode==='exit')process.exit(7);
  const row=JSON.stringify({id:mode==='unknown'?'999999':id,solution:'U',length:1,cancelled:false});
  process.stdout.write(row+'\\n');
  if(mode==='duplicate')process.stdout.write(row+'\\n');
});`;
function session() { return new ResidentRustSession(spawn(process.execPath, ['-e',script], {stdio:['pipe','pipe','ignore']})); }
test('one PID serves separate batches without EOF, including an empty resumed batch', async () => {
  const s=session(), pid=s.child.pid, got:string[]=[];
  try {
    const rows=Array.from({length:150},(_,id)=>({id,scramble:'U'}));
    await s.run(rows,(_raw,csv)=>got.push(csv));
    await s.run([],()=>assert.fail());
    await new Promise(r=>setTimeout(r,20));
    assert.equal(s.child.exitCode,null); assert.equal(s.child.pid,pid);
    await s.run([{id:200,scramble:'R'}],(_raw,csv)=>got.push(csv));
    assert.deepEqual(got,[...rows.map(r=>`${r.id},1,U`),'200,1,U']);
    await s.finish(); assert.equal(s.child.exitCode,0);
  } finally { s.child.kill(); }
});
test('unexpected output, invalid verification and premature exit fail closed', async () => {
  for(const mode of ['unknown','exit','verify']){
    const s=session();
    try {
      await assert.rejects(s.run([{id:0,scramble:mode}],()=>{if(mode==='verify')throw Error('verification failed');}));
      await s.closed;
      await assert.rejects(s.run([{id:1,scramble:'U'}],()=>assert.fail()));
    } finally {s.child.kill();}
  }
});
test('duplicate result after the last row poisons the session before another batch', async () => {
  const s=session();
  try {
    await s.run([{id:0,scramble:'duplicate'}],()=>{}).catch(()=>{});
    await s.closed;
    await assert.rejects(s.run([{id:1,scramble:'U'}],()=>assert.fail()),/duplicate/);
  } finally {s.child.kill();}
});
