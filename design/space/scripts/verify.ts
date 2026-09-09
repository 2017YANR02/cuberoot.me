import * as THREE from 'three';
import { SpaceRoom } from '../../../core/packages/client/app/[lang]/space/space-room';
import { ROOMS, type RoomStyle, type Environment } from '../../../core/packages/client/app/[lang]/space/space-state';
import { ShanghaiScene } from '../../../core/packages/client/app/[lang]/space/space-shanghai';

// Browser-side round-trip acceptance; also works without a WebGL context.
const results: unknown[] = [];
const errors: string[] = [];
THREE.DefaultLoadingManager.onError = url => errors.push(url);
const requested = new URLSearchParams(location.search).get('asset');
const keys = requested ? [requested] : [...Object.keys(ROOMS).flatMap(style => ['original', 'island', 'shanghai'].map(env => `${style}-${env}`)), 'shanghai'];
const status = document.querySelector('pre')!;
try {
  for (const key of keys) {
    if (key === 'shanghai') {
      const city = new ShanghaiScene(false, () => {});
      await city.ready;
      const internal = city as any, before = new THREE.Matrix4(), after = new THREE.Matrix4();
      const camera = new THREE.PerspectiveCamera(); camera.position.set(-1165, 64, 1475); camera.lookAt(-1345, 36, 1367);
      city.setWeather('sunny', 0, new THREE.Vector3(0, 1, 0), 'huangpu', '09:00');
      city.update(1000, true, camera, new THREE.Vector3());
      internal.boats.getMatrixAt(0, before);
      const clocks: THREE.Object3D[] = [];
      city.root.traverse(o => { if (o.name === 'Customs hour hand') clocks.push(o); });
      const rotations = clocks.map(o => o.rotation.z);
      city.setWeather('thunderstorm', 1, new THREE.Vector3(0, -1, 0), 'tahiti', '21:30');
      city.update(1100, true, camera, new THREE.Vector3()); internal.boats.getMatrixAt(0, after);
      if (!clocks.length || clocks.some((o, i) => o.rotation.z === rotations[i]) || before.equals(after)) throw new Error('Clock or boat animation lost');
      if (!internal.water || internal.water.material.uniforms.riverSlope.value !== .9 || !internal.traffic.root.children.length || errors.length) throw new Error('Water, traffic or texture lost');
      let meshes = 0, shaderMaterials = 0, buildingAttributes = 0;
      const seen = new Set<THREE.Material>();
      city.root.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        meshes++; if (o.geometry.getAttribute('buildingData')) buildingAttributes++;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (seen.has(m)) continue; seen.add(m);
          if (!(m instanceof THREE.MeshStandardMaterial)) continue;
          const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
          m.onBeforeCompile(shader as any, {} as any);
          if ('cityNight' in shader.uniforms) shaderMaterials++;
          if (/\b(?:NaN|Infinity|undefined)\b/.test(shader.vertexShader + shader.fragmentShader)) throw new Error(`Invalid shader ${m.userData.spaceMaterialId}`);
        }
      });
      if (!buildingAttributes || shaderMaterials < 50) throw new Error('Building attributes or night shaders lost');
      // glTF sanitizes imported names; the authoring contract uses stable IDs.
      let jinMao: THREE.Object3D | undefined;
      city.root.traverse(o => { if (o.userData.spaceId === 'root/132/0') jinMao = o; });
      if (!jinMao) throw new Error('Jin Mao runtime root lost');
      let authoredJinMao: unknown = null;
      if (jinMao?.userData.spaceAuthoringRevision) {
        city.root.updateMatrixWorld(true);
        const height = new THREE.Box3().setFromObject(jinMao).getSize(new THREE.Vector3()).y;
        const metalwork = jinMao.getObjectByName('Jin Mao crown metalwork');
        if (Math.abs(height - 420.5) > .1 || jinMao.userData.reconstruction?.floors !== 88 || !metalwork) throw new Error('Authored Jin Mao height, floors or crown lost');
        let facadeMeshes = 0;
        jinMao.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          if (!o.geometry.getAttribute('uv') || !o.castShadow || !o.receiveShadow) throw new Error('Authored facade UVs or shadows lost');
          facadeMeshes++;
        });
        authoredJinMao = {revision: jinMao.userData.spaceAuthoringRevision, height, floors: 88, facadeMeshes};
      }
      const roots = new Map<string, THREE.Object3D>();
      city.root.traverse(o => { if (o.userData.spaceId) roots.set(o.userData.spaceId, o); });
      const revision = 'shanghai-landmarks-20260908';
      const financial = roots.get('root/132/1'), tower = roots.get('root/132/2');
      if (!financial || !tower) throw new Error('Supertall runtime roots lost');
      let authoredLandmarks: unknown = null;
      if (financial.userData.spaceAuthoringRevision === revision) {
        if (tower.userData.spaceAuthoringRevision !== revision) throw new Error('Shanghai Tower revision lost');
        const towerHeight = new THREE.Box3().setFromObject(tower).getSize(new THREE.Vector3()).y;
        if (Math.abs(towerHeight - 632) > .5 || !tower.userData.spaceFacadeDetail?.crownInnerSkin) throw new Error('Shanghai Tower height or crown lost');
        // Rays traverse the real exported opening from both faces; the slab
        // above it must remain solid. This catches accidental mullion bridges.
        for (const side of [-1, 1]) {
          const direction = new THREE.Vector3(0, 0, -side).transformDirection(financial.matrixWorld);
          const probe = (height: number) => new THREE.Raycaster(
            new THREE.Vector3(0, height, side * 100).applyMatrix4(financial.matrixWorld), direction, 0, 200,
          ).intersectObject(financial, true);
          if (probe(460).length || !probe(486).length) throw new Error('SWFC aperture or crown slab lost');
        }
        const bundIds = [...Array.from({length: 21}, (_, i) => `root/147/8/${i}`), 'root/147/4', 'root/147/5', 'root/147/6'];
        let stoneMeshes = 0, fittedWindows = 0;
        for (const id of bundIds) {
          const building = roots.get(id);
          if (building?.userData.spaceAuthoringRevision !== revision) throw new Error(`Bund authoring revision lost: ${id}`);
          fittedWindows += building.userData.spaceFacadeDetail.fittedWindows;
          let surfaces = 0;
          building.traverse(o => {
            if (!(o instanceof THREE.Mesh)) return;
            for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
              if (!mat.userData.spaceSurfaceProvenance) continue;
              // Frames copy provenance but intentionally omit the stone maps.
              if (!String(mat.userData.spaceShaderKey).includes('bund-stone')) continue;
              if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.normalMap || !mat.roughnessMap || !o.geometry.getAttribute('uv')) throw new Error(`Stone maps or UV lost: ${id}`);
              surfaces++;
            }
          });
          if (surfaces !== building.userData.spaceFacadeDetail.stoneMeshes) throw new Error(`Stone surface count changed: ${id}`);
          stoneMeshes += surfaces;
        }
        authoredLandmarks = {revision, towerHeight, bundBuildings: bundIds.length, fittedWindows, stoneMeshes, apertureRays: 4};
      }
      let authoredEntrances: unknown = null;
      const asia = roots.get('root/147/8/0'), club = roots.get('root/147/8/1');
      if (asia?.userData.spaceBundEntranceRevision || club?.userData.spaceBundEntranceRevision) {
        const entranceRevision = 'bund-entrances-20260908';
        if (asia?.userData.spaceBundEntranceRevision !== entranceRevision || club?.userData.spaceBundEntranceRevision !== entranceRevision) throw new Error('Bund entrance revision mismatch');
        const ray = (building: THREE.Object3D, start: THREE.Vector3, direction: THREE.Vector3) => new THREE.Raycaster(
          start.applyMatrix4(building.matrixWorld), direction.transformDirection(building.matrixWorld), 0, 60,
        ).intersectObject(building, true)[0];
        const front = (building: THREE.Object3D, x: number, height: number) => ray(building, new THREE.Vector3(x, height, -10), new THREE.Vector3(0, 0, 1));
        const mustHit = (hit: THREE.Intersection | undefined, part: string, label: string) => {
          if (hit?.object.userData.spaceBundEntrancePart !== part) throw new Error(`${label}: expected recessed ${part}, hit ${hit?.object.userData.spaceId}`);
        };
        // Test real exported surfaces: masonry must leave both attic/oculus
        // openings clear, and both roof slopes must face an overhead camera.
        for (const side of [-1, 1]) {
          mustHit(front(asia, side * asia.userData.frontage * .37 + .2, 31.5), 'glass', 'Asia attic');
          mustHit(front(club, side * 3.9 + .24, 7.85), 'glass', 'Club oculus');
          mustHit(front(club, side * club.userData.frontage * .37 + .3, 23.9), 'stone', 'Club gable');
          const neighbor = front(club, side * club.userData.frontage / 9 * 2 + .18, 7);
          if (neighbor?.object.userData.spaceId !== 'root/147/8/1/1') throw new Error('Neighboring Club window was clipped');
          const canopy = ray(club, new THREE.Vector3(side * 5.1, 12, -2.4), new THREE.Vector3(0, -1, 0));
          mustHit(canopy, 'glass', 'Club canopy');
          const local = club.worldToLocal(canopy!.point.clone());
          if (Math.abs(local.y - 4.63125) > .02) throw new Error('Club canopy slope changed');
        }
        mustHit(front(club, 0, 7.2), 'stone', 'Club entrance spandrel');
        const height = new THREE.Box3().setFromObject(asia).getSize(new THREE.Vector3()).y;
        if (Math.abs(height - 35.11) > .03) throw new Error('Asia old triangular roof remains or cap lost');
        authoredEntrances = {revision: entranceRevision, buildings: 2, surfaceRays: 11, asiaHeight: height, canopyProjection: club.userData.spaceBundEntranceDetail.canopyProjection};
      }
      let authoredGalleries: unknown = null;
      if (asia?.userData.spaceBundGalleryRevision || club?.userData.spaceBundGalleryRevision) {
        const galleryRevision = 'bund-galleries-20260909';
        if (asia?.userData.spaceBundGalleryRevision !== galleryRevision || club?.userData.spaceBundGalleryRevision !== galleryRevision) throw new Error('Bund gallery revision mismatch');
        let surfaceRays = 0;
        const cast = (building: THREE.Object3D, start: THREE.Vector3, direction: THREE.Vector3, far = 60) => {
          surfaceRays++;
          return new THREE.Raycaster(start.applyMatrix4(building.matrixWorld), direction.transformDirection(building.matrixWorld), 0, far).intersectObject(building, true)[0];
        };
        const front = (building: THREE.Object3D, x: number, height: number, far = 60) => cast(building, new THREE.Vector3(x, height, -10), new THREE.Vector3(0, 0, 1), far);
        const recesses: number[] = [];
        const glazing = (building: THREE.Object3D, x: number, height: number, depth: number) => {
          const hit = front(building, x, height);
          if (hit?.object.userData.spaceBundGalleryPart !== 'glass') throw new Error(`Gallery opening blocked: ${building.userData.spaceId} at ${x}, ${height}; hit ${hit?.object.userData.spaceId}`);
          const measured = building.worldToLocal(hit.point.clone()).z;
          if (Math.abs(measured - depth) > .025) throw new Error(`Gallery glazing not recessed: ${measured}`);
          recesses.push(measured);
        };
        // Probe all new windows through the exported colonnades and balconies.
        // A front pane, remaining old window, or filled arch must fail here.
        for (const x of [-5.76, 0, 5.76]) {
          for (const bottom of [9.08, 13.08, 17.08, 21.6, 25.78]) glazing(asia, x + .31, bottom + 1.43, 2.7525);
        }
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * club.userData.frontage * .64 / 5;
          for (const bottom of [9.65, 16]) glazing(club, x + .31, bottom + 1.43, 1.8525);
        }
        // The colonnade stands in front of the wall; verify both surfaces.
        const column = front(club, 1.9, 12.2);
        if (column?.object.userData.spaceBundGalleryPart !== 'columns') throw new Error(`Club foreground column missing: hit ${column?.object.userData.spaceId}`);
        const pier = front(club, 1.6, 12.2);
        if (pier?.object.userData.spaceBundGalleryPart !== 'stone') throw new Error(`Club back wall between windows missing: hit ${pier?.object.userData.spaceId}`);
        for (const side of [-1, 1]) {
          if (front(club, side * club.userData.frontage * .37 + .2, 25.3, 16)) throw new Error('Club lantern arch is filled');
        }
        // Downward rays catch inverted slab/roof faces invisible to the camera.
        for (const height of [21.38, 25.50]) {
          const hit = cast(asia, new THREE.Vector3(.31, height + 2, -.3), new THREE.Vector3(0, -1, 0));
          if (hit?.object.userData.spaceBundGalleryPart !== 'trim' || Math.abs(asia.worldToLocal(hit.point.clone()).y - height) > .02) throw new Error('Asia balcony upper surface missing');
        }
        for (const depth of [12, 35, 50]) {
          const hit = cast(club, new THREE.Vector3(.31, 32, depth), new THREE.Vector3(0, -1, 0));
          if (hit?.object.userData.spaceBundGalleryPart !== 'roof') throw new Error(`Club roof missing at depth ${depth}`);
        }
        authoredGalleries = {revision: galleryRevision, buildings: 2, surfaceRays, recessedWindows: recesses.length,
          glassDepthMin: Math.min(...recesses), glassDepthMax: Math.max(...recesses), estimatedDimensions: true};
      }
      results.push({key, source: city.root.userData.spaceSource, meshes, shaderMaterials, buildingAttributes, clocks: clocks.length, traffic: internal.traffic.root.userData.cars, boats: internal.boats.count, authoredJinMao, authoredLandmarks, authoredEntrances, authoredGalleries});
      city.dispose(); continue;
    }
    const [style, env] = key.split('-') as [RoomStyle, Environment];
    if (!(style in ROOMS) || !['original', 'island', 'shanghai'].includes(env)) throw new Error(`Invalid asset: ${key}`);
    const room = new SpaceRoom(style, [], () => {}, env);
    await room.ready;
    let meshes = 0, instances = 0, reflections = 0, island = false;
    room.root.traverse(o => {
      if (o instanceof THREE.Mesh) { meshes++; instances += o instanceof THREE.InstancedMesh ? o.count : 1; }
      if (o.type === 'Reflector') reflections++;
      if (o instanceof THREE.Mesh && !Array.isArray(o.material) && o.material.customProgramCacheKey() === 'space-island-terrain') island = true;
    });
    if (!room.floor || !reflections || !room.obstacles.length || errors.length) throw new Error(`${key}: missing floor, reflection, collision or texture: ${errors.join(',')}`);
    if (env === 'island' && !island) throw new Error(`${key}: island shader missing`);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(6, 1.7, 7); room.update(camera, false);
    const bounds = new THREE.Box3().setFromObject(room.root);
    if (bounds.isEmpty() || !bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite)) throw new Error(`${key}: invalid bounds`);
    results.push({key, meshes, instances, reflections, surfaces: room.surfaces.length, obstacles: room.obstacles.length, min: bounds.min.toArray(), max: bounds.max.toArray()});
    room.dispose();
    status.textContent = JSON.stringify({results, errors}, null, 2);
  }
  (window as any).verification = {ok: true, results, errors};
} catch (error) {
  (window as any).verification = {ok: false, results, errors, error: String(error)};
  status.textContent = JSON.stringify((window as any).verification, null, 2);
}
