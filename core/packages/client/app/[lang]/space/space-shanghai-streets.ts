import * as THREE from 'three';
import { CityGeometry, type MaterialFactory, type ShanghaiPolygon } from './space-shanghai-geometry';
import type { ShanghaiRoad } from './space-shanghai-bridges';
import type { Vec3 } from './space-state';

type Point = [number, number];
const WEST_WALK = 178412507;
const CROSSINGS = new Set([178412509, 226657312, 745201528, 745201529, 745201530, 745201536]);
export const isShanghaiWalkway = (r: ShanghaiRoad) => ['footway', 'pedestrian', 'steps', 'path', 'cycleway'].includes(r.kind ?? '');
const inBund = ([x, z]: Point) => x > -1400 && x < -1100 && z >= 1200 && z <= 1840;
const bundRoad = (r: ShanghaiRoad) => !r.bridge && r.name === '中山东一路' && r.points.some(inBund);

// The asset's 11.5 m class fallback makes the two mapped carriageways overlap.
// Four surface lanes are documented by the city; 3.5 m lane widths are estimates.
export function shanghaiRoadWidth(r: ShanghaiRoad) { return bundRoad(r) ? 7 : r.width; }

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

// Meter-scale paving, with subpixel joints and aggregate fading out during flight.
// Materials stay owned by ShanghaiScene's factory and use its day/night uniform.
export function shanghaiStreetMaterial(material: MaterialFactory, paving: boolean) {
  const m = material(paving ? 0xa7a69a : 0x414746, .025, .93);
  const compile = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    compile.call(m, shader, renderer);
    shader.vertexShader = 'varying vec2 streetPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nstreetPosition=position.xz;');
    shader.fragmentShader = 'varying vec2 streetPosition;\nfloat streetHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 stoneUV=vec2(streetPosition.x*.992+streetPosition.y*.126,-streetPosition.x*.126+streetPosition.y*.992);
      vec2 cell=stoneUV/vec2(.6,1.2);
      vec2 footprint=max(fwidth(cell),vec2(.0001));
      float detail=1.-smoothstep(.15,.65,max(footprint.x,footprint.y));
      vec2 seam=min(fract(cell),1.-fract(cell));
      float joint=1.-smoothstep(.005,.005+max(footprint.x,footprint.y),min(seam.x,seam.y));
      float grainDetail=1.-smoothstep(.1,.6,max(fwidth(stoneUV.x*55.),fwidth(stoneUV.y*55.)));
      float grain=(streetHash(floor(stoneUV*55.))-.5)*grainDetail;
      diffuseColor.rgb*= ${paving ? '(1.-joint*.22*detail)*(1.+(streetHash(floor(cell))-.5)*.08*detail)' : '1.'} *(1.+grain*.12);
    `);
  };
  m.customProgramCacheKey = () => `${key}-bund-street-${paving}`;
  return m;
}

export function createBundStreets(roads: ShanghaiRoad[], polygons: ShanghaiPolygon[], material: MaterialFactory) {
  const g = new CityGeometry(); g.group.name = 'Bund streetscape';
  g.group.userData.reconstruction = 'OSM road and footway positions; four surface lanes from Shanghai 2010 project report. Lane widths, paving, curb heights and lighting furniture are estimates, not a current street survey.';
  // No roads, invalid/zero-length segments, bridges and out-of-area paths must not
  // allocate street furniture. Input geometry is validated by ShanghaiScene first.
  const main = roads.filter(bundRoad);
  if (!main.length) return g.group;
  const nearby = roads.filter(r => !r.bridge && !isShanghaiWalkway(r) && r.points.some(p => p[0] > -1460 && p[0] < -1000 && p[1] > 1100 && p[1] < 1940));
  const crossings = roads.filter(r => CROSSINGS.has(r.id ?? 0) && !r.bridge);
  const atCrossing = (p: Point) => crossings.some(r => r.points.slice(1).some((b, i) => segmentDistance(p, r.points[i], b) < 2));
  const barriers = polygons.filter(p => p.kind !== 'green' && p.points.some(p => p[0] > -1470 && p[0] < -1000 && p[1] > 1100 && p[1] < 1940));
  const onRoad = (p: Point, margin = 0, except?: ShanghaiRoad) => nearby.some(r => r !== except && r.points.slice(1).some((b, i) => segmentDistance(p, r.points[i], b) < shanghaiRoadWidth(r) / 2 + margin));
  const onBarrier = (point: Point, margin: number) => barriers.some(p => {
    let inside = false;
    for (let i = 0, j = p.points.length - 1; i < p.points.length; j = i++) {
      const a = p.points[j], b = p.points[i];
      if (segmentDistance(point, a, b) < margin) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  });
  const paving = shanghaiStreetMaterial(material, true);
  const curb = material(0xc2c1b5, .015, .85), paint = material(0xdad8c6, .01, .87), yellow = material(0xb8a55f, .01, .87);
  // Road markings are decals. Depth bias keeps a shallow camera from resolving
  // the asphalt and paint as the same depth; retain depth testing for occlusion.
  for (const m of [paint, yellow]) {
    m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
    m.transparent = true; m.depthWrite = false;
    const compile = m.onBeforeCompile, key = m.customProgramCacheKey();
    m.onBeforeCompile = (shader, renderer) => {
      compile.call(m, shader, renderer);
      shader.vertexShader = 'varying vec2 roadMark;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nroadMark=uv;');
      shader.fragmentShader = 'varying vec2 roadMark;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float pixel=max(fwidth(roadMark.x),.001);
        diffuseColor.a*=min(2.*roadMark.y/pixel,clamp((roadMark.y+pixel*.5-abs(roadMark.x))/pixel,0.,1.));
      `);
    };
    m.customProgramCacheKey = () => `${key}-bund-marking-aa`;
  }
  const metal = material(0x535c58, .6, .48), lamp = material(0xe8dcc0, .1, .55, 1.5);
  const walks: number[] = [], whiteLines: number[] = [], yellowLines: number[] = [];
  const whiteUV: number[] = [], yellowUV: number[] = [];
  const quad = (out: number[], a: Point, b: Point, c: Point, d: Point, y: number) => out.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], a[0], y, a[1], c[0], y, c[1], d[0], y, d[1]);
  const stripe = (a: Point, b: Point, width: number, out: number[]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < .01) return;
    // Expanded transparent edges integrate subpixel lane markings during flight.
    const half = width / 2 + .45;
    const nx = -dz / length * half, nz = dx / length * half;
    quad(out, [a[0] - nx, a[1] - nz], [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], -.61);
    (out === whiteLines ? whiteUV : yellowUV).push(-half, width / 2, half, width / 2, half, width / 2, -half, width / 2, half, width / 2, -half, width / 2);
  };
  let pavingSections = 0, lamps = 0, crossingStripes = 0;
  // Straight subsegments retain the OSM bends. Cumulative stations keep dashes
  // and lamp spacing independent of how densely OSM has sampled each polyline.
  const walkSegments = (r: ShanghaiRoad, visit: (a: Point, b: Point, nx: number, nz: number, distance: number) => void) => {
    let distance = 0;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < .01) continue;
      const steps = Math.ceil(length / 1.5);
      for (let j = 0; j < steps; j++) {
        const start: Point = [a[0] + dx * j / steps, a[1] + dz * j / steps];
        const end: Point = [a[0] + dx * (j + 1) / steps, a[1] + dz * (j + 1) / steps];
        if (inBund(start) && inBund(end)) visit(start, end, -dz / length, dx / length, distance + length * j / steps);
      }
      distance += length;
    }
  };
  for (const r of main) walkSegments(r, (a, b, nx, nz, distance) => {
    const at = (p: Point, offset: number): Point => [p[0] + nx * offset, p[1] + nz * offset];
    const center: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const junction = nearby.some(other => other !== r && !bundRoad(other) && other.points.slice(1).some((end, i) => segmentDistance(center, other.points[i], end) < other.width / 2 + 2));
    if (junction || atCrossing(center)) return;
    const line = (offset: number, out: number[]) => stripe(at(a, offset), at(b, offset), .12, out);
    if (distance % 9 < 3) line(0, whiteLines);
    for (const side of [-1, 1]) {
      const adjacent = main.some(other => other !== r && other.points.slice(1).some((end, i) => segmentDistance(at(center, side * 7.5), other.points[i], end) < 2));
      line(side * 3.25, adjacent ? yellowLines : whiteLines);
    }
  });
  for (const r of roads.filter(r => r.id === WEST_WALK && !r.bridge)) {
    let lastLamp = -Infinity;
    walkSegments(r, (a, b, nx, nz, distance) => {
      const at = (p: Point, offset: number): Point => [p[0] + nx * offset, p[1] + nz * offset];
      const corners = [at(a, -4.6), at(a, 4.6), at(b, 4.6), at(b, -4.6)];
      const center: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const halfLength = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
      // A narrow obstacle can lie entirely between slab corners. Its vertices
      // and the slab center must also be checked before accepting the section.
      const containsBarrier = barriers.some(p => p.points.some(([x, z]) =>
        Math.abs((x - center[0]) * nx + (z - center[1]) * nz) <= 4.8 &&
        Math.abs((x - center[0]) * nz - (z - center[1]) * nx) <= halfLength + .2));
      // Leave cross streets and building/water boundaries open, including corners
      // of the proposed slab, rather than only checking its center point.
      if (containsBarrier || [...corners, center].some(p => onRoad(p, .3) || onBarrier(p, .2))) return;
      quad(walks, corners[0], corners[1], corners[2], corners[3], -.44); pavingSections++;
      for (const side of [-1, 1]) {
        const p = at(a, side * 4.6), q = at(b, side * 4.6);
        if (atCrossing(p) || atCrossing(q)) continue;
        g.add(new THREE.BoxGeometry(.24, .2, Math.hypot(q[0] - p[0], q[1] - p[1])), curb, [(p[0] + q[0]) / 2, -.54, (p[1] + q[1]) / 2], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(q[0] - p[0], q[1] - p[1])));
      }
      if (distance - lastLamp < 32) return;
      // Place poles on the road side of the walk, away from cross streets. No
      // per-pole shadow maps or point lights: lenses share the city night state.
      const p = at(a, nx < 0 ? -3.7 : 3.7);
      if (onRoad(p, 1.2) || onBarrier(p, 1.2) || atCrossing(p)) return;
      lastLamp = distance; lamps++;
      g.add(new THREE.CylinderGeometry(.15, .23, .8, 10), metal, [p[0], -.04, p[1]]);
      g.add(new THREE.CylinderGeometry(.075, .13, 7.3, 10), metal, [p[0], 3.5, p[1]]);
      for (const side of [-1, 1]) {
        let previous: Vec3 = [p[0], 6.8, p[1]];
        for (let i = 1; i <= 8; i++) {
          const t = i / 8, reach = side * 1.45 * t;
          const next: Vec3 = [p[0] + nx * reach, 6.8 + .7 * Math.sin(t * Math.PI / 2), p[1] + nz * reach];
          g.beam(previous, next, .065, metal, .065, true); previous = next;
        }
        const housing = new THREE.SphereGeometry(.25, 10, 6); housing.scale(1.5, .4, .8);
        g.add(housing, metal, previous);
        const lens = new THREE.SphereGeometry(.2, 10, 6); lens.scale(1.5, .22, .8);
        g.add(lens, lamp, [previous[0], previous[1] - .07, previous[2]]);
      }
    });
  }
  for (const r of crossings) walkSegments(r, (a, b, nx, nz, distance) => {
    if (distance % 2 >= 1) return;
    const p: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!onRoad(p, -.7) || onBarrier(p, .2)) return;
    stripe([p[0] - nx * 1.35, p[1] - nz * 1.35], [p[0] + nx * 1.35, p[1] + nz * 1.35], .48, whiteLines);
    crossingStripes++;
  });
  for (const [vertices, m] of [[whiteLines, paint], [yellowLines, yellow], [walks, paving]] as const) if (vertices.length) {
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geom.computeVertexNormals();
    const uv = vertices === whiteLines ? whiteUV : vertices === yellowLines ? yellowUV : new Float32Array(vertices.length / 3 * 2);
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.add(geom, m);
  }
  Object.assign(g.group.userData, { pavingSections, lamps, crossingStripes });
  const root = g.finish();
  root.traverse(o => { if (o instanceof THREE.Mesh && (o.material === paint || o.material === yellow || o.material === paving)) o.castShadow = false; });
  return root;
}
