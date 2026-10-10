// Reproducible pre-implementation face-cut review. Build puzzle-solvers first,
// then run this script from any directory; QA output stays outside watched src.
import { mkdirSync, writeFileSync } from 'node:fs';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { Vector3 } from 'three';
const rows = [
  { id: 'lattice', prior: 'c v 0.577350269189626' },
  { id: 'hyperx', prior: 'c v 0.275' },
  { id: 'latticex', prior: 'c v 0.577350269189626 v 1.154700538379252' },
  { id: 'masterbrilic', prior: 'd f 0.447213595499989' },
  { id: 'masterftov2', prior: 'o f 0 f 0.5' },
];
function faceEdges(desc) {
  const pg = getPuzzleGeometryByDesc(desc, {allMoves:true,orientCenters:true,addRotations:true});
  const data = pg.get3d();
  const face = data.faces[0];
  const vertices=Array.from({length:face.coords.length/3},(_,i)=>new Vector3().fromArray(face.coords,i*3));
  const center=vertices.reduce((sum,v)=>sum.add(v),new Vector3()).divideScalar(vertices.length);
  const u=vertices[1].clone().sub(vertices[0]).normalize();
  const v=vertices[2].clone().sub(vertices[0]).cross(u).normalize().cross(u).normalize();
  const projected=vertices.map(p=>[p.clone().sub(center).dot(u),p.clone().sub(center).dot(v)]);
  const half=Math.max(...projected.flat().map(Math.abs));
  const project=p=>[p.clone().sub(center).dot(u)/half,p.clone().sub(center).dot(v)/half];
  const edges = new Map();
  const key = p => p.map(x => Math.round(x * 1e7)).join(',');
  for (const s of data.stickers.filter(s => s.face === 0 && !s.isDup)) {
    const pts = Array.from({length:s.coords.length / 3},(_,i)=>project(new Vector3().fromArray(s.coords,i*3)));
    for(let i=0;i<pts.length;i++) {
      const a=pts[i], b=pts[(i+1)%pts.length];
      edges.set([key(a),key(b)].sort().join(';'),[a,b]);
    }
  }
  return { edges, pg, boundary:vertices.map(project), faces:data.faces.length, count: data.stickers.filter(s=>!s.isDup).length };
}
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1420" viewBox="0 0 1200 1420"><rect width="1200" height="1420" fill="white"/><style>text{font-family:Arial,sans-serif;fill:#222}</style>';
rows.forEach((row,index)=>{
  const spec=NATIVE_PUZZLES[row.id];
  const old=faceEdges(row.prior), next=faceEdges(spec.description), x=index%3*400;
  svg+=`<g transform="translate(0 ${Math.floor(index/3)*710})">`;
  const line=(a,b,color,width=1.5)=>`<line x1="${x+200+a[0]*125}" y1="${220-a[1]*125}" x2="${x+200+b[0]*125}" y2="${220-b[1]*125}" stroke="${color}" stroke-width="${width}"/>`;
  svg+=`<text x="${x+200}" y="35" text-anchor="middle" font-size="22">${spec.en}</text><text x="${x+200}" y="59" text-anchor="middle" font-size="13">${next.count/next.faces} regions per face / ${next.count} visible stickers</text><rect x="${x+66}" y="86" width="268" height="268" fill="none" stroke="#999" stroke-dasharray="6 5"/>`;
  for(const [a,b] of old.edges.values()) svg+=line(a,b,'#111',1.1);
  for(const [key,[a,b]] of next.edges) if(!old.edges.has(key)) svg+=line(a,b,'#12a348',2);
  svg+=`<polygon points="${next.boundary.map(p=>`${x+200+p[0]*125},${220-p[1]*125}`).join(' ')}" fill="none" stroke="#2869d8" stroke-width="2"/>`;
  svg+=next.pg.generatesvg().replace('<svg ',`<svg x="${x+10}" y="380" width="380" height="250" `);
  svg+=`<text x="${x+200}" y="658" text-anchor="middle" font-size="13">Idealized symmetric cuts; not commercial measurements</text>`;
  svg+='</g>';
});
svg+='<text x="600" y="694" text-anchor="middle" font-size="14">Black: previous cuts · Green: proposed partition · Blue: fixed boundary · Gray dashed: envelope</text></svg>';
const outputDir = new URL('../../../../.tmp/png/', import.meta.url);
mkdirSync(outputDir, { recursive: true });
writeFileSync(new URL('native-five-outlines.svg', outputDir), svg);
console.log('Wrote core/.tmp/png/native-five-outlines.svg');
