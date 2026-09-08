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
  x?: number; xFraction?: number; bay?: number; yaw?: number; finish?: string; panel?: string;
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
    ivory: material(0xe5e0ce, .35, .4, .65), shopGreen: material(0x074435, .25, .35, .07),
  };
  for (const item of signage) {
    const building = buildings.get(item.building);
    if (!building) continue;
    const g = new CityGeometry(); g.group.name = `Bund ${item.building} physical signage`;
    g.group.userData.signTexts = item.lines.map(s => s.text);
    const letter = (line: SignLine) => {
      const centers: number[] | undefined = building.userData.groundOpeningCenters;
      const x = line.bay === undefined ? line.x ?? (line.xFraction ?? 0) * (building.userData.frontage ?? 0)
        : centers?.[line.bay + (centers.length - 1) / 2] ?? line.bay * building.userData.groundBayPitch;
      const width = line.bay === undefined ? line.width : Math.min(line.width, building.userData.groundOpeningWidth - .16);
      const position: Vec3 = [x, line.y, line.z];
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), line.yaw ?? Math.PI);
      const geometry = shanghaiSignLetters(font, line.text, line.height, width);
      geometry.computeBoundingBox();
      if (line.panel) {
        const size = geometry.boundingBox!.getSize(new THREE.Vector3());
        const offset = new THREE.Vector3(0, 0, -.085).applyQuaternion(q).add(new THREE.Vector3(...position));
        g.add(new THREE.BoxGeometry(line.bay === undefined ? size.x + .5 : building.userData.groundOpeningWidth - .04, size.y + .26, .14), finishes[line.panel], offset.toArray(), q);
      }
      g.add(geometry, finishes[line.finish ?? 'gold'], position, q);
    };
    if (item.building === 18) {
      // Recessed display surrounds and plinths visible in the reference photo;
      // no invented merchandise or detailed shop interior behind the glazing.
      const width = building.userData.groundOpeningWidth - .12;
      for (const bay of [-2, -1, 1, 2]) {
        const x = bay * building.userData.groundBayPitch;
        for (const dx of [-width / 2, width / 2]) g.box([.1, 3.35, .13], [x + dx, 2.66, .38], finishes.bronze);
        for (const y of [1, 4.33]) g.box([width, .1, .13], [x, y, .38], finishes.bronze);
        g.box([width - .22, 2.95, .04], [x, 2.65, .55], finishes.ivory);
        g.box([width - .4, 2.65, .04], [x, 2.65, .52], finishes.bronze);
        g.box([width * .56, .48, .28], [x, 1.43, .32], finishes.ivory);
        g.box([width * .46, .03, .26], [x, 1.69, .31], finishes.gold);
      }
    }
    if (item.building === 27) {
      // Green lower shop glazing in the referenced photograph. The original
      // recessed opening and mullions remain visible above these infill panels.
      const width = building.userData.groundOpeningWidth - .08;
      for (const bay of [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]) {
        const x = bay * building.userData.groundBayPitch;
        g.box([width, 2.2, .075], [x, 1.92, .39], finishes.shopGreen);
        for (const offset of [-width / 2, 0, width / 2]) g.box([.065, 2.3, .1], [x + offset, 1.92, .32], finishes.bronze);
        for (const y of [.82, 2.35, 3.02]) g.box([width, .065, .1], [x, y, .32], finishes.bronze);
      }
    }
    for (const line of item.lines) letter(line);
    if (item.blade) {
      // South facade, just west of the riverfront corner. A projecting bronze
      // blade has two separately readable faces; neither face is a billboard.
      const x = -1318.7, z = 1383.2, y = 12.1, h = 11.8, w = 2.35;
      const profile = new THREE.Shape().moveTo(-w / 2, -h / 2 + .3)
        .quadraticCurveTo(-w / 2, -h / 2, -w / 2 + .3, -h / 2)
        .lineTo(w / 2 - .3, -h / 2).quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + .3)
        .lineTo(w / 2, h / 2 - .75).quadraticCurveTo(w / 2, h / 2, 0, h / 2)
        .quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - .75).closePath();
      const body = new THREE.ExtrudeGeometry(profile, { depth: .38, bevelEnabled: false, curveSegments: 12 });
      body.translate(0, 0, -.19);
      g.add(body, finishes.bronze, [x, y, z], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
      for (const face of [-1, 1]) {
        const yaw = face * Math.PI / 2;
        const rim = new THREE.Shape(profile.getPoints(12).map(p => p.multiply(new THREE.Vector2(.94, .985))));
        rim.holes.push(new THREE.Path(profile.getPoints(12).map(p => p.multiply(new THREE.Vector2(.885, .975)))));
        g.add(new THREE.ExtrudeGeometry(rim, { depth: .04, bevelEnabled: false }), finishes.warm, [x + face * .215, y, z], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
        // The photographed English reads down a separate narrow column beside
        // the Chinese, with a word gap. Keep each face readable, not mirrored.
        [...item.blade.text].forEach((text, i) => letter({ text, x: x + face * .26, y: y + 3.65 - i * 2.35, z: z - face * .3, yaw, height: 1.65, width: 1.15, finish: 'warm' }));
        let row = 0;
        for (const text of item.blade.english) {
          if (text === ' ') { row += .7; continue; }
          letter({ text, x: x + face * .26, y: y + 4.05 - row * .79, z: z + face * .76, yaw, height: .53, width: .4, finish: 'warm' });
          row++;
        }
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
