import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { addShanghaiSigns, shanghaiSignLetters } from '@/app/[lang]/space/space-shanghai-signs';
import signage from '@/app/[lang]/space/space-shanghai-signs-data.json';
import { SHANGHAI_VIEWS, ShanghaiScene, validateShanghaiData, type ShanghaiData } from '@/app/[lang]/space/space-shanghai';
import { createShanghaiBridges, createShanghaiRoads, shanghaiRoadElevations, type ShanghaiRoad } from '@/app/[lang]/space/space-shanghai-bridges';
import { createShanghaiArchitecture, setShanghaiClockTime, SHANGHAI_ARCHITECTURE_IDS } from '@/app/[lang]/space/space-shanghai-architecture';
import { BUND_BUILDING_IDS, createBundBuildings } from '@/app/[lang]/space/space-shanghai-bund';
import { createBundStreets, createShanghaiQuays } from '@/app/[lang]/space/space-shanghai-streets';
import { createShanghaiSupertalls } from '@/app/[lang]/space/space-shanghai-supertalls';
import { shanghaiWindowTexture } from '@/app/[lang]/space/space-shanghai-facades';
import { ShanghaiTraffic, shanghaiTrafficTracks, sampleShanghaiTraffic } from '@/app/[lang]/space/space-shanghai-traffic';

const windows = new THREE.Texture();

const data: unknown = JSON.parse(readFileSync(new URL('../public/assets/space/shanghai-v1/huangpu.json', import.meta.url), 'utf8'));
validateShanghaiData(data);
const inside = (x: number, z: number, ring: number[][]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};

describe('Shanghai geographic asset and river cruise', () => {
  it('bundles every inscription glyph with finite, bounded raised lettering', () => {
    const font = new FontLoader().parse(JSON.parse(readFileSync(new URL('../public/assets/space/shanghai-v1/sign-font.json', import.meta.url), 'utf8')));
    expect(Object.keys(font.data.glyphs)).toHaveLength(70);
    for (const item of signage) for (const line of [...item.lines, ...(item.blade ? [{text:item.blade.text,height:1.45,width:1.6},{text:item.blade.english,height:.28,width:1.95}] : [])]) {
      const geometry = shanghaiSignLetters(font, line.text, line.height, line.width);
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeLessThanOrEqual(line.width + .00001);
      expect(size.y).toBeLessThanOrEqual(line.height + .00001);
      expect(size.z).toBeCloseTo(.051, 5);
      for (const name of ['position','normal','uv']) expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
    for (const [text, height, width] of [['',1,1],[' ',1,1],['?',1,1],['A',0,1],['A',1,-1],['A',NaN,1],['A',1,Infinity]] as const) expect(()=>shanghaiSignLetters(font,text,height,width)).toThrow();
  });

  it('attaches physical signage to all 16 photographed buildings and keeps empty regions allocation-free', () => {
    const font = new FontLoader().parse(JSON.parse(readFileSync(new URL('../public/assets/space/shanghai-v1/sign-font.json', import.meta.url), 'utf8')));
    const material = () => new THREE.MeshStandardMaterial();
    let allocated = 0;
    addShanghaiSigns(new THREE.Group(), font, () => { allocated++; return material(); });
    expect(allocated).toBe(0);
    const root = createShanghaiArchitecture(data.polygons, material, data.roads);
    addShanghaiSigns(root, font, material);
    root.updateMatrixWorld(true);
    expect(signage).toHaveLength(16);
    for (const item of signage) {
      const signs = root.getObjectByName(`Bund ${item.building} physical signage`)!;
      expect(signs.userData.signTexts).toEqual([...item.lines.map(l=>l.text), ...(item.blade ? [item.blade.text,item.blade.english] : [])]);
      expect(signs.parent?.name).not.toBe('');
      const bounds = new THREE.Box3().setFromObject(signs);
      expect([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      signs.traverse(o => { if(o instanceof THREE.Mesh) expect(o.geometry.getAttribute('position').count).toBeGreaterThan(0); });
    }
    const peace = root.getObjectByName('Bund 20 physical signage')!;
    // Both faces of the projecting blade are solid and visible from the street.
    for(const side of [-1,1]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(-1318.7 + side * 2, 12.1, 1383.2), new THREE.Vector3(-side,0,0)).intersectObject(peace,true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].distance).toBeLessThan(2);
      const cap = (dz: number) => new THREE.Raycaster(new THREE.Vector3(-1318.7 + side * 2, 17.96, 1383.2 + dz), new THREE.Vector3(-side,0,0)).intersectObject(peace,true);
      expect(cap(0).length).toBeGreaterThan(0);
      for (const dz of [-1.1,1.1]) expect(cap(dz)).toHaveLength(0);
    }
    root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
  });

  it('respects forward, reverse and two-way streets and excludes pedestrian routes and tunnels', () => {
    const road: ShanghaiRoad = { kind: 'residential', bridge: false, width: 8, points: [[0,0],[0,0],[0,100]] };
    const position = new THREE.Vector3(), direction = new THREE.Vector3();
    const tracks = shanghaiTrafficTracks([road, {...road, oneway:1}, {...road, oneway:-1}]);
    expect(tracks).toHaveLength(4);
    for(const [i,x,z,dz] of [[0,-2,25,1],[1,2,75,-1],[2,0,25,1],[3,0,75,-1]]) {
      sampleShanghaiTraffic(tracks[i],25,position,direction);
      expect(position.toArray()).toEqual([x,-.64,z]); expect(direction.toArray()).toEqual([0,0,dz]);
    }
    for(const invalid of [{...road,kind:'footway'}, {...road,layer:-1}, {...road,width:4}, {...road,points:[[0,0],[0,0]] as [number,number][]}]) expect(shanghaiTrafficTracks([invalid])).toEqual([]);
    sampleShanghaiTraffic(tracks[2],-1,position,direction); expect(position.z).toBe(0);
    sampleShanghaiTraffic(tracks[2],101,position,direction); expect(position.z).toBe(100);
  });

  it('uses the rendered road elevations for every traffic track and connects only matching endpoints', () => {
    const tracks = shanghaiTrafficTracks(data.roads), heights = shanghaiRoadElevations(data.roads);
    expect(tracks).toHaveLength(4517);
    const position = new THREE.Vector3(), direction = new THREE.Vector3();
    for(const track of tracks) {
      const road=data.roads[track.road];
      expect(road.oneway===1 ? track.points[0].x===road.points[0][0] : true).toBe(true);
      for(let i=0;i<track.points.length;i++) {
        const p=track.points[i], ri=road.points.findIndex(([x,z])=>x===p.x&&z===p.z);
        expect(p.y).toBe(heights[track.road][ri]);
        sampleShanghaiTraffic(track,track.distances[i],position,direction);
        expect(position.toArray().every(Number.isFinite)).toBe(true);
        expect(position.y).toBeCloseTo(p.y,6);
        expect(Math.hypot(position.x-p.x,position.z-p.z)).toBeLessThanOrEqual(road.width/2);
      }
      for(const next of track.next) {
        expect(tracks[next].road).not.toBe(track.road);
        expect(tracks[next].points[0].toArray()).toEqual(track.points.at(-1)!.toArray());
      }
    }
  });

  it('moves finite instanced cars, stays paused at the same time and caps desktop and narrow allocations', () => {
    for(const [narrow,count] of [[false,1200],[true,420]] as const) {
      const traffic=new ShanghaiTraffic(data.roads,()=>new THREE.MeshStandardMaterial(),narrow);
      expect(traffic.root.userData.cars).toBe(count); expect(traffic.root.children).toHaveLength(7);
      const meshes=traffic.root.children as THREE.InstancedMesh[];
      const before=Array.from(meshes[0].instanceMatrix.array);
      traffic.update(.05);
      const moved=Array.from(meshes[0].instanceMatrix.array);
      expect(moved.every(Number.isFinite)).toBe(true); expect(moved).not.toEqual(before);
      traffic.update(.05); expect(Array.from(meshes[0].instanceMatrix.array)).toEqual(moved);
      for(const mesh of meshes) {
        expect(mesh.count).toBe(count); expect(mesh.instanceMatrix).toBe(meshes[0].instanceMatrix);
        expect(mesh.boundingSphere!.radius).toBeGreaterThan(0);
        mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
      }
    }
    let allocated=0;
    const empty=new ShanghaiTraffic([],()=>{allocated++; return new THREE.MeshStandardMaterial();},false);
    empty.update(1); expect(empty.root.children).toEqual([]); expect(allocated).toBe(0);
  });

  it('validates optional OSM traffic metadata while preserving older maps', () => {
    const road={kind:'secondary',bridge:false,width:8,points:[[0,0],[0,100]]};
    for(const oneway of [undefined,-1,0,1]) expect(()=>validateShanghaiData({...data,roads:[{...road,oneway}]})).not.toThrow();
    for(const metadata of [{oneway:2},{oneway:'yes'},{lanes:0},{lanes:13},{lanes:1.5},{lanes:'2'}]) expect(()=>validateShanghaiData({...data,roads:[{...road,...metadata}]})).toThrow('Invalid Shanghai map');
  });

  it('clips the waterfront promenade around roads, water and narrow obstacles', () => {
    const root=createBundStreets([
      { name:'中山东一路',width:7,bridge:false,kind:'secondary',points:[[-1280,1250],[-1280,1370]] },
      { id:909213000,kind:'footway',width:2,bridge:false,points:[[-1240,1250],[-1240,1370]] },
      { width:8,bridge:false,kind:'residential',points:[[-1310,1310],[-1240,1310]] },
    ],[
      {id:'river',kind:'water',points:[[-1237,1200],[-1200,1200],[-1200,1400],[-1237,1400]]},
      {id:'small-obstacle',kind:'building',points:[[-1245,1340],[-1244.8,1340],[-1244.8,1340.2],[-1245,1340.2]]},
    ],()=>new THREE.MeshStandardMaterial());
    root.updateMatrixWorld(true);
    const probe=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)).intersectObject(root,true).filter(hit=>Math.abs(hit.point.y+.44)<.001);
    expect(probe(-1250,1270)[0].point.y).toBeCloseTo(-.44,4);
    // The last slab must reach the road margin, without whole-strip steps.
    expect(probe(-1275.8,1270)[0].point.y).toBeCloseTo(-.44,4);
    expect(probe(-1276.2,1270)).toEqual([]);
    for(const [x,z] of [[-1280,1270],[-1250,1310],[-1235,1270],[-1244.9,1340.1]]) expect(probe(x,z).length,`${x},${z}`).toBe(0);
    root.traverse(o=>{if(o instanceof THREE.Mesh){
      for(const name of ['position','normal','uv']) expect(Array.from(o.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      o.geometry.dispose();(o.material as THREE.Material).dispose();
    }});
  });

  it('keeps illuminated quays on the acquired central Huangpu banks, leaving the navigation channel open', () => {
    const root = createShanghaiQuays(data.polygons, () => new THREE.MeshStandardMaterial());
    expect(root.userData.segments).toBe(258);
    expect(root.children).toHaveLength(2);
    root.updateMatrixWorld(true);
    for (const [x, z] of data.river.filter(p => p[1] > 700 && p[1] < 2600)) {
      expect(new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true)).toHaveLength(0);
    }
    const bounds = new THREE.Box3().setFromObject(root);
    expect(bounds.min.y).toBeCloseTo(-.65, 5); expect(bounds.max.y).toBeCloseTo(.95, 5);
    expect(bounds.min.z).toBeGreaterThan(699); expect(bounds.max.z).toBeLessThan(2601);
    root.traverse(o => { if (o instanceof THREE.Mesh) { expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true); o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('does not allocate quays for unrelated ponds, missing banks or degenerate segments', () => {
    let allocations = 0;
    const factory = () => { allocations++; return new THREE.MeshStandardMaterial(); };
    const pond = { id: 'pond', kind: 'water' as const, points: [[0, 1000], [0, 1000], [10, 1020]] as [number, number][] };
    for (const polygons of [[], [pond], [{ ...pond, id: 'way/71118583', points: [[0, 1000], [0, 1000], [0, 1000]] as [number, number][] }]]) expect(createShanghaiQuays(polygons, factory).children).toHaveLength(0);
    expect(allocations).toBe(0);
  });

  it('keeps the night-window atlas deterministic, filtered and mostly unlit', () => {
    const office = shanghaiWindowTexture(true), home = shanghaiWindowTexture(false), repeat = shanghaiWindowTexture(true);
    expect(office.image.data).toEqual(repeat.image.data);
    for (const texture of [office, home]) {
      expect(texture.image.width).toBe(256); expect(texture.image.height).toBe(512);
      expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(texture.generateMipmaps).toBe(true);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping); expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      const bytes = texture.image.data!;
      let lit = 0;
      for (let i = 0; i < bytes.length; i += 4) if (bytes[i]) lit++;
      expect(lit).toBe(texture === office ? 21660 : 20676);
    }
    for (const texture of [office, home, repeat]) texture.dispose();
  });

  it('keeps the three supertalls at documented heights with finite batched geometry', () => {
    const root = createShanghaiSupertalls(() => new THREE.MeshStandardMaterial(), windows);
    root.updateMatrixWorld(true);
    for (const [name, height] of [['Jin Mao Tower', 420.5], ['Shanghai World Financial Center', 492], ['Shanghai Tower', 632]] as const) {
      const building = root.getObjectByName(name)!;
      const bounds = new THREE.Box3().setFromObject(building);
      // Mullion thickness can extend under 0.5 m past the crown centreline.
      expect(bounds.max.y - building.position.y).toBeCloseTo(height, 0);
      expect(building.position.y).toBe(-.65);
      expect(bounds.min.y - building.position.y).toBeCloseTo(0, 0);
    }
    let meshes = 0;
    root.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      for (const attribute of ['position', 'normal', 'uv']) expect(Array.from(o.geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);
      expect((o.material as THREE.MeshStandardMaterial).map).toBe(null);
      o.geometry.dispose(); (o.material as THREE.Material).dispose();
    });
    expect(meshes).toBe(13);
  });

  it('keeps the SWFC trapezoidal portal open from both faces with solid jambs and roof', () => {
    const root = createShanghaiSupertalls(() => new THREE.MeshStandardMaterial(), windows);
    root.updateMatrixWorld(true);
    const building = root.getObjectByName('Shanghai World Financial Center')!;
    for (const side of [-1, 1]) {
      const probe = (x: number, y: number) => new THREE.Raycaster(
        building.localToWorld(new THREE.Vector3(x, y, side * 100)),
        new THREE.Vector3(0, 0, -side).transformDirection(building.matrixWorld),
      ).intersectObject(building, true);
      expect(probe(0, 460)).toEqual([]);
      expect(probe(17, 472)).toEqual([]); // opening is wider at the top
      expect(probe(17, 448).length > 0).toBe(true);
      for (const [x, y] of [[23, 460], [-23, 460], [0, 485], [0, 430]]) expect(probe(x, y).length > 0).toBe(true);
    }
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('leaves Shanghai Tower crown open with its inner roof below the sloping glass rim', () => {
    const root = createShanghaiSupertalls(() => new THREE.MeshStandardMaterial(), windows);
    root.updateMatrixWorld(true);
    const tower = root.getObjectByName('Shanghai Tower')!;
    const ray = new THREE.Raycaster(tower.localToWorld(new THREE.Vector3(0, 700, 0)), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(tower, true)[0];
    expect(tower.worldToLocal(hit.point.clone()).y).toBeCloseTo(587, 4);
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('renders separate Bund carriageways without narrowing bridges or unrelated streets', () => {
    const base: ShanghaiRoad = { name: '中山东一路', width: 11.5, bridge: false, points: [[-1280, 1250], [-1280, 1370]] };
    for (const [road, width] of [[base, 7], [{ ...base, bridge: true }, 11.5], [{ ...base, name: '其他道路' }, 11.5]] as const) {
      const root = createShanghaiRoads([road], () => new THREE.MeshStandardMaterial());
      const mesh = root.children.at(-1) as THREE.Mesh;
      mesh.geometry.computeBoundingBox();
      expect(mesh.geometry.boundingBox!.max.x - mesh.geometry.boundingBox!.min.x).toBe(width);
      root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    }
  });

  it('keeps road light spacing continuous through bends and excludes narrow paths', () => {
    for (const [width, lit] of [[8, true], [3, false]] as const) {
      const root = createShanghaiRoads([{ kind: 'residential', width, bridge: false, points: [[0, 0], [34, 0], [34, 0], [34, 68]] }], () => new THREE.MeshStandardMaterial());
      const geometry = (root.children[0] as THREE.Mesh).geometry;
      const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      expect(position.count).toBe(12); expect(uv.count).toBe(position.count);
      expect(Array.from({ length: uv.count }, (_, i) => uv.getX(i))).toEqual(lit ? [0, 0, 1, 0, 1, 1, 1, 1, 3, 1, 3, 3] : Array(12).fill(-1000));
      expect(Array.from({ length: uv.count }, (_, i) => uv.getY(i))).toEqual([-1, 1, 1, -1, 1, -1, -1, 1, 1, -1, 1, -1]);
      root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    }
  });

  it('keeps Bund paving out of roads and buildings, and renders upward-facing paint decals', () => {
    const root = createBundStreets([
      { name: '中山东一路', width: 11.5, bridge: false, points: [[-1280, 1250], [-1280, 1370]] },
      { id: 178412507, kind: 'footway', width: 2, bridge: false, points: [[-1292, 1250], [-1292, 1370]] },
      { id: 178412509, kind: 'footway', width: 2, bridge: false, points: [[-1296, 1290], [-1268, 1290]] },
      { width: 8, bridge: false, points: [[-1340, 1310], [-1240, 1310]] },
    ], [{ id: 'test-building', kind: 'building', points: [[-1296, 1340], [-1288, 1340], [-1288, 1350], [-1296, 1350]] }], () => new THREE.MeshStandardMaterial());
    root.updateMatrixWorld(true);
    const probe = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true);
    expect(probe(-1292, 1270)[0].point.y).toBeCloseTo(-.44, 4);
    expect(probe(-1292, 1310)).toEqual([]); // side street remains passable
    expect(probe(-1292, 1345)).toEqual([]); // no slab through a building
    const paint = root.children.filter(o => (o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.polygonOffset) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>[];
    expect(paint.length).toBe(1);
    for (const mesh of paint) {
      expect(mesh.material.depthTest).toBe(true); // buildings can still occlude paint
      expect(mesh.castShadow).toBe(false);
      const positions = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal');
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBeCloseTo(-.61, 4);
        expect(normals.getY(i)).toBe(1); // no vertical beams standing in the road
      }
    }
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('does not allocate Bund street furniture without a ground-level Bund road', () => {
    let allocated = 0;
    const material = () => { allocated++; return new THREE.MeshStandardMaterial(); };
    expect(createBundStreets([], [], material).children).toEqual([]);
    expect(createBundStreets([{ name: '中山东一路', bridge: true, width: 7, points: [[-1280, 1250], [-1280, 1370]] }], [], material).children).toEqual([]);
    expect(allocated).toBe(0);
  });

  it('keeps every elevated junction continuous and all ramp grades finite', () => {
    const heights = shanghaiRoadElevations(data.roads), junctions = new Map<string, number>();
    const steep: { id: number | undefined; grade: number }[] = [];
    data.roads.forEach((r, index) => r.points.forEach((p, j) => {
      const h = heights[index][j];
      expect(Number.isFinite(h)).toBe(true);
      const key = p.join(',');
      if (r.bridge) {
        if (junctions.has(key)) expect(h).toBe(junctions.get(key));
        junctions.set(key, h);
        if (j) {
          const length = Math.hypot(p[0] - r.points[j - 1][0], p[1] - r.points[j - 1][1]);
          const grade = length > .01 ? Math.abs(h - heights[index][j - 1]) / length : 0;
          if (grade > .16) steep.push({ id: r.id, grade });
        }
      }
    }));
    expect(steep).toEqual([]);
    for (const [id, maximum] of [[730934055, 11947], [914661635, 12000]]) {
      const index = data.roads.findIndex(r => r.id === id);
      // Actual East Bank foot/cycle bridges overlap Nanpu in plan, beneath its 48.4 m deck.
      expect(Math.round(Math.max(...heights[index]) * 1000)).toBe(maximum);
      expect(heights[index][0]).toBe(-.64);
      expect(heights[index].at(-1)).toBe(-.64);
    }
  });

  it('grounds an isolated approach gradually and preserves separate stacked crossings', () => {
    const roads: ShanghaiRoad[] = [
      { points: [[0, 1990], [0, 2000]], width: 8, bridge: false },
      { points: [[0, 2000], [0, 2100], [0, 2200]], width: 8, bridge: true, layer: 2 },
      { points: [[-100, 2100], [100, 2100]], width: 8, bridge: true, layer: 3 },
    ];
    expect(shanghaiRoadElevations(roads)).toEqual([[-.64, -.64], [-.64, 3.86, 8.36], [36, 36]]);
  });

  it('builds engineering-sized bridge decks and exposes the underside of elevated roads', () => {
    const material = () => new THREE.MeshStandardMaterial();
    const bridges = createShanghaiBridges(material);
    for (const [name, length, width] of [['Nanpu Bridge', 846, 30.35], ['Lupu Bridge', 750, 40], ['Waibaidu Bridge', 107, 18]] as const) {
      const bridge = bridges.getObjectByName(name)!;
      // The first batch is the asphalt surface, measured in each bridge's local frame.
      const deck = (bridge.children[0] as THREE.Mesh).geometry;
      deck.computeBoundingBox();
      expect(deck.boundingBox!.max.z - deck.boundingBox!.min.z).toBeCloseTo(length, 4);
      expect(deck.boundingBox!.max.x - deck.boundingBox!.min.x).toBeCloseTo(width, 4);
    }
    const roads = createShanghaiRoads([{ points: [[-600, 4850], [-600, 4860]], width: 8, bridge: true }], material);
    const ray = new THREE.Raycaster(new THREE.Vector3(-600, 0, 4855), new THREE.Vector3(0, 1, 0));
    roads.updateMatrixWorld(true);
    expect(ray.intersectObject(roads, true).length > 0).toBe(true);
    for (const root of [bridges, roads]) root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('reconstructs the mapped buildings while keeping hotel courtyards and the Tomson pool open', () => {
    const architecture = createShanghaiArchitecture(data.polygons, () => new THREE.MeshStandardMaterial(), data.roads);
    expect(architecture.children.map(o => o.name)).toEqual([
      'Tomson Riviera relation/12966760', 'Tomson Riviera relation/12966761',
      'Tomson Riviera way/964405391', 'Tomson Riviera way/964405392', 'Fairmont Peace Hotel',
      'Shanghai Customs House', 'HSBC Building Bund', 'Tomson Riviera podium and garden', 'Bund photographic reconstructions',
    ]);
    const peace = architecture.getObjectByName('Fairmont Peace Hotel')!;
    architecture.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(peace).max.y).toBe(77);
    const customs = architecture.getObjectByName('Shanghai Customs House')!;
    expect(new THREE.Box3().setFromObject(customs).max.y).toBeCloseTo(79.2, 4);
    const hsbc = architecture.getObjectByName('HSBC Building Bund')!;
    expect(new THREE.Box3().setFromObject(hsbc).max.y).toBeCloseTo(46.3, 4);
    // Raycast the assembled buildings, including cornices and door furniture.
    // Window panes sit behind the masonry; a plinth must not seal an arched door.
    for (const [building, probes] of [
      [hsbc, [[-28.5, 14.2, .6], [-30, 14.2, -.06], [-.45, 1.3, .6], [1.65, 5.35, -.06]]],
      [customs, [[-.55, 17.6, .6], [-10, 17.6, -.06], [-.45, 1.2, .6], [1.65, 5.45, -.06]]],
    ] as const) for (const [x, y, depth] of probes) {
      const origin = building.localToWorld(new THREE.Vector3(x, y, -10));
      const direction = new THREE.Vector3(0, 0, 1).transformDirection(building.matrixWorld);
      const hit = new THREE.Raycaster(origin, direction).intersectObject(building, true)[0];
      expect(hit, `${building.name} opening at ${x},${y}`).toBeDefined();
      expect(building.worldToLocal(hit.point).z).toBeCloseTo(depth, 4);
    }
    const garden = architecture.getObjectByName('Tomson Riviera podium and garden')!;
    const peacePlan = data.polygons.find(p => p.id === 'relation/2376366')!;
    expect(peacePlan.holes).toHaveLength(3);
    const hsbcPlan = data.polygons.find(p => p.id === 'relation/2380996')!;
    expect(hsbcPlan.holes).toHaveLength(1);
    const pool = data.polygons.find(p => p.id === 'way/964405405')!;
    for (const [root, holes] of [[peace, peacePlan.holes!], [hsbc, hsbcPlan.holes!], [garden, [pool.points]]] as const) for (const hole of holes) {
      const x = (Math.min(...hole.map(p => p[0])) + Math.max(...hole.map(p => p[0]))) / 2;
      const z = (Math.min(...hole.map(p => p[1])) + Math.max(...hole.map(p => p[1]))) / 2;
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(root, true)).toHaveLength(0);
    }
    const hourHands: THREE.Object3D[] = [], minuteHands: THREE.Object3D[] = [];
    customs.traverse(o => {
      if (o.name === 'Customs hour hand') hourHands.push(o);
      if (o.name === 'Customs minute hand') minuteHands.push(o);
    });
    expect(hourHands).toHaveLength(4); expect(minuteHands).toHaveLength(4);
    for (const [time, hours, minutes] of [['00:00', 0, 0], ['06:30', 195, 180], ['23:59', 719.5, 354], ['invalid', 270, 0]] as const) {
      setShanghaiClockTime(architecture, time);
      for (const hand of hourHands) expect(hand.rotation.z).toBeCloseTo(-hours * Math.PI / 180, 10);
      for (const hand of minuteHands) expect(hand.rotation.z).toBeCloseTo(-minutes * Math.PI / 180, 10);
    }
    architecture.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('omits architecture when its mapped footprint is missing', () => {
    expect(createShanghaiArchitecture([], () => new THREE.MeshStandardMaterial()).children).toHaveLength(0);
  });

  it('replaces the full photographed Bund row without duplicate OSM shells or texture dependencies', () => {
    const root = createBundBuildings(data.polygons, () => new THREE.MeshStandardMaterial());
    expect(root.children.map(o => o.userData.bundNumber)).toEqual([1, 2, 3, 5, 6, 7, 9, 14, 15.1, 15, 16, 17, 18, 19, 23, 24, 26, 27, 28, 29, 33]);
    const ids = root.children.flatMap(o => o.userData.osmIds as string[]);
    expect(new Set(ids).size).toBe(24);
    expect(new Set(ids)).toEqual(BUND_BUILDING_IDS);
    for (const id of ids) {
      expect(data.polygons.some(p => p.id === id), `Missing footprint ${id}`).toBe(true);
      expect(SHANGHAI_ARCHITECTURE_IDS.has(id), `Generic shell would overlap ${id}`).toBe(true);
    }
    let meshes = 0, triangles = 0;
    const materials = new Set<THREE.Material>();
    root.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
      for (const name of ['position', 'normal', 'uv']) expect(Array.from(o.geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      expect((o.material as THREE.MeshStandardMaterial).map).toBe(null);
      materials.add(o.material as THREE.Material); o.geometry.dispose();
    });
    // No. 6 has eleven rounded ground openings; No. 18 has five shopfronts.
    expect(meshes).toBe(103); expect(triangles).toBe(664124);
    for (const m of materials) m.dispose();
  });

  it('keeps the assembled Chartered portico and Gothic pointed windows recessed behind their walls', () => {
    const root = createBundBuildings(data.polygons, () => new THREE.MeshStandardMaterial());
    root.updateMatrixWorld(true);
    for (const [name, probes] of [
      ['Chartered Bank Bund', [[1.8, 13.7, .6]]],
      ['Bund Public Service Center 15-1', [[.8, 6.2, .6]]],
      ['China Commercial Bank', [[.25, 14.05, .6], [1.05, 14.1, -.06]]],
    ] as const) {
      const building = root.getObjectByName(name)!;
      for (const [x, y, depth] of probes) {
        const hit = new THREE.Raycaster(building.localToWorld(new THREE.Vector3(x, y, -10)), new THREE.Vector3(0, 0, 1).transformDirection(building.matrixWorld)).intersectObject(building, true)[0];
        expect(hit, `${name} opening at ${x},${y}`).toBeDefined();
        expect(building.worldToLocal(hit.point).z).toBeCloseTo(depth, 4);
      }
    }
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  });

  it('allocates no photo-reconstruction materials for a map without Bund buildings', () => {
    let allocations = 0;
    expect(createBundBuildings([], () => { allocations++; return new THREE.MeshStandardMaterial(); }).children).toEqual([]);
    expect(allocations).toBe(0);
  });

  it('keeps the complete acquired asset valid, with an unbroken water route and both banks in every section', () => {
    expect(data.polygons.filter(p => p.kind === 'building')).toHaveLength(16409);
    expect(data.polygons.filter(p => p.kind === 'water')).toHaveLength(115);
    expect(data.roads).toHaveLength(8646);
    expect(data.river).toHaveLength(43);
    const water = data.polygons.filter(p => p.kind === 'water');
    let length = 0;
    for (let i = 1; i < data.river.length; i++) {
      const a = data.river[i - 1], b = data.river[i], distance = Math.hypot(b[0] - a[0], b[1] - a[1]); length += distance;
      for (let s = 0; s < Math.ceil(distance / 50); s++) {
        const t = s / Math.ceil(distance / 50), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        expect(water.some(p => inside(x, z, p.points) && !p.holes?.some(h => inside(x, z, h))), `Route on land at ${x},${z}`).toBe(true);
      }
    }
    expect(length).toBeCloseTo(16717.658, 2);
    expect(data.river[0]).toEqual([1239, 438.5]);
    expect(data.river.at(-1)![1]).toBeGreaterThan(12000);
    for (const z of [1000, 2500, 5000, 7000, 9500, 11500]) {
      const p = data.river.reduce((a, b) => Math.abs(a[1] - z) < Math.abs(b[1] - z) ? a : b);
      for (const side of [-1, 1]) expect(data.polygons.some(b => b.kind === 'building' && Math.abs(b.points[0][1] - z) < 600 && (b.points[0][0] - p[0]) * side > 150), `Missing bank ${side} at ${z}`).toBe(true);
    }
  });

  it('covers all eight new Xujiahui blocks and places the camera at the WGS84 South Wanping Road neighbourhood', () => {
    const project = (lon: number, lat: number) => [(lon - data.origin[0]) * Math.PI / 180 * 6378137 * Math.cos(data.origin[1] * Math.PI / 180), (data.origin[1] - lat) * Math.PI / 180 * 6378137];
    for (const lat of [31.185, 31.2]) for (const lon of [121.425, 121.44, 121.455, 121.47]) {
      const [west, south] = project(lon, lat), [east, north] = project(lon + .015, lat + .015);
      const inBlock = ([x, z]: number[]) => x >= west && x <= east && z >= north && z <= south;
      expect(data.polygons.some(p => p.kind === 'building' && p.points.some(inBlock)), `Missing buildings in ${lon},${lat}`).toBe(true);
      expect(data.roads.some(r => r.points.some(inBlock)), `Missing roads in ${lon},${lat}`).toBe(true);
    }
    // Independently project the public OSM residential boundary, never the offset Amap coordinates.
    const [x, z] = project((121.4414951 + 121.4437254) / 2, (31.1937655 + 31.1966478) / 2);
    expect(SHANGHAI_VIEWS.xujiahui.target[0]).toBeCloseTo(x, 0);
    expect(SHANGHAI_VIEWS.xujiahui.target[2]).toBeCloseTo(z, 0);
    expect(data.polygons.filter(p => p.kind === 'building' && Math.hypot(p.points[0][0] - x, p.points[0][1] - z) < 230)).toHaveLength(17);
    expect(data.roads.some(r => r.name === '宛平南路' && r.points.some(p => Math.hypot(p[0] - x, p[1] - z) < 300))).toBe(true);
  });

  it('rejects malformed versions, geometry and non-finite building heights before allocating meshes', () => {
    const minimal: ShanghaiData = { version: 1, origin: [121.4991, 31.2534], river: [[0, 0], [0, 100]], polygons: [{ id: 'test', kind: 'building', height: 10, minHeight: 0, points: [[0, 0], [10, 0], [0, 10]] }], roads: [] };
    expect(() => validateShanghaiData(minimal)).not.toThrow();
    expect(() => validateShanghaiData({ ...minimal, river: [[0, 0], [0, 0]] })).toThrow('Invalid Shanghai map');
    expect(() => validateShanghaiData({ ...minimal, roads: [{ points: [[0, 0], [1, 0]], width: 8, bridge: 'false' }] })).toThrow('Invalid Shanghai map');
    for (const bad of [null, {}, { ...minimal, version: 2 }, { ...minimal, origin: [181, 31] }, { ...minimal, river: [[0, NaN], [0, 100]] }, { ...minimal, river: [[0, 0], [25000, 0]] }, { ...minimal, polygons: [null] }, { ...minimal, polygons: [{ ...minimal.polygons[0], holes: {} }] }, { ...minimal, polygons: [{ ...minimal.polygons[0], height: Infinity }] }, { ...minimal, polygons: [{ ...minimal.polygons[0], minHeight: 11 }] }, { ...minimal, roads: [null] }, { ...minimal, roads: [{ points: [[0, 0], [1, 0]], width: -1 }] }]) expect(() => validateShanghaiData(bad)).toThrow('Invalid Shanghai map');
  });

  it('pauses without advancing, clamps long frames, and stops exactly at the end', () => {
    // Exercise the runtime camera update without fetch, DOM or GPU allocation.
    const city = Object.create(ShanghaiScene.prototype) as ShanghaiScene;
    Object.assign(city, { lastTime: 1000, elapsed: 0, distance: 0, cruising: false, changed: () => {} });
    city.route = new THREE.CurvePath(); city.route.add(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 100)));
    const camera = new THREE.PerspectiveCamera(), target = new THREE.Vector3();
    city.update(2000, false, camera, target); expect(city.distance).toBe(0);
    city.cruising = true; city.update(3000, false, camera, target); expect(city.distance).toBe(9.5);
    city.distance = 99; city.update(3100, false, camera, target); expect(city.distance).toBe(100); expect(city.cruising).toBe(false);
    city.update(3200, true, camera, target); expect(city.distance).toBe(100);
  });
});
