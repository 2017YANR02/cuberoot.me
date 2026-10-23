import test from 'node:test';
import assert from 'node:assert/strict';
import {request,lllFivePolicy,validateLllFiveSession} from './lll-five-policy.mts';
test('fixed workload and resource history cannot be expanded or reset',()=>{
 const r=request();assert.equal(lllFivePolicy(r).deadlineMs,180000);
 for(const x of [{...r,args:[...r.args.slice(0,-1),'0']},{...r,label:'other'},{...r,env:{...r.env,CUBEOPT_SEARCH_THREADS:'4'}},{...r,env:{...r.env,CUBEOPT_H:'11'}}])assert.throws(()=>lllFivePolicy(x));
 const e={boot:'same boot',swapouts:0},n={...e,pressure:1,available:15565455360+4*2**30};
 const s={schema:'cuberoot.lll-five.session.v1',request:r,evidence:e,...e,preparedAt:new Date().toISOString()};validateLllFiveSession(s,e,n);
 for(const x of [{...n,swapouts:1},{...n,boot:'changed'},{...n,pressure:2},{...n,available:n.available-1}])assert.throws(()=>validateLllFiveSession(s,e,x));
 assert.throws(()=>validateLllFiveSession(s,e,n,true));assert.throws(()=>validateLllFiveSession(s,e,n,false,true));
});
test('explicit retry accepts only its recorded baseline and remains one-use',async()=>{
 const {retryLabel}=await import('./lll-five-policy.mts');const r=request(retryLabel);
 const authorization='那你重新跑吧 现在内存应该是够的';
 const e={boot:'unchanged boot',swapouts:16,continuation:{authorization}};
 const n={boot:e.boot,swapouts:16,pressure:1,available:15565455360+4*2**30};
 const s={schema:'cuberoot.lll-five.session.v1',authorization,request:r,evidence:e,boot:e.boot,swapouts:16,preparedAt:new Date().toISOString()};
 assert.equal(lllFivePolicy(r).scopeStopPath.endsWith('/retry-1/stop.json'),true);validateLllFiveSession(s,e,n);
 assert.throws(()=>validateLllFiveSession({...s,authorization:'automatic'},e,n));
 assert.throws(()=>validateLllFiveSession(s,e,{...n,swapouts:17}));
 assert.throws(()=>validateLllFiveSession(s,e,n,true));assert.throws(()=>validateLllFiveSession(s,e,n,false,true));
});
