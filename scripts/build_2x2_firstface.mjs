// build_2x2_firstface.mjs
// Home-grown enumerator for the 2×2 "first-face case gallery": every essentially-different
// arrangement of the four D-face corners, irrelevant (U-face) corners grayed out.
//
// Model: the same validated <U,R,F>, DBL-fixed corner model as build_2x2_essential.mjs
// (reachable first-face sub-states = 945 = shipped "Fixed FF", cross-check).
// A "case" = the arrangement of the D-face pieces at FACE granularity (target pieces
// interchangeable — a solved face needs no fixed permutation), deduped by whole-puzzle
// PHYSICAL reorientation. Dedup is done by masked-facelet canonicalization: the mask grays the
// non-D corners, then we minimise over the 24 rotation facelet-permutations (+24 reflections for
// the mirror fold). Facelet perms are pure geometry (blind to the gray pieces), so the sub-state
// orbits are well-defined — unlike a fixed-slot sub-key under conj+regauge, which entangles the
// gray pieces (that bug produced a wrong, inconsistent count).
//   fixed frame           945
//   + reorient (24)       258   ← rows emitted
//   + reorient + mirror   140   ← distinct mgid
//
// Emits core/packages/client/app/[lang]/scramble/stats/_data/firstface_2x2.json.
// run: node --max-old-space-size=4096 scripts/build_2x2_firstface.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const N = 3674160;
const GENERATED_AT = '2026-07-14';
const OUT = fileURLToPath(new URL('../core/packages/client/app/[lang]/scramble/stats/_data', import.meta.url));
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

// ── group algebra + index/decode (DBL-fixed model) ──────────────────────────
const ID = { p: [0,1,2,3,4,5,6,7], o: [0,0,0,0,0,0,0,0] };
function pw(m,n){let r=ID;for(let i=0;i<n;i++){const p=new Array(8),o=new Array(8);for(let x=0;x<8;x++){p[x]=r.p[m.p[x]];o[x]=(r.o[m.p[x]]+m.o[x])%3;}r={p,o};}return r;}
const MOVES={U:{p:[3,0,1,2,4,5,6,7],o:[0,0,0,0,0,0,0,0]},R:{p:[4,1,2,0,7,5,6,3],o:[2,0,0,1,1,0,0,2]},F:{p:[1,5,2,3,0,4,6,7],o:[1,2,0,0,2,1,0,0]}};
const MOVE_ELEMS=[pw(MOVES.U,1),pw(MOVES.U,2),pw(MOVES.U,3),pw(MOVES.R,1),pw(MOVES.R,2),pw(MOVES.R,3),pw(MOVES.F,1),pw(MOVES.F,2),pw(MOVES.F,3)];
const MOVE_NAMES=['U','U2',"U'",'R','R2',"R'",'F','F2',"F'"];
const FREE=[0,1,2,3,4,5,7], INVP=[0,1,2,3,4,5,7], FACT=[1,1,2,6,24,120,720];
const PMAP=new Int8Array(8);{let k=0;for(const p of FREE)PMAP[p]=k++;}
function permRank(cp){const a=new Int8Array(7);for(let i=0;i<7;i++)a[i]=PMAP[cp[FREE[i]]];let r=0;for(let i=0;i<7;i++){let s=a[i];for(let j=0;j<i;j++)if(a[j]<a[i])s--;r+=s*FACT[6-i];}return r;}
function oriRank(co){let r=0;for(let i=0;i<6;i++)r=r*3+co[FREE[i]];return r;}
function indexPO(p,o){return permRank(p)*729+oriRank(o);}
function decode(idx){const pr=Math.floor(idx/729);let orr=idx%729;const co=new Array(8).fill(0);for(let i=5;i>=0;i--){co[FREE[i]]=orr%3;orr=Math.floor(orr/3);}let s=0;for(let i=0;i<6;i++)s+=co[FREE[i]];co[FREE[6]]=((3-(s%3))%3);co[6]=0;let r=pr;const digits=new Array(7);for(let i=0;i<7;i++){const f=FACT[6-i];digits[i]=Math.floor(r/f);r%=f;}const avail=[0,1,2,3,4,5,6];const a=new Array(7);for(let i=0;i<7;i++){a[i]=avail[digits[i]];avail.splice(digits[i],1);}const cp=new Array(8);cp[6]=6;for(let i=0;i<7;i++)cp[FREE[i]]=INVP[a[i]];return{p:cp,o:co};}

// ── facelet geometry (corner i × axis a) ────────────────────────────────────
const NF=24;
const COORD=[[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1],[1,-1,1],[-1,-1,1],[-1,-1,-1],[1,-1,-1]];
const DIR=-1;
function cycAxesF(i){const v=COORD[i];if(v[0]*v[1]*v[2]*DIR<0)return[1,0,2];return[1,2,0];}
function slotIndex(v){for(let i=0;i<8;i++){const c=COORD[i];if(c[0]===v[0]&&c[1]===v[1]&&c[2]===v[2])return i;}return -1;}
function mmul(M,v){return[M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];}
function det(M){return M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);}
function faceletPerm(M){const perm=new Int8Array(NF);for(let f=0;f<NF;f++)perm[f]=f;for(let i=0;i<8;i++){const vi=COORD[i];const j=slotIndex(mmul(M,vi));for(let a=0;a<3;a++){const n=[0,0,0];n[a]=vi[a];const np=mmul(M,n);const ap=np[0]!==0?0:(np[1]!==0?1:2);perm[j*3+ap]=i*3+a;}}return perm;}
function allMatrices(){const perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];const out=[];for(const pm of perms)for(let s=0;s<8;s++){const sg=[(s&1)?-1:1,(s&2)?-1:1,(s&4)?-1:1];const M=[[0,0,0],[0,0,0],[0,0,0]];for(let r=0;r<3;r++)M[r][pm[r]]=sg[r];out.push(M);}return out;}
const MATS=allMatrices();
const ROT_PERMS=MATS.filter(M=>det(M)===1).map(faceletPerm);   // 24
const ALL_PERMS=MATS.map(faceletPerm);                          // 48
if(ROT_PERMS.length!==24||ALL_PERMS.length!==48)throw new Error('perm counts');

// blur code: D-pieces {4,5,6,7} -> mark axis showing D-colour (its axis-0 sticker, on cyc[co]) as 2,
// other two axes as 1; non-D corners 0. Packs to a base-3 Number (24 digits, < 2^53).
const DSET=new Set([4,5,6,7]);
function blurDigits(cp,co){const d=new Uint8Array(NF);for(let i=0;i<8;i++){if(!DSET.has(cp[i])){continue;}const cyc=cycAxesF(i);const dAxis=cyc[co[i]];for(let a=0;a<3;a++)d[i*3+a]=(a===dAxis)?2:1;}return d;}
function packPerm(d,perm){let v=0;for(let f=0;f<NF;f++)v=v*3+d[perm[f]];return v;}
function canonBlur(d,perms){let best=Infinity;for(const p of perms){const v=packPerm(d,p);if(v<best)best=v;}return best;}

// ── move table + dH (rep selection: min-solve, cleanest scramble) ────────────
log('move table + dH...');console.time('tbl');
const tbl=[];for(let m=0;m<9;m++)tbl.push(new Int32Array(N));
{const g={p:null,o:null};for(let idx=0;idx<N;idx++){const gg=decode(idx);for(let m=0;m<9;m++){const mm=MOVE_ELEMS[m];const p=new Array(8),o=new Array(8);for(let i=0;i<8;i++){p[i]=gg.p[mm.p[i]];o[i]=(gg.o[mm.p[i]]+mm.o[i])%3;}tbl[m][idx]=indexPO(p,o);}}void g;}
console.timeEnd('tbl');
const dH=new Uint8Array(N).fill(255);dH[0]=0;{let fr=[0],d=0;while(fr.length){const nx=[];for(const s of fr)for(let m=0;m<9;m++){const t=tbl[m][s];if(dH[t]===255){dH[t]=d+1;nx.push(t);}}fr=nx;d++;}}

// ── per-state blur digits, canonR, canonM, fixed-frame code ──────────────────
log('canonicalize...');console.time('canon');
const canonR=new Float64Array(N),canonM=new Float64Array(N),codeF=new Float64Array(N);
const idP=new Int8Array(NF);for(let f=0;f<NF;f++)idP[f]=f;
for(let i=0;i<N;i++){const g=decode(i);const d=blurDigits(g.p,g.o);codeF[i]=packPerm(d,idP);canonR[i]=canonBlur(d,ROT_PERMS);canonM[i]=canonBlur(d,ALL_PERMS);}
console.timeEnd('canon');
{const dr=new Set(),dm=new Set(),df=new Set();for(let i=0;i<N;i++){dr.add(canonR[i]);dm.add(canonM[i]);df.add(codeF[i]);}
 log('distinct: fixed-frame',df.size,'(expect 945)  reorient',dr.size,'(expect 258)  +mirror',dm.size,'(expect 140)');
 // consistency: canonM constant on canonR-orbits (well-defined) — the check the buggy method failed
 const r2m=new Map();let violate=0;for(let i=0;i<N;i++){const k=canonR[i];if(r2m.has(k)){if(r2m.get(k)!==canonM[i])violate++;}else r2m.set(k,canonM[i]);}
 log('consistency violations (must be 0):',violate);}

// ── fixed-frame first-face distance per code (BFS over full graph) ───────────
log('FF distance...');
const ffDist=new Map();{ffDist.set(codeF[0],0);const seen=new Set([codeF[0]]);let fr=[0],d=0;const vis=new Uint8Array(N);vis[0]=1;while(fr.length){const nx=[];for(const s of fr)for(let m=0;m<9;m++){const t=tbl[m][s];if(!vis[t]){vis[t]=1;const c=codeF[t];if(!seen.has(c)){seen.add(c);ffDist.set(c,d+1);}nx.push(t);}}fr=nx;d++;}}

// ── true first-face solve distance + solution (multi-source BFS from every solid-D state) ──
// codeF[i]===codeF[0] ⟺ the four D-pieces sit in the D slots with the D sticker down (face
// granularity, so any D-corner permutation counts) ⟺ the shown face is solid.
log('FF solve distance...');
const dFF=new Uint8Array(N).fill(255);
{let fr=[];for(let i=0;i<N;i++)if(codeF[i]===codeF[0]){dFF[i]=0;fr.push(i);}
 let d=0;while(fr.length){const nx=[];for(const s of fr)for(let m=0;m<9;m++){const t=tbl[m][s];if(dFF[t]===255){dFF[t]=d+1;nx.push(t);}}fr=nx;d++;}}
// The shipped F metric (BFS-from-solved, first depth a code appears) must BE that solve distance.
{let bad=0;for(let i=0;i<N;i++)if(dFF[i]!==ffDist.get(codeF[i]))bad++;
 log('F metric vs true solve distance, mismatches (must be 0):',bad);
 if(bad)throw new Error('F metric is not the first-face solve distance');}
function solveOf(i){const mv=[];let s=i;while(dFF[s]){const d=dFF[s];let ok=false;for(let m=0;m<9;m++){const t=tbl[m][s];if(dFF[t]===d-1){mv.push(MOVE_NAMES[m]);s=t;ok=true;break;}}if(!ok)throw new Error('dFF descent stuck');}return mv.join(' ');}

// ── representative per reorient-case: min dH, tie min scramble ────────────────
log('representatives...');
function invScramble(s){const mv=[];let g=0;while(s!==0&&g++<40){const d=dH[s];for(let m=0;m<9;m++){const t=tbl[m][s];if(dH[t]===d-1){mv.push(m);s=t;break;}}}const inv=[];for(let i=mv.length-1;i>=0;i--){const nm=MOVE_NAMES[mv[i]];inv.push(nm.endsWith('2')?nm:nm.endsWith("'")?nm.slice(0,-1):nm+"'");}return inv.join(' ');}
const best=new Map();  // canonR -> {idx,len,scr,codeF}
for(let i=0;i<N;i++){
  const key=canonR[i],len=dH[i];const prev=best.get(key);
  if(prev&&prev.len<len)continue;
  const scr=invScramble(i);
  if(prev&&prev.len===len&&prev.scr<=scr)continue;
  best.set(key,{idx:i,len,scr,code:codeF[i]});
}
log('reorient cases:',best.size,'(expect 258)');

const mgidOf=new Map();let mg=0;const rows=[];
for(const[,rep]of best){const mk=canonM[rep.idx];if(!mgidOf.has(mk))mgidOf.set(mk,mg++);
  const sol=solveOf(rep.idx);
  if(sol.split(' ').filter(Boolean).length!==ffDist.get(rep.code))throw new Error('solution length != F');
  rows.push({scr:rep.scr,F:ffDist.get(rep.code),sol,mgid:mgidOf.get(mk),key:rep.code});}
log('mirror groups:',mgidOf.size,'(expect 140)');
rows.sort((a,b)=>(b.F-a.F)||(a.key-b.key));

// mask = gray everything except the D face — renderer id space. This is a FACE case, not a layer
// one: blurDigits marks a D-corner's two non-D stickers with the same digit (1), so the side
// colours carry zero information in the case identity (F = turns to make the face solid, side
// colours may end up anywhere). Colouring them would render it as a first-LAYER case.
const MASK='U:0-3;R:0-3;F:0-3;L:0-3;B:0-3';
const out={
  meta:{generated_at:GENERATED_AT,total_reorient:rows.length,total_mirror_folded:mgidOf.size,fixed_frame:945,mask:MASK,cols:['scramble','F','mgid','sol'],
    note:'2×2 first-face cases: essentially-different arrangements of the four D-face corners (face granularity: target pieces interchangeable), deduped by whole-puzzle physical reorientation via masked-facelet canonicalisation. F = HTM moves to make the shown D face solid; sol = an optimal first-face solve for the shown scramble (|sol| == F); mgid folds mirror pairs.'},
  rows:rows.map(r=>[r.scr,r.F,r.mgid,r.sol]),
};
mkdirSync(OUT,{recursive:true});
writeFileSync(OUT+'/firstface_2x2.json',JSON.stringify(out)+'\n');
log('wrote',OUT+'/firstface_2x2.json','('+rows.length+' cases)');
log('\nsample (hardest first):');for(const r of rows.slice(0,6))log('  F='+r.F,'mgid='+r.mgid,' ',r.scr);
