import * as THREE from 'three';
import { CityGeometry, type MaterialFactory, type ShanghaiPolygon } from './space-shanghai-geometry';
import { validSceneTime, type Vec3 } from './space-state';
import { centre, scaleRing, edges, buildingFrame, windowBays, bundStone, roofMetal, wallLedge, frontShell, type FrontOpening } from './space-shanghai-facades';
import { createBundBuildings, BUND_BUILDING_IDS } from './space-shanghai-bund';
import type { ShanghaiRoad } from './space-shanghai-bridges';

// IDs select exact OSM footprints, including disconnected relation members.
// Per-tower floor assignment and façade dimensions are photo reconstructions.
// 153 m is the developer's project maximum, not four independently surveyed heights.
const TOMSON = [
  { id: 'relation/12966760', floors: 40, height: 142, roof: 'hip' },
  { id: 'relation/12966761', floors: 40, height: 142, roof: 'hip' },
  { id: 'way/964405391', floors: 44, height: 153, roof: 'flat' },
  { id: 'way/964405392', floors: 44, height: 153, roof: 'flat' },
] as const;
const CUSTOMS_IDS = ['way/178407318', 'way/178407323', 'way/178407326', 'way/178407328', 'way/178407330', 'way/178407333'];
const TOMSON_PODIUM_IDS = ['way/964405396', 'way/964405397', 'way/964405398', 'way/964405399', 'way/964405400'];
export const SHANGHAI_ARCHITECTURE_IDS = new Set<string>([
  ...BUND_BUILDING_IDS, ...TOMSON.map(t => t.id), 'relation/2376366', 'relation/2380996', ...CUSTOMS_IDS, ...TOMSON_PODIUM_IDS,
]);

function customsHouse(polygons: ShanghaiPolygon[], material: MaterialFactory) {
  const main = polygons.find(p => p.id === CUSTOMS_IDS[0]);
  if (!main) return null;
  const frame = buildingFrame([-1288.8, 1643.9], -Math.atan2(36.2, 4.2));
  const g = new CityGeometry(); g.group.name = 'Shanghai Customs House';
  g.group.userData.reconstruction = 'OSM six building parts; 79.2 m overall from Xinhua; intermediate heights, clock diameter and façade details estimated from onsite photo';
  const stone = bundStone(material, 0xbcb6a5, 1.12, true, [6.6, 26, 34.5, 49.5, 63.8], 5.2), trim = bundStone(material, 0xcfc6b1, 1.65, false, [26, 34.5, 49.5, 63.8], 5.2);
  const dark = material(0x253532, .38, .3), bronze = material(0x74664c, .48, .48, .1);
  const plan = frame.plan(main);
  const openings: FrontOpening[] = [];
  for (const x of [-14.8, -8, 0, 8, 15.1]) {
    for (const y of [9.3, 13.6, 18, 22.4, 26.8]) openings.push({ x, y, width: 2.35, height: 2.9 });
    openings.push({ x, y: 32.6, width: 1.8, height: 2.1 });
    if (Math.abs(x) > 12) openings.push({ x, y: 3.3, width: 2.1, height: 3.2 });
  }
  for (const x of [-6.5, 0, 6.5]) openings.push({ x, y: 2.9, width: 3.4, height: 5.4, arch: true });
  frontShell(g, plan, 34.5, openings, stone, trim, dark, bronze);
  for (const y of [1.2, 6.7, 29.5, 31, 34.4]) wallLedge(g, plan, y, y === 29.5 ? .9 : .4, trim, openings);
  windowBays(g, plan, [4, 9.2, 13.6, 18, 22.4, 26.8, 32.6], 4.4, dark, trim, true);
  for (const id of CUSTOMS_IDS.slice(1).filter(id => id !== 'way/178407326')) {
    const p = polygons.find(p => p.id === id); if (!p) continue;
    const local = frame.plan(p);
    g.extrude(local, 34.4, 5.1, stone);
    for (const y of [34.7, 38.5, 39.4]) edges(local, (a, b) => g.beam([a[0], y, a[1]], [b[0], y, b[1]], .6, trim));
    windowBays(g, local, [36.5], 4.1, dark, trim);
  }
  // Four large piers and the recessed entrance sit on the east-facing river elevation.
  for (const x of [-12, -4, 4, 12]) {
    g.box([1.6, 22, 1.25], [x, 18.1, -1.05], trim);
    g.box([2.15, .75, 1.6], [x, 29.2, -1.05], stone);
  }
  for (const x of [-8, 0, 8]) for (const y of [11.5, 15.8, 20.2, 24.6]) {
    g.box([2.32, 1.05, .18], [x, y, -.16], bronze);
    for (const off of [-.8, -.4, 0, .4, .8]) g.box([.035, .87, .09], [x + off, y, -.29], trim);
  }
  for (let x = -17; x <= 17; x += .9) {
    g.box([.35, .65, .82], [x, 30.1, -.46], trim);
    g.box([.48, .12, .94], [x, 30.48, -.46], stone);
  }
  for (const y of [29.1, 30.6, 31]) g.box([37.2, .22, 1.1], [.6, y, -.38], trim);
  for (let i = 0; i < 4; i++) g.box([21, .2, 1 + i * .6], [0, -.45 + i * .2, -2.1], stone);
  const towerPlan = polygons.find(p => p.id === 'way/178407326');
  const [tx, tz] = towerPlan ? centre(frame.plan(towerPlan)) : [0, 6];
  for (const [width, base, height] of [[14.5, 34.5, 8.5], [11, 43, 6.5], [9, 49.5, 12.3], [7.5, 62.1, 4], [5.6, 66.6, 4]]) {
    g.box([width, height, width], [tx, base + height / 2, tz], stone);
    g.box([width + .9, .5, width + .9], [tx, base + height, tz], trim);
    if (base === 49.5) continue;
    for (const side of [-1, 1]) for (const off of [-width * .27, width * .27]) {
      g.box([.9, height * .62, .12], [tx + off, base + height * .48, tz + side * (width / 2 + .04)], dark);
      g.box([.12, height * .62, .9], [tx + side * (width / 2 + .04), base + height * .48, tz + off], dark);
      for (let y = base + height * .2; y < base + height * .77; y += .32) {
        g.box([.9, .075, .23], [tx + off, y, tz + side * (width / 2 + .11)], bronze);
        g.box([.23, .075, .9], [tx + side * (width / 2 + .11), y, tz + off], bronze);
      }
    }
  }
  const cap = new THREE.ConeGeometry(4.55, 1.7, 4); cap.rotateY(Math.PI / 4);
  g.add(cap, trim, [tx, 71.45, tz]);
  g.beam([tx, 72.3, tz], [tx, 79.2, tz], .09, bronze);
  for (const side of [-1, 1]) g.beam([tx + side * 2.8, 70.6, tz], [tx, 77, tz], .025, bronze);
  const building = g.finish();
  // Vector clock faces stay sharp without a downloaded texture or a canvas/font dependency.
  const dial = material(0xe5e2ca, .02, .5, .9), ink = material(0x293330, .28, .42);
  for (let side = 0; side < 4; side++) {
    const face = new CityGeometry(); face.group.name = `Customs clock ${side}`;
    face.add(new THREE.CircleGeometry(2.72, 64), dial);
    face.add(new THREE.TorusGeometry(2.76, .095, 6, 64), ink, [0, 0, .035]);
    face.add(new THREE.TorusGeometry(2.08, .025, 4, 64), ink, [0, 0, .055]);
    for (let tick = 0; tick < 60; tick++) {
      const a = tick * Math.PI / 30, inner = tick % 5 === 0 ? 2.17 : 2.48;
      face.beam([Math.sin(a) * inner, Math.cos(a) * inner, .07], [Math.sin(a) * 2.61, Math.cos(a) * 2.61, .07], tick % 5 === 0 ? .1 : .035, ink);
      if (tick % 5 === 0) face.beam([Math.sin(a) * .48, Math.cos(a) * .48, .055], [Math.sin(a) * 1.93, Math.cos(a) * 1.93, .055], .028, ink);
    }
    const dialGroup = face.finish();
    for (const [name, length, width] of [['hour', 1.48, .14], ['minute', 2.13, .085]] as const) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(width, length, .08).translate(0, length * .4, .16), ink);
      hand.name = `Customs ${name} hand`; dialGroup.add(hand);
    }
    dialGroup.rotation.y = side * Math.PI / 2;
    dialGroup.position.set(tx + Math.sin(dialGroup.rotation.y) * 4.53, 55.7, tz + Math.cos(dialGroup.rotation.y) * 4.53);
    building.add(dialGroup);
  }
  return frame.place(building);
}

export function setShanghaiClockTime(root: THREE.Object3D, timeOfDay: string) {
  const [hours, minutes] = (validSceneTime(timeOfDay) ? timeOfDay : '09:00').split(':').map(Number);
  const time = hours * 60 + minutes;
  root.traverse(o => {
    if (o.name === 'Customs hour hand') o.rotation.z = -time * Math.PI / 360;
    if (o.name === 'Customs minute hand') o.rotation.z = -(time % 60) * Math.PI / 30;
  });
}

function hsbcBuilding(polygons: ShanghaiPolygon[], material: MaterialFactory) {
  const p = polygons.find(p => p.id === 'relation/2380996'); if (!p) return null;
  const frame = buildingFrame([-1277.3, 1716.3], -Math.atan2(82.8, 10.4));
  const g = new CityGeometry(); g.group.name = 'HSBC Building Bund';
  g.group.userData.reconstruction = 'OSM plan and courtyard; façade composition from Shanghai tourism photographs; 46.3 m model height and detail dimensions remain estimates';
  const stone = bundStone(material, 0xc4bdaa, 1.12, true, [6.2, 20.8, 28.7, 35.5]), trim = bundStone(material, 0xd5ccb8, 1.65, false, [20.8, 28.7, 35.5]);
  const dark = material(0x233638, .4, .27), bronze = material(0x685d48, .48, .44);
  const plan = frame.plan(p);
  const openings: FrontOpening[] = [];
  for (const side of [-1, 1]) for (const offset of [19, 23.5, 28, 32.5, 37.5]) {
    const x = side * offset;
    for (const [y, height] of [[9.3, 3.5], [14.5, 2.9], [19.3, 2.9], [27.1, 2.7]]) openings.push({ x, y, width: 2.25, height, pediment: y === 9.3 });
    if (offset === 37.5) openings.push({ x, y: 2.8, width: 3.1, height: 5.3, arch: true });
    else {
      openings.push({ x, y: 2.4, width: 2.4, height: 2.2 });
      openings.push({ x, y: 5.2, width: 2.4, height: .85 });
    }
  }
  for (const x of [-6.2, 0, 6.2]) openings.push({ x, y: 2.8, width: 3.4, height: 5.4, arch: true });
  for (const x of [-9.3, 0, 9.3]) {
    for (const y of [9.5, 14.6, 19.7]) openings.push({ x, y, width: 4.4, height: 3.5 });
    openings.push({ x, y: 27.1, width: 2.25, height: 2.7 });
  }
  frontShell(g, plan, 29.4, openings, stone, trim, dark, bronze);
  windowBays(g, plan, [3.2, 9, 14.1, 19.2, 27.1], 4.8, dark, trim, true);
  for (const y of [1.3, 5.9, 6.6, 23.1, 24.1, 29.3]) wallLedge(g, plan, y, y === 24.1 ? .85 : .38, trim, openings);
  // Paired middle shafts and single end shafts match the photographed six-column portico.
  for (const x of [-12.7, -6.3, -4.5, 4.5, 6.3, 12.7]) {
    g.add(new THREE.CylinderGeometry(.73, .87, 15.5, 20), trim, [x, 14.55, -2.1]);
    for (const [y, radius, height] of [[6.8, 1.03, .45], [7.15, .94, .22], [22.3, 1.02, .6]]) g.add(new THREE.CylinderGeometry(radius, radius, height, 20), trim, [x, y, -2.1]);
    g.box([2.15, .4, 2.15], [x, 22.8, -2.1], trim);
    // Fluting and layered capital leaves are geometric, not flat window stripes.
    for (let rib = 0; rib < 16; rib++) {
      const a = rib * Math.PI / 8;
      g.beam([x + Math.sin(a) * .8, 7.5, -2.1 + Math.cos(a) * .8], [x + Math.sin(a) * .68, 21.7, -2.1 + Math.cos(a) * .68], .045, stone);
    }
    for (let leaf = 0; leaf < 8; leaf++) {
      const a = leaf * Math.PI / 4;
      const geometry = new THREE.SphereGeometry(.22, 6, 5); geometry.scale(1, 2, 1);
      g.add(geometry, stone, [x + Math.sin(a) * .8, 22.05, -2.1 + Math.cos(a) * .8]);
    }
  }
  g.box([29, 1, 3.3], [0, 23.55, -1.2], trim);
  for (const x of [-40.8, -17, 17, 40.8]) {
    g.box([1.5, 17, .65], [x, 14.5, -.5], trim);
    for (let y = 7; y < 23; y += .7) g.box([1.6, .055, .1], [x, y, -.87], stone);
  }
  for (let x = -40; x < 41; x += 1.25) g.box([.42, .5, .9], [x, 23.45, -.55], stone);
  // Parapet balusters and the layered cornice read in silhouette from the opposite bank.
  for (let x = -40; x <= 40; x += 1.15) {
    g.add(new THREE.CylinderGeometry(.11, .17, .95, 8), trim, [x, 30, -.12]);
    if (Math.round((x + 40) / 1.15) % 7 === 0) g.box([.5, 1.3, .7], [x, 30.1, -.12], stone);
  }
  g.box([83, .27, .8], [0, 30.65, -.12], trim);
  for (const x of [-37.5, 37.5]) {
    g.box([8, .45, 1.6], [x, 29.6, -.7], trim);
    for (const side of [-1, 1]) g.box([.6, 3.7, .9], [x + side * 2.7, 27.5, -.45], trim);
  }
  // Octagonal drum is placed over the east entrance, outside the mapped courtyard.
  const z = 4.7;
  for (const [radius, base, height] of [[10, 29.4, 4.2], [8.4, 33.6, 4.1]]) {
    const drum = new THREE.CylinderGeometry(radius, radius, height, 8); drum.rotateY(Math.PI / 8);
    g.add(drum, stone, [0, base + height / 2, z]);
    const rim = new THREE.CylinderGeometry(radius + .35, radius + .35, .45, 8); rim.rotateY(Math.PI / 8);
    g.add(rim, trim, [0, base + height, z]);
    for (let face = 0; face < 8; face++) {
      const a = face * Math.PI / 4, r = radius * Math.cos(Math.PI / 8) + .06;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      g.add(new THREE.BoxGeometry(2.1, 2.5, .15), dark, [Math.sin(a) * r, base + height / 2, z + Math.cos(a) * r], q);
      for (const side of [-1, 1]) g.add(new THREE.BoxGeometry(.35, 3.25, .4), trim, [Math.sin(a) * r + Math.cos(a) * side * 1.45, base + height / 2, z + Math.cos(a) * r - Math.sin(a) * side * 1.45], q);
      const apex = new THREE.Vector3(0, base + height - .3, r + .18).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      for (const side of [-1, 1]) {
        const end = new THREE.Vector3(side * 1.8, base + height - 1.05, r + .18).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        g.beam([end.x, end.y, end.z + z], [apex.x, apex.y, apex.z + z], .2, trim);
      }
      if (base === 33.6) {
        const at = (x: number, y: number, depth: number): Vec3 => {
          const v = new THREE.Vector3(x, y, depth).applyQuaternion(q); return [v.x, v.y, v.z + z];
        };
        g.add(new THREE.BoxGeometry(4.6, .25, 1.15), trim, at(0, base + .2, r + .38), q);
        g.add(new THREE.BoxGeometry(4.6, .18, .3), trim, at(0, base + 1.25, r + .82), q);
        for (let x = -1.9; x <= 1.9; x += .47) g.add(new THREE.CylinderGeometry(.075, .12, .9, 8), trim, at(x, base + .75, r + .82));
        const corner = (face + .5) * Math.PI / 4;
        const cx = Math.sin(corner) * radius, cz = z + Math.cos(corner) * radius;
        g.box([.6, 4.6, .6], [cx, base + 2, cz], trim);
        g.add(new THREE.CylinderGeometry(.27, .36, .5, 10), bronze, [cx, 38.5, cz]);
        g.add(new THREE.SphereGeometry(.28, 10, 8), trim, [cx, 38.85, cz]);
      }
    }
  }
  const dome = new THREE.SphereGeometry(8.3, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, .64, 1);
  // Shanghai's 2022 lighting report shows a honey-gold dome, brighter than the
  // facade wash. Retain the ribs and stone drum as separate materials/shadows.
  g.add(dome, roofMetal(material, 0xcaa052, 1.3, 32), [0, 37.9, z]);
  for (let rib = 0; rib < 16; rib++) {
    const a = rib * Math.PI / 8;
    for (let segment = 0; segment < 12; segment++) {
      const t = segment * Math.PI / 24, u = (segment + 1) * Math.PI / 24;
      g.beam([Math.sin(a) * 8.34 * Math.cos(t), 37.9 + 5.35 * Math.sin(t), z + Math.cos(a) * 8.34 * Math.cos(t)], [Math.sin(a) * 8.34 * Math.cos(u), 37.9 + 5.35 * Math.sin(u), z + Math.cos(a) * 8.34 * Math.cos(u)], .055, stone);
    }
  }
  g.add(new THREE.CylinderGeometry(1.45, 1.65, .5, 24), bronze, [0, 43.3, z]);
  g.add(new THREE.CylinderGeometry(.42, .9, 1.45, 20), trim, [0, 44.15, z]);
  g.beam([0, 44.875, z], [0, 45.8, z], .075, bronze);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, radius = i % 2 ? .14 : .35;
    const x = Math.sin(a) * radius, y = Math.cos(a) * radius;
    if (i) star.lineTo(x, y); else star.moveTo(x, y);
  }
  star.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(star, { depth: .07, bevelEnabled: false });
  g.add(starGeometry, bronze, [0, 45.95, z]);
  for (let i = 0; i < 5; i++) g.box([29, .16, 1.2 + i * .55], [0, -.5 + i * .16, -3.2], stone);
  return frame.place(g.finish());
}

function tomsonGrounds(polygons: ShanghaiPolygon[], material: MaterialFactory, roads: ShanghaiRoad[]) {
  const parts = polygons.filter(p => p.kind === 'building' && TOMSON_PODIUM_IDS.includes(p.id));
  if (!parts.length) return null;
  const g = new CityGeometry(); g.group.name = 'Tomson Riviera podium and garden';
  g.group.userData.reconstruction = 'Five OSM podium footprints and mapped pool retained; podium elevations, paving, planted beds and landscape details are illustrative estimates, not a surveyed garden';
  const limestone = material(0xccbca1, .03, .8, .06), edge = material(0xe0cfac, .04, .7, .13);
  const glazing = material(0x344948, .28, .26), bronze = material(0x786349, .35, .49);
  const warm = material(0xd8b576, .05, .5, 1.4), leaf = material(0x3e5940, .0, .98), leafLight = material(0x61714a, .0, .96);
  const soil = material(0x55543b, .0, 1), bark = material(0x66513d, .0, .95);
  for (const p of parts) {
    const height = p.id === 'way/964405396' ? 7.2 : p.id === 'way/964405397' ? 4.5 : 5.8;
    g.extrude(p, -.65, height, glazing);
    g.extrude(p, -.65, .9, limestone);
    g.extrude(p, height - .65, .45, edge);
    g.extrude(scaleRing(p, .89), height - .2, .35, bronze);
    edges(p, (a, b, len) => {
      const count = Math.ceil(len / 3.3);
      for (let i = 0; i < count; i++) {
        const t = i / count, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
        g.box([.46, height, .46], [x, height / 2 - .65, z], limestone);
      }
      g.beam([a[0], height - .8, a[1]], [b[0], height - .8, b[1]], .075, warm);
      g.beam([a[0], 2.2, a[1]], [b[0], 2.2, b[1]], .1, bronze);
    });
  }
  const pool = polygons.find(p => p.id === 'way/964405405');
  if (pool) edges(pool, (a, b) => g.beam([a[0], -.12, a[1]], [b[0], -.12, b[1]], .38, edge, .38));
  // Restrained planting in gaps between the mapped structures. These are not cadastral beds.
  // Reject any bed whose full radius touches a footprint or the mapped pool.
  const nearby = polygons.filter(p => p.points.some(([x, z]) => x > -300 && x < -70 && z > 1960 && z < 2160));
  const nearbyRoads = roads.filter(r => !r.bridge && r.points.some(([x, z]) => x > -320 && x < -50 && z > 1940 && z < 2180));
  const clear = (x: number, z: number, radius: number) => !nearbyRoads.some(r => r.points.slice(1).some((b, i) => {
    const a = r.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < radius + r.width / 2;
  })) && !nearby.some(p => {
    let inside = false, distance = Infinity;
    for (let i = 0, j = p.points.length - 1; i < p.points.length; j = i++) {
      const a = p.points[j], b = p.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
      if ((a[1] > z) !== (b[1] > z) && x < dx * (z - a[1]) / dz + a[0]) inside = !inside;
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
    }
    return inside || distance < radius;
  });
  let beds = 0;
  for (const [x, z, radius] of [[-245, 2052, 5], [-247, 2078, 5], [-222, 2095, 5], [-200, 2115, 5], [-188, 2061, 4.5], [-173, 2041, 4], [-173, 2084, 4], [-216, 2038, 3], [-181, 2135, 3.5]]) {
    if (!clear(x, z, radius + 1)) continue;
    beds++;
    const stretch = .68 + (beds % 3) * .11;
    const bed = new THREE.CylinderGeometry(radius, radius, .12, 48); bed.scale(1, 1, stretch);
    g.add(bed, limestone, [x, -.56, z]);
    const bedSoil = new THREE.CylinderGeometry(radius - .25, radius - .25, .1, 48); bedSoil.scale(1, 1, stretch);
    g.add(bedSoil, soil, [x, -.48, z]);
    // Broadleaf trees with branching crowns; avoid identical spheres in a straight row.
    g.beam([x, -.2, z], [x + .3, 4.1, z + .15], .27, bark, .27, true);
    for (let branch = 0; branch < 7; branch++) {
      const a = branch * 2.399, reach = 1.2 + branch % 3 * .34;
      const at: Vec3 = [x + Math.cos(a) * reach, 3.8 + branch % 3 * .48, z + Math.sin(a) * reach];
      g.beam([x + .2, 2.6, z], at, .11, bark, .11, true);
      const crown = new THREE.IcosahedronGeometry(1.15 + beds % 3 * .09, 2); crown.scale(1, .72, 1);
      g.add(crown, branch % 3 ? leaf : leafLight, at);
      for (let tuft = 0; tuft < 9; tuft++) {
        const t = tuft * 2.399 + beds, reach = .75 + tuft % 2 * .25;
        const spray = new THREE.IcosahedronGeometry(.42 + tuft % 3 * .08, 1); spray.scale(1, .65, 1);
        g.add(spray, tuft % 3 ? leaf : leafLight, [at[0] + Math.cos(t) * reach, at[1] + Math.sin(t * 1.7) * .55, at[2] + Math.sin(t) * reach]);
      }
    }
    for (let shrub = 0; shrub < 13; shrub++) {
      const a = shrub * 2.399, r = (radius - 1) * Math.sqrt((shrub + 1) / 13);
      const geometry = new THREE.IcosahedronGeometry(.75 + shrub % 3 * .12, 1); geometry.scale(1, .42, 1);
      g.add(geometry, shrub % 2 ? leaf : leafLight, [x + Math.cos(a) * r, -.17, z + Math.sin(a) * r * stretch]);
    }
    const lx = x + radius + .45;
    g.box([.16, .75, .16], [lx, -.15, z], bronze);
    g.box([.2, .14, .2], [lx, .27, z], warm);
  }
  g.group.userData.plantedBeds = beds;
  return g.finish();
}

export function createShanghaiArchitecture(polygons: ShanghaiPolygon[], material: MaterialFactory, roads: ShanghaiRoad[] = []) {
  const root = new THREE.Group(); root.name = 'Shanghai architectural reconstructions';
  const stone = material(0xc9b38b, .08, .72), lightStone = material(0xe5d5b3, .05, .69, .045);
  const bronze = material(0x88725d, .32, .45), glazing = material(0x465353, .35, .26);
  const warm = material(0xf1d6a2, .05, .5, .7), interior = material(0x826951, .15, .55, 1.15);
  for (const tower of TOMSON) {
    const parts = polygons.filter(p => p.kind === 'building' && p.id === tower.id);
    if (!parts.length) continue;
    const g = new CityGeometry(); g.group.name = `Tomson Riviera ${tower.id}`;
    g.group.userData.reconstruction = 'OSM footprint; per-tower heights and façade dimensions estimated from developer photos';
    const main = parts.reduce((a, b) => a.points.length > b.points.length ? a : b);
    const floorHeight = (tower.height - 12) / tower.floors, bodyTop = tower.height - 9;
    for (const p of parts) {
      if (p !== main) { g.extrude(p, -.65, bodyTop, stone); continue; }
      g.extrude(scaleRing(p, .87), -.65, bodyTop, glazing);
      g.extrude(p, -.65, 4.1, stone);
      for (let floor = 1; floor <= tower.floors; floor++) {
        const y = 3 + floor * floorHeight;
        g.extrude(p, y, .23, lightStone);
        // Balconies sit outside the recessed window wall, not a painted stripe.
        edges(scaleRing(p, .985), (a, b, len) => {
          const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(b[1] - a[1], b[0] - a[0]));
          g.add(new THREE.BoxGeometry(len, 1.06, .075), bronze, [(a[0] + b[0]) / 2, y + .85, (a[1] + b[1]) / 2], rotation);
          g.beam([a[0], y + 1.4, a[1]], [b[0], y + 1.4, b[1]], .055, lightStone);
          for (let j = 0; j < Math.ceil(len / 2.5); j++) {
            const t = j / Math.ceil(len / 2.5), x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
            g.box([.075, 1.18, .075], [x, y + .82, z], bronze);
          }
        });
      }
      edges(scaleRing(p, .992), (a, b, len) => {
        const count = Math.max(1, Math.floor(len / 4.1));
        for (let i = 0; i < count; i++) {
          const x = THREE.MathUtils.lerp(a[0], b[0], i / count), z = THREE.MathUtils.lerp(a[1], b[1], i / count);
          g.box([.96, bodyTop, .96], [x, bodyTop / 2, z], lightStone);
        }
      });
      // Lit rooms sit ON the recessed glazing, not behind an opaque window shell.
      edges(scaleRing(p, .87), (a, b, len) => {
        const count = Math.floor(len / 3.2), rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(b[1] - a[1], b[0] - a[0]));
        for (let bay = 0; bay < count; bay++) for (let floor = 2; floor < tower.floors; floor++) {
          if (Math.abs(floor * 13 + bay * 7 + Math.round(a[0])) % 11 > 1) continue;
          const t = (bay + .5) / count;
          g.add(new THREE.BoxGeometry(1.5, 1.65, .15), interior, [THREE.MathUtils.lerp(a[0], b[0], t), 3 + floor * floorHeight + 2.15, THREE.MathUtils.lerp(a[1], b[1], t)], rotation);
        }
      });
      g.extrude(scaleRing(p, 1.035), bodyTop - .8, .7, lightStone);
      g.extrude(scaleRing(p, .98), bodyTop, 3.4, glazing);
      if (tower.roof === 'hip') {
        // Layered bronze roof follows the main plan; ridge proportions remain estimated.
        for (let i = 0; i < 16; i++) g.extrude(scaleRing(p, 1.1 - i * .022), bodyTop + 3.4 + i * .32, .35, bronze);
        g.extrude(scaleRing(p, .78), tower.height - .5, .5, bronze);
      } else {
        g.extrude(scaleRing(p, 1.055), bodyTop + 3.4, .9, lightStone);
        g.extrude(scaleRing(p, .68), bodyTop + 4.3, 4.7, bronze);
        edges(scaleRing(p, 1.03), (a, b) => g.beam([a[0], bodyTop + 3.4, a[1]], [b[0], bodyTop + 3.4, b[1]], .14, warm));
      }
    }
    root.add(g.finish());
  }

  const peace = polygons.find(p => p.kind === 'building' && p.id === 'relation/2376366');
  if (peace) {
    const g = new CityGeometry(); g.group.name = 'Fairmont Peace Hotel';
    g.group.userData.reconstruction = 'OSM courtyards retained; 77 m overall and 19 m roof from Shanghai heritage account; façade, setbacks and night wash estimated';
    // Approximate warm architectural wash, driven by the shared night uniform.
    const granite = bundStone(material, 0xbeb5a1, 1.15, true, [5.2, 11.2, 33, 37.6, 44.5, 50, 58], 3.4);
    const trim = bundStone(material, 0xd9d0b8, 1.7, false, [11.2, 33, 37.6, 50, 58], 3.4);
    // The referenced night photograph lights the riverfront and stepped tower
    // much more strongly than the west wings. Coordinates are the OSM world
    // frame used by this building's merged geometry, not camera coordinates.
    for (const surface of [granite, trim]) {
      applyPeaceWash(surface);
    }
    const copper = roofMetal(material, 0x487b61, 1.7, 64);
    g.extrude(peace, -.65, 38.5, granite);
    // The west wing retains all three mapped courtyards; only the riverfront steps up.
    for (const y of [5.2, 11.2, 33, 37.6]) edges(peace, (a, b) => g.beam([a[0], y, a[1]], [b[0], y, b[1]], .65, trim));
    edges(peace, (a, b, length) => {
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length, count = Math.floor(length / 3.4);
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx));
      for (let bay = 0; bay < count; bay++) for (let level = 0; level < 9; level++) {
        const t = (bay + .5) / count, at: Vec3 = [THREE.MathUtils.lerp(a[0], b[0], t), 7.4 + level * 3.2, THREE.MathUtils.lerp(a[1], b[1], t)];
        g.add(new THREE.BoxGeometry(1.5, 2.05, .18), (bay * 7 + level * 3) % 11 < 3 ? interior : glazing, at, rotation);
        g.add(new THREE.BoxGeometry(1.7, .18, .35), trim, [at[0], at[1] - 1.1, at[2]], rotation);
        g.add(new THREE.BoxGeometry(.055, 2.05, .2), bronze, at, rotation);
      }
    });
    const x = -1328, z = 1367;
    for (const [width, depth, base, height] of [[30, 29, 38.5, 6], [26, 25, 44.5, 5.5], [23, 22, 50, 8]]) {
      g.box([width, height, depth], [x, base + height / 2, z], granite);
      g.box([width + 1, .55, depth + 1], [x, base + height, z], trim);
      for (const side of [-1, 1]) for (const offset of [-7.5, -2.5, 2.5, 7.5]) {
        g.box([1.4, 2.7, .15], [x + offset, base + height / 2, z + side * depth / 2], glazing);
        g.box([.15, 2.7, 1.4], [x + side * width / 2, base + height / 2, z + offset], glazing);
      }
    }
    // Four-sided copper pyramid, with standing seams rather than a green flat cap.
    // Shanghai's published heritage account gives the copper roof itself as 19 m.
    const roof = new THREE.ConeGeometry(16.3, 19, 4); roof.rotateY(Math.PI / 4);
    g.add(roof, copper, [x, 67.5, z]);
    for (const side of [-1, 1]) for (let offset = -10.5; offset <= 10.5; offset += 1.5) {
      g.beam([x + side * 11.5, 58, z + offset], [x, 76.8, z], .035, bronze);
      g.beam([x + offset, 58, z + side * 11.5], [x, 76.8, z], .035, bronze);
    }
    root.add(g.finish());
  }
  for (const building of [customsHouse(polygons, material), hsbcBuilding(polygons, material), tomsonGrounds(polygons, material, roads)]) if (building) root.add(building);
  const bund = createBundBuildings(polygons, material);
  if (bund.children.length) root.add(bund);
  setShanghaiClockTime(root, '09:00');
  return root;
}

export function applyPeaceWash(surface: THREE.Material) {
  const compile = surface.onBeforeCompile, key = surface.customProgramCacheKey();
  surface.onBeforeCompile = (shader, renderer) => {
    compile.call(surface, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('totalEmissiveRadiance+=vec3(1.,.56,.22)', `
      float peaceRiverfront=smoothstep(-1344.,-1315.,bundPosition.x);
      float peaceTower=smoothstep(36.,42.,bundPosition.y);
      wash*=mix(.09,.82,max(peaceRiverfront,peaceTower));
      totalEmissiveRadiance+=vec3(1.,.56,.22)`);
  };
  surface.customProgramCacheKey = () => `${key}-peace-riverfront-wash`;
}
