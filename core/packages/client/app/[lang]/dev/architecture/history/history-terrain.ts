import * as T from 'three';
import { HISTORY_LAST, HISTORY_PLACES, HISTORY_SPACING, clampHistoryPosition } from './history-days';
import { environmentBlend, environmentValue, groundY, HISTORY_ENVIRONMENTS, pathY, pathZ, riverZ } from './history-environment';
import type { PaperScenery } from './history-scenery';
import { HISTORY_LANDFORMS } from './history-landforms';
import { LANDFORM_BUILDERS } from './history-landform-builders';

type Point = [number, number, number];

function landColor(art: PaperScenery, x: number, water = false) {
  const { left, right, t } = environmentBlend(x / HISTORY_SPACING), p = art.palette;
  const color = (i: number) => water ? (HISTORY_PLACES[i].biome === 4 ? p.ice : [5, 6].includes(HISTORY_PLACES[i].biome) ? p.ocean : p.water) : p[HISTORY_ENVIRONMENTS[i].ground];
  return new T.Color(color(left)).lerp(new T.Color(color(right)), t);
}

/** Adjacent chunks sample the same world coordinates, joining river, ridges and trail exactly. */
export function buildHistoryLand(art: PaperScenery, root: T.Group, day: number, waterMaterial?: T.MeshStandardMaterial) {
  const p = art.palette;
  const start = day === 0 ? -42 : (day - .5) * HISTORY_SPACING;
  const end = day === HISTORY_LAST ? day * HISTORY_SPACING + 42 : (day + .5) * HISTORY_SPACING;
  const base = art.mesh(root, new T.PlaneGeometry(end - start, 101), p.paper, [(start + end) / 2, -1.3, 24.5]);
  base.rotation.x = -Math.PI / 2; base.castShadow = false;
  const surface = (sample: (x: number, v: number) => Point, color: (x: number, v: number) => T.Color, rows = 1, sharedMaterial?: T.MeshStandardMaterial) => {
    const vertices: number[] = [], colors: number[] = [], uvs: number[] = [];
    const columns = Math.round((end - start) / .7);
    for (let column = 0; column < columns; column++) for (let row = 0; row < rows; row++) {
      const x = start + column * .7, nextX = start + (column + 1) * .7;
      const a = row / rows, b = (row + 1) / rows;
      for (const [xx, v] of [[x, a], [x, b], [nextX, a], [nextX, a], [x, b], [nextX, b]]) {
        vertices.push(...sample(xx, v)); colors.push(...color(xx, v).toArray()); uvs.push(xx / 10, v);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
    const material = sharedMaterial ?? art.material(p.paper).clone();
    if (!sharedMaterial) {
      material.color.setRGB(1, 1, 1); material.vertexColors = true; material.side = T.DoubleSide;
      art.materials.set(`land-${root.children.length}`, material);
    }
    const mesh = new T.Mesh(geometry, material); mesh.receiveShadow = true; root.add(mesh);
    return mesh;
  };
  const waterEdge = (x: number, side: number) => {
    const coast = riverZ(x) + side * environmentValue(x, 'water') / 2;
    if (side > 0) return coast;
    const nearest = Math.round(clampHistoryPosition(x / HISTORY_SPACING));
    if (HISTORY_LANDFORMS[nearest] !== 'fjord') return coast;
    const distance = Math.abs(Math.abs(x - nearest * HISTORY_SPACING) - 9.3);
    const inlet = 1 - T.MathUtils.smoothstep(distance, 1.1, 2.8);
    return coast - inlet * 7;
  };
  const edge = (x: number, side: number) => waterEdge(x, side) + side * .2;
  // A broad continental shelf, then the open foreground bank. Neither is a repeated oval island.
  surface((x, v) => {
    const z = -26 * (1 - v) + edge(x, -1) * v;
    // Each miniature rests on its local ground level. Blend only outside its footprint,
    // then meet the riverbank smoothly; a raised blanket would bury lakes and salt crusts.
    const center = Math.round(clampHistoryPosition(x / HISTORY_SPACING)) * HISTORY_SPACING;
    const parcel = 1 - T.MathUtils.smoothstep(Math.abs(x - center), 13.5, 14);
    const inland = T.MathUtils.smoothstep(edge(x, -1) - z, 0, 5)
      * T.MathUtils.smoothstep(z, -15, -12.8);
    const y = T.MathUtils.lerp(groundY(x) + .06, groundY(center) + .015, parcel * inland);
    return [x, y, z];
  },
    x => landColor(art, x).lerp(new T.Color(p.paper), .77), 8);
  surface((x, v) => [x, groundY(x) - .03, edge(x, 1) + v * 16], () => new T.Color(p.paper));
  const water = surface((x, v) => [x, groundY(x) - .11, waterEdge(x, -1) * (1 - v) + waterEdge(x, 1) * v],
    (x, v) => landColor(art, x, true).lerp(new T.Color(p.paper), Math.abs(v - .5) * .22), 6, waterMaterial);
  water.name = `history-river-${day}`;
  const positions = water.geometry.getAttribute('position');
  water.geometry.setAttribute('riverWidth', new T.Float32BufferAttribute(Array.from({ length: positions.count }, (_, i) => {
    const x = positions.getX(i); return waterEdge(x, 1) - waterEdge(x, -1);
  }), 1));
  // Inlets alter the shoreline, not the main current's direction or phase.
  water.geometry.setAttribute('riverCenter', new T.Float32BufferAttribute(Array.from({ length: positions.count }, (_, i) => riverZ(positions.getX(i))), 1));
  // Sample both sides in world space so reflections stay smooth across streamed sections.
  const normals: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), slope = (groundY(x + .35) - groundY(x - .35)) / .7;
    normals.push(...new T.Vector3(-slope, 1, 0).normalize().toArray());
  }
  water.geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  for (const side of [-1, 1]) for (let layer = 0; layer < 4; layer++) {
    surface((x, v) => [x, groundY(x) - .015 + layer * .038, edge(x, side) + side * (layer * .14 + v * .085)],
      x => landColor(art, x).lerp(new T.Color(p.limestone), .6));
  }
  // High terrain exposes its stacked paper edges toward the viewer.
  for (let layer = 0; layer < 5; layer++) {
    surface((x, v) => [x, -1.2 + (groundY(x) + 1.2) * (layer + v) / 5, edge(x, 1) + 15.95 + (4 - layer) * .1],
      x => landColor(art, x).lerp(new T.Color(layer % 2 ? p.limestone : p.paper), .8));
  }
  // Far ridges inherit local terrain height and palette, so icy peaks fade into open plains.
  for (let layer = 0; layer < 3; layer++) {
    surface((x, v) => {
      const ridge = environmentValue(x, 'ridge');
      const wave = Math.abs(Math.sin(x * .16 + layer * 1.8)) * .65 + Math.abs(Math.sin(x * .31 + layer)) * .35;
      return [x, groundY(x) + v * (1.2 + ridge * wave * (.55 + layer * .12)), -13.5 - layer * 4.3];
    }, x => landColor(art, x).lerp(new T.Color(p.paper), .38 + layer * .2));
  }
  class Trail extends T.Curve<T.Vector3> {
    constructor() { super(); }
    getPoint(t: number, target = new T.Vector3()) {
      const x = start + t * (end - start);
      return target.set(x, pathY(x), pathZ(x));
    }
  }
  const route = art.mesh(root, new T.TubeGeometry(new Trail(), Math.ceil((end - start) / .35), .045, 6, false), p.vermilion);
  route.castShadow = false;
}

export function buildDayTerrain(art: PaperScenery, root: T.Group, day: number) {
  const p = art.palette, env = HISTORY_ENVIRONMENTS[day], place = HISTORY_PLACES[day];
  const id = HISTORY_LANDFORMS[day];
  const terrain = new T.Group(); terrain.name = `history-landform-${id}`; root.add(terrain);
  root = terrain;
  // Low paper contours support the exhibit; the surrounding relief has its own authored structure.
  art.island(root, 0, -1.6, 8.1, 4.1, .7, place.seed % 59, art.mix(p[env.ground], p.paper, .72));
  LANDFORM_BUILDERS[id](art, root, day);

  // Small watercraft belong to the river throughout the journey, including its first date.
  if (!place.authored && place.biome !== 4 && env.water >= 5 && day % 3 === 0) {
    const x = day % 2 ? 7 : -7, worldX = day * HISTORY_SPACING + x;
    const craft = new T.Group(); craft.position.y = groundY(worldX) - groundY(day * HISTORY_SPACING) - .1;
    root.add(craft); art.boat(craft, x, riverZ(worldX), day % 2 === 0);
  }
  // Small habitat details occupy the edges; the centre stays clear for each date's authored sculpture.
  for (const side of [-1, 1]) {
    const x = side * (10.5 + (place.seed % 7) * .1), z = -.7 - (place.seed % 11) * .13;
    if (place.biome === 0 || place.biome === 4 || place.biome === 5) {
      const rock = art.mesh(root, new T.DodecahedronGeometry(.72, 0), place.biome === 4 ? p.ice : p.limestone, [x, .63, z]);
      rock.scale.set(1.4, .55, .85); rock.rotation.y = side * .3;
      for (let i = 0; i < 3; i++) art.line(root, [[x - .65, .59 + i * .12, z + .35], [x, .65 + i * .09, z + .54], [x + .6, .58 + i * .12, z + .38]], .013, p.paper);
      if (place.biome !== 4) for (let i = 0; i < 4; i++) {
        art.cylinder(root, .018, .48 + i * .06, [x + .55 + i * .16, .94, z], p.forest);
        art.mesh(root, new T.IcosahedronGeometry(.07, 0), place.biome === 5 ? p.heather : p.gold, [x + .55 + i * .16, 1.18 + i * .03, z]);
      }
    } else if (place.biome === 1) {
      for (let i = 0; i < 5; i++) {
        const leaf = art.mesh(root, new T.CircleGeometry(.24 + i * .02, 12, .16, Math.PI * 1.86), p.jade, [x + Math.sin(i * 2.3) * .8, .025, 4.2 + Math.cos(i * 2.3) * .65]);
        leaf.rotation.x = -Math.PI / 2;
        art.mesh(root, new T.OctahedronGeometry(.13, 0), p.paper, [leaf.position.x, .17, leaf.position.z]);
      }
    } else if (place.biome === 2) {
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9;
        const leaf = art.shape(root, [[-.08, 0], [.05, .82], [.46, 1.2], [.15, .38]], .035, i % 2 ? p.forest : p.jade, [x, .45, z]);
        leaf.rotation.y = a; leaf.rotation.z = .25;
      }
      art.line(root, [[x, .5, z], [x + .05, 1.7, z], [x + .3, 2.05, z]], .028, p.gold);
      for (let i = 0; i < 3; i++) art.mesh(root, new T.OctahedronGeometry(.09), p.gold, [x + .3, 1.8 + i * .13, z]);
    } else if (place.biome === 3) {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        art.line(root, [[x, .72, z], [x + Math.cos(a) * .35, 1.22, z + Math.sin(a) * .35], [x + Math.cos(a) * .9, .95, z + Math.sin(a) * .9]], .025, p.forest);
        for (let j = 0; j < 3; j++) {
          const leaf = art.mesh(root, new T.CircleGeometry(.16 - j * .025, 5), p.jade, [x + Math.cos(a) * (.3 + j * .2), 1.15 - j * .03, z + Math.sin(a) * (.3 + j * .2)]);
          leaf.rotation.set(-1.1, a, .3); leaf.scale.x = .55;
        }
      }
      art.cylinder(root, .045, .35, [x + .7, .86, z + .6], p.paper);
      art.mesh(root, new T.SphereGeometry(.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), p.clay, [x + .7, 1.04, z + .6]);
    } else if (place.biome === 6) {
      for (let i = 0; i < 5; i++) art.box(root, [1.7, .055, .1], [x, .93, z + i * .13], p.gold);
      for (const dx of [-.6, .6]) {
        art.box(root, [.075, .46, .6], [x + dx, .69, z + .25], p.ink);
        art.line(root, [[x + dx, .91, z + .48], [x + dx, 1.4, z + .61]], .035, p.ink);
      }
      for (let i = 0; i < 3; i++) art.box(root, [1.7, .08, .06], [x, 1.1 + i * .12, z + .58], p.gold);
    } else {
      for (let i = 0; i < 8; i++) {
        const sx = x + (i % 4) * .2, sz = z + Math.floor(i / 4) * .32;
        art.line(root, [[sx, .6, sz], [sx + .05, 1.15, sz], [sx + .19, 1.32, sz]], .016, p.jade);
        for (let j = 0; j < 3; j++) art.mesh(root, new T.OctahedronGeometry(.055), p.gold, [sx + .1 + j * .035, 1.18 + j * .06, sz]);
      }
    }
  }
  if (![2, 4, 6].includes(place.biome)) for (let i = 0; i < 6; i++) {
    const x = -11 + i * 4.2, worldX = day * HISTORY_SPACING + x;
    art.reeds(root, x, riverZ(worldX) - env.water / 2 - .4, day + i);
  }
}
