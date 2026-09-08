import * as THREE from 'three';
import { CityGeometry, type MaterialFactory } from './space-shanghai-geometry';
import { isShanghaiWalkway, shanghaiRoadWidth, shanghaiStreetMaterial } from './space-shanghai-streets';
import type { Vec3 } from './space-state';

type Point = [number, number];
export type ShanghaiRoad = { id?: number; kind?: string; points: Point[]; width: number; bridge: boolean; name?: string; layer?: number };
type RoadNode = { p: Point; edges: Map<string, number>; deck?: number; ground: boolean; fallback: number };

// OSM plan alignment + published engineering dimensions. Elevations, member sections,
// arch curve and ramp grades remain reconstructions, not a survey. See the replica tracker.
export const SHANGHAI_BRIDGES = {
  nanpu: { name: 'Nanpu Bridge', x: 173.7, z: 5106.4, angle: 1.166, length: 846, span: 423, width: 30.35, deck: 48.4, tower: 150 },
  lupu: { name: 'Lupu Bridge', x: -2159.6, z: 6927.8, angle: .328, length: 750, span: 550, width: 40, deck: 48.4, rise: 100 },
  waibaidu: { name: 'Waibaidu Bridge', x: -1271.75, z: 900.15, angle: -.267, length: 107, span: 53.5, width: 18, deck: 6.2 },
} as const;
type Bridge = typeof SHANGHAI_BRIDGES[keyof typeof SHANGHAI_BRIDGES];

export function bridgeAt([x, z]: Point): Bridge | undefined {
  return Object.values(SHANGHAI_BRIDGES).find(b => {
    const dx = x - b.x, dz = z - b.z;
    return Math.abs(dx * Math.cos(b.angle) - dz * Math.sin(b.angle)) <= b.width / 2 + 1 &&
      Math.abs(dx * Math.sin(b.angle) + dz * Math.cos(b.angle)) <= b.length / 2;
  });
}

function roadBridgeAt(road: ShanghaiRoad, point: Point) {
  // The East Bank walking/cycling viaduct passes UNDER Nanpu. A plan overlap is
  // not a connection to the highway deck; keep these independently elevated.
  return isShanghaiWalkway(road) ? undefined : bridgeAt(point);
}

// Preserve the actual OSM spiral and shared junctions. Interpolate height by distance
// along the connected elevated road network, never by XY distance across stacked loops.
export function shanghaiRoadElevations(roads: ShanghaiRoad[]): number[][] {
  const key = (p: Point) => `${p[0]},${p[1]}`;
  const ground = new Set(roads.filter(r => !r.bridge).flatMap(r => [key(r.points[0]), key(r.points[r.points.length - 1])]));
  const nodes = new Map<string, RoadNode>();
  for (const r of roads) if (r.bridge) {
    for (let i = 0; i < r.points.length; i++) {
      const p = r.points[i], k = key(p), lowBridge = p[1] < 1400;
      const n: RoadNode = nodes.get(k) ?? { p, edges: new Map(), ground: ground.has(k), fallback: lowBridge ? 6.2 : 12 * Math.max(1, r.layer ?? 2) };
      n.deck = roadBridgeAt(r, p)?.deck ?? n.deck;
      nodes.set(k, n);
      if (i) { const previous = key(r.points[i - 1]), d = Math.hypot(p[0] - r.points[i - 1][0], p[1] - r.points[i - 1][1]); n.edges.set(previous, d); nodes.get(previous)!.edges.set(k, d); }
    }
  }
  const distances = (isSeed: (n: RoadNode) => boolean) => {
    const result = new Map<string, { distance: number; height: number }>(), queue: string[] = [];
    for (const [k, n] of nodes) if (isSeed(n)) { result.set(k, { distance: 0, height: n.deck ?? -.64 }); queue.push(k); }
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i], current = result.get(k)!;
      for (const [next, length] of nodes.get(k)!.edges) if (current.distance + length < (result.get(next)?.distance ?? Infinity)) {
        result.set(next, { distance: current.distance + length, height: current.height }); queue.push(next);
      }
    }
    return result;
  };
  const fromDeck = distances(n => n.deck !== undefined), fromGround = distances(n => n.ground && n.deck === undefined);
  return roads.map(r => r.points.map(p => {
    if (!r.bridge) return -.64;
    const k = key(p), n = nodes.get(k)!, top = fromDeck.get(k), bottom = fromGround.get(k);
    if (n.deck !== undefined) return n.deck;
    if (n.ground) return -.64;
    if (top && bottom) return THREE.MathUtils.lerp(-.64, top.height, bottom.distance / (top.distance + bottom.distance));
    if (top) return top.height;
    return bottom ? Math.min(n.fallback, -.64 + bottom.distance * .045) : n.fallback;
  }));
}

export function createShanghaiBridges(material: MaterialFactory) {
  const root = new THREE.Group(); root.name = 'Shanghai detailed bridges';
  const concrete = material(0xd0cec2, .06, .76), steel = material(0xdce0db, .36, .42), historicSteel = material(0x7c8883, .5, .5);
  const asphalt = material(0x373c3d, .02, .95), paint = material(0xdad5bc, .05, .8), cable = material(0xbcc3bf, .5, .36);
  const light = material(0xf6d69a, .1, .35, 2.2);
  // Baked facade wash approximates architectural floodlights at night; no measured
  // fixture photometry is available. Keep it off the road surface and foundations.
  const towerWash = material(0xd0cec2, .06, .76, .24), archWash = material(0xdce0db, .36, .42, .18);
  const trussWash = material(0x7c8883, .5, .5, .28);
  for (const [id, b] of Object.entries(SHANGHAI_BRIDGES)) {
    const g = new CityGeometry(), y = b.deck, half = b.width / 2, small = id === 'waibaidu';
    g.group.name = b.name; g.group.position.set(b.x, 0, b.z); g.group.rotation.y = b.angle;
    g.box([b.width, .4, b.length], [0, y - .2, 0], asphalt);
    const roadHalf = small ? 5.5 : id === 'nanpu' ? 10.8 : 11.3;
    for (const side of [-1, 1]) {
      g.box([small ? 3.5 : 2, .35, b.length], [side * (half - (small ? 1.75 : 1)), y + .12, 0], concrete);
      g.box([.26, 1.05, b.length], [side * (roadHalf + .5), y + .5, 0], concrete);
      g.box([.18, .025, b.length], [side * roadHalf, y + .025, 0], paint);
      for (const railY of [.4, 1.05]) g.box([.08, .08, b.length], [side * (half - .18), y + railY, 0], steel);
      for (let z = -b.length / 2; z <= b.length / 2; z += 3) g.box([.085, 1.12, .085], [side * (half - .18), y + .56, z], steel);
      g.box([.12, .12, b.length], [side * (half - .1), y - .4, 0], light);
      const lanes = small ? 1 : 3;
      for (let lane = 1; lane < lanes; lane++) for (let z = -b.length / 2 + 4; z < b.length / 2 - 4; z += 12)
        g.box([.15, .025, 5], [side * roadHalf * lane / lanes, y + .025, z], paint);
    }
    g.box([small ? .14 : .5, small ? .025 : .65, b.length], [0, y + (small ? .025 : .32), 0], small ? paint : concrete);
    const girder = id === 'nanpu' ? 12.275 : small ? 5.8 : 16;
    const girderDepth = id === 'nanpu' ? 2.21 : small ? 1.15 : 2.6;
    for (const side of [-1, 1]) {
      // Steel I-girders have separate webs and flanges, visible from the river.
      // Only Nanpu's depth is verified; the other sections remain visual estimates.
      g.box([.2, girderDepth, b.length], [side * girder, y - .4 - girderDepth / 2, 0], steel);
      for (const h of [-.4, -.4 - girderDepth]) g.box([.85, .14, b.length], [side * girder, y + h, 0], steel);
    }
    for (let z = -b.length / 2; z <= b.length / 2; z += small ? 6.6875 : 4.5) g.box([b.width - .6, .65, .24], [0, y - 1.2, z], steel);

    if (id === 'nanpu') {
      const spec = SHANGHAI_BRIDGES.nanpu;
      for (const z of [-spec.span / 2, spec.span / 2]) {
        for (const side of [-1, 1]) {
          g.box([12, 4, 20], [side * 18, 0, z], concrete);
          g.beam([side * 18, 2, z], [side * 17, 52, z], 5.4, towerWash, 8);
          g.beam([side * 17, 52, z], [side * 12.6, spec.tower - 3, z], 4.8, towerWash, 7);
          g.box([5.4, 3, 7.6], [side * 12.6, spec.tower - 1.5, z], towerWash);
          for (const face of [-1, 1]) g.beam([side * 17, 52, z + face * 3.55], [side * 12.6, spec.tower - 3, z + face * 3.55], .18, light);
          // 22 pairs per pylon plane + a vertical stay: 180 stays in total.
          for (const direction of [-1, 1]) for (let i = 1; i <= 22; i++) {
            const anchorY = 104 + i * 1.8, anchorX = side * THREE.MathUtils.lerp(17, 12.6, (anchorY - 52) / (spec.tower - 55));
            const top: Vec3 = [anchorX, anchorY, z], bottom: Vec3 = [side * 12.275, y + .25, z + direction * (9 + i * 9)];
            g.beam(top, bottom, .146, cable, .146, true);
            const socket = new THREE.Vector3(...top).sub(new THREE.Vector3(...bottom)).normalize().multiplyScalar(2).add(new THREE.Vector3(...bottom)).toArray();
            g.beam(bottom, socket, .44, steel, .44, true);
            g.box([.9, .32, 1.5], [bottom[0], y + .1, bottom[2]], steel);
          }
          g.beam([side * 14.5, 107, z], [side * 12.275, y, z], .146, cable, .146, true);
          g.box([.24, 4, .24], [side * 12.6, 152, z], steel);
        }
        for (const [height, width, depth] of [[53, 35, 4], [108, 31, 5], [146, 28, 3.2]]) g.box([width, depth, 7], [0, height, z], towerWash);
      }
      for (const z of [-410, -320, 320, 410]) for (const x of [-10, 10]) {
        g.box([3, y - 2.6, 4], [x, (y - 2.6) / 2, z], concrete);
        g.box([7, 2, 8], [x, .2, z], concrete);
      }
    } else if (id === 'lupu') {
      const spec = SHANGHAI_BRIDGES.lupu, spring = 12;
      // A parabolic approximation is used until the exact as-built arch ordinates are available.
      const archPoint = (z: number, side: number): Vec3 => {
        const height = spring + spec.rise * (1 - (z / (spec.span / 2)) ** 2);
        return [side * (20 + (y - height) / 5), height, z];
      };
      for (const side of [-1, 1]) {
        for (let i = 1; i <= 110; i++) {
          const a = archPoint(-275 + (i - 1) * 5, side), b = archPoint(-275 + i * 5, side);
          g.beam(a, b, 4.5, archWash, 5.2);
          g.beam([a[0] + side * 2.3, a[1], a[2]], [b[0] + side * 2.3, b[1], b[2]], .18, light);
        }
        for (let z = -264; z <= 264; z += 12) {
          const p = archPoint(z, side);
          g.beam([side * 20, y - .5, z], p, p[1] > y ? .15 : 1.8, p[1] > y ? cable : steel, .22, p[1] > y);
        }
        for (const z of [-275, 275]) {
          const foot = archPoint(z, side);
          g.box([12, 12, 18], [foot[0], 5.5, z], concrete);
          g.beam(foot, [side * 20, y - 2, z], 3.5, steel, 5);
        }
        // The two 100 m side spans descend to the arch springings.
        for (const end of [-1, 1]) {
          g.beam([side * 20, y - 2, end * 375], archPoint(end * 275, side), 3.2, steel, 4);
          g.box([4, y - 2.6, 5], [side * 16, (y - 2.6) / 2, end * 375], concrete);
        }
      }
      for (let z = -204; z <= 204; z += 24) g.beam(archPoint(z, -1), archPoint(z, 1), 2.1, archWash, 3);
    } else {
      // Two riveted, polygonal upper-chord trusses. Panel ordinates are shape estimates.
      const heights = [0, 6.3, 8.6, 9.6, 10, 9.6, 8.6, 6.3, 0];
      for (const start of [-53.5, 0]) for (const side of [-1, 1]) {
        const x = side * 5.8;
        for (let i = 0; i < heights.length; i++) {
          const z = start + i * 53.5 / 8, top: Vec3 = [x, y + heights[i], z];
          if (i) {
            const before: Vec3 = [x, y + heights[i - 1], z - 53.5 / 8];
            g.beam(before, top, .48, trussWash, .65);
            g.beam(i <= 4 ? before : top, [x, y, i <= 4 ? z : z - 53.5 / 8], .22, trussWash, .28);
          }
          if (i && i < 8) {
            g.beam([x, y, z], top, .26, trussWash, .42);
            g.beam(top, [-x, top[1], z], .24, trussWash, .35);
            g.box([.08, .85, .9], [x + side * .27, y + .4, z], historicSteel);
            g.box([.08, .85, .9], [x + side * .27, top[1] - .15, z], historicSteel);
            // Visible rivet heads and splice plates; spacing is a visual estimate.
            for (const height of [y + .4, top[1] - .15]) for (const dy of [-.25, .25]) for (const dz of [-.3, 0, .3])
              g.beam([x + side * .31, height + dy, z + dz], [x + side * .37, height + dy, z + dz], .08, historicSteel, .08, true);
          }
        }
      }
      for (const z of [-53.5, 0, 53.5]) g.box([19, 5.2, z ? 4 : 5.5], [0, 1.5, z], concrete);
    }
    root.add(g.finish());
  }
  return root;
}

export function createShanghaiRoads(roads: ShanghaiRoad[], material: MaterialFactory) {
  const g = new CityGeometry(), elevations = shanghaiRoadElevations(roads);
  g.group.name = 'Shanghai roads and graded approaches';
  const asphalt = shanghaiStreetMaterial(material, false, true), concrete = material(0xafafa3, 0, .82), steel = material(0xb3b8b0, .25, .6);
  const paving = shanghaiStreetMaterial(material, true);
  // OSM crossings overlap the road in plan. Asphalt must win their coincident
  // depth; paint is supplied separately by the detailed Bund streetscape.
  paving.polygonOffset = true; paving.polygonOffsetFactor = 1; paving.polygonOffsetUnits = 2;
  const positions: number[] = [], walkPositions: number[] = [], sidePositions: number[] = [];
  const roadUV: number[] = [];
  roads.forEach((r, index) => {
    const surfacePositions = isShanghaiWalkway(r) ? walkPositions : positions;
    let pierDistance = 0;
    let along = 0;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < .01) continue;
      const width = shanghaiRoadWidth(r), nx = -dz / len * width / 2, nz = dx / len * width / 2;
      const steps = r.bridge ? Math.ceil(len / 8) : 1;
      for (let j = 0; j < steps; j++) {
        const t0 = j / steps, t1 = (j + 1) / steps;
        const ax = a[0] + dx * t0, az = a[1] + dz * t0, bx = a[0] + dx * t1, bz = a[1] + dz * t1;
        if (r.bridge && roadBridgeAt(r, [(ax + bx) / 2, (az + bz) / 2])) continue;
        const ay = THREE.MathUtils.lerp(elevations[index][i - 1], elevations[index][i], t0), by = THREE.MathUtils.lerp(elevations[index][i - 1], elevations[index][i], t1);
        surfacePositions.push(ax - nx, ay, az - nz, ax + nx, ay, az + nz, bx + nx, by, bz + nz, ax - nx, ay, az - nz, bx + nx, by, bz + nz, bx - nx, by, bz - nz);
        if (!isShanghaiWalkway(r)) {
          const lit = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified'].includes(r.kind ?? '') && width >= 5;
          const start = lit ? (along + len * t0) / 34 : -1000, end = lit ? (along + len * t1) / 34 : -1000;
          roadUV.push(start, -1, start, 1, end, 1, start, -1, end, 1, end, -1);
        }
        if (!r.bridge || Math.min(ay, by) < 2) continue;
        // Detailed supports are limited to the bridge approaches, not every city viaduct.
        const detailed = Object.values(SHANGHAI_BRIDGES).some(b => Math.hypot(ax - b.x, az - b.z) < (b.length > 200 ? 1050 : 85));
        if (!detailed) continue;
        for (const side of [-1, 1]) {
          const v0: Vec3 = [ax + side * nx, ay, az + side * nz], v1: Vec3 = [bx + side * nx, by, bz + side * nz];
          const a = side === 1 ? v1 : v0, b = side === 1 ? v0 : v1;
          sidePositions.push(...a, ...b, b[0], b[1] - 1.6, b[2], ...a, b[0], b[1] - 1.6, b[2], a[0], a[1] - 1.6, a[2]);
          g.beam([v0[0], ay + .8, v0[2]], [v1[0], by + .8, v1[2]], .13, steel);
          g.box([.12, .9, .12], [v0[0], ay + .45, v0[2]], steel);
        }
        sidePositions.push(ax - nx, ay - 1.6, az - nz, bx + nx, by - 1.6, bz + nz, ax + nx, ay - 1.6, az + nz,
          ax - nx, ay - 1.6, az - nz, bx - nx, by - 1.6, bz - nz, bx + nx, by - 1.6, bz + nz);
        pierDistance += len / steps;
        if (pierDistance >= 32) { pierDistance %= 32; g.box([2.3, ay - 1.6, 2.3], [ax, (ay - 1.6) / 2, az], concrete); }
      }
      along += len;
    }
  });
  const surface = (vertices: number[], m: THREE.Material, uv?: number[]) => {
    if (!vertices.length) return;
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geom.computeVertexNormals();
    // Match the primitive batch attributes before merging.
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv ?? new Float32Array(vertices.length / 3 * 2), 2)); g.add(geom, m);
  };
  surface(positions, asphalt, roadUV); surface(walkPositions, paving); surface(sidePositions, concrete); return g.finish();
}
