import * as THREE from 'three';
import { CityGeometry, type MaterialFactory, type ShanghaiPolygon } from './space-shanghai-geometry';
import { buildingFrame, centre, edges, frontShell, bundStone, roofMetal, wallLedge, windowBay, windowBays, type FrontOpening } from './space-shanghai-facades';

// Each street elevation was compared with the actual photographs linked in the
// credits and replica tracker. Widths follow OSM; vertical dimensions below are
// photo estimates, NOT survey data. Do not substitute the generic city facade.
type BundBuilding = {
  number: number; id: string; name: string; edge: number; top: number;
  floors: number[]; bays: number; stone: 'grey' | 'warm' | 'ivory' | 'brick';
  cornices: number[]; arches?: number[];
  order?: { count: number; bottom: number; top: number; span: number; pilaster?: boolean };
};
export const BUND_BUILDINGS: readonly BundBuilding[] = [
  { number: 1, id: 'way/178410323', name: 'Asia Building', edge: 2, top: 30.5, floors: [3, 7, 11, 15, 19, 23.5, 27.5], bays: 11, stone: 'warm', cornices: [8.8, 21, 25.6, 30.3], arches: [3, 19] },
  { number: 2, id: 'way/178410325', name: 'Shanghai Club', edge: 4, top: 22.5, floors: [3, 7, 12, 17, 20.5], bays: 9, stone: 'ivory', cornices: [8.8, 19.2, 22.5], arches: [3, 7, 20.5], order: { count: 6, bottom: 9, top: 18.8, span: .64 } },
  { number: 3, id: 'way/178408816', name: 'Union Building', edge: 2, top: 26.5, floors: [3, 7.4, 12, 16.4, 20.7, 24.5], bays: 7, stone: 'grey', cornices: [8.9, 18.6, 22.3, 26.5], arches: [3, 24.5] },
  { number: 5, id: 'way/178408821', name: 'Nissin Building', edge: 6, top: 26, floors: [3, 7, 11.5, 16, 20.5, 24], bays: 5, stone: 'warm', cornices: [8.9, 22, 26], arches: [3, 7], order: { count: 4, bottom: 9, top: 22, span: .65, pilaster: true } },
  { number: 6, id: 'way/178408827', name: 'China Commercial Bank', edge: 9, top: 16.2, floors: [3, 8.3, 13.1], bays: 9, stone: 'grey', cornices: [5.5, 10.6, 16], arches: [3, 8.3, 13.1] },
  { number: 7, id: 'way/178408810', name: 'Great Northern Telegraph', edge: 3, top: 19.2, floors: [3, 8.5, 13.7, 17.3], bays: 7, stone: 'warm', cornices: [5.7, 15.8, 19], arches: [3] },
  { number: 9, id: 'way/178408820', name: 'China Merchants Building', edge: 17, top: 13.8, floors: [2.7, 7, 11.5], bays: 5, stone: 'brick', cornices: [4.7, 9.3, 13.8], arches: [2.7] },
  { number: 14, id: 'way/178405872', name: 'Bank of Communications Bund', edge: 5, top: 27.5, floors: [3, 8, 12.3, 16.6, 20.9, 25.2], bays: 5, stone: 'ivory', cornices: [5.8, 27.5] },
  // Internal numeric key 15.1 represents the actual street address 15-1 / 15甲.
  { number: 15.1, id: 'way/178405874', name: 'Bund Public Service Center 15-1', edge: 6, top: 23.8, floors: [2.8, 7.5, 12.3, 17, 21.7], bays: 7, stone: 'ivory', cornices: [9.6, 19.4, 23.8] },
  { number: 15, id: 'way/178405875', name: 'Russo-Chinese Bank', edge: 2, top: 18, floors: [3, 8.7, 14.1], bays: 9, stone: 'grey', cornices: [5.6, 16.3, 18], arches: [3], order: { count: 6, bottom: 5.8, top: 16.1, span: .67 } },
  { number: 16, id: 'way/1196704496', name: 'Bank of Taiwan Bund', edge: 2, top: 20.3, floors: [3, 8.2, 13.2, 18.1], bays: 5, stone: 'ivory', cornices: [5.7, 16.2, 20.3], arches: [3], order: { count: 4, bottom: 5.9, top: 16, span: .7 } },
  { number: 17, id: 'way/1196704497', name: 'North China Daily News AIA', edge: 2, top: 39.5, floors: [3.1, 7.6, 12.2, 16.5, 20.8, 25.1, 29.4, 33.5, 37.4], bays: 5, stone: 'ivory', cornices: [9.8, 31.4, 39.5], arches: [3.1] },
  { number: 18, id: 'way/1196704498', name: 'Chartered Bank Bund', edge: 2, top: 28.3, floors: [3.2, 8.5, 13, 17.5, 22, 26.2], bays: 7, stone: 'warm', cornices: [5.8, 20.1, 24.1, 28.3], order: { count: 2, bottom: 6, top: 19.9, span: .23 } },
  { number: 19, id: 'way/177998982', name: 'Palace Hotel Peace South', edge: 16, top: 25.8, floors: [2.9, 7.4, 11.8, 16.2, 20.6, 24], bays: 3, stone: 'brick', cornices: [5.1, 9.4, 18.5, 22.5, 25.8], arches: [2.9] },
  { number: 23, id: 'way/177995050', name: 'Bank of China Bund', edge: 2, top: 57.8, floors: [3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55], bays: 7, stone: 'warm', cornices: [9.2, 57.8] },
  { number: 24, id: 'way/177993356', name: 'Yokohama Specie Bank', edge: 2, top: 29.2, floors: [3.1, 8.4, 13, 17.6, 22.2, 27], bays: 7, stone: 'grey', cornices: [5.9, 24.3, 29.2], arches: [3.1], order: { count: 4, bottom: 6.1, top: 24.1, span: .62 } },
  { number: 26, id: 'way/177931019', name: 'Yangtze Insurance Building', edge: 3, top: 28.2, floors: [3, 7, 11.2, 15.4, 19.6, 23.8, 26.8], bays: 3, stone: 'grey', cornices: [5.2, 21.6, 25.4, 28.2], arches: [3, 19.6], order: { count: 2, bottom: 21.7, top: 25.2, span: .35 } },
  { number: 27, id: 'way/177930855', name: 'Jardine Matheson Building', edge: 10, top: 27.8, floors: [3, 8.5, 13.1, 17.7, 22.3, 26.1], bays: 11, stone: 'ivory', cornices: [5.8, 20.2, 24.4, 27.8], arches: [3], order: { count: 6, bottom: 6, top: 20, span: .62 } },
  { number: 28, id: 'way/177930858', name: 'Glen Line Building', edge: 6, top: 28.4, floors: [3, 7.3, 11.7, 16.1, 20.5, 24.8], bays: 5, stone: 'warm', cornices: [5.2, 22.6, 28.4], arches: [3], order: { count: 4, bottom: 9.4, top: 22.5, span: .75, pilaster: true } },
  { number: 29, id: 'way/177930859', name: 'Banque de Indochine', edge: 6, top: 17.5, floors: [3, 8.5, 13.8], bays: 5, stone: 'grey', cornices: [5.5, 16.3, 17.5], arches: [3], order: { count: 4, bottom: 5.7, top: 16.1, span: .75, pilaster: true } },
  { number: 33, id: 'way/160152535', name: 'Former British Consulate', edge: 5, top: 11.4, floors: [2.8, 8], bays: 5, stone: 'grey', cornices: [5.1, 11.3], arches: [2.8] },
];
const BANK_PARTS = ['way/177995048', 'way/177998983'];
const CONSULATE_RESIDENCE = 'way/160152533';
export const BUND_BUILDING_IDS = new Set([...BUND_BUILDINGS.map(b => b.id), ...BANK_PARTS, CONSULATE_RESIDENCE]);

function ionicColumn(g: CityGeometry, x: number, z: number, bottom: number, top: number, radius: number, stone: THREE.Material, pilaster = false) {
  const height = top - bottom;
  if (pilaster) g.box([radius * 1.6, height - .7, radius], [x, (bottom + top) / 2, z], stone);
  else {
    g.add(new THREE.CylinderGeometry(radius * .77, radius, height - .8, 20), stone, [x, (bottom + top) / 2, z]);
    // Narrow raised flutes catch light without adding a draw call per column.
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      g.beam([x + Math.cos(a) * radius * .98, bottom + .5, z + Math.sin(a) * radius * .98],
        [x + Math.cos(a) * radius * .77, top - .55, z + Math.sin(a) * radius * .77], .035, stone, .035, true);
    }
  }
  for (const [y, r, h] of [[bottom + .12, 1.38, .24], [bottom + .4, 1.13, .22], [top - .25, 1.3, .18]])
    g.add(new THREE.CylinderGeometry(radius * r, radius * r, h, 20), stone, [x, y, z]);
  g.box([radius * 2.9, .3, radius * 2.3], [x, top - .02, z], stone);
  if (!pilaster) for (const side of [-1, 1]) {
    g.add(new THREE.TorusGeometry(radius * .31, radius * .09, 5, 14), stone, [x + side * radius, top - .34, z - radius * .8]);
  }
}

function pediment(g: CityGeometry, x: number, y: number, z: number, width: number, rise: number, stone: THREE.Material) {
  const triangle = new THREE.Shape().moveTo(-width / 2, 0).lineTo(width / 2, 0).lineTo(0, rise).closePath();
  g.add(new THREE.ExtrudeGeometry(triangle, { depth: .48, bevelEnabled: false }), stone, [x, y, z]);
  for (const sign of [-1, 1]) g.beam([x + sign * width / 2, y, z - .15], [x, y + rise, z - .15], .25, stone, .4);
  g.box([width + .5, .32, .9], [x, y, z], stone);
}

function balustrade(g: CityGeometry, a: [number, number], b: [number, number], y: number, stone: THREE.Material) {
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (length < 2) return;
  for (const h of [0, 1.05]) g.beam([a[0], y + h, a[1]], [b[0], y + h, b[1]], .26, stone, .4);
  const count = Math.floor(length / .85);
  for (let i = 0; i <= count; i++) {
    const x = THREE.MathUtils.lerp(a[0], b[0], i / count), z = THREE.MathUtils.lerp(a[1], b[1], i / count);
    g.add(new THREE.CylinderGeometry(.105, .145, .8, 6), stone, [x, y + .55, z]);
    if (i % 6 === 0) g.box([.5, 1.12, .5], [x, y + .55, z], stone);
  }
}

function pavilion(g: CityGeometry, x: number, y: number, z: number, radius: number, height: number, stone: THREE.Material, metal: THREE.Material, pointed = false) {
  g.add(new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, .4, 8), stone, [x, y, z]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    g.beam([x + Math.cos(a) * radius * .83, y, z + Math.sin(a) * radius * .83], [x + Math.cos(a) * radius * .83, y + height, z + Math.sin(a) * radius * .83], .27, stone);
  }
  g.add(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, .45, 8), stone, [x, y + height, z]);
  const cap = pointed ? new THREE.ConeGeometry(radius * 1.16, radius * 1.2, 8) : new THREE.SphereGeometry(radius * 1.12, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  if (!pointed) cap.scale(1, .63, 1);
  g.add(cap, metal, [x, y + height + (pointed ? radius * .6 : .1), z]);
  g.beam([x, y + height + radius * .6, z], [x, y + height + radius * (pointed ? 1.7 : 1.15), z], .13, metal);
}

// A hipped roof with a ridge, not a cone or a scaled box. The supplied rectangle
// stays within the mapped building; low sloped roofs retain readable eaves.
function hipRoof(g: CityGeometry, x: number, z: number, width: number, depth: number, y: number, rise: number, metal: THREE.Material) {
  const across = width > depth, half = Math.max(0, (Math.max(width, depth) - Math.min(width, depth)) / 2);
  const a = [-width / 2, 0, -depth / 2], b = [width / 2, 0, -depth / 2], c = [width / 2, 0, depth / 2], d = [-width / 2, 0, depth / 2];
  const r = across ? [-half, rise, 0] : [0, rise, -half], s = across ? [half, rise, 0] : [0, rise, half];
  const faces = across ? [a,r,s, a,s,b, b,s,c, c,s,r, c,r,d, d,r,a] : [a,r,b, b,r,s, b,s,c, c,s,d, d,s,r, d,r,a];
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(faces.flat(), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(faces.flatMap(p => [p[0] / width + .5, p[2] / depth + .5]), 2)); geo.computeVertexNormals();
  g.add(geo, metal, [x, y, z]);
}

function bankChinaRoof(g: CityGeometry, plan: ShanghaiPolygon, width: number, stone: THREE.Material, trim: THREE.Material, roof: THREE.Material, glass: THREE.Material) {
  const depth = Math.max(...plan.points.map(p => p[1])), z = depth / 2;
  for (const [w, d, y, h] of [[width * .78, depth * .86, 57.8, 4.3], [width * .64, depth * .75, 62.1, 4.1]]) {
    g.box([w, h, d], [0, y + h / 2, z], stone);
    for (let x = -w * .36; x <= w * .36; x += 2.4) g.box([1.25, h - 1.1, .15], [x, y + h / 2, z - d / 2 - .08], glass);
    g.box([w + .7, .35, d + .7], [0, y + h, z], trim);
  }
  // Upturned four-sided Chinese eaves: sampled curved sections and hip ridges.
  const w = width * .76, d = depth * .85;
  for (let i = 0; i < 9; i++) {
    const t = i / 9, next = (i + 1) / 9;
    const level = (v: number) => 66.5 + 2.9 * v * v + .55 * Math.exp(-v * 16);
    const a = { x: w * (1 - t * .6) / 2, z: d * (1 - t * .68) / 2 }, b = { x: w * (1 - next * .6) / 2, z: d * (1 - next * .68) / 2 };
    const ring = (p: {x: number; z: number}, y: number) => [[-p.x,y,z-p.z],[p.x,y,z-p.z],[p.x,y,z+p.z],[-p.x,y,z+p.z]];
    const low = ring(a,level(t)), high = ring(b,level(next)), vertices: number[] = [];
    for (let j = 0; j < 4; j++) vertices.push(...low[j],...high[j],...high[(j+1)%4],...low[j],...high[(j+1)%4],...low[(j+1)%4]);
    const mesh = new THREE.BufferGeometry(); mesh.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); mesh.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((_,j) => j%3===0 ? [vertices[j]*.2,vertices[j+2]*.2] : []),2)); mesh.computeVertexNormals();
    g.add(mesh, roof);
  }
  hipRoof(g, 0, z, w * .4, d * .32, 69.4, 1.6, roof);
}

export function createBundBuildings(polygons: ShanghaiPolygon[], material: MaterialFactory) {
  const root = new THREE.Group(); root.name = 'Bund photographic reconstructions';
  const found = BUND_BUILDINGS.filter(b => polygons.some(p => p.id === b.id));
  if (!found.length) return root;
  const stone = {
    grey: bundStone(material, 0xb1b0a8, .8), warm: bundStone(material, 0xc4b99e, .8),
    ivory: bundStone(material, 0xd3d0bc, .8), brick: bundStone(material, 0x834b3d, .75, false),
  };
  const trim = bundStone(material, 0xdbd1b9, 1.05, false), darkStone = bundStone(material, 0x77786e, .85);
  const glass = material(0x34433f, .38, .3, .48), bronze = material(0x645740, .4, .5, .035);
  const copper = roofMetal(material, 0x35675c, .9, 24), slate = roofMetal(material, 0x555b57, .55, 32);
  const newsStone = bundStone(material, 0xd3d0bc, .8);
  const newsCompile = newsStone.onBeforeCompile, newsKey = newsStone.customProgramCacheKey();
  newsStone.onBeforeCompile = (shader, renderer) => {
    newsCompile.call(newsStone, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif(bundPosition.y>31.3 || bundPosition.y<9.8) diffuseColor.rgb*=vec3(.52,.54,.52);');
  };
  newsStone.customProgramCacheKey = () => `${newsKey}-news-two-stone-zones`;
  for (const b of found) {
    const source = polygons.find(p => p.id === b.id)!;
    let a = source.points[b.edge], end = source.points[b.edge + 1];
    // No. 24 has two collinear OSM edges on the same east elevation.
    if (b.number === 24) end = source.points[b.edge + 2];
    if (a[1] > end[1]) [a, end] = [end, a];
    const width = Math.hypot(end[0] - a[0], end[1] - a[1]);
    if (width < 2 || !Number.isFinite(width)) continue;
    const frame = buildingFrame([(a[0] + end[0]) / 2, (a[1] + end[1]) / 2], -Math.atan2(end[1] - a[1], end[0] - a[0]));
    const plan = frame.plan(source), g = new CityGeometry();
    g.group.name = b.name; g.group.userData.osmIds = [b.id]; g.group.userData.bundNumber = b.number;
    g.group.userData.frontage = width;
    g.group.userData.reconstruction = `Individual facade and roof from ${b.number === 15.1 ? 'Wenhui completed-building photograph (2019 report)' : 'Asisbiz onsite photographs'}; OSM plan, estimated vertical dimensions; not a surveyed replica`;
    const pitch = width / b.bays, windowWidth = Math.min(2.5, pitch * .53);
    const openings: FrontOpening[] = [];
    const porticoWidth = b.order && !b.order.pilaster ? width * (b.order.span + .1) : 0;
    for (const y of b.floors) for (let i = 0; i < b.bays; i++) {
      const x = (i - (b.bays - 1) / 2) * pitch;
      if (b.number === 15.1 && y < 9 && Math.abs(x) < width * .23) continue;
      if (b.number === 23 && y > 9) continue;
      if (porticoWidth && b.order && y > b.order.bottom && y < b.order.top && Math.abs(x) < porticoWidth / 2 + windowWidth / 2) continue;
      openings.push({ x, y, width: windowWidth,
        height: Math.min(y < 4 ? 4.5 : 2.7, (b.top - y) * 1.6), arch: b.number === 6 ? 'pointed' : b.arches?.includes(y) || (b.number === 17 && y === 37.4 && i % 2 === 0),
        pediment: [3, 7, 19, 29].includes(b.number) && y > 6 && y < 17,
      });
    }
    if (porticoWidth && b.order) openings.push({x:0,y:(b.order.bottom+b.order.top)/2,width:porticoWidth,height:b.order.top-b.order.bottom-.7});
    if (b.number === 15.1) openings.push({x:0,y:4.4,width:width*.4,height:8.5});
    if (b.number === 23) {
      for (const x of [-width * .34,width * .34]) openings.push({x,y:33.2,width:width * .17,height:46.3});
      for (const y of b.floors.filter(y=>y>9)) for (const x of [-width*.12,0,width*.12]) openings.push({x,y,width:width*.079,height:3.3});
    }
    frontShell(g, plan, b.top, openings, b.number === 17 ? newsStone : stone[b.stone], trim, glass, bronze);
    windowBays(g, plan, b.floors, b.number === 23 ? 2.6 : 3.6, glass, trim, true);
    for (const y of b.cornices) {
      wallLedge(g, plan, y, y === b.top ? .68 : .36, trim, openings);
      if (y === b.top || y === b.cornices.at(-2)) {
        wallLedge(g, plan, y - .35, .26, trim, openings);
        if (b.number !== 15.1) for (let x = -width / 2 + .55; x < width / 2; x += .72) g.box([.22, .32, .65], [x, y - .65, -.33], trim);
      }
    }
    const depth = Math.max(...plan.points.map(p => p[1])), centrePlan = centre(plan);
    if (b.order) {
      const o = b.order;
      for (let i = 0; i < o.count; i++) ionicColumn(g, (i / (o.count - 1) - .5) * width * o.span, -1.2, o.bottom, o.top, Math.min(.85, width / 32), trim, o.pilaster);
      g.box([width * (o.span + .13), .65, 2.3], [0, o.top + .35, -.7], trim);
      // The column order stands in front of a recessed multi-storey wall. Floor
      // bands stay behind the shafts instead of cutting across their front.
      if (porticoWidth) {
        for (const y of b.floors.filter(y=>y>o.bottom+1 && y<o.top-1)) {
          g.box([porticoWidth,.55,.2],[0,y-1.65,.32],darkStone);
          for (let i=0;i<o.count-1;i++) {
            const x = (i/(o.count-1)-.5)*width*o.span+width*o.span/(o.count-1)/2;
            g.box([.14,3,.2],[x-1,y,.32],trim); g.box([.14,3,.2],[x+1,y,.32],trim);
            g.box([2.2,.18,.2],[x,y+1.4,.32],trim);
          }
        }
      }
    }
    if (![6, 9, 14, 15.1, 23, 33].includes(b.number)) balustrade(g, [-width / 2, -.3], [width / 2, -.3], b.top + .25, trim);

    if (b.number === 1) {
      for (const side of [-1, 1]) {
        const x = side * width * .37;
        g.box([7, 2.3, 6], [x, 31.6, 3], stone.warm);
        pediment(g, x, 32.7, -.6, 7.6, 1.9, trim);
      }
      for (let x = -width * .3; x <= width * .3; x += 3.2) ionicColumn(g, x, -.55, 21.6, 29.7, .38, trim);
    } else if (b.number === 2) {
      for (const side of [-1, 1]) pavilion(g, side * width * .37, b.top + .4, 3.4, 2.3, 3.1, trim, slate);
    } else if (b.number === 3) {
      // The lantern is on the south-east corner, not centred on the roof.
      pavilion(g, width * .39, b.top + .6, 3.4, 2.5, 5.4, trim, copper, true);
      for (const x of [-width * .34, 0, width * .34]) g.box([1.1, 13.5, .8], [x, 15.8, -.35], trim);
    } else if (b.number === 5) {
      for (const side of [-1, 1]) {
        const x = side * width * .33;
        pediment(g, x, b.top + .6, -.5, width * .36, 2.4, trim);
        g.add(new THREE.CircleGeometry(.68, 18, 0, Math.PI), glass, [x, b.top + .8, -.56]);
      }
    } else if (b.number === 6) {
      hipRoof(g, centrePlan[0], Math.min(8, depth / 2), width, Math.min(16, depth), b.top, 5.4, slate);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * width / 5.3;
        pediment(g, x, b.top - .5, -.65, width / 5.8, i % 2 ? 3.8 : 5.2, stone.grey);
        g.box([.7, 1.8, .16], [x, b.top + 1, -.74], glass);
        for (const sign of [-1, 1]) {
          const bx = x + sign * width / 12;
          g.beam([bx, 6, -.65], [bx, b.top + 1.4, -.65], .38, trim, .7);
          g.add(new THREE.ConeGeometry(.32, 1.5, 4), trim, [bx, b.top + 2.1, -.65]);
        }
      }
    } else if (b.number === 7) {
      hipRoof(g, 0, 5, width - 2, 10, b.top, 3.8, slate);
      for (const side of [-1, 1]) pavilion(g, side * width * .36, b.top, 3.2, 2.1, 2.4, trim, slate);
      for (const x of [-width * .18, 0, width * .18]) { g.box([2.6, 2.8, 2.1], [x, b.top + 1.2, .6], trim); pediment(g, x, b.top + 2.5, -.6, 3, 1, trim); }
    } else if (b.number === 9) {
      hipRoof(g, 0, Math.min(9, depth / 2), width + 1, Math.min(18, depth), b.top, 3.6, slate);
      pediment(g, 0, b.top + .3, -.6, width * .42, 3.2, trim);
      for (let i = 0; i <= b.bays; i++) ionicColumn(g, (i / b.bays - .5) * width * .94, -.72, 5, 13.5, .22, trim);
      for (const y of [5.1, 9.5]) balustrade(g, [-width * .46, -.9], [width * .46, -.9], y, trim);
    } else if (b.number === 14) {
      for (const [span, h] of [[.82, 2.4], [.54, 5], [.27, 8]]) {
        g.box([width * span, h, 7], [0, b.top + h / 2, 3.5], stone.ivory);
        g.box([width * span + .35, .35, 7.4], [0, b.top + h, 3.5], trim);
      }
      for (let i = -3; i <= 3; i++) g.box([.34, 29, .75], [i * width / 9, 19, -.4], trim);
      g.box([width * .35, 5.5, 1.2], [0, 2.3, -.28], darkStone);
      g.box([width * .24, 4.3, .12], [0, 2.1, -.92], glass);
    } else if (b.number === 15.1) {
      // Use the bottom completed-building photo in Wenhui's 2019 report,
      // not either of the unbuilt competition renderings above it.
      for (let i = 0; i <= b.bays; i++) {
        const x = (i / b.bays - .5) * width;
        g.box([.44, 9.8, .65], [x, 14.5, -.3], trim);
      }
      g.box([width * .44, .35, .9], [0, 8.9, -.35], trim);
      for (const x of [-width * .067, width * .067]) g.box([.11, 8.5, .16], [x, 4.4, .38], bronze);
      g.box([width * .4, .12, .16], [0, 3.1, .38], bronze);
    } else if (b.number === 15 || b.number === 16 || b.number === 24) {
      for (const side of [-1, 1]) g.box([1.15, 1.8, 1.5], [side * width * .43, b.top + .9, .5], trim);
      if (b.number === 24) for (let x = -width * .34; x < width * .4; x += 3.6) ionicColumn(g, x, -.4, 24.7, 28.7, .27, trim);
    } else if (b.number === 17) {
      // Two dark upper-storey pavilions, open rather than solid boxes.
      for (const side of [-1, 1]) {
        const x = side * width * .33;
        pavilion(g, x, b.top + .6, 2.4, 1.8, 3.4, darkStone, slate);
        ionicColumn(g, side * width * .15, -.85, .1, 9.2, .52, darkStone);
        pediment(g,x,b.top-.15,-.6,width*.35,1.8,darkStone);
        for (const offset of [-width*.105,width*.105]) ionicColumn(g,x+offset,-.6,31.7,39,.25,darkStone,true);
      }
      g.box([width, .8, 1.8], [0, 31.3, -.5], darkStone);
    } else if (b.number === 18) {
      g.box([width * .56, 3.1, 9], [0, b.top + 1.55, 5], stone.warm);
      g.box([width * .6, .45, 9.4], [0, b.top + 3.1, 5], trim);
      for (let x=-width*.22;x<width*.25;x+=2.4) g.box([1.2,2.2,.14],[x,b.top+1.4,.42],glass);
      pediment(g,0,b.top+3.3,.35,width*.58,1.8,trim);
      for (const sign of [-1, 1]) g.box([1.1, 14, 1.4], [sign * width * .34, 13, -.65], trim);
    } else if (b.number === 19) {
      // Photographed rooftop lettering is mounted over the brick parapet.
      g.box([width, 1.45, .7], [0, b.top + .86, -.12], stone.brick);
      for (const y of [b.top + .18, b.top + 1.56]) g.box([width + .25, .16, .85], [0, y, -.12], trim);
      // Long Nanjing Road wing: alternate cream panels, red brick piers and
      // mouldings all the way around the plan, including the rounded corners.
      // Rounded OSM corners consist of sub-window-length edges. Join those
      // sampled arcs into window bays so they do not become blank brick drums.
      const corners = [[17,20,23,26], [6,8,10,12,13], [28,31,34,35]];
      for (const corner of corners) for (let i=0;i<corner.length-1;i++) {
        const a=plan.points[corner[i]], end=plan.points[corner[i+1]], x=(a[0]+end[0])/2,z=(a[1]+end[1])/2;
        const angle=-Math.atan2(end[1]-a[1],end[0]-a[0]), q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
        // Move the chord back onto the polygon arc, beyond the original shell.
        const mid=plan.points[Math.round((corner[i]+corner[i+1])/2)], outward=new THREE.Vector3(0,0,Math.sign((mid[0]-x)*Math.sin(angle)+(mid[1]-z)*Math.cos(angle))*.72).applyQuaternion(q);
        for (const y of b.floors) windowBay(g,[x+outward.x,y,z+outward.z],q,glass,trim);
      }
      edges(plan, (a, b, length) => {
        const count = Math.floor(length / 3.6), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(b[1] - a[1], b[0] - a[0]));
        for (let i = 0; i < count; i++) for (const y of [7.4,11.8,16.2,20.6,24]) {
          const t = (i + .5) / count, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          g.add(new THREE.BoxGeometry(2.7, .5, .56), trim, [x,y + 1.55,z], q);
          // Side-wall cream panels surround the dark glazing, leaving red piers.
          for (const side of [-1,1]) {
            const delta = new THREE.Vector3(side * 1.08,0,0).applyQuaternion(q);
            g.add(new THREE.BoxGeometry(.58,3.1,.32),trim,[x+delta.x,y,z+delta.z],q);
          }
          g.add(new THREE.BoxGeometry(2.7,.9,.28),trim,[x,y-1.95,z],q);
        }
      });
      const turrets = [[-2.2,2.3], [centrePlan[0] - 3,depth - 5]];
      for (const [x,z] of turrets) {
        // Enclosed octagonal drum with arched windows beneath the copper cupola.
        g.add(new THREE.CylinderGeometry(2.25,2.25,3.6,8),trim,[x,b.top+2.1,z]);
        for (let i=0;i<8;i++) {
          const a=i*Math.PI/4, q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),a);
          g.add(new THREE.BoxGeometry(.8,1.8,.15),glass,[x+Math.sin(a)*2.12,b.top+2.1,z+Math.cos(a)*2.12],q);
        }
        g.add(new THREE.ConeGeometry(2.5,1.6,8),copper,[x,b.top+4.65,z]);
        g.beam([x,b.top+5.45,z],[x,b.top+6.15,z],.12,bronze);
      }
      g.box([4.6,2.5,2],[0,b.top+1.25,2.5],trim);
      pediment(g,0,b.top+2.5,1.2,5.2,1.4,trim);
    } else if (b.number === 23) {
      // Chinese stone screens flank the recessed central three window bands.
      for (const side of [-1,1]) {
        const x = side * width * .34;
        for (let row = 0; row < 23; row++) for (let col = 0; col < 4; col++) {
          const cx = x + (col - 1.5) * width * .04, y = 11 + row * 1.96;
          g.box([width * .034,.18,.35],[cx,y,-.25],trim);
          g.box([.16,1.96,.35],[cx + (row % 2 ? 1 : -1) * width * .014,y + .98,-.25],trim);
        }
      }
      for (const x of [-width * .2,width * .2]) g.box([.75,48,1],[x,33,-.3],trim);
      bankChinaRoof(g,plan,width,stone.warm,trim,slate,glass);
      const wing = polygons.find(p => p.id === BANK_PARTS[1]);
      if (wing) {
        const wp = frame.plan(wing); g.extrude(wp,-.65,20.4,stone.warm);
        windowBays(g,wp,[3,8,13,18],3.6,glass,trim);
        edges(wp,(a,b) => g.beam([a[0],20,a[1]],[b[0],20,b[1]],.55,trim));
        g.group.userData.osmIds.push(wing.id);
      }
      g.group.userData.osmIds.push(BANK_PARTS[0]);
    } else if (b.number === 26) {
      for (const side of [-1,1]) {
        const x = side * width * .32;
        hipRoof(g,x,3.1,width * .32,6,b.top + .3,2.7,slate);
        g.box([2,2.4,.6],[x,b.top + 1.3,-.3],trim);
        g.box([1.1,1.5,.16],[x,b.top + 1.4,-.65],glass);
      }
    } else if (b.number === 27) {
      pediment(g,0,b.top + .8,-.3,width * .27,2.2,trim);
      for (let x = -width / 2 + 1; x < width / 2; x += 1.1) g.box([.28,.48,.8],[x,19.6,-.6],trim);
    } else if (b.number === 28) {
      for (const [w,y,h] of [[width*.55,b.top,3.4],[width*.36,b.top+3.4,2.6],[width*.27,b.top+6,1]]) {
        g.box([w,h,6],[0,y+h/2,3],stone.warm); g.box([w+.65,.35,6.7],[0,y+h,3],trim);
      }
      g.add(new THREE.CircleGeometry(1.1,24,0,Math.PI),glass,[0,b.top+1,-.05]);
      pediment(g,0,b.top+4,-.45,width*.55,1.9,trim);
    } else if (b.number === 29) {
      pediment(g,0,b.top+.35,-.3,width*.43,3.3,trim);
    } else if (b.number === 33) {
      // Main building is the southern house; the smaller residence is north.
      hipRoof(g,centrePlan[0],centrePlan[1],width + 15,Math.min(36,depth),b.top,4.5,slate);
      pediment(g,0,b.top,-.5,width*.5,3.5,trim);
      for (let i=0;i<5;i++) g.box([1.2,4.3,1.4],[centrePlan[0]+(i-2)*5.8,b.top+3.4,centrePlan[1]+(i%2?6:-6)],stone.grey);
      const residence = polygons.find(p=>p.id===CONSULATE_RESIDENCE);
      if (residence) {
        const p=frame.plan(residence), c=centre(p); g.extrude(p,-.65,11.5,stone.grey);
        windowBays(g,p,[2.8,8],3.7,glass,trim);
        hipRoof(g,c[0],c[1],Math.max(...p.points.map(v=>v[0]))-Math.min(...p.points.map(v=>v[0])),Math.max(...p.points.map(v=>v[1]))-Math.min(...p.points.map(v=>v[1])),10.85,4.3,slate);
        g.group.userData.osmIds.push(residence.id);
      }
    }
    root.add(frame.place(g.finish()));
  }
  return root;
}
