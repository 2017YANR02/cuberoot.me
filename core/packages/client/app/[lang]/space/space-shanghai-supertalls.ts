import * as THREE from 'three';
import { CityGeometry, type MaterialFactory } from './space-shanghai-geometry';
import type { Vec3 } from './space-state';

// Metres. Heights come from the owners/designers; plan widths, setback widths,
// cladding and luminaire positions remain photo-derived, not surveyed geometry.
// References and the distinction between design studies/as-built are in /about credits.
const JIN_MAO_FLOORS = [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1];

function glazing(material: MaterialFactory, color: number, floor: number, panel: number, horizontal = false) {
  const m = material(color, .38, .3, .001);
  const compile = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    compile.call(m, shader, renderer);
    shader.vertexShader = 'varying vec2 towerUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntowerUV=uv;');
    shader.fragmentShader = 'varying vec2 towerUV;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 grid=towerUV/vec2(${panel.toFixed(3)},${floor.toFixed(3)});
      vec2 footprint=max(fwidth(grid),vec2(.0001));
      vec2 edge=min(fract(grid),1.-fract(grid));
      vec2 line=(1.-smoothstep(vec2(.022),vec2(.022)+footprint,edge));
      vec2 resolved=1.-smoothstep(vec2(.18),vec2(.7),footprint);
      line=mix(vec2(.044),line,resolved);
      float frame=max(line.x*${horizontal ? '.38' : '.75'},line.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.57,.6,.59),frame*.8);
      float room=fract(sin(dot(floor(grid/vec2(4.,1.)),vec2(23.31,87.12)))*43758.5453);
      float roomResolved=1.-smoothstep(.2,.75,max(footprint.x/4.,footprint.y));
      float lit=mix(.035,step(.79,room)*(.3+.35*room),roomResolved);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.82,.6)*lit*(1.-frame)*cityNight*.35;');
  };
  m.customProgramCacheKey = () => `${key}-supertall-glass-${floor}-${panel}-${horizontal}`;
  return m;
}

type Plan = [number, number][];
function chamfered(half: number, cut: number): Plan {
  return [[half, half - cut], [half - cut, half], [-half + cut, half], [-half, half - cut],
    [-half, -half + cut], [-half + cut, -half], [half - cut, -half], [half, -half + cut]];
}

function jinMaoPlan(half: number): Plan {
  const cut = half * .27, bay = half * .32, points: Plan = [];
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    for (const [x, z] of [[half - cut, half], [bay + .9, half], [bay, half - .65], [-bay, half - .65], [-bay - .9, half], [-half + cut, half]]) points.push([x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)]);
  }
  return points;
}

// Open-sided loft. Per-face metre UVs keep all three curtain walls at a consistent
// physical scale. Counterclockwise X/Z rings produce outward-facing triangles.
function loft(g: CityGeometry, lower: Plan, upper: Plan, bottom: number, top: number, m: THREE.Material) {
  const p: number[] = [], uv: number[] = [];
  let along = 0;
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length, a = lower[i], b = lower[j], c = upper[i], d = upper[j];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    p.push(a[0], bottom, a[1], c[0], top, c[1], b[0], bottom, b[1], b[0], bottom, b[1], c[0], top, c[1], d[0], top, d[1]);
    uv.push(along, bottom, along, top, along + length, bottom, along + length, bottom, along, top, along + length, top);
    along += length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals(); g.add(geo, m);
}

function ring(g: CityGeometry, points: Plan, y: number, width: number, m: THREE.Material, depth = width) {
  points.forEach(([x, z], i) => { const b = points[(i + 1) % points.length]; g.beam([x, y, z], [b[0], y, b[1]], width, m, depth); });
}

function jinMao(material: MaterialFactory) {
  const g = new CityGeometry(); g.group.name = 'Jin Mao Tower'; g.group.position.set(218, -.65, 1796); g.group.rotation.y = -.12;
  const glass = glazing(material, 0x829398, 4.04, 1.4);
  const steel = material(0xc1c1b4, .48, .38, .16), ribs = material(0xbdbdaf, .42, .4, .6);
  const crown = material(0xc8c6b8, .4, .38, 1.25), recess = material(0x35464b, .32, .5);
  // SOM: the initial 16 floors lose two floors per section until eight;
  // subsequent sections lose one floor each. 88 floors, unlike the old 15 drums.
  const halfWidths = [29.3, 28.5, 27.7, 26.9, 26.1, 25.3, 24.5, 23.7, 22.9, 22.1, 21.3, 20.5];
  let bottom = 0;
  JIN_MAO_FLOORS.forEach((floors, section) => {
    const top = bottom + floors * 4.04, half = halfWidths[section];
    // Chamfered shoulders with four shallow recessed central bays break up the
    // broad faces. The shoulders splay out below each projecting cornice.
    const lower = jinMaoPlan(half), upper = jinMaoPlan(half + .6);
    loft(g, lower, upper, bottom, top, glass);
    for (let side = 0; side < 4; side++) {
      const angle = side * Math.PI / 2;
      const point = (x: number, y: number, z: number): Vec3 => [x * Math.cos(angle) - z * Math.sin(angle), y, x * Math.sin(angle) + z * Math.cos(angle)];
      const bayHalf = half * .32;
      // Closely spaced silver fins in the central bay continue vertically through
      // long lower tiers, while corner piers emphasize the stepped silhouette.
      for (let x = -bayHalf; x <= bayHalf + .01; x += bayHalf / 3) {
        g.beam(point(x, bottom, half - .45), point(x, top, half + .15), .22, steel, .48);
      }
      for (const x of [-bayHalf - .45, bayHalf + .45]) g.beam(point(x, bottom, half + .55), point(x, top, half + 1.1), .65, ribs, .9);
    }
    for (let i = 0; i < lower.length; i++) g.beam([lower[i][0], bottom, lower[i][1]], [upper[i][0], top, upper[i][1]], .5, steel, .62);
    // Shallow silver ledges and dark undersides, not luminous gold rings.
    ring(g, upper, top - .35, .5, recess, .8);
    ring(g, upper, top, .6, section > 8 ? crown : steel, 1.1);
    g.extrude({ points: upper }, top - .12, .12, steel);
    bottom = top;
  });
  // Compact stepped lantern and separated prongs. A narrow aerial sets the
  // owner's 420.5 m height; the former full conical roof erased this silhouette.
  for (const [y, h, r] of [[355.52, 7.5, 18.8], [363.02, 7, 15.1], [370.02, 6.4, 11.3], [376.42, 5.5, 7.6]] as const) {
    const plan = chamfered(r, r * .32);
    loft(g, plan, plan, y, y + h, glass);
    ring(g, plan, y + h - .2, .4, crown, .65);
    plan.forEach(([x, z]) => g.beam([x, y, z], [x * .97, y + h + .8, z * .97], .42, crown));
  }
  g.add(new THREE.CylinderGeometry(1.05, 3.1, 12, 8), crown, [0, 387.5, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    g.beam([Math.cos(a) * 1.8, 388, Math.sin(a) * 1.8], [Math.cos(a) * 4.6, 397.5, Math.sin(a) * 4.6], .65, crown);
  }
  g.add(new THREE.CylinderGeometry(.08, .62, 29, 12), crown, [0, 406, 0]);
  const root = g.finish(); root.userData.reconstruction = { height: 420.5, floors: 88, sectionFloors: JIN_MAO_FLOORS, estimated: ['plan widths', 'crown details', 'lighting'] }; return root;
}

function financialCenter(material: MaterialFactory) {
  const g = new CityGeometry(); g.group.name = 'Shanghai World Financial Center'; g.group.position.set(371, -.65, 1871); g.group.rotation.y = -.58;
  const glass = glazing(material, 0x829fae, 4.4, 1.45, true), steel = material(0xafbcc0, .48, .3, .11);
  const light = material(0xb5d3de, .3, .38, .75), dark = material(0x334954, .36, .4);
  // True trapezoidal portal, wider at the top, with four visible inside reveals.
  // The two sweeping side surfaces narrow a square base into a slender roof
  // blade. Keep the opening a hole during deformation, including its reveals.
  const halfDepth = (y: number) => 29 - 22 * Math.pow(y / 492, 1.65);
  const halfWidth = (y: number) => 29 - 4 * y / 492;
  const portalWidth = (y: number) => 13.8 + (y - 444) / 33 * 6.2;
  const rectangle = (left: number, right: number, y: number): Plan => [[right, halfDepth(y)], [left, halfDepth(y)], [left, -halfDepth(y)], [right, -halfDepth(y)]];
  const levels = [...new Set([0, ...Array.from({ length: 111 }, (_, i) => (i + 1) * 4.4), 444, 477, 492])].sort((a, b) => a - b);
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1], b = levels[i];
    if (a >= 444 && b <= 477) {
      loft(g, rectangle(-halfWidth(a), -portalWidth(a), a), rectangle(-halfWidth(b), -portalWidth(b), b), a, b, glass);
      loft(g, rectangle(portalWidth(a), halfWidth(a), a), rectangle(portalWidth(b), halfWidth(b), b), a, b, glass);
    } else loft(g, rectangle(-halfWidth(a), halfWidth(a), a), rectangle(-halfWidth(b), halfWidth(b), b), a, b, glass);
  }
  // Horizontal portal reveals are opaque surfaces, not a face sealing the hole.
  g.box([27.6, .18, halfDepth(444) * 2], [0, 443.91, 0], steel);
  g.box([40, .18, halfDepth(477) * 2], [0, 477.09, 0], steel);
  g.box([50, .2, 14], [0, 491.9, 0], steel);
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    for (let i = 0; i < 48; i++) {
      const a = i * 492 / 48, b = (i + 1) * 492 / 48;
      g.beam([side * (29 - 4 * a / 492), a, face * halfDepth(a)], [side * (29 - 4 * b / 492), b, face * halfDepth(b)], .45, light);
    }
  }
  for (const face of [-1, 1]) {
    const at = (x: number, y: number): Vec3 => [x, y, face * (halfDepth(y) + .13)];
    const portal = [[-13.8, 444], [-20, 477], [20, 477], [13.8, 444]];
    portal.forEach(([x, y], i) => { const b = portal[(i + 1) % 4]; g.beam(at(x, y), at(b[0], b[1]), .5, steel); });
    g.beam(at(-25, 491.7), at(25, 491.7), .55, light);
    // Mechanical floors break the otherwise continuous horizontal curtain wall.
    for (const y of [77, 154, 231, 308, 385, 439]) g.beam(at(-29 + 4 * y / 492, y), at(29 - 4 * y / 492, y), .65, dark, .26);
  }
  const root = g.finish(); root.userData.reconstruction = { height: 492, floors: 101, estimated: ['plan widths', 'portal dimensions', 'lighting'] }; return root;
}

function towerPlan(): Plan {
  // Rounded triangular outer skin, not a three-lobed circular cylinder. Rounded
  // corners and bowed sides follow Gensler's published parametric design study.
  const vertices = Array.from({ length: 3 }, (_, i) => new THREE.Vector2(Math.cos(i * Math.PI * 2 / 3) * 69, Math.sin(i * Math.PI * 2 / 3) * 69));
  const curve = new THREE.CurvePath<THREE.Vector2>();
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3], c = vertices[(i + 2) % 3];
    const start = a.clone().lerp(b, .2), end = a.clone().lerp(b, .8), next = b.clone().lerp(c, .2);
    curve.add(new THREE.QuadraticBezierCurve(start, a.clone().add(b).multiplyScalar(.69), end));
    curve.add(new THREE.QuadraticBezierCurve(end, b, next));
  }
  return curve.getSpacedPoints(96).slice(0, -1).map(p => [p.x, p.y]);
}

function shanghaiTower(material: MaterialFactory) {
  const g = new CityGeometry(); g.group.name = 'Shanghai Tower'; g.group.position.set(206, -.65, 1982);
  const glass = glazing(material, 0xa5b8bb, 4.2, 1.5, true); glass.side = THREE.DoubleSide;
  const mullion = material(0xb2c0bf, .45, .32, .075), seam = material(0xc6cec8, .42, .36, .4), core = material(0x43565a, .3, .5, .02);
  const plan = towerPlan(), segments = plan.length, rows = 100;
  const at = (i: number, t: number): Vec3 => {
    // Figure 4 labels the upper profile at 56.86% of the default profile.
    // This is a design-study reconstruction, not a surveyed as-built outline.
    const [x, z] = plan[i % segments], angle = t * Math.PI * 2 / 3 - .34, scale = Math.exp(Math.log(.5686) * t);
    // 120 degree twist, exponential taper, and the angled 603–632 m open crown.
    const crownY = 617.5 + 14.5 * Math.cos(i / segments * Math.PI * 2);
    const y = t * 603 + Math.max(0, (t - .91) / .09) * (crownY - 603);
    return [(x * Math.cos(angle) - z * Math.sin(angle)) * scale, y, (x * Math.sin(angle) + z * Math.cos(angle)) * scale];
  };
  const pos: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i < segments; i++) { const p = at(i, j / rows); pos.push(...p); uv.push(i / segments * 330, p[1]); }
  // Leave a narrow vertical seam as an actual recess between the skins.
  for (let j = 0; j < rows; j++) for (let i = 1; i < segments - 1; i++) {
    const a = j * segments + i, b = a + segments; indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shell.setIndex(indices); shell.computeVertexNormals(); g.add(shell, glass);
  // The roof is inside the crown, well below its sloping rim: no circular lid.
  g.add(new THREE.CylinderGeometry(12, 12.5, 14, 48), core, [0, 580, 0]);
  for (let i = 1; i < segments; i++) {
    if (i < segments - 1) g.beam(at(i, 1), at(i + 1, 1), .45, seam);
    if (i % 3 === 1 || i === segments - 1) for (let j = 0; j < rows; j += 2) g.beam(at(i, j / rows), at(i, (j + 2) / rows), i === 1 || i === segments - 1 ? .68 : .14, i === 1 || i === segments - 1 ? seam : mullion);
  }
  // Nine stacked zones are visible as paired mechanical belts in the glass.
  for (const y of [68, 128, 190, 252, 313, 374, 435, 496, 558]) for (const delta of [-1.2, 1.2]) for (let i = 1; i < segments - 1; i++) g.beam(at(i, (y + delta) / 603), at(i + 1, (y + delta) / 603), .32, mullion);
  const root = g.finish(); root.userData.reconstruction = { height: 632, twistDegrees: 120, estimated: ['plan curves', 'design-stage taper', 'cladding', 'lighting'] }; return root;
}

export function createShanghaiSupertalls(material: MaterialFactory) {
  const root = new THREE.Group(); root.name = 'Shanghai supertall reconstructions';
  root.add(jinMao(material), financialCenter(material), shanghaiTower(material)); return root;
}
