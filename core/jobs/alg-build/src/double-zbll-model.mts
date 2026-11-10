import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
export const root=resolve(import.meta.dirname,'../../../..');
const req=createRequire(resolve(root,'core/jobs/alg-build/package.json'));
const {cube3x3x3}=await import(resolve(root,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js'));
const {Alg}=await import(resolve(root,'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/alg/index.js'));
export const {normalizeWcaScramble:normalize}=await import(req.resolve('@cuberoot/shared/normalize-wca-scramble'));
export const kp=await cube3x3x3.kpuzzle();
export const invert=(s:string)=>new Alg(s).invert().toString();
export const key=(p:any)=>JSON.stringify([p.EDGES,p.CORNERS]);
export const pattern=(s:string)=>key(kp.defaultPattern().applyAlg(s).patternData);
export const solved=pattern('');
const source=JSON.parse(readFileSync(resolve(root,'.local-data/double-zbll-v1/source.json'),'utf8'));
const pll=JSON.parse(readFileSync(resolve(root,'.local-data/double-zbll-auf-20261011/pll-source.json'),'utf8'));
export const file={...source,cases:[...source.cases,...pll.cases.map((c: {subgroup:string})=>({...c,subgroup:'PLL/'+c.subgroup}))]};
export const cases=file.cases;
export const moves=['U',"U'",'U2','R',"R'",'R2','F',"F'",'F2','D',"D'",'D2','L',"L'",'L2','B',"B'",'B2'];
const aufs=['','U','U2',"U'"];
export const states:{caseIndex:number;phase:number;alg:string;key:string}[]=[];
export const phases:number[][]=[];
const lookup=new Map<string,number>();
const home=(o:any,i:number)=>o.pieces[i]===i&&o.orientation[i]===0;
for(let c=0;c<cases.length;c++){
 const base=normalize(cases[c].meta?.optimal?.htm?.scramble||cases[c].setup);phases[c]=[];
 for(let phase=0;phase<16;phase++){
  const alg=normalize(`${aufs[phase&3]} ${base} ${aufs[phase>>2]}`);
  const p=kp.defaultPattern().applyAlg(alg).patternData;
  if(![4,5,6,7,8,9,10,11].every(i=>home(p.EDGES,i))||![4,5,6,7].every(i=>home(p.CORNERS,i)))throw Error('Not isolated '+c);
  const k=key(p);let id=lookup.get(k);
  if(id===undefined){id=states.length;lookup.set(k,id);states.push({caseIndex:c,phase,alg,key:k});}
  else if(states[id].caseIndex!==c)throw Error('Cases overlap');
  phases[c].push(id);
 }
}
export const N=states.length;
export const rotations=['','y','y2',"y'",'x2','y x2','y2 x2',"y' x2"];
export const rot=rotations.slice(0,4).map(r=>Int32Array.from(states.map(s=>{
 const i=lookup.get(pattern(`${r} ${s.alg} ${invert(r)}`));if(i===undefined)throw Error('Rotation not closed');return i;
})));
export function image(a:number,b:number,g:number):number{
 const k=g%4;return rot[k][g<4?a:b]*N+rot[(4-k)%4][g<4?b:a];
}
export function canonical(a:number,b:number):{id:number;g:number}{
 let id=a*N+b,g=0;for(let i=1;i<8;i++){const x=image(a,b,i);if(x<id){id=x;g=i;}}return {id,g};
}
export const setup=(id:number)=>`${states[Math.floor(id/N)].alg} x2 ${states[id%N].alg} x2`;
// Each rotation permutes the 18 HTM generators bijectively, preserving distance.
const moveMaps=rotations.map(r=>moves.map(m=>{
 const target=pattern(`${r} ${m} ${invert(r)}`),match=moves.find(n=>pattern(n)===target);
 if(!match)throw Error('Non-HTM conjugate');return match;
}));
export function transform(alg:string,g:number):string{
 return alg.trim().split(/\s+/).filter(Boolean).map(m=>{const i=moves.indexOf(m);if(i<0)throw Error('Invalid HTM '+m);return moveMaps[g][i];}).join(' ');
}
export const inverseRotation=rotations.map(r=>rotations.findIndex(t=>kp.algToTransformation(`${r} ${t}`).isIdentityTransformation()));
const bottomLookup=new Map(states.map((s,i)=>[pattern(`x2 ${s.alg} x2`),i]));
export function identify(alg:string):number{
 const p=kp.defaultPattern().applyAlg(alg).patternData,top=structuredClone(kp.defaultPattern().patternData),bottom=structuredClone(kp.defaultPattern().patternData);
 for(const orbit of ['EDGES','CORNERS'])for(let i=0;i<4;i++){top[orbit].pieces[i]=p[orbit].pieces[i];top[orbit].orientation[i]=p[orbit].orientation[i];}
 for(const orbit of ['EDGES','CORNERS'])for(let i=4;i<8;i++){bottom[orbit].pieces[i]=p[orbit].pieces[i];bottom[orbit].orientation[i]=p[orbit].orientation[i];}
 const a=lookup.get(key(top)),b=bottomLookup.get(key(bottom));
 if(a===undefined||b===undefined||![8,9,10,11].every(i=>home(p.EDGES,i)))throw Error('Unrecognized pair');return a*N+b;
}
export const fix=rot.map(m=>m.reduce((n,x,i)=>n+(x===i?1:0),0));
export const orbitCount=(N*N+fix[1]**2+fix[2]**2+fix[3]**2+4*N)/8;
