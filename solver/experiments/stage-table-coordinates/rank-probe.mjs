import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const report=JSON.parse(readFileSync('.local-data/stage-table-audit-20261110/model-result.json','utf8'));
const syms=report.goals.f2b_f2l_shared_c4_middle_e4.symmetries;
const mod=(x,b)=>(x%b+b)%b;
function decode(i,n,b,pn){let p=Math.floor(i/b**n),o=i%b**n;const free=Array.from({length:pn},(_,j)=>j),v=[];for(let j=0;j<n;j++){const d=p%(pn-j);p=Math.floor(p/(pn-j));v.push([free.splice(d,1)[0],0]);}for(let j=n-1;j>=0;j--){v[j][1]=o%b;o=Math.floor(o/b);}return v;}
function encode(v,b,pn){const free=Array.from({length:pn},(_,j)=>j);let p=0,stride=1,o=0;for(let j=0;j<v.length;j++){const d=free.indexOf(v[j][0]);assert(d>=0);p+=d*stride;stride*=pn-j;free.splice(d,1);o=o*b+v[j][1];}return p*b**v.length+o;}
const canonical=new Uint32Array(136080);const reps=new Set();let transitions=0;
for(let i=0;i<canonical.length;i++){
  const v=decode(i,4,3,8);assert.equal(encode(v,3,8),i);let lowest=i;
  for(const s of syms){const out=Array(4);for(let j=0;j<4;j++){const [pos,ori]=v[j],label=j+4;out[s.cornerMap[label]-4]=[s.cornerMap[pos],mod(s.det*ori+s.cornerOffsets[pos]-s.cornerOffsets[label],3)];}const k=encode(out,3,8);lowest=Math.min(lowest,k);transitions++;}
  canonical[i]=lowest;reps.add(lowest);
}
assert.equal(reps.size,17214);
for(let i=0;i<canonical.length;i++)assert.equal(canonical[canonical[i]],canonical[i]);
const pop=x=>{let n=0;for(;x;x&=x-1)n++;return n;};let residualStates=0;
for(let mask=0;mask<4096;mask++)if(pop(mask)===6){const free=[];for(let p=0;p<12;p++)if(!(mask>>p&1))free.push(p);const seen=new Set();for(let p=0;p<12;p++)if(!(mask>>p&1))for(let o=0;o<2;o++){const rank=2*pop(((1<<p)-1)&~mask)+o;assert.equal(free[Math.floor(rank/2)],p);assert.equal(rank%2,o);seen.add(rank);residualStates++;}assert.equal(seen.size,12);}
const result={coordinate:'labelled corners [4,5,6,7], same mixed-radix layout as array_to_index',cornerStates:canonical.length,cornerRoundtrips:canonical.length,cornerSymmetryTransitions:transitions,cornerOrbits:reps.size,canonicalIdempotent:true,edge7ResidualStates:residualStates,edge7ResidualBijective:true,persistentArrayBytes:canonical.byteLength,heapLimitMiB:32,tableGenerated:false};
writeFileSync('.local-data/stage-table-audit-20261110/rank-probe-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
