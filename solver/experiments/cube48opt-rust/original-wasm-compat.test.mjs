import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mailboxOld, mailboxFixed, patchOriginalWrapper } from './original-wasm-compat.mjs';

test('upstream mailbox fails on the real synchronous waitAsync result; patched branch yields safely',()=>{
  const array=new Int32Array(new SharedArrayBuffer(4));
  const wait=Atomics.waitAsync(array,0,123);
  assert.equal(wait.async,false);assert.equal(wait.value,'not-equal');
  assert.throws(()=>new Function('wait','checkMailbox',mailboxOld)(wait,()=>{}),TypeError);
  const callbacks=[],logs=[];
  new Function('wait','checkMailbox','setTimeout','Module',mailboxFixed)(wait,()=>{},fn=>callbacks.push(fn),{printErr:line=>logs.push(line)});
  assert.equal(callbacks.length,1);assert.equal(logs.length,1);
});
test('async notifications remain unchanged, wrapper patch cannot silently drift',async()=>{
  let calls=0;
  new Function('wait','checkMailbox','setTimeout','Module',mailboxFixed)({async:true,value:Promise.resolve('ok')},()=>calls++,()=>assert.fail(),{});
  await Promise.resolve();assert.equal(calls,1);
  for (const variant of [8,9]) {
    const source=readFileSync(new URL(`../../../core/packages/client/public/cubeopt/cube48opt${variant}.mjs`,import.meta.url),'utf8');
    const patched=patchOriginalWrapper(source);assert(patched.includes(mailboxFixed));assert.throws(()=>patchOriginalWrapper(patched));
  }
});
