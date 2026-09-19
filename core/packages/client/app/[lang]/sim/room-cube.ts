import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type Cube from './engine/nxn/cube';
import { supportsRoomCube, type RoomTheme } from './room-themes';

type V = [number, number, number];
// Deliberate miniature-art pigments, independent of the surrounding UI theme.
const INK = '#29354f', CREAM = '#fff0d2', WOOD = '#bd7952', GOLD = '#f7c85b';
const CORAL = '#ed806f', TEAL = '#4bada0', BLUE = '#649ed0', PINK = '#e9abc2';
const LEAF = '#538b69', MINT = '#b3d3a2', LILAC = '#afa8d4';
const palettes: Record<RoomTheme, string[]> = {
  whimsy: [CREAM, '#f4bc9c', '#b3d6cb', '#d7cbe7', '#f6d579', '#add2dd'],
  forest: ['#c4dba9', '#90bba5', '#e4c591', '#a5ccbd', '#dcbbbc', '#d3d9a2'],
  cosmos: ['#647292', '#8e8cac', '#679caa', '#a098b3', '#717eaa', '#759eae'],
};

/** One merged vertex-coloured mesh per room, with no textures or per-object draw calls. */
class Miniature {
  private parts: THREE.BufferGeometry[] = [];
  private shapes = {
    box: new THREE.BoxGeometry(1, 1, 1),
    ball: new THREE.SphereGeometry(1, 10, 7),
    tube: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 10),
    ring: new THREE.TorusGeometry(1, 0.17, 5, 18),
  };

  add(shape: keyof Miniature['shapes'], p: V, size: V, color: string, rotation: V = [0, 0, 0]) {
    const g = this.shapes[shape].toNonIndexed();
    g.deleteAttribute('uv');
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(p[0], p[1] - 0.405, p[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...size),
    );
    g.applyMatrix4(matrix);
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
  }
  box(p: V, size: V, color: string, r?: V) { this.add('box', p, size, color, r); }
  ball(p: V, size: V, color: string) { this.add('ball', p, size, color); }
  tube(p: V, radius: number, height: number, color: string, r?: V) {
    this.add('tube', p, [radius, height, radius], color, r);
  }
  rod(a: V, b: V, radius: number, color: string) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const delta = to.clone().sub(from);
    const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
    this.tube(from.add(to).multiplyScalar(0.5).toArray() as V, radius, delta.length(), color, [euler.x, euler.y, euler.z]);
  }
  ring(p: V, radius: number, color: string, r: V = [0, 0, 0]) {
    this.add('ring', p, [radius, radius, radius], color, r);
  }
  plant(x: number, z: number, h = 0.25) {
    this.tube([x, 0.055, z], 0.065, 0.11, CORAL);
    this.rod([x, 0.1, z], [x, h + 0.1, z], 0.014, LEAF);
    for (let i = 0; i < 3; i++) {
      const side = i % 2 ? -1 : 1;
      this.ball([x + side * 0.045, 0.15 + i * h / 3, z], [0.065, 0.03, 0.033], i % 2 ? MINT : TEAL);
    }
  }
  person(x: number, z: number, shirt = TEAL, y = 0) {
    for (const s of [-1, 1]) {
      this.rod([x + s * 0.035, y + 0.05, z], [x + s * 0.032, y + 0.19, z - 0.012], 0.023, INK);
      this.box([x + s * 0.035, y + 0.025, z + 0.022], [0.06, 0.035, 0.09], CREAM);
      this.rod([x + s * 0.06, y + 0.3, z], [x + s * 0.105, y + 0.2, z + 0.045], 0.023, shirt);
      this.ball([x + s * 0.105, y + 0.2, z + 0.045], [0.027, 0.027, 0.027], '#e7ae83');
    }
    this.ball([x, y + 0.25, z], [0.078, 0.106, 0.05], shirt);
    this.ball([x, y + 0.405, z], [0.062, 0.075, 0.058], '#e7ae83');
    this.ball([x, y + 0.447, z - 0.012], [0.065, 0.04, 0.055], INK);
    for (const s of [-1, 1]) this.ball([x + s * 0.022, y + 0.407, z + 0.053], [0.007, 0.009, 0.006], INK);
  }
  table(x: number, z: number, color = WOOD) {
    this.box([x, 0.28, z], [0.36, 0.045, 0.23], color);
    for (const dx of [-0.14, 0.14]) for (const dz of [-0.08, 0.08])
      this.box([x + dx, 0.14, z + dz], [0.025, 0.27, 0.025], WOOD);
  }
  mushroom(x: number, z: number, h: number, color = CORAL) {
    this.tube([x, h / 2, z], 0.036, h, CREAM);
    this.ball([x, h, z], [h * 0.57, h * 0.28, h * 0.57], color);
    for (const s of [-1, 1]) this.ball([x + s * h * 0.22, h * 1.22, z], [0.023, 0.009, 0.026], CREAM);
  }
  tree(x: number, z: number, h = 0.62) {
    this.tube([x, h * 0.36, z], 0.035, h * 0.72, WOOD);
    this.ball([x, h * 0.74, z], [h * 0.24, h * 0.3, h * 0.22], TEAL);
    this.ball([x - 0.055, h * 0.65, z + 0.035], [h * 0.2, h * 0.22, h * 0.21], LEAF);
  }
  finish() {
    const result = mergeGeometries(this.parts)!;
    for (const g of [...this.parts, ...Object.values(this.shapes)]) g.dispose();
    return result;
  }
}

function living(b: Miniature, scene: number) {
  b.ball([0, 0.015, 0.06], [0.33, 0.012, 0.27], [TEAL, CORAL, LILAC][scene % 3]);
  switch (scene) {
    case 0: // Library, a ladder and a tiny reader.
      b.box([0, 0.31, -0.28], [0.58, 0.62, 0.14], WOOD);
      for (const y of [0.14, 0.35, 0.56]) {
        b.box([0, y, -0.18], [0.6, 0.025, 0.19], CREAM);
        for (let i = 0; i < 7; i++) b.box([-0.235 + i * 0.077, y - 0.073, -0.195], [0.045, 0.12 + (i % 2) * 0.025, 0.1], [CORAL, GOLD, BLUE, MINT][i % 4]);
      }
      b.person(0.16, 0.2, GOLD);
      b.box([0.14, 0.24, 0.29], [0.16, 0.025, 0.11], CREAM, [-0.4, 0, 0]);
      b.plant(-0.28, 0.2); break;
    case 1: // Coffee bar.
      b.table(-0.03, -0.14, CREAM);
      b.box([-0.11, 0.39, -0.19], [0.18, 0.18, 0.14], TEAL);
      b.tube([0.1, 0.34, -0.07], 0.04, 0.07, CORAL);
      b.ring([0.145, 0.35, -0.07], 0.025, CORAL);
      b.person(0.16, 0.18, CORAL); b.plant(-0.29, 0.18, 0.38); break;
    case 2: // Music studio: real raised black keys and a brass horn.
      b.box([-0.06, 0.24, -0.17], [0.49, 0.44, 0.19], INK);
      b.box([-0.06, 0.28, -0.01], [0.49, 0.04, 0.16], CREAM);
      for (let i = 0; i < 8; i++) b.box([-0.26 + i * 0.056, 0.31, -0.045], [0.019, 0.026, 0.07], INK);
      b.person(-0.05, 0.22, PINK);
      b.rod([0.3, 0.03, -0.19], [0.3, 0.48, -0.19], 0.02, GOLD);
      b.add('cone', [0.3, 0.48, -0.19], [0.1, 0.14, 0.1], GOLD, [0, 0, Math.PI / 2]); break;
    case 3: // Artist's atelier.
      for (const x of [-0.2, 0.14]) b.rod([x, 0.02, -0.01], [x * 0.7, 0.61, -0.17], 0.018, WOOD);
      b.box([-0.03, 0.42, -0.12], [0.39, 0.31, 0.035], CREAM);
      b.ball([-0.1, 0.45, -0.09], [0.085, 0.085, 0.009], GOLD);
      b.box([0.04, 0.36, -0.092], [0.17, 0.07, 0.013], TEAL, [0, 0, 0.2]);
      b.person(0.21, 0.2, CORAL); b.tube([-0.28, 0.07, 0.22], 0.06, 0.14, BLUE); break;
    case 4: // Dream bedroom and sculptural bedside lamp.
      b.box([-0.08, 0.11, -0.02], [0.4, 0.18, 0.63], WOOD);
      b.box([-0.08, 0.22, 0.05], [0.4, 0.08, 0.45], LILAC);
      b.ball([-0.08, 0.225, -0.24], [0.17, 0.055, 0.08], CREAM);
      b.box([-0.08, 0.25, -0.34], [0.44, 0.4, 0.04], TEAL);
      b.tube([0.25, 0.17, -0.22], 0.1, 0.28, CORAL);
      b.rod([0.25, 0.32, -0.22], [0.25, 0.51, -0.22], 0.016, GOLD);
      b.add('cone', [0.25, 0.53, -0.22], [0.1, 0.13, 0.1], CREAM); break;
    case 5: // The rooftop greenhouse.
      for (const x of [-0.25, 0, 0.25]) { b.plant(x, -0.23, 0.4); b.plant(x, 0.2, 0.2); }
      b.person(0, 0.01, GOLD); break;
    case 6: // Giant doughnut bakery.
      b.table(0, -0.1, TEAL);
      b.ring([0, 0.51, -0.12], 0.18, CORAL);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.box([Math.cos(a) * 0.18, 0.51 + Math.sin(a) * 0.18, -0.085], [0.025, 0.013, 0.015], i % 2 ? GOLD : CREAM, [0, 0, a]); }
      b.person(-0.22, 0.22, BLUE); b.tube([0.24, 0.065, 0.21], 0.095, 0.13, GOLD); break;
    case 7: // Quiet bath with a toy duck.
      b.ball([0, 0.13, -0.06], [0.34, 0.15, 0.23], CREAM);
      b.ball([0, 0.245, -0.06], [0.28, 0.02, 0.17], BLUE);
      b.ball([0.08, 0.3, -0.04], [0.075, 0.045, 0.047], GOLD);
      b.ball([0.11, 0.36, -0.025], [0.034, 0.036, 0.033], GOLD);
      b.box([0.11, 0.35, 0.015], [0.034, 0.016, 0.035], CORAL);
      b.plant(-0.29, -0.29, 0.42); b.plant(0.29, 0.25); break;
    case 8: // A retro arcade.
      b.box([-0.08, 0.26, -0.13], [0.3, 0.52, 0.26], CORAL);
      b.box([-0.08, 0.4, 0.009], [0.24, 0.19, 0.026], INK);
      b.box([-0.1, 0.41, 0.025], [0.12, 0.035, 0.008], TEAL);
      b.box([-0.08, 0.28, 0.065], [0.32, 0.035, 0.13], GOLD);
      b.rod([-0.15, 0.29, 0.08], [-0.15, 0.34, 0.08], 0.012, INK);
      b.person(0.12, 0.23, BLUE); b.plant(0.29, -0.24); break;
  }
}

function woodland(b: Miniature, scene: number) {
  b.ball([0, 0.025, 0], [0.37, 0.04, 0.34], MINT);
  if (scene !== 1) b.tree(-0.25, -0.23, scene === 4 ? 0.69 : 0.59);
  switch (scene) {
    case 0: b.mushroom(0.1, -0.12, 0.47); b.mushroom(0.29, 0.15, 0.25, GOLD); b.person(-0.14, 0.2, BLUE); break;
    case 1: // Tree house on stilts, with individual ladder rungs.
      for (const x of [-0.18, 0.18]) b.box([x, 0.2, -0.18], [0.04, 0.4, 0.045], WOOD);
      b.box([0, 0.42, -0.19], [0.45, 0.25, 0.31], GOLD);
      b.box([0, 0.42, -0.026], [0.1, 0.15, 0.015], TEAL);
      b.add('cone', [0, 0.65, -0.19], [0.34, 0.25, 0.27], CORAL, [0, Math.PI / 4, 0]);
      for (const x of [-0.06, 0.06]) b.rod([x, 0.03, 0.17], [x, 0.32, -0.03], 0.014, WOOD);
      for (let i = 0; i < 5; i++) b.rod([-0.07, 0.055 + i * 0.055, 0.15 - i * 0.036], [0.07, 0.055 + i * 0.055, 0.15 - i * 0.036], 0.012, CREAM);
      b.mushroom(0.27, 0.18, 0.19); break;
    case 2: // A blue pond and a fishing visitor.
      b.ball([0.05, 0.07, 0.07], [0.28, 0.035, 0.25], BLUE);
      for (const x of [-0.04, 0.16]) b.ball([x, 0.1, 0.12], [0.065, 0.008, 0.055], LEAF);
      b.person(-0.24, 0.18, GOLD);
      b.rod([-0.14, 0.25, 0.23], [0.09, 0.59, 0.17], 0.007, WOOD);
      b.rod([0.09, 0.59, 0.17], [0.12, 0.11, 0.12], 0.002, CREAM); break;
    case 3: // Canvas tent and a campfire.
      b.box([0.09, 0.22, -0.18], [0.31, 0.025, 0.38], GOLD, [0, 0, 0.9]);
      b.box([0.29, 0.22, -0.18], [0.31, 0.025, 0.38], CORAL, [0, 0, -0.9]);
      b.rod([-0.1, 0.07, 0.13], [0.16, 0.07, 0.27], 0.026, WOOD);
      b.rod([-0.1, 0.07, 0.27], [0.16, 0.07, 0.13], 0.026, WOOD);
      b.add('cone', [0.03, 0.19, 0.2], [0.06, 0.24, 0.06], CORAL);
      b.add('cone', [0.02, 0.15, 0.24], [0.035, 0.15, 0.035], GOLD); break;
    case 4: // A tree swing.
      b.rod([-0.25, 0.59, -0.23], [0.28, 0.59, -0.23], 0.025, WOOD);
      for (const x of [0.02, 0.21]) b.rod([x, 0.58, -0.23], [x, 0.15, -0.07], 0.006, CREAM);
      b.box([0.115, 0.15, -0.07], [0.26, 0.025, 0.18], CORAL);
      b.mushroom(-0.15, 0.23, 0.2, LILAC); break;
    case 5: // Snail among giant mushrooms.
      b.mushroom(0.22, -0.18, 0.46, LILAC);
      b.ball([0.02, 0.09, 0.18], [0.22, 0.075, 0.1], GOLD);
      b.ball([-0.04, 0.21, 0.15], [0.13, 0.14, 0.12], CORAL);
      b.ring([-0.04, 0.21, 0.264], 0.065, CREAM);
      for (const x of [0.12, 0.2]) { b.rod([x, 0.12, 0.2], [x, 0.24, 0.23], 0.009, GOLD); b.ball([x, 0.25, 0.23], [0.017, 0.017, 0.017], INK); } break;
    case 6: // White rabbit.
      b.ball([0.1, 0.15, 0.1], [0.15, 0.16, 0.13], CREAM);
      b.ball([0.1, 0.31, 0.14], [0.1, 0.1, 0.09], CREAM);
      for (const x of [0.055, 0.145]) { b.ball([x, 0.47, 0.14], [0.03, 0.12, 0.027], CREAM); b.ball([x, 0.48, 0.163], [0.014, 0.08, 0.008], PINK); b.ball([x, 0.33, 0.22], [0.011, 0.012, 0.009], INK); }
      b.mushroom(-0.24, 0.2, 0.23); break;
    case 7: // Picnic.
      b.box([0.05, 0.073, 0.12], [0.5, 0.018, 0.4], CORAL);
      for (let i = 0; i < 4; i++) b.box([-0.12 + i * 0.12, 0.084, 0.12], [0.045, 0.005, 0.4], CREAM);
      b.tube([0.1, 0.11, 0.09], 0.09, 0.045, CREAM);
      b.ball([0.11, 0.16, 0.1], [0.045, 0.045, 0.045], CORAL);
      b.person(0.21, -0.2, GOLD); break;
    case 8: // Oversized flower garden.
      for (let i = 0; i < 4; i++) {
        const x = -0.2 + (i % 2) * 0.39, z = -0.08 + Math.floor(i / 2) * 0.3, y = 0.35 + (i % 2) * 0.15;
        b.rod([x, 0.04, z], [x, y, z], 0.012, LEAF);
        for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5; b.ball([x + Math.cos(a) * 0.052, y + Math.sin(a) * 0.052, z], [0.036, 0.036, 0.022], i % 2 ? PINK : CREAM); }
        b.ball([x, y, z + 0.02], [0.03, 0.03, 0.02], GOLD);
      } break;
  }
}

function cosmic(b: Miniature, scene: number) {
  // Small inset stars are real geometry as well.
  for (let i = 0; i < 5; i++) b.ball([-0.3 + i * 0.14, 0.58 + (i % 2) * 0.15, -0.365], [0.013, 0.013, 0.01], CREAM);
  b.tube([0, 0.015, 0], 0.33, 0.03, LILAC);
  switch (scene) {
    case 0: // Rocket launch pad.
      b.tube([0, 0.33, -0.06], 0.11, 0.39, CREAM);
      b.add('cone', [0, 0.6, -0.06], [0.11, 0.19, 0.11], CORAL);
      b.ball([0, 0.39, 0.045], [0.055, 0.055, 0.014], BLUE);
      for (const s of [-1, 1]) b.box([s * 0.13, 0.16, -0.06], [0.08, 0.21, 0.16], CORAL, [0, 0, -s * 0.2]);
      b.add('cone', [0, 0.075, -0.06], [0.065, 0.15, 0.065], GOLD, [Math.PI, 0, 0]); break;
    case 1: // Ringed planet on a museum plinth.
      b.tube([0, 0.07, 0], 0.14, 0.14, INK);
      b.rod([0, 0.1, 0], [0, 0.38, 0], 0.015, GOLD);
      b.ball([0, 0.44, 0], [0.19, 0.19, 0.19], CORAL);
      b.ring([0, 0.44, 0], 0.29, GOLD, [1.04, 0.3, 0]);
      b.ball([-0.27, 0.69, -0.2], [0.055, 0.055, 0.055], TEAL); break;
    case 2: // Astronaut and flag.
      b.person(-0.08, 0.08, CREAM);
      b.ball([-0.08, 0.415, 0.08], [0.09, 0.09, 0.085], CREAM);
      b.ball([-0.08, 0.422, 0.151], [0.07, 0.052, 0.023], INK);
      b.box([-0.08, 0.28, -0.012], [0.15, 0.2, 0.08], BLUE);
      b.rod([0.25, 0.03, -0.08], [0.25, 0.64, -0.08], 0.01, CREAM);
      b.box([0.16, 0.56, -0.08], [0.18, 0.12, 0.016], GOLD); break;
    case 3: // Observatory telescope.
      for (const x of [-0.19, 0.19]) b.rod([x, 0.025, 0.1], [0, 0.35, -0.03], 0.016, CREAM);
      b.rod([0, 0.025, -0.28], [0, 0.35, -0.03], 0.016, CREAM);
      b.rod([-0.15, 0.32, 0.12], [0.16, 0.58, -0.18], 0.085, BLUE);
      b.ball([0.16, 0.58, -0.18], [0.086, 0.06, 0.086], GOLD); break;
    case 4: // Solar-panel satellite.
      b.box([0, 0.42, -0.08], [0.17, 0.19, 0.16], GOLD);
      for (const s of [-1, 1]) {
        b.box([s * 0.25, 0.42, -0.08], [0.24, 0.02, 0.3], BLUE);
        for (let i = 0; i < 3; i++) b.box([s * 0.25, 0.434, -0.18 + i * 0.1], [0.23, 0.005, 0.009], CREAM);
      }
      b.rod([0, 0.51, -0.08], [0.04, 0.69, -0.08], 0.01, CREAM);
      b.ball([0.04, 0.69, -0.08], [0.027, 0.027, 0.027], CORAL);
      b.rod([0, 0.03, -0.08], [0, 0.32, -0.08], 0.014, INK); break;
    case 5: // Six-wheeled lunar rover.
      b.box([0, 0.18, 0.02], [0.4, 0.16, 0.32], GOLD);
      for (const x of [-0.23, 0.23]) for (const z of [-0.14, 0.02, 0.18]) b.tube([x, 0.085, z], 0.077, 0.06, INK, [0, 0, Math.PI / 2]);
      b.rod([0.09, 0.26, -0.04], [0.09, 0.51, -0.04], 0.019, CREAM);
      b.box([0.09, 0.52, -0.015], [0.15, 0.08, 0.08], BLUE);
      for (const x of [0.045, 0.135]) b.ball([x, 0.53, 0.032], [0.025, 0.025, 0.013], INK); break;
    case 6: // Friendly alien greenhouse.
      b.mushroom(-0.18, -0.16, 0.46, LILAC);
      b.ball([0.14, 0.2, 0.09], [0.11, 0.17, 0.09], TEAL);
      b.ball([0.14, 0.43, 0.09], [0.13, 0.13, 0.09], MINT);
      for (const x of [0.09, 0.19]) b.ball([x, 0.44, 0.168], [0.025, 0.034, 0.01], INK);
      b.plant(-0.19, 0.24); break;
    case 7: // Mission control.
      b.table(0, -0.18, INK);
      for (const x of [-0.13, 0.13]) {
        b.box([x, 0.43, -0.19], [0.2, 0.19, 0.05], CREAM);
        b.box([x, 0.43, -0.158], [0.16, 0.14, 0.014], TEAL);
        b.box([x, 0.43, -0.145], [0.12, 0.018, 0.009], GOLD);
      }
      b.person(0.04, 0.18, CORAL); break;
    case 8: // A flying saucer above moon rocks.
      b.ball([0, 0.43, -0.05], [0.3, 0.065, 0.25], TEAL);
      b.ball([0, 0.51, -0.05], [0.14, 0.12, 0.13], CREAM);
      for (const x of [-0.18, 0, 0.18]) b.ball([x, 0.43, 0.16], [0.028, 0.022, 0.018], GOLD);
      for (const x of [-0.24, 0.21]) b.ball([x, 0.06, 0.1], [0.09, 0.06, 0.08], LILAC);
      b.rod([0, 0.025, -0.05], [0, 0.38, -0.05], 0.012, BLUE); break;
  }
}

export const ROOM_SCENE_COUNT = 9;

/** Stable HOME-index rooms follow the existing static/moving instance matrices. */
export class RoomCube extends THREE.Group {
  readonly rooms = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>>();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private readonly wasVisible: boolean;
  private disposed = false;

  constructor(readonly cube: Cube, readonly theme: RoomTheme) {
    super();
    if (!supportsRoomCube(cube.order) || cube.isMirror || !(theme in palettes)) throw new Error('Rooms require an ordinary 2–7 layer cube and a valid theme');
    this.name = `room-cube-${theme}`;
    this.wasVisible = cube.instancedRenderer.visible;
    const n = cube.order, mid = (n - 1) / 2;
    let ordinal = 0;
    for (const [initial] of cube.initials) {
      const xyz = [initial % n, Math.floor(initial / n) % n, Math.floor(initial / (n * n))];
      // Side rooms stand upright, including the bottom row. U/D-only centres face out.
      const side = xyz[2] === n - 1 ? 0 : xyz[0] === n - 1 ? Math.PI / 2 : xyz[2] === 0 ? Math.PI : xyz[0] === 0 ? -Math.PI / 2 : null;
      const orientation = side === null
        ? new THREE.Matrix4().makeRotationX(xyz[1] === n - 1 ? -Math.PI / 2 : Math.PI / 2)
        : new THREE.Matrix4().makeRotationY(side);
      const outward = (v: V) => {
        const d = new THREE.Vector3(...v).transformDirection(orientation).toArray();
        return d.some((value, axis) => Math.abs(value) > 0.9 && xyz[axis] === (value > 0 ? n - 1 : 0));
      };
      const b = new Miniature(), color = palettes[theme][ordinal % 6];
      b.box([0, -0.018, 0], [0.92, 0.055, 0.92], color);
      for (const sign of [-1, 1]) {
        if (!outward([sign, 0, 0])) b.box([sign * 0.446, 0.38, 0], [0.028, 0.79, 0.92], color);
        if (!outward([0, 0, sign])) b.box([0, 0.38, sign * 0.446], [0.92, 0.79, 0.028], color);
      }
      // Open structural frames preserve the cube silhouette without covering the contents.
      for (const x of [-0.446, 0.446]) for (const z of [-0.446, 0.446])
        b.box([x, 0.393, z], [0.024, 0.87, 0.024], INK);
      for (const sign of [-1, 1]) {
        b.box([sign * 0.446, 0.815, 0], [0.024, 0.025, 0.916], INK);
        b.box([0, 0.815, sign * 0.446], [0.916, 0.025, 0.024], INK);
      }
      // Thin contrasting floor rim makes the independent physical cubies legible.
      b.box([0, 0.006, 0.443], [0.92, 0.022, 0.033], theme === 'cosmos' ? GOLD : CREAM);
      const scene = (ordinal + Math.floor(ordinal / ROOM_SCENE_COUNT) * 4) % ROOM_SCENE_COUNT;
      ordinal++;
      ({ whimsy: living, forest: woodland, cosmos: cosmic })[theme](b, scene);
      const geometry = b.finish();
      geometry.applyMatrix4(orientation).scale(64, 64, 64);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `${theme}-${scene}-${initial}`;
      mesh.userData.roomScene = scene;
      mesh.matrixAutoUpdate = false;
      // Initialize before first render (also usable in headless geometry tests).
      mesh.matrix.makeTranslation((xyz[0] - mid) * 64, (xyz[1] - mid) * 64, (xyz[2] - mid) * 64);
      this.rooms.set(initial, mesh);
      this.add(mesh);
    }
    cube.instancedRenderer.visible = false;
    cube.add(this);
  }

  override updateMatrixWorld(force?: boolean) {
    if (!this.disposed) for (const [initial, mesh] of this.rooms) {
      this.cube.instancedRenderer.getCubeletRenderMatrix(initial, mesh.matrix);
      mesh.matrixWorldNeedsUpdate = true;
    }
    super.updateMatrixWorld(force);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.removeFromParent();
    this.cube.instancedRenderer.visible = this.wasVisible;
    for (const mesh of this.rooms.values()) mesh.geometry.dispose();
    this.material.dispose();
    this.rooms.clear();
    this.clear();
  }
}
