/**
 * CubeRoot's structural puzzle glyphs. Source geometry is the same PG definition
 * used by /sim. No runtime geometry dependency is added to the icon package.
 * Run from core: pnpm --filter @cuberoot/client exec node scripts/generate-puzzle-icons.mts
 * Then: pnpm --filter @cuberoot/event-icon generate
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveWorkspacePath } from '../../../scripts/resolve-workspace-path.mjs';
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

// Offset convex sticker edges by an optical gap, capped for narrow pieces.
function inset(poly: P[], gap: number): P[] {
  const area = poly.reduce((s, p, i) => { const q=poly[(i+1)%poly.length]; return s+p[0]*q[1]-q[0]*p[1]; },0);
  const mid: P = [
    poly.reduce((sum,p) => sum+p[0],0)/poly.length,
    poly.reduce((sum,p) => sum+p[1],0)/poly.length,
  ];
  const maxGap = Math.min(...poly.map((p,i) => {
    const q=poly[(i+1)%poly.length], dx=q[0]-p[0], dy=q[1]-p[1];
    return Math.sign(area)*(dx*(mid[1]-p[1])-dy*(mid[0]-p[0]))/Math.hypot(dx,dy);
  }));
  // Keep this interior point strictly inside every offset half-plane.
  gap = Math.min(gap,0.95*maxGap);
  const edges = poly.map((p,i) => {
    const q=poly[(i+1)%poly.length], dx=q[0]-p[0], dy=q[1]-p[1], len=Math.hypot(dx,dy);
    const k=Math.sign(area)*gap/len;
    return {p:[p[0]-dy*k,p[1]+dx*k] as P, d:[dx,dy] as P};
  });
  const shifted: P[] = edges.map((b,i) => {
    const a=edges[(i+edges.length-1)%edges.length], det=a.d[0]*b.d[1]-a.d[1]*b.d[0];
    if(Math.abs(det)<1e-8) return b.p;
    const t=((b.p[0]-a.p[0])*b.d[1]-(b.p[1]-a.p[1])*b.d[0])/det;
    return [a.p[0]+t*a.d[0],a.p[1]+t*a.d[1]];
  });
  // Each offset edge length is affine in gap. Stop before any edge collapses.
  const scale = Math.min(1,...poly.map((p,i) => {
    const j=(i+1)%poly.length, q=poly[j], dx=q[0]-p[0], dy=q[1]-p[1];
    const lengthSq=dx*dx+dy*dy;
    const remaining=(shifted[j][0]-shifted[i][0])*dx+(shifted[j][1]-shifted[i][1])*dy;
    const shrink=lengthSq-remaining;
    return shrink>0 ? 0.95*lengthSq/shrink : 1;
  }));
  return scale===1 ? shifted : shifted.map(([x,y],i) => [
    poly[i][0]+scale*(x-poly[i][0]),
    poly[i][1]+scale*(y-poly[i][1]),
  ]);
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
  return renderPolygons(polygons);
}

function renderPolygons(polygons: P[][]): string {
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

// Skewb Ultimate extends the cube with vertices (±1, ±1, ±1) to a regular
// dodecahedron, retaining the four central tetrahedral cutting planes.
// It is not the PG dodecahedron with all vertex cuts (a different puzzle).
// Geometry and visible seams: https://www.jaapsch.net/puzzles/ultimate.htm
function ultimateGlyph(): string {
  const phi=(1+Math.sqrt(5))/2;
  const face: V[]=[[0,1/phi,phi],[1,1,1],[1/phi,phi,0],[-1/phi,phi,0],[-1,1,1]];
  const view=norm([0,phi,1]), mid=center(face);
  const up=norm(add(face[0],mul(mid,-1))), right=norm(cross(up,view));
  let pieces: V[][]=[face];
  const planes: V[]=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
  for (const plane of planes) {
    pieces=pieces.flatMap(poly => {
      const values=poly.map(v=>dot(v,plane));
      if (Math.min(...values)>=-1e-9 || Math.max(...values)<=1e-9) return [poly];
      return [1,-1].map(sign => {
        const clipped: V[]=[];
        for (let i=0;i<poly.length;i++) {
          const j=(i+1)%poly.length, a=poly[i], b=poly[j], da=values[i]*sign, db=values[j]*sign;
          if (da>=0) clipped.push(a);
          if ((da>0 && db<0) || (da<0 && db>0)) {
            clipped.push(add(a,mul(add(b,mul(a,-1)),da/(da-db))));
          }
        }
        return clipped;
      });
    });
  }
  if (pieces.length!==4) throw new Error('Unexpected Skewb Ultimate face subdivision');
  return renderPolygons(pieces.map(poly=>poly.map(v=>[dot(v,right),-dot(v,up)] as P)));
}

// Rubik's UFO has two circular layers of six wedge-shaped pieces, distinct
// from the site's three-sphere UFO. Show the upper six sectors and the three
// visible lower sectors with a transparent seam between the two disks.
// Physical reference: https://www.jaapsch.net/puzzles/rubufo.htm
function rubiksUfoGlyph(): string {
  const point=(angle: number, radiusY: number): string =>
    `${fmt(48+44*Math.cos(angle))} ${fmt(42+radiusY*Math.sin(angle))}`;
  const gap=Math.PI/180;
  const paths: string[]=[];
  for (let sector=0;sector<6;sector++) {
    const start=sector*Math.PI/3+gap, end=(sector+1)*Math.PI/3-gap;
    const mid=(start+end)/2;
    const tip=`${fmt(48+1.5*Math.cos(mid))} ${fmt(42+0.9*Math.sin(mid))}`;
    paths.push(`M${tip}L${point(start,25)}A44 25 0 0 1 ${point(end,25)}Z`);
  }
  for (let sector=0;sector<3;sector++) {
    const start=sector*Math.PI/3+gap, end=(sector+1)*Math.PI/3-gap;
    paths.push(`M${point(start,26.8)}A44 26.8 0 0 1 ${point(end,26.8)}L${point(end,35)}A44 35 0 0 0 ${point(start,35)}Z`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="currentColor"><path d="${paths.join('')}"/></svg>\n`;
}
const out=resolve(import.meta.dirname, '../../..', resolveWorkspacePath('@cuberoot/event-icon'), 'svg/puzzle') + '/';
const check = process.argv.includes('--check');
const only=process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only')+1] : undefined;
if (!check) mkdirSync(out,{recursive:true});
function save(name: string, svg: string) {
  if (check) {
    if (readFileSync(`${out}${name}.svg`, 'utf8') !== svg) throw new Error(`Stale puzzle icon: ${name}`);
  } else writeFileSync(`${out}${name}.svg`, svg);
}
// Curvy Copter retains its existing curved silhouette: planar PG cuts are not
// a faithful drawing of its physical curved seams.
for(const p of PG_PUZZLES) {
  if(p.id==='curvycopter' || (only && only!==p.id)) continue;
  save(p.id,glyph(p.def));
}
if (!only || only==='fto') save('fto',glyph('o f 0.333333333333333'));
if (!only || only==='skewb-ultimate') save('skewb-ultimate',ultimateGlyph());
if (!only || only==='rubiks-ufo') save('rubiks-ufo',rubiksUfoGlyph());
// A cutting-plane symbol for the custom geometry editor; it is not a 3x3 event.
if (!only || only==='custom') save('custom','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path fill="none" d="M48 5 87 27v43L48 92 9 70V27ZM9 27l39 22 39-22M48 49v43"/><path fill="none" d="m5 48 43-23 43 23-43 24Z" stroke-dasharray="5 3"/></svg>\n');
console.log(`${check ? "Verified" : "Generated"} ${only ?? `${PG_PUZZLES.length-1} catalog glyphs plus FTO, Skewb Ultimate, Rubik's UFO and custom cuts`}.`);
