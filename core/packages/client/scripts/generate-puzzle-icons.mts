/**
 * CubeRoot's structural puzzle glyphs. Source geometry is the same PG definition
 * used by /sim. No runtime geometry dependency is added to the icon package.
 * Run from core: pnpm --filter @cuberoot/client exec node scripts/generate-puzzle-icons.mts
 * Then: pnpm --filter @cuberoot/event-icon generate
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog.ts';

type V = [number, number, number];
type P = [number, number];
const add = (a: V, b: V): V => a.map((v, i) => v + b[i]) as V;
const mul = (a: V, k: number): V => a.map(v => v * k) as V;
const dot = (a: V, b: V) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a: V, b: V): V => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = (v: V) => mul(v, 1 / Math.hypot(...v));
const vertices = (coords: number[]): V[] => Array.from({length: coords.length / 3}, (_, i) => coords.slice(i * 3, i * 3 + 3) as V);
const center = (vs: V[]) => mul(vs.reduce(add, [0, 0, 0]), 1 / vs.length);
const fmt = (n: number) => Number(n.toFixed(2));

// Offset convex sticker edges by a fixed optical gap. Unlike centroid scaling,
// this keeps thin high-order pieces and broad centers separated by equal gaps.
function inset(poly: P[], gap: number): P[] {
  const area = poly.reduce((s, p, i) => { const q=poly[(i+1)%poly.length]; return s+p[0]*q[1]-q[0]*p[1]; },0);
  const edges = poly.map((p,i) => {
    const q=poly[(i+1)%poly.length], dx=q[0]-p[0], dy=q[1]-p[1], len=Math.hypot(dx,dy);
    const k=Math.sign(area)*gap/len;
    return {p:[p[0]-dy*k,p[1]+dx*k] as P, d:[dx,dy] as P};
  });
  return edges.map((b,i) => {
    const a=edges[(i+edges.length-1)%edges.length], det=a.d[0]*b.d[1]-a.d[1]*b.d[0];
    if(Math.abs(det)<1e-8) return b.p;
    const t=((b.p[0]-a.p[0])*b.d[1]-(b.p[1]-a.p[1])*b.d[0])/det;
    return [a.p[0]+t*a.d[0],a.p[1]+t*a.d[1]];
  });
}

function glyph(def: string): string {
  const data=getPuzzleGeometryByDesc(def,{allMoves:true}).get3d();
  const shape=def[0];
  let right: V=[1,0,0], up: V=[0,1,0], view: V=[0,0,1];
  const oneFace=shape==='c'||shape==='t'||shape==='d';
  if(oneFace) {
    const face=vertices(data.faces[0].coords), mid=center(face);
    view=norm(mid);
    if(shape!=='c') {
      up=norm(add(face[shape==='d'?1:0],mul(mid,-1)));
      right=norm(cross(up,view));
    }
  } else if(shape==='o') {
    const [a,b,c]=vertices(data.faces[0].coords);
    up=norm(a); view=norm(add(b,mul(c,0.65))); right=norm(cross(up,view));
  }
  const faceIds = new Set(data.faces.flatMap((face,i) =>
    (oneFace ? i===0 : dot(center(vertices(face.coords)),view)>1e-5) ? [i] : []));
  const project=(v: V): P => [dot(v,right),-dot(v,up)];
  const polygons=data.stickers.filter(s=>!s.isDup && faceIds.has(s.face)).map(s=>vertices(s.coords).map(project));
  const points=polygons.flat(), xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=88/Math.max(maxX-minX,maxY-minY);
  // Dense high-order patterns keep all cuts, with proportionately narrower gaps.
  const gap=Math.min(0.8, 5 / Math.sqrt(polygons.length));
  const paths=polygons.map(poly => {
    const normalized=poly.map(([x,y]): P=>[48+(x-(minX+maxX)/2)*scale,48+(y-(minY+maxY)/2)*scale]);
    return 'M'+inset(normalized,gap).map(p=>p.map(fmt).join(' ')).join('L')+'Z';
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="currentColor"><path d="${paths.join('')}"/></svg>\n`;
}
const out=fileURLToPath(new URL('../../event-icon/svg/puzzle/',import.meta.url));
const check = process.argv.includes('--check');
if (!check) mkdirSync(out,{recursive:true});
function save(name: string, svg: string) {
  if (check) {
    if (readFileSync(`${out}${name}.svg`, 'utf8') !== svg) throw new Error(`Stale puzzle icon: ${name}`);
  } else writeFileSync(`${out}${name}.svg`, svg);
}
// Curvy Copter retains its existing curved silhouette: planar PG cuts are not
// a faithful drawing of its physical curved seams.
for(const p of PG_PUZZLES) {
  if(p.id==='curvycopter') continue;
  save(p.id,glyph(p.def));
}
save('fto',glyph('o f 0.333333333333333'));
// A cutting-plane symbol for the custom geometry editor; it is not a 3x3 event.
save('custom','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path fill="none" d="M48 5 87 27v43L48 92 9 70V27ZM9 27l39 22 39-22M48 49v43"/><path fill="none" d="m5 48 43-23 43 23-43 24Z" stroke-dasharray="5 3"/></svg>\n');
console.log(`${check ? "Verified" : "Generated"} ${PG_PUZZLES.length-1} catalog glyphs plus FTO and custom cuts.`);
