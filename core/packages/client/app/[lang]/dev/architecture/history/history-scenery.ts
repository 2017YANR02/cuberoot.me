import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HISTORY_PLACES, HISTORY_SPACING } from './history-days';
import { groundY, riverZ } from './history-environment';
import { buildDayTerrain } from './history-terrain';
import { HISTORY_MODELS } from './history-models';

export type PaperPalette = Record<'paper' | 'limestone' | 'jade' | 'forest' | 'water' | 'vermilion' | 'gold' | 'mist' | 'ink' | 'ice' | 'snow' | 'ocean' | 'clay' | 'sand' | 'heather', string>;
type Point = [number, number, number];

/** Paper architecture built from real Three.js geometry, owned by one streamed passage. */
export class PaperScenery {
  readonly materials = new Map<string, T.MeshStandardMaterial>();
  readonly textures = new Set<T.Texture>();
  readonly grain: T.CanvasTexture;
  readonly animations: { object: T.Object3D; kind: 'record' | 'boat' | 'leaf'; base: T.Vector3; phase: number }[] = [];

  animate(object: T.Object3D, kind: 'record' | 'boat' | 'leaf', phase = 0) {
    object.traverse(o => { o.userData.journeyAnimated = true; });
    this.animations.push({ object, kind, phase, base: object.position.clone() });
  }

  update(time: number, position: number) {
    for (const { object, kind, base, phase } of this.animations) {
      if (Math.abs(object.getWorldPosition(new T.Vector3()).x / HISTORY_SPACING - position) > 1.6) continue;
      if (kind === 'record') object.rotation.y = time * .18;
      if (kind === 'boat') { object.position.x = base.x + Math.sin(time * .15 + phase) * .55; object.position.y = base.y + Math.sin(time * .9 + phase) * .045; object.rotation.z = Math.sin(time * .8 + phase) * .02; }
      if (kind === 'leaf') { object.position.y = base.y + Math.sin(time * .6 + phase) * .14; object.rotation.y = time * .12 + phase; }
    }
  }

  constructor(readonly palette: PaperPalette) {
    const paper = document.createElement('canvas');
    paper.width = paper.height = 128;
    const ctx = paper.getContext('2d')!;
    const pixels = ctx.createImageData(128, 128);
    let seed = 7281;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 205 + (seed >>> 26);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    this.grain = new T.CanvasTexture(paper);
    this.grain.wrapS = this.grain.wrapT = T.RepeatWrapping;
    this.grain.repeat.set(3, 3);
    this.textures.add(this.grain);
  }

  material(color: string) {
    let material = this.materials.get(color);
    if (!material) {
      material = new T.MeshStandardMaterial({ color, roughness: .95, bumpMap: this.grain, bumpScale: .025 });
      this.materials.set(color, material);
    }
    return material;
  }

  mix(a: string, b: string, amount: number) { return `#${new T.Color(a).lerp(new T.Color(b), amount).getHexString()}`; }

  mesh(parent: T.Object3D, geometry: T.BufferGeometry, color: string, position: Point = [0, 0, 0]) {
    const mesh = new T.Mesh(geometry, this.material(color));
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(parent: T.Object3D, size: Point, position: Point, color: string) {
    return this.mesh(parent, new T.BoxGeometry(...size), color, position);
  }

  cylinder(parent: T.Object3D, radius: number, height: number, position: Point, color: string, top = radius) {
    return this.mesh(parent, new T.CylinderGeometry(top, radius, height, 32), color, position);
  }

  line(parent: T.Object3D, points: Point[], radius: number, color: string) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    return this.mesh(parent, new T.TubeGeometry(curve, Math.max(12, points.length * 6), radius, 5, false), color);
  }

  ring(parent: T.Object3D, radius: number, tube: number, position: Point, color: string) {
    return this.mesh(parent, new T.TorusGeometry(radius, tube, 6, 72), color, position);
  }

  shape(parent: T.Object3D, points: [number, number][], depth: number, color: string, position: Point = [0, 0, 0]) {
    const shape = new T.Shape();
    shape.moveTo(...points[0]);
    points.slice(1).forEach(p => shape.lineTo(...p));
    shape.closePath();
    return this.mesh(parent, new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }), color, position);
  }

  island(parent: T.Object3D, x: number, z: number, rx: number, rz: number, height: number, seed: number, top?: string) {
    for (let layer = 0; layer < 4; layer++) {
      const points: [number, number][] = [];
      const scale = 1 - layer * .028;
      for (let j = 0; j < 80; j++) {
        const a = j / 80 * Math.PI * 2;
        const r = 1 + .055 * Math.sin(a * 3 + seed) + .027 * Math.sin(a * 7 + seed * .5);
        points.push([Math.cos(a) * rx * r * scale, Math.sin(a) * rz * r * scale]);
      }
      const color = layer === 3 && top ? top : this.mix(this.palette.limestone, this.palette.paper, layer * .21);
      const piece = this.shape(parent, points, height / 4, color, [x, height * (layer + 1) / 4, z]);
      piece.rotation.x = Math.PI / 2;
    }
  }

  tree(parent: T.Object3D, x: number, z: number, size: number, variant: 'pine' | 'maple' | 'round', seed = 0, base = .65) {
    const group = new T.Group(); group.position.set(x, base, z); group.scale.setScalar(size); parent.add(group);
    const p = this.palette;
    this.cylinder(group, .12, 2.6, [0, 1.3, 0], p.ink, .06);
    if (variant === 'pine') {
      for (let i = 0; i < 4; i++) {
        const width = 1.65 - i * .27;
        const y = 1.1 + i * .62;
        const fan = new T.Shape();
        fan.moveTo(-width, 0); fan.quadraticCurveTo(-width * .35, .52, .13, 1.35);
        fan.quadraticCurveTo(width * .5, .5, width, -.05); fan.quadraticCurveTo(0, .13, -width, 0);
        const leaf = this.mesh(group, new T.ExtrudeGeometry(fan, { depth: .16, bevelEnabled: false }), this.mix(p.forest, p.jade, i * .17), [0, y, -.13]);
        leaf.rotation.y = Math.sin(seed + i) * .28;
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.39 + seed;
        const x1 = Math.cos(a) * .95;
        const y = 2.1 + Math.sin(a) * .65;
        const z1 = Math.sin(a * 1.7) * .4;
        this.line(group, [[0, 1, 0], [x1 * .5, y - .35, z1 * .5], [x1, y, z1]], .035, p.ink);
        const color = variant === 'maple' ? this.mix(p.vermilion, p.gold, (i % 3) * .27) : this.mix(p.forest, p.jade, .35 + (i % 3) * .2);
        const points: [number, number][] = [];
        const count = variant === 'maple' ? 14 : 32;
        for (let j = 0; j < count; j++) {
          const angle = j / count * Math.PI * 2;
          const r = variant === 'maple' ? (j % 2 ? .47 : .92) : .73 + Math.sin(angle * 3) * .11;
          points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
        }
        const leaf = this.shape(group, points, .13, color, [x1, y, z1]);
        leaf.rotation.y = (i % 3 - 1) * .25;
      }
    }
    return group;
  }

  reeds(parent: T.Object3D, x: number, z: number, seed: number) {
    for (let i = 0; i < 5; i++) {
      const dx = Math.sin(i * 3.1 + seed) * .35;
      const height = .5 + (i % 3) * .19;
      this.line(parent, [[x + dx, .12, z], [x + dx + .1, height * .6, z], [x + dx + .18, height, z + .1]], .018, this.palette.forest);
      const leaf = this.mesh(parent, new T.SphereGeometry(.085, 6, 5), this.palette.gold, [x + dx + .18, height, z + .1]);
      leaf.scale.y = 2.7;
    }
  }

  roof(parent: T.Object3D, x: number, y: number, z: number, width: number, depth: number, color: string) {
    // A swept, upturned ridge with visible stacked paper eaves.
    const pts: [number, number][] = [[-width / 2, .52], [-width * .36, .2], [0, 1.28], [width * .36, .2], [width / 2, .52], [width * .45, -.08], [0, .88], [-width * .45, -.08]];
    this.shape(parent, pts, depth, color, [x, y, z - depth / 2]);
    this.shape(parent, pts, depth + .2, this.palette.limestone, [x, y - .16, z - depth / 2 - .1]);
    this.line(parent, [[x, y + 1.34, z - depth / 2 - .15], [x, y + 1.25, z], [x, y + 1.34, z + depth / 2 + .15]], .07, this.palette.gold);
  }

  pavilion(parent: T.Object3D, x: number, z: number, scale = 1) {
    const g = new T.Group(); g.position.set(x, .65, z); g.scale.setScalar(scale); parent.add(g);
    const p = this.palette;
    for (let i = 0; i < 3; i++) this.box(g, [5.2 - i * .35, .18, 4.4 - i * .3], [0, i * .18, 0], p.paper);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      this.cylinder(g, .11, 3.3, [a * 1.9, 1.85, b * 1.45], p.vermilion);
      this.box(g, [.38, .17, .38], [a * 1.9, .58, b * 1.45], p.gold);
    }
    this.roof(g, 0, 3.6, 0, 6.3, 4.6, p.forest);
    for (const side of [-1, 1]) {
      this.box(g, [.1, .1, 2.8], [side * 1.92, 1.35, 0], p.vermilion);
      for (let i = 0; i < 7; i++) this.box(g, [.05, .65, .05], [side * 1.92, 1, -1.3 + i * .43], p.vermilion);
    }
    return g;
  }

  steps(parent: T.Object3D, x: number, z: number, width: number, count: number, rise = .18) {
    for (let i = 0; i < count; i++) this.box(parent, [width, rise * (count - i), .5], [x, rise * (count - i) / 2, z + i * .48], this.palette.paper);
  }

  bridge(parent: T.Object3D, x: number, z: number, length = 7, width = 1.7) {
    const p = this.palette;
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const y = .3 + Math.sin(t * Math.PI) * 1.15;
      this.box(parent, [width, .14, length / 19], [x, y, z + (t - .5) * length], p.paper);
    }
    for (const side of [-1, 1]) {
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10; const y = .5 + Math.sin(t * Math.PI) * 1.15;
        this.box(parent, [.07, .8, .07], [x + side * width / 2, y + .25, z + (t - .5) * length], p.vermilion);
        points.push([x + side * width / 2, y + .62, z + (t - .5) * length]);
      }
      this.line(parent, points, .045, p.vermilion);
    }
  }

  boat(parent: T.Object3D, x: number, z: number, sail = false) {
    const group = new T.Group(); group.position.set(x, 0, z); parent.add(group);
    parent = group; const phase = x; x = 0; z = 0;
    const p = this.palette;
    const hull = this.shape(parent, [[-1.5, .35], [-1.05, -.1], [.9, -.1], [1.6, .4], [.85, .19], [-.85, .15]], .62, p.ink, [x, .1, z]);
    hull.rotation.y = -.35;
    this.box(parent, [1.7, .06, .58], [x, .36, z + .3], p.gold);
    if (sail) {
      this.cylinder(parent, .035, 2.8, [x, 1.7, z + .3], p.ink);
      this.shape(parent, [[.1, .1], [1.7, .2], [.15, 2.4]], .05, p.paper, [x, .75, z + .3]);
    }
    this.animate(group, 'boat', phase);
  }

  medal(parent: T.Object3D, x: number, y: number, z: number, radius = .7) {
    const p = this.palette;
    const medal = this.cylinder(parent, radius, .13, [x, y, z], p.gold); medal.rotation.x = Math.PI / 2;
    this.ring(parent, radius * .82, .025, [x, y, z + .08], p.paper);
    const star: [number, number][] = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2; const r = radius * (i % 2 ? .22 : .5); star.push([Math.cos(a) * r, Math.sin(a) * r]); }
    this.shape(parent, star, .06, p.paper, [x, y, z + .09]);
  }

  /** Merge within each date only, preserving independent culling and bounded draw calls. */
  flatten(root: T.Group) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const buckets = new Map<T.Material, T.BufferGeometry[]>();
    const old: T.Mesh[] = [];
    root.traverse(o => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material) || o.userData.journeyAnimated) return;
      const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      geometry.deleteAttribute('uv1');
      const list = buckets.get(o.material) ?? []; list.push(geometry); buckets.set(o.material, list); old.push(o);
    });
    for (const mesh of old) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const [material, geometries] of buckets) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      if (!geometry) throw new Error('Unable to merge paper scenery');
      const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
  }

  /** A date's own sculpture, separate from the common terrain so it can be reviewed on its own. */
  buildLandmark(day: number): T.Group {
    const root = new T.Group();
    const p = this.palette;
    const place = HISTORY_PLACES[day], worldX = day * HISTORY_SPACING;
    if (!place.authored) {
      const build = HISTORY_MODELS[place.date as keyof typeof HISTORY_MODELS];
      if (!build) throw new Error(`Missing history sculpture for ${place.date}`);
      build(this, root);
      // Fit each authored sculpture to the same viewing distance, keeping its feet on the paper shelf.
      const bounds = new T.Box3().setFromObject(root, true), size = bounds.getSize(new T.Vector3());
      const scale = Math.min(1.65, 14 / size.x, 10.5 / (bounds.max.y - .72), 8 / size.z);
      root.scale.setScalar(scale);
      root.position.y = .72 * (1 - scale);
      root.position.z = -1.5 - bounds.getCenter(new T.Vector3()).z * scale;
      return root;
    }
    switch (place.motif) {
      case 0: {
        // The layered grotto rises behind a brass vault door.
        for (let i = 0; i < 9; i++) {
          const r = 4.3 - i * .23;
          const arc: [number, number][] = [[-r, 0]];
          for (let j = 0; j <= 32; j++) { const a = Math.PI - j / 32 * Math.PI; arc.push([Math.cos(a) * r, Math.sin(a) * r * 1.2]); }
          arc.push([r, 0]);
          this.shape(root, arc, .24, this.mix(p.limestone, p.paper, .15 + i * .065), [-2.5, .7, -4.5 + i * .23]);
        }
        const door = this.cylinder(root, 1.62, .2, [-2.5, 2.36, -2.15], p.jade); door.rotation.x = Math.PI / 2;
        this.ring(root, 1.58, .09, [-2.5, 2.36, -1.99], p.gold);
        this.ring(root, 1.34, .025, [-2.5, 2.36, -1.94], p.paper);
        for (let i = 0; i < 24; i++) {
          const a = i * Math.PI / 12;
          this.mesh(root, new T.SphereGeometry(.034, 6, 4), p.gold, [-2.5 + Math.cos(a) * 1.45, 2.36 + Math.sin(a) * 1.45, -1.86]);
        }
        for (const y of [1.5, 3.05]) {
          this.box(root, [.53, .22, .12], [-4, y, -1.85], p.gold);
          this.cylinder(root, .1, .36, [-4.19, y, -1.8], p.ink);
        }
        for (const x of [-4.35, -.65]) {
          this.cylinder(root, .06, 1, [x, 1.3, -.48], p.gold);
          this.box(root, [.27, .38, .27], [x, 1.96, -.48], p.paper);
          this.box(root, [.35, .06, .35], [x, 2.18, -.48], p.forest);
        }
        this.ring(root, .55, .055, [-2.5, 2.36, -1.79], p.gold);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; this.line(root, [[-2.5, 2.36, -1.75], [-2.5 + Math.cos(a) * .59, 2.36 + Math.sin(a) * .59, -1.75]], .045, p.gold); }
        this.steps(root, -2.5, -.7, 3.6, 4);
        this.pavilion(root, 5.8, -3.8, .6);
        this.tree(root, -7, -2, 1.5, 'pine', 1); this.tree(root, -5.6, -5, 1.9, 'pine', 4); this.tree(root, 7.8, .2, .85, 'round', 3);
        this.bridge(root, 2.8, riverZ(worldX + 2.8), 8);
        this.boat(root, -5.5, 5.2, true);
        break;
      }
      case 1: {
        this.pavilion(root, -5, -3.3, .68);
        for (let i = 0; i < 4; i++) this.cylinder(root, 3.9 - i * .16, .15, [1.8, .18 + i * .15, .9], i % 2 ? p.paper : p.limestone);
        const record = new T.Group(); record.position.set(1.8, .82, .9); root.add(record);
        this.cylinder(record, 3.16, .16, [0, 0, 0], p.ink);
        for (let i = 0; i < 12; i++) { const ring = this.ring(record, 1.03 + i * .169, .014, [0, .09, 0], this.mix(p.gold, p.ink, .35)); ring.rotation.x = -Math.PI / 2; }
        this.cylinder(record, .88, .04, [0, .12, 0], p.vermilion);
        this.cylinder(record, .12, .08, [0, .17, 0], p.gold);
        this.box(record, [.58, .018, .07], [.32, .15, .4], p.paper);
        this.animate(record, 'record');
        this.line(root, [[5.5, .8, -1.4], [5.3, 1.45, -1.2], [3.6, 1.14, .9]], .065, p.gold);
        this.cylinder(root, .22, .24, [5.4, 1.18, -1.3], p.ink);
        this.box(root, [.45, .15, .22], [3.6, 1.1, .9], p.paper).rotation.y = -.65;
        this.line(root, [[5.55, 1.3, -1.4], [6.1, .9, -1.1], [6.5, .8, -.2]], .024, p.ink);
        for (let i = 0; i < 7; i++) {
          const sleeve = new T.Group(); root.add(sleeve); sleeve.position.set(-5.95 + i * .28, 1.35, -3); sleeve.rotation.z = -.12 + i * .023;
          this.box(sleeve, [.12, 1.55, 1.3], [0, 0, 0], i % 2 ? p.paper : p.jade);
          this.box(sleeve, [.14, .06, .24], [0, .51, .59], p.gold);
        }
        for (let i = 0; i < 5; i++) {
          const x = 4.4 + Math.sin(i) * .5; const y = 2 + i * .38;
          this.line(root, [[x, y, -2], [x + 1.5, y + .15, -.8], [x + 2.2, y + .02, 1.4]], .017, p.gold);
        }
        for (let i = 0; i < 3; i++) {
          const x = 5 + i * .8, y = 3 + Math.sin(i * 1.8) * .65;
          const note = this.mesh(root, new T.SphereGeometry(.13, 12, 8), p.vermilion, [x, y, -.7]); note.scale.set(1.5, .8, .35);
          this.box(root, [.035, .75, .035], [x + .15, y + .36, -.7], p.vermilion);
          this.line(root, [[x + .15, y + .74, -.7], [x + .43, y + .59, -.7], [x + .35, y + .37, -.7]], .027, p.vermilion);
        }
        for (let i = 0; i < 3; i++) { const r = this.ring(root, 1.4 + i * .37, .018, [-5, .09, 4.8], p.paper); r.rotation.x = -Math.PI / 2; r.scale.y = .65; }
        this.tree(root, -9.5, -5, .8, 'round', 3); this.tree(root, 8.4, -6, .9, 'round', 6);
        this.boat(root, 7, riverZ(worldX + 7)); this.bridge(root, -4.8, riverZ(worldX - 4.8), 7.5, 1.25);
        break;
      }
      case 2: {
        this.cylinder(root, 4.4, .35, [0, .88, -1], p.paper);
        this.cylinder(root, 4, .1, [0, 1.12, -1], p.jade);
        const nodes: Point[] = [[-2.4, 1.65, -1], [0, 2.3, -2.7], [2.5, 1.8, -.5], [.4, 1.5, 1.4]];
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i], b = nodes[(i + 1) % nodes.length];
          this.line(root, [a, [(a[0] + b[0]) / 2, 2.8, (a[2] + b[2]) / 2], b], .045, p.gold);
          this.cylinder(root, .55, .4, a, p.paper);
          this.mesh(root, new T.OctahedronGeometry(.4), p.vermilion, [a[0], a[1] + .55, a[2]]);
          this.cylinder(root, .07, a[1] - 1.15, [a[0], (a[1] + 1.15) / 2, a[2]], p.gold);
          for (let j = 0; j < 6; j++) this.box(root, [.05, .04, .14], [a[0] - .28 + j * .11, a[1] + .22, a[2] + .35], p.gold);
        }
        const hoop = this.ring(root, 4, .045, [0, 3, -1], p.gold); hoop.rotation.y = .28;
        for (const x of [-3.82, 3.82]) this.line(root, [[x, 1.2, -1], [x, 2.1, -1], [x, 3, -1]], .085, p.ink);
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2;
          this.box(root, [.04, .025, i % 4 ? .18 : .32], [Math.sin(a) * 3.7, 1.2, -1 + Math.cos(a) * 3.7], p.gold).rotation.y = a;
        }
        this.pavilion(root, -6.5, -4, .65);
        for (let i = 0; i < 7; i++) { const book = this.box(root, [.21, 1.1 + (i % 2) * .2, .75], [-7.2 + i * .23, 1.8, -3.5], i % 2 ? p.gold : p.jade); book.rotation.z = (i % 3 - 1) * .08; }
        this.steps(root, 0, 2.9, 2.8, 5);
        this.boat(root, 7, riverZ(worldX + 7), true);
        break;
      }
      case 3: {
        for (let i = 0; i < 7; i++) this.tree(root, -8.2 + i * 2.5, -4.8 + Math.sin(i * 2) * 1.5, 1.1 + (i % 3) * .25, 'maple', i * 4);
        for (let i = 0; i < 3; i++) {
          const frame = new T.Group(); frame.position.set(-4.7 + i * 4.5, .8, -.2 + Math.sin(i) * 1.2); frame.rotation.y = (i - 1) * -.13; root.add(frame);
          this.box(frame, [3.3, 3.8, .2], [0, 2.1, 0], p.gold);
          this.box(frame, [2.96, 3.46, .12], [0, 2.1, .17], p.paper);
          const disc = this.cylinder(frame, .42, .025, [.64, 2.96, .25], p.vermilion); disc.rotation.x = Math.PI / 2;
          this.shape(frame, [[-1.4, 0], [-1.4, 1], [-.6, 2.1 + i * .18], [.2, 1.3], [.6, 1.7], [1.4, .9], [1.4, 0]], .05, p.jade, [0, .48, .27]);
          this.shape(frame, [[-1.4, 0], [-1.4, .4], [-.7, 1.1], [.1, .5], [1.1, 1.4 - i * .16], [1.4, .7], [1.4, 0]], .06, p.forest, [0, .48, .35]);
          this.box(frame, [.12, 1, .18], [-1.2, .15, 0], p.ink); this.box(frame, [.12, 1, .18], [1.2, .15, 0], p.ink);
          for (const side of [-1, 1]) {
            this.line(frame, [[side * 1.1, .1, -1.3], [side * 1.1, 3.1, -.18]], .065, p.ink);
            this.line(frame, [[side * 1.15, .2, .05], [side * 1.1, .8, -1]], .035, p.gold);
            for (const y of [.35, 3.83]) this.box(frame, [.3, .045, .035], [side * 1.44, y, .29], p.ink);
          }
          this.box(frame, [1.05, .12, .24], [0, .29, .28], p.limestone);
        }
        this.bridge(root, 5.6, riverZ(worldX + 5.6), 8, 1.4);
        for (let i = 0; i < 12; i++) { const leaf = this.mesh(root, new T.CircleGeometry(.11, 5), i % 2 ? p.gold : p.vermilion, [-8 + i * 1.4, .73, 1.9 + Math.sin(i) * 1.1]); leaf.rotation.x = -Math.PI / 2; }
        break;
      }
      case 4: {
        this.island(root, 0, -1.5, 5, 4, 1.2, 17, p.paper);
        for (let i = 0; i < 3; i++) {
          const gate = new T.Group(); gate.position.set((i - 1) * .38, 1.2 + i * .14, -1.8 - i * 1.45); root.add(gate);
          const color = i % 2 ? p.jade : p.paper;
          this.box(gate, [.42, 5.8, .45], [-2.2, 2.9, 0], color); this.box(gate, [.42, 5.8, .45], [2.2, 2.9, 0], color);
          this.box(gate, [4.8, .42, .45], [0, 5.8, 0], color);
          this.line(gate, [[-2.2, .1, .27], [-2.2, 5.8, .27], [2.2, 5.8, .27], [2.2, .1, .27]], .025, p.gold);
          for (const side of [-1, 1]) {
            this.box(gate, [.9, .15, .85], [side * 2.2, .12, 0], p.limestone);
            this.box(gate, [.58, .32, .53], [side * 2.2, 5.4, 0], p.gold);
            for (let j = 0; j < 5; j++) this.box(gate, [.12, .03, .028], [side * 2.2, 1.2 + j * .18, .245], p.gold);
          }
        }
        for (let i = 0; i < 11; i++) this.box(root, [2.1, .16, .65], [0, .23 + i * .15, 4.9 - i * .58], p.paper);
        for (let i = 0; i < 4; i++) {
          const crystal = this.mesh(root, new T.OctahedronGeometry(.7 + i * .12), i % 2 ? p.ice : p.snow, [Math.cos(i * 1.9) * 6.6, 2.3 + i * .6, -2.8 + Math.sin(i * 2) * 2]); crystal.rotation.set(.3, i, .2);
          this.animate(crystal, 'leaf', i);
          this.cylinder(root, 1.1, .13, [crystal.position.x, .9, crystal.position.z], p.paper);
        }
        break;
      }
      case 5: {
        for (let i = 0; i < 5; i++) {
          const x = -4.8 + i * 2.5; const y = 1.5 + Math.sin(i * .8) * 1.5;
          this.box(root, [2.2, 3.3, 2], [x, y + 1, -2.5], p.paper);
          this.box(root, [1.9, 2.95, .14], [x, y + 1, -1.43], p.forest);
          for (let row = 0; row < 3; row++) {
            this.box(root, [2, .09, .3], [x, y + row * .9, -1.25], p.gold);
            for (let book = 0; book < 5; book++) this.box(root, [.25, .6 + (book % 2) * .15, .25], [x - .73 + book * .35, y + row * .9 + .38, -1.23], book % 2 ? p.paper : p.jade);
          }
          this.roof(root, x, y + 2.75, -2.5, 2.8, 2.3, p.jade);
          for (const side of [-1, 1]) {
            this.box(root, [.13, y + .7, .16], [x + side * .9, (y + .7) / 2, -2.1], p.gold);
            this.line(root, [[x + side * .9, .7, -1.5], [x + side * 1.35, y + .4, -2], [x + side * .9, y + .7, -2.1]], .04, p.gold);
          }
          for (let row = 0; row < 3; row++) for (let book = 0; book < 5; book++) {
            for (const band of [.2, .48]) this.box(root, [.23, .025, .025], [x - .73 + book * .35, y + row * .9 + band, -1.085], p.gold);
          }
        }
        this.medal(root, 6.9, 2.2, .5, 1.05); this.box(root, [2.5, .3, 1.5], [6.9, .85, .3], p.paper);
        if (place.biome === 5 && place.authored) {
          this.tree(root, -10, -7.5, .55, 'pine', 2, 8.8); this.tree(root, 10.3, -7.5, .5, 'pine', 4, 9.4);
        }
        this.bridge(root, -6, riverZ(worldX - 6), 8);
        this.boat(root, 3, 6, true);
        break;
      }
      case 6: {
        // Original, stylized skyline silhouettes; deliberately no imported /space page runtime.
        this.cylinder(root, .28, 6.6, [-4.8, 4, -3], p.gold, .14);
        for (const [y, r] of [[2.4, .9], [5.7, 1.1], [7.7, .4]]) this.mesh(root, new T.SphereGeometry(r, 24, 16), p.vermilion, [-4.8, y, -3]);
        this.cylinder(root, .045, 2.2, [-4.8, 8.5, -3], p.gold);
        for (const s of [-1, 1]) this.line(root, [[-4.8 + s * 1.2, .8, -3], [-4.8 + s * .7, 1.5, -3], [-4.8, 3.3, -3]], .12, p.paper);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          this.line(root, [[-4.8 + Math.sin(a) * .82, 5, -3 + Math.cos(a) * .82], [-4.8 + Math.sin(a) * 1.08, 5.7, -3 + Math.cos(a) * 1.08], [-4.8 + Math.sin(a) * .82, 6.4, -3 + Math.cos(a) * .82]], .018, p.gold);
        }
        this.box(root, [1.7, 7.6, 1.6], [-.6, 4.5, -4.4], p.jade);
        this.box(root, [.36, 1.3, 1.6], [-1.27, 8.9, -4.4], p.jade); this.box(root, [.36, 1.3, 1.6], [.07, 8.9, -4.4], p.jade);
        this.box(root, [1.7, .3, 1.6], [-.6, 9.5, -4.4], p.jade);
        for (let i = 0; i < 12; i++) this.box(root, [1.76, .035, 1.66], [-.6, 1.3 + i * .56, -4.4], p.paper);
        for (const x of [-1.2, -.8, -.4, 0]) this.box(root, [.018, 7.2, .025], [x, 4.5, -3.56], p.gold);
        for (let i = 0; i < 12; i++) {
          const tier = this.box(root, [1.65 - i * .065, .6, 1.65 - i * .065], [2.5 + Math.sin(i * .09) * .35, 1.1 + i * .58, -4], p.paper); tier.rotation.y = i * .07;
        }
        for (let i = 0; i < 4; i++) {
          const x = -6 + i * 3.4;
          this.box(root, [2.65, 1.65, 2.1], [x, 1.5, .15], p.paper); this.roof(root, x, 2.3, .15, 2.95, 2.3, p.forest);
          for (let j = 0; j < 3; j++) this.box(root, [.35, .7, .05], [x - .75 + j * .75, 1.65, 1.22], p.gold);
          for (const dx of [-.75, 0, .75]) {
            this.box(root, [.025, .7, .025], [x + dx, 1.65, 1.26], p.paper);
            this.box(root, [.35, .025, .025], [x + dx, 1.65, 1.26], p.paper);
          }
          this.box(root, [2.72, .07, .2], [x, 1.12, 1.25], p.limestone);
        }
        this.medal(root, 4.2, 2.1, 1.3, .57); this.boat(root, -2.5, 6, true);
        break;
      }
      case 7: {
        for (let i = 0; i < 3; i++) {
          const x = -4.7 + i * 4.6, y = .7 + i * .62;
          this.box(root, [3.6, y, 4.1], [x, y / 2, -.6], p.paper);
          this.box(root, [2.9, .09, 3.4], [x, y + .06, -.6], this.mix(p.jade, p.paper, .3));
          this.box(root, [2.6, 2.6, .13], [x, y + 1.85, -1.3], p.gold);
          this.box(root, [2.4, 2.4, .09], [x, y + 1.85, -1.2], p.paper);
          this.steps(root, x, 1.7, 2.6, 3 + i * 2, .15);
          this.medal(root, x, y + 3.65, -1.2, .25 + i * .08);
          for (const side of [-1, 1]) {
            this.line(root, [[x + side * 1.7, y + .75, 1.2], [x + side * 1.7, y + .75, -2.4]], .028, p.gold);
            for (let j = 0; j < 6; j++) this.box(root, [.045, .7, .045], [x + side * 1.7, y + .37, 1.1 - j * .67], p.gold);
          }
          this.box(root, [1.8, .09, .5], [x, y + .2, .8], p.limestone);
          for (let j = 0; j < 7; j++) this.box(root, [.12, .018, .25], [x - .6 + j * .2, y + .26, .8], j <= i * 2 ? p.vermilion : p.paper);
        }
        this.tree(root, -8.7, -4, 1.8, 'pine', 5); this.tree(root, 7.5, -4, 1.5, 'maple', 10);
        this.pavilion(root, 8.5, .5, .5);
        for (let i = 0; i < 10; i++) {
          const x = -12 + i * 2.7;
          this.cylinder(root, .035, 1.5, [x, .83, 3], p.ink);
          this.box(root, [.32, .44, .32], [x, 1.64, 3], p.gold);
          this.box(root, [.45, .06, .45], [x, 1.9, 3], p.forest);
        }
        this.boat(root, 1.4, riverZ(day * HISTORY_SPACING + 1.4) + 2.1);
        break;
      }
    }
    return root;
  }

  buildDay(day: number): T.Group {
    const group = new T.Group();
    buildDayTerrain(this, group, day);
    const root = this.buildLandmark(day); group.add(root);
    // Exhibits are attached later; retain their local parent through the static geometry merge.
    group.userData.exhibitRoot = root;
    this.flatten(group);
    const worldX = day * HISTORY_SPACING;
    group.position.x = worldX;
    group.position.y = groundY(worldX);
    return group;
  }

  dispose() {
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
