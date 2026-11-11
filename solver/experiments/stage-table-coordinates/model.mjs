import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync('solver/src/cube_common.rs', 'utf8');
const section = source.slice(source.indexOf('pub const MOVE_STATES'), source.indexOf('#[inline]', source.indexOf('pub const MOVE_STATES')));
const rows = [...section.matchAll(/make_move\(\s*(\[[\s\S]*?\]),\s*(Z0|\[[\s\S]*?\]),\s*(\[[\s\S]*?\]),\s*(Z0E|\[[\s\S]*?\]),\s*\)/g)].map(m => m.slice(1).map((x,i) => x.startsWith('Z') ? Array(i === 1 ? 8 : 12).fill(0) : JSON.parse(x)));
assert.equal(rows.length, 18);
const C = [[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]];
const E = [[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[0,1,-1],[1,1,0],[0,1,1],[-1,1,0],[0,-1,-1],[1,-1,0],[0,-1,1],[-1,-1,0]];
const faces = [[0,1,0],[0,-1,0],[-1,0,0],[1,0,0],[0,0,1],[0,0,-1]];
const mod = (x,b) => (x%b+b)%b, key = a => a.join(',');
const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const mul = (n,k) => { let p=1; for(let i=0;i<k;i++)p*=n-i; return p; };
const count = (n,k,b) => mul(n,k)*b**k;
const permSign = p => { let inv=0; for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(p[i]>p[j])inv++; return inv%2?-1:1; };
const steps = [C,E].map((positions,kind) => rows.map(row => {
  const pp=row[kind*2], oo=row[kind*2+1];
  return positions.map((_,p) => { const q=pp.indexOf(p); return [q,oo[q]]; });
}));
let checks=0;
const syms=[];
for(const perm of perms)for(let signs=0;signs<8;signs++){
  const sg=[0,1,2].map(i=>signs>>i&1?-1:1), det=permSign(perm)*sg.reduce((a,b)=>a*b,1);
  const transform=v=>perm.map((p,i)=>sg[i]*v[p]);
  const maps=[C,E].map(pos=>pos.map(p=>pos.findIndex(q=>key(q)===key(transform(p)))));
  const faceMap=faces.map(f=>faces.findIndex(q=>key(q)===key(transform(f))));
  const moveMap=Array.from({length:18},(_,m)=>faceMap[Math.floor(m/3)]*3+(det<0?[2,1,0][m%3]:m%3));
  const offsets=[];
  for(let kind=0;kind<2;kind++){
    const b=kind===0?3:2, sign=kind===0?det:1, g=maps[kind], st=steps[kind];
    const off=Array(g.length).fill(null);off[0]=0;
    let changed=true;
    while(changed){changed=false;for(let p=0;p<g.length;p++)if(off[p]!==null)for(let m=0;m<18;m++){
      const [q,d]=st[m][p], [gq,gd]=st[moveMap[m]][g[p]];
      assert.equal(gq,g[q]);
      const v=mod(off[p]+gd-sign*d,b);
      if(off[q]===null){off[q]=v;changed=true;}else assert.equal(off[q],v);
    }}
    assert(off.every(v=>v!==null));
    // T(label,pos,ori) = (g(label),g(pos), sign*ori + off[pos]-off[label]).
    // Validate all identities, positions, orientations and all 18 moves.
    for(let label=0;label<g.length;label++)for(let p=0;p<g.length;p++)for(let o=0;o<b;o++)for(let m=0;m<18;m++){
      const [q,d]=st[m][p], [gq,gd]=st[moveMap[m]][g[p]];
      assert.equal(gq,g[q]);
      assert.equal(mod(sign*(o+d)+off[q]-off[label],b),mod(sign*o+off[p]-off[label]+gd,b));checks++;
    }
    offsets.push(off);
  }
  syms.push({perm,sg,det,maps,offsets,moveMap});
}
const cycles = (map, subset=map.map((_,i)=>i)) => {
  const todo=new Set(subset), out=[];
  while(todo.size){const start=todo.values().next().value, c=[];let p=start;do{assert(todo.delete(p));c.push(p);p=map[p];}while(p!==start);out.push(c);}
  return out;
};
// Count fixed oriented injective labelled partial states by cycle matching.
// Memoized used-cycle masks keep this small even for identity on seven edges.
function fixed(s,kind,labels){
  const b=kind===0?3:2, sign=kind===0?s.det:1, g=s.maps[kind], off=s.offsets[kind];
  const lc=cycles(g,labels), pc=cycles(g), memo=new Map();
  const weights=lc.map(l=>pc.map(p=>{
    if(l.length!==p.length)return 0;let ways=0;
    for(let phase=0;phase<p.length;phase++)for(let q=0;q<b;q++){
      let o=q;for(let i=0;i<l.length;i++)o=mod(sign*o+off[p[(phase+i)%p.length]]-off[l[i]],b);
      if(o===q)ways++;
    }
    return ways;
  }));
  function walk(i,used){if(i===lc.length)return 1;const k=i*4096+used;if(memo.has(k))return memo.get(k);let n=0;for(let j=0;j<pc.length;j++)if(!(used>>j&1)&&weights[i][j])n+=weights[i][j]*walk(i+1,used|(1<<j));memo.set(k,n);return n;}
  return walk(0,0);
}
const goals={
  first_layer:{c:[4,5,6,7],e:[8,9,10,11]},
  f2b_f2l_shared_c4_middle_e4:{c:[4,5,6,7],e:[0,1,2,3]},
  f2b_full:{c:[4,5,6,7],e:[0,1,2,3,9,11]},
  std_add_corner_c3_e6:{c:[4,5,6],e:[0,2,8,9,10,11]},
  std_add_edge_c2_e7:{c:[4,6],e:[0,1,2,8,9,10,11]},
  std_three_slots_full:{c:[4,5,6],e:[0,1,2,8,9,10,11]},
  std_four_slots_full:{c:[4,5,6,7],e:[0,1,2,3,8,9,10,11]},
  block223_full:{c:[4,7],e:[0,3,8,10,11]},
};
const result={source:'solver/src/cube_common.rs MOVE_STATES', checks, symmetries:syms.length, allocation:'Only 48 small transformations plus cycle-count memoization; no cube tables, BFS, solver or analyzer', goals:{}};
for(const [name,goal]of Object.entries(goals)){
  const stable=syms.filter(s=>[goal.c,goal.e].every((set,k)=>set.every(i=>set.includes(s.maps[k][i]))));
  let jointFixed=0,cFixed=0;
  const facts=stable.map(s=>{
    for(let kind=0;kind<2;kind++)for(const id of [goal.c,goal.e][kind])assert.equal(mod(s.offsets[kind][id]-s.offsets[kind][id],kind===0?3:2),0);
    const fc=fixed(s,0,goal.c),fe=fixed(s,1,goal.e);jointFixed+=fc*fe;cFixed+=fc;
    return {perm:s.perm,sg:s.sg,det:s.det,cornerMap:s.maps[0],edgeMap:s.maps[1],cornerOffsets:s.offsets[0],edgeOffsets:s.offsets[1],cornerFixed:fc,edgeFixed:fe};
  });
  const nc=count(8,goal.c.length,3),ne=count(12,goal.e.length,2),raw=nc*ne,orbits=jointFixed/stable.length,cornerOrbits=cFixed/stable.length;
  assert(Number.isInteger(orbits));assert(Number.isInteger(cornerOrbits));
  result.goals[name]={goal,states:raw,raw4bitBytes:raw/2,raw4bitGiB:raw/2/2**30,raw5bitGiB:raw*5/8/2**30,rawByteGiB:raw/2**30,stabilizerOrder:stable.length,properCount:stable.filter(s=>s.det===1).length,orbitCount:orbits,orbit4bitGiB:orbits/2/2**30,cornerOrbits,cornerRow4bitBytes:cornerOrbits*ne/2,cornerRow4bitGiB:cornerOrbits*ne/2/2**30,symmetries:facts};
}
result.extra={DRstates:2048*2187*495,DR4bitGiB:2048*2187*495/2/2**30,edge7MoveGiB:count(12,7,2)*18*4/2**30,edge6MoveGiB:count(12,6,2)*18*4/2**30,F2B_current_pt9_bytes:504*10560*504/2,F2B_dense_c4e3_bytes:136080*10560/2,edge6_position_mask_map_bytes:mul(12,6)*2,edge7_residual_transition_bytes:924*12*18};
writeFileSync('.local-data/stage-table-audit-20261110/model-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks,goals:Object.fromEntries(Object.entries(result.goals).map(([k,v])=>[k,{states:v.states,raw4bitGiB:v.raw4bitGiB,raw5bitGiB:v.raw5bitGiB,stabilizerOrder:v.stabilizerOrder,properCount:v.properCount,orbit4bitGiB:v.orbit4bitGiB,cornerOrbits:v.cornerOrbits,cornerRow4bitGiB:v.cornerRow4bitGiB}])),extra:result.extra},null,2));
