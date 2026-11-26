import {expect,it} from 'vitest';
import {getCube3} from '@cuberoot/shared/recon/cube3';
import {checkedStateExplanation} from '../src/utils/site_assistant_state_questions.js';

const prompt=(n:number,m:number)=>
  `In the cube game, n=${n}, m=${m}. You cannot reverse immediately, but can reverse from a different state.`;

// Verify the defender certificate off the response path. Projecting onto four
// labelled edges is sufficient for evasion: the full cube cannot be solved
// while any one of these four edges is displaced or flipped.
it('verifies every small boundary pair on the reachable four-edge graph',async()=>{
  const cube=await getCube3();
  const words=[...'URFDLB'].flatMap(face=>[face,face+"'",face+'2']);
  const moves=words.map(word=>{
    const move=cube.algToTransformation(word).transformationData.EDGES;
    return Array.from({length:24},(_,edge)=>{
      const slot=move.permutation.indexOf(edge>>1);
      return slot*2+((edge&1)^move.orientationDelta[slot]);
    });
  });
  const encode=(a:number,b:number,c:number,d:number)=>((a*24+b)*24+c)*24+d;
  const size=12*11*10*9*16;
  const home=encode(0,10,16,20);
  const keys=[home],index=new Int32Array(24**4).fill(-1);
  index[home]=0;
  const distance=new Uint8Array(size),next=new Int32Array(size*18);
  for (let id=0;id<keys.length;id++) {
    let value=keys[id];
    const d=value%24; value=Math.floor(value/24);
    const c=value%24; value=Math.floor(value/24);
    const b=value%24,a=Math.floor(value/24);
    moves.forEach((move,t)=>{
      const key=encode(move[a],move[b],move[c],move[d]);
      if (index[key]<0) {
        index[key]=keys.length; keys.push(key);
        distance[index[key]]=distance[id]+1;
      }
      next[id*18+t]=index[key];
    });
  }
  expect(keys.length).toBe(190080);
  expect(distance[keys.length-1]).toBe(8);

  // After a defender's last move, the player can choose any first turn
  // except its inverse; after that first turn every HTM turn is available.
  const playerDistance=new Uint8Array(size*18);
  const inverse=words.map((_,t)=>t-t%3+[1,0,2][t%3]);
  for (let id=1;id<size;id++) for (let last=0;last<18;last++) {
    let shortest=Infinity;
    for (let t=0;t<18;t++) if (t!==inverse[last]) shortest=Math.min(shortest,1+distance[next[id*18+t]]);
    playerDistance[id*18+last]=shortest;
  }
  for (let n=1;n<=7;n++) {
    let canFinish=new Uint8Array(size);
    for (let m=1;m<=n;m++) {
      const canStart=new Uint8Array(size);
      let minimum=18;
      for (let id=1;id<size;id++) {
        let choices=0;
        for (let turn=0;turn<18;turn++) {
          const dest=next[id*18+turn];
          if (dest!==0 && (m===1 ? playerDistance[dest*18+turn]>n : canFinish[dest])) choices++;
        }
        minimum=Math.min(minimum,choices);
        canStart[id]=Number(choices>0);
      }
      canFinish=canStart;
      if (m===n || m===n-1) {
        expect(minimum).toBeGreaterThanOrEqual(2);
        expect(await checkedStateExplanation(prompt(n,m),'en')).toContain('at least '+minimum+' candidate first turns');
      }
    }
  }
},20_000);

it('reports each proven and undecided budget separately',async()=>{
  const counts={win:0,evade:0,unknown:0};
  for (let n=1;n<20;n++) for (let m=0;m<=n;m++) {
    const answer=await checkedStateExplanation(prompt(n,m),'en');
    if (m===0 || n>=m+2) {expect(answer).toMatch(/^Yes\./);counts.win++;}
    else if (n<=7) {expect(answer).toMatch(/^You cannot force/);counts.evade++;}
    else {expect(answer).toContain('do not decide n='+n+', m='+m);counts.unknown++;}
  }
  expect(counts).toEqual({win:172,evade:13,unknown:24});
  expect(await checkedStateExplanation(prompt(4,3)+' All reverse edges remain forbidden throughout the block.','en')).toContain('requires tracking');
  expect(await checkedStateExplanation('对抗魔方禁止立即撤销末步。哪些组合 n<20、m≤n 必胜？','zh')).toContain('剩余 24 组');
});
