import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { CityGeometry, type MaterialFactory } from './space-shanghai-geometry';
import type { Vec3 } from './space-state';
import signage from './space-shanghai-signs-data.json';

// Physical inscriptions, not translated navigation labels. Locations and wording
// follow the photos listed in credits_data.json; dimensions and lettering remain
// estimates. Do not infer a tenant sign from a building's historical name.
type SignLine = {
  text: string; y: number; z: number; height: number; width: number;
  x?: number; xFraction?: number; yaw?: number; finish?: string; panel?: string;
};

export function shanghaiSignLetters(font: Font, text: string, height: number, width: number) {
  if (!text.trim() || !Number.isFinite(height) || !Number.isFinite(width) || height <= 0 || width <= 0)
    throw new Error('Invalid Bund sign dimensions or text');
  for (const character of text) if (!font.data.glyphs[character]) throw new Error(`Missing Bund sign glyph: ${character}`);
  const shapes = font.generateShapes(text, 1);
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: .045, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1, curveSegments: 3, steps: 1 });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3());
  const scale = Math.min(height / size.y, width / size.x);
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  // Keep a real 4.5 cm letter depth when scaling the face to the photo estimate.
  geometry.scale(scale, scale, 1);
  return geometry;
}

export function addShanghaiSigns(architecture: THREE.Group, font: Font, material: MaterialFactory) {
  const buildings = new Map<number, THREE.Object3D>();
  architecture.traverse(o => {
    if (typeof o.userData.bundNumber === 'number') buildings.set(o.userData.bundNumber, o);
    if (o.name === 'Fairmont Peace Hotel') buildings.set(20, o);
    if (o.name === 'HSBC Building Bund') buildings.set(12, o);
  });
  if (!signage.some(s => buildings.has(s.building))) return;
  const finishes: Record<string, THREE.Material> = {
    gold: material(0xd5b774, .65, .32, .3), warm: material(0xffdb9c, .25, .36, 2.2),
    red: material(0xbb1632, .28, .38, 1.6), ink: material(0x272c28, .18, .5, .08),
    teal: material(0x166b64, .32, .4, .35), bronze: material(0x302a23, .48, .4, .02),
    lightbox: material(0xf1ecdb, .12, .55, 1.5),
  };
  for (const item of signage) {
    const building = buildings.get(item.building);
    if (!building) continue;
    const g = new CityGeometry(); g.group.name = `Bund ${item.building} physical signage`;
    g.group.userData.signTexts = item.lines.map(s => s.text);
    const letter = (line: SignLine) => {
      const position: Vec3 = [line.x ?? (line.xFraction ?? 0) * (building.userData.frontage ?? 0), line.y, line.z];
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), line.yaw ?? Math.PI);
      const geometry = shanghaiSignLetters(font, line.text, line.height, line.width);
      geometry.computeBoundingBox();
      if (line.panel) {
        const size = geometry.boundingBox!.getSize(new THREE.Vector3());
        const offset = new THREE.Vector3(0, 0, -.085).applyQuaternion(q).add(new THREE.Vector3(...position));
        g.add(new THREE.BoxGeometry(size.x + .5, size.y + .26, .14), finishes[line.panel], offset.toArray(), q);
      }
      g.add(geometry, finishes[line.finish ?? 'gold'], position, q);
    };
    for (const line of item.lines) letter(line);
    if (item.blade) {
      // South facade, just west of the riverfront corner. A projecting bronze
      // blade has two separately readable faces; neither face is a billboard.
      const x = -1318.7, z = 1383.2, y = 12.1, h = 11.8, w = 2.35;
      g.box([.38, h, w], [x, y, z], finishes.bronze);
      for (const face of [-1, 1]) {
        const yaw = face * Math.PI / 2;
        for (const dz of [-w / 2 + .12, w / 2 - .12]) g.box([.1, h - .2, .065], [x + face * .23, y, z + dz], finishes.warm);
        for (const dy of [-h / 2 + .12, h / 2 - .12]) g.box([.1, .065, w - .2], [x + face * .23, y + dy, z], finishes.warm);
        [...item.blade.text].forEach((text, i) => letter({ text, x: x + face * .25, y: y + 3.5 - i * 2.05, z, yaw, height: 1.45, width: 1.6, finish: 'warm' }));
        letter({ text: item.blade.english, x: x + face * .25, y: y - 4.55, z, yaw, height: .28, width: 1.95, finish: 'warm' });
      }
      // Brackets reach the slanted south wall rather than floating in the road.
      for (const by of [7, 17.2]) g.beam([x, by, z - w / 2], [x, by, 1380.9], .16, finishes.bronze, .16);
      g.group.userData.signTexts.push(item.blade.text, item.blade.english);
      // Ground-floor canopy carries the two riverfront entrance inscriptions.
      g.box([2.6, .25, 10.2], [-1310.4, 5.6, 1366.5], finishes.bronze);
      for (const cz of [1361.8, 1371.2]) g.beam([-1311.6, 6.5, cz], [-1309.35, 5.72, cz], .09, finishes.bronze);
      // Closed glazed doors and sidelights beneath the photographed canopy.
      // Keep them outside the existing stone shell; this is not a walk-in room.
      g.box([.16, 3.55, 6.1], [-1311.15, 1.9, 1366.5], finishes.ink);
      for (const dz of [-3.05, -1.3, 0, 1.3, 3.05]) g.box([.24, 3.65, .085], [-1311.02, 1.9, 1366.5 + dz], finishes.bronze);
      for (const by of [.1, 3.05, 3.72]) g.box([.24, .085, 6.2], [-1311.02, by, 1366.5], finishes.bronze);
      for (const dz of [-.2, .2]) g.box([.2, .7, .045], [-1310.8, 1.75, 1366.5 + dz], finishes.gold);
    }
    building.add(g.finish());
  }
}
