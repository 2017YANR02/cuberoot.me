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
          // The later window revision replaces every upper pane with a pair;
          // those openings have their own exhaustive surface probes below.
          const bottoms = club.userData.spaceBundWindowRevision ? [9.65] : [9.65, 16];
          for (const bottom of bottoms) glazing(club, x + .31, bottom + 1.43, 1.8525);
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
      let authoredWindows: unknown = null;
      if (club?.userData.spaceBundWindowRevision) {
        const windowRevision = 'bund-windows-20260909';
        if (club.userData.spaceBundWindowRevision !== windowRevision) throw new Error('Bund window revision mismatch');
        let surfaceRays = 0, windows = 0;
        const front = (x: number, height: number, part: string, depth?: number) => {
          surfaceRays++;
          const hit = new THREE.Raycaster(
            new THREE.Vector3(x, height, -10).applyMatrix4(club.matrixWorld),
            new THREE.Vector3(0, 0, 1).transformDirection(club.matrixWorld), 0, 60,
          ).intersectObject(club, true)[0];
          if (hit?.object.userData.spaceBundWindowPart !== part) throw new Error(`Club ${part} at ${x}, ${height} blocked by ${hit?.object.userData.spaceId}`);
          if (depth !== undefined && Math.abs(club.worldToLocal(hit.point.clone()).z - depth) > .025) throw new Error(`Club ${part} depth changed at ${x}, ${height}`);
          return hit;
        };
        for (let group = 0; group < 5; group++) {
          const center = (group - 2) * club.userData.frontage * .64 / 5;
          for (const offset of [-.93, 0, .93]) {
            // Above the spring line, glazing must remain visible inside the
            // arch; just outside that curve the spandrel must stay solid.
            front(center + offset + .10, 21.48, 'glass', .57); windows++;
            front(center + offset + .33, 21.675, 'stone', -.03);
          }
          for (const offset of [-.60, .60]) {
            front(center + offset + .11, 17.57, 'glass', 1.8525); windows++;
          }
          // Adjacent jambs meet at the center of the pair, in front of the
          // masonry. Probe the jamb and clear wall above the lintel separately.
          front(center, 17.57, 'trim', 1.55);
          front(center, 18.70, 'stone', 1.80);
        }
        for (const side of [-1, 1]) {
          front(side * club.userData.frontage * .37 + .21, 21.5, 'glass', .57); windows++;
          front(side * 18.40, 21, 'stone', -.03);
        }
        const detail = club.userData.spaceBundWindowDetail;
        if (detail?.atticGroups !== 5 || detail.atticWindows !== 15 || detail.endArches !== 2 || detail.pairedWindows !== 10) throw new Error('Club window grouping metadata lost');
        authoredWindows = {revision: windowRevision, surfaceRays, windows, atticGroups: 5, pairedGroups: 5, estimatedDimensions: true};
      }
      let authoredHeroDetails: unknown = null;
      const heroRevision = 'bund-hero-details-20260909';
      const bank = roots.get('root/147/6'), customs = roots.get('root/147/5'), peace = roots.get('root/147/4');
      if ([bank, customs, peace].some(b => b?.userData.spaceBundHeroRevision)) {
        for (const b of [bank, customs, peace]) {
          if (b?.userData.spaceBundHeroRevision !== heroRevision) throw new Error('Bund hero revision mismatch');
          const body = roots.get(b.userData.spaceId + '/0');
          if (!(body instanceof THREE.Mesh) || !body.geometry.getAttribute('uv')) throw new Error('Stone metric UV lost');
          const mat = body.material;
          if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.map || !mat.normalMap || !mat.roughnessMap) throw new Error('Stone PBR maps lost');
          const lenses = roots.get(heroRevision + '/' + b.userData.spaceId + '/lamp-lenses');
          if (!(lenses instanceof THREE.Mesh) || !(lenses.material instanceof THREE.MeshStandardMaterial) ||
              lenses.material.userData.spaceShaderKey !== 'shanghai-illumination-1.2') throw new Error('Fixture runtime night binding lost');
        }
        let surfaceRays = 0;
        const cast = (building: THREE.Object3D, target: THREE.Object3D, start: THREE.Vector3, direction: THREE.Vector3, far = 100) => {
          surfaceRays++;
          return new THREE.Raycaster(start.applyMatrix4(building.matrixWorld), direction.transformDirection(building.matrixWorld), 0, far).intersectObject(target, true)[0];
        };
        const columns = roots.get(heroRevision + '/root/147/6/fluted-columns');
        if (!bank || !customs || !peace || !columns) throw new Error('Hero building or shafts missing');
        const grooveDepths: number[] = [];
        for (const x of [-12.7, -7.62, -2.54, 2.54, 7.62, 12.7]) {
          const radii = [Math.PI / 2, Math.PI / 2 + Math.PI / 24].map(angle => {
            const center = new THREE.Vector3(x, 14, -2.1);
            const outward = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
            const hit = cast(bank, columns, center.clone().addScaledVector(outward, 10), outward.clone().negate(), 20);
            if (!hit) throw new Error('Fluted column surface missing at ' + x);
            return bank.worldToLocal(hit.point.clone()).distanceTo(center);
          });
          const depth = radii[0] - radii[1];
          if (Math.abs(depth - .058) > .005) throw new Error('Column fluting flattened at ' + x);
          grooveDepths.push(depth);
        }
        // The original body mesh carried raised flutes and capital leaves.
        // Probe those old positions through the entire building, not just the
        // new shafts, so floating geometry after changing the spacing fails.
        for (const x of [-6.3, -4.5, 4.5, 6.3]) {
          for (const height of [14, 22.05]) {
            if (cast(bank, bank, new THREE.Vector3(x, height, -4), new THREE.Vector3(0, 0, 1), 3)) throw new Error('Old column decoration remains at ' + x);
          }
        }
        const rebuiltFrontage = customs.userData.spaceBundFrontageRevision === 'bund-frontages-20260909';
        for (const x of rebuiltFrontage ? [-16, -9.6, -4.8, 0, 4.8, 9.6, 16] : [-8, 0, 8]) for (const height of rebuiltFrontage ? [15.7, 20, 24.3] : [11.5, 15.8, 20.2, 24.6]) {
          for (const [offset, part] of [[.14, 'bronze-relief'], [.55, 'bronze-panels']] as const) {
            const hit = cast(customs, customs, new THREE.Vector3(x + offset, height, -10), new THREE.Vector3(0, 0, 1));
            if (hit?.object.userData.spaceBundHeroPart !== part) throw new Error(`Customs ${part} blocked at ${x}, ${height}: ${hit?.object.userData.spaceId}`);
          }
        }
        const roof = roots.get('root/147/4/5');
        if (!roof) throw new Error('Peace roof missing');
        for (const [height, expected] of [[66, 11.52588 - (11.52588 - 1.6) * 6 / 13.6], [75, 1.05]]) {
          const center = new THREE.Vector3(-1328, height, 1367);
          for (let side = 0; side < 4; side++) {
            const outward = new THREE.Vector3(Math.cos(side * Math.PI / 2), 0, Math.sin(side * Math.PI / 2));
            // The later crown opens the central lantern skin for real louvers.
            // Keep checking the unchanged 1.05 m skin at its uncut side strip.
            const target = center.clone();
            if (height === 75 && peace.userData.spacePeaceCrownRevision) target.add(new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(.90));
            const hit = cast(peace, roof, target.clone().addScaledVector(outward, 30), outward.clone().negate(), 60);
            if (!hit || Math.abs(peace.worldToLocal(hit.point.clone()).distanceTo(target) - expected) > .025) throw new Error('Peace copper roof or lantern surface missing');
          }
        }
        const cap = cast(peace, roof, new THREE.Vector3(-1327.8, 80, 1367), new THREE.Vector3(0, -1, 0), 10);
        if (!cap || Math.abs(peace.worldToLocal(cap.point.clone()).y - 76.6) > .025) throw new Error('Peace lantern top is open');
        authoredHeroDetails = {revision: heroRevision, buildings: 3, surfaceRays, flutedColumns: 6,
          grooveDepthMin: Math.min(...grooveDepths), grooveDepthMax: Math.max(...grooveDepths), bronzeSpandrels: rebuiltFrontage ? 21 : 12, estimatedDimensions: true};
      }
      let authoredFrontages: unknown = null;
      const frontageRevision = 'bund-frontages-20260909';
      if ([customs, peace].some(b => b?.userData.spaceBundFrontageRevision)) {
        if (!customs || !peace || [customs, peace].some(b => b.userData.spaceBundFrontageRevision !== frontageRevision)) throw new Error('Bund frontage revision mismatch');
        let surfaceRays = 0;
        const probe = (building: THREE.Object3D, start: THREE.Vector3, direction: THREE.Vector3, part: string, axis: 'x' | 'y' | 'z', depth: number) => {
          surfaceRays++;
          const hit = new THREE.Raycaster(start.applyMatrix4(building.matrixWorld), direction.transformDirection(building.matrixWorld), 0, 100).intersectObject(building, true)[0];
          if (hit?.object.userData.spaceBundFrontagePart !== part || Math.abs(building.worldToLocal(hit.point.clone())[axis] - depth) > .025) {
            throw new Error(`Bund frontage ${part} at ${start.toArray()}: ${hit?.object.userData.spaceId}, ${hit ? building.worldToLocal(hit.point.clone()).toArray() : 'no hit'}`);
          }
        };
        const customsFront = (x: number, height: number, part: string, depth: number) => probe(customs, new THREE.Vector3(x, height, -10), new THREE.Vector3(0, 0, 1), part, 'z', depth);
        for (const x of [-16, -9.6, -4.8, 0, 4.8, 9.6, 16]) {
          for (const z of [12, 16.3, 20.6, 24.9]) customsFront(x + .22, z + .9, 'glass', .39);
          customsFront(x + .20, 8.8, 'glass', .39);
        }
        for (const x of [-8, -4, 0, 4, 8]) customsFront(x + .3, 3.0, 'glass', .83);
        for (const x of [-18, -12.8, -7.2, -2.4, 2.4, 7.2, 12.8, 18]) customsFront(x, 18.3, 'stone', -.16);
        const customsDetail = customs.userData.spaceBundFrontageDetail;
        if (customsDetail?.mainWindows !== 28 || customsDetail.portals !== 5 || customsDetail.doricColumns !== 4 || customsDetail.towerGrilles !== 3 || customsDetail.bronzeSpandrels !== 21) throw new Error('Customs frontage metadata lost');
        for (const offset of [-2.18, 0, 2.18]) customsFront(customsDetail.towerCenter[0] + offset + .22, 44.51, 'glass', .65 - customsDetail.towerFront);
        const peaceFront = (x: number, height: number, part: string, depth: number) => probe(peace, new THREE.Vector3(-1280, height, 1367 + x), new THREE.Vector3(-1, 0, 0), part, 'x', depth);
        for (const group of [-7.4, 0, 7.4]) for (const offset of [-1.72, 0, 1.72]) {
          for (const z of [39.05, 43.25]) peaceFront(group + offset + .15, z + 1.1, 'glass', -1313.55);
        }
        for (const x of [-9.12, -7.4, -5.68, 5.68, 7.4, 9.12]) peaceFront(x + .15, 48.35, 'glass', -1315.35);
        for (const x of [-8, -4, 0, 4, 8]) peaceFront(x + .15, 55.3, 'glass', -1317.05);
        peaceFront(.23, 50.8, 'glass', -1316.8);
        for (const x of [-1.7, 1.7]) peaceFront(x, 52.25, 'stone', -1316.2);
        // Downward probes catch missing horizontal returns at the rebuilt tiers.
        for (const x of [-10, 10]) probe(peace, new THREE.Vector3(-1313.5, 47, 1367 + x), new THREE.Vector3(0, -1, 0), 'stone', 'y', 46.58);
        const peaceDetail = peace.userData.spaceBundFrontageDetail;
        if (peaceDetail?.upperGroupedWindows !== 24 || peaceDetail.topWindows !== 5 || peaceDetail.centralArches !== 1 || peaceDetail.carvedParapetPanels !== 11 || peaceDetail.terraces !== 2) throw new Error('Peace upper frontage metadata lost');
        authoredFrontages = {revision: frontageRevision, buildings: 2, surfaceRays, customsMainWindows: 28, peaceUpperWindows: 29, estimatedDimensions: true};
      }
      let authoredPeaceRiverfront: unknown = null;
      if (peace?.userData.spacePeaceRiverfrontRevision) {
        const revision = 'peace-riverfront-20260909';
        if (peace.userData.spacePeaceRiverfrontRevision !== revision) throw new Error('Peace riverfront revision mismatch');
        const detail = peace.userData.spacePeaceRiverfrontDetail;
        if (detail?.windows !== 63 || detail.spandrels !== 63 || detail.groundArches !== 2 || detail.fanlightRibs !== 22) throw new Error('Peace riverfront metadata lost');
        let surfaceRays = 0;
        const front = (x: number, height: number, part: string, depth: number) => {
          surfaceRays++;
          const start = new THREE.Vector3(-1280, height, 1367 + x).applyMatrix4(peace.matrixWorld);
          const direction = new THREE.Vector3(-1, 0, 0).transformDirection(peace.matrixWorld);
          const hit = new THREE.Raycaster(start, direction, 0, 100).intersectObject(peace, true)[0];
          if (hit?.object.userData.spacePeaceRiverfrontPart !== part || Math.abs(peace.worldToLocal(hit.point.clone()).x - depth) > .025) {
            throw new Error(`Peace riverfront ${part} at ${x}, ${height}: ${hit?.object.userData.spaceId}, ${hit ? peace.worldToLocal(hit.point.clone()).toArray() : 'no hit'}`);
          }
        };
        // Probe every new aperture and spandrel, then masonry between the bays.
        for (const group of [-7.4, 0, 7.4]) for (const offset of [-1.72, 0, 1.72]) {
          for (let level = 0; level < 7; level++) {
            const bottom = 9.65 + 4.2 * level;
            front(group + offset + .15, bottom + 1.1, 'glass', -1313.55);
            front(group + offset + .1, bottom + 3.35, 'trim', -1312.98);
          }
        }
        for (const x of [-11, -3.6, 3.6, 11]) {
          for (let level = 0; level < 7; level++) front(x, 10.75 + 4.2 * level, 'stone', -1313);
          for (const height of [38.5, 38.8]) front(x, height, 'stone', -1313);
        }
        // These strips replaced intersecting wall and closure-box faces.
        for (const x of [-12.71, 12.71]) for (const height of [39.1, 42, 45.7]) front(x, height, 'stone', -1313);
        for (const x of [-11, 11]) front(x, 46.51, 'stone', -1313);
        for (const x of [-7.4, 7.4]) {
          front(x + .4, 3.5, 'glass', -1312.1);
          front(x + 1.4 * Math.cos(Math.PI * .37), 5.8 + 1.4 * Math.sin(Math.PI * .37), 'glass', -1312.1);
          front(x + 1.137 * Math.cos(Math.PI * .37), 5.8 + 1.137 * Math.sin(Math.PI * .37), 'metal', -1311.98);
          front(x + 2.56, 2, 'stone', -1311.5);
        }
        authoredPeaceRiverfront = {revision, surfaceRays, windows: 63, spandrels: 63, groundArches: 2, estimatedDimensions: true};
      }
      let authoredCustomsRoof: unknown = null;
      if (customs?.userData.spaceCustomsRoofRevision) {
        const revision = 'customs-roof-20260910';
        const detail = customs.userData.spaceCustomsRoofDetail;
        if (customs.userData.spaceCustomsRoofRevision !== revision || detail?.pavilions?.length !== 2 || detail.terraceWindows !== 5 || detail.plinthPanels !== 9 || detail.towerPiers !== 2) throw new Error('Customs roof metadata lost');
        let surfaceRays = 0;
        const probe = (start: THREE.Vector3, direction: THREE.Vector3, part: string, axis: 'y' | 'z', depth: number) => {
          surfaceRays++;
          const hit = new THREE.Raycaster(start.applyMatrix4(customs.matrixWorld), direction.transformDirection(customs.matrixWorld), 0, 100).intersectObject(customs, true)[0];
          const actualPart = hit?.object.userData.spaceCustomsRoofPart ?? hit?.object.userData.spaceId;
          if (actualPart !== part || Math.abs(customs.worldToLocal(hit.point.clone())[axis] - depth) > .025) {
            throw new Error(`Customs roof ${part}: ${actualPart}, ${hit ? customs.worldToLocal(hit.point.clone()).toArray() : 'no hit'}`);
          }
        };
        const front = (x: number, height: number, part: string, depth: number) => probe(new THREE.Vector3(x, height, -10), new THREE.Vector3(0, 0, 1), part, 'z', depth);
        // Check both arch crowns, jambs, chamfer returns and continuous cornices.
        for (const [center, face, half] of [[-16.45, 1.02, 3.95], [15.61, 1.27, 4.22]]) {
          for (const height of [32.85, 34.55]) front(center + .25, height, 'glass', .60 - face);
          front(center + .75, 34.75, 'stone', -face);
          front(center + .86, 33.7, 'trim', -(face + .105));
          front(center + .20, 35.91, 'stone', -(face + .30));
          for (const sign of [-1, 1]) {
            front(center + sign * (half - .325), 36.2, 'stone', -(face - .325));
            front(center + sign * (half - .325), 38.02, 'trim', -(face + .2714));
          }
        }
        for (const x of [-8, -4, 0, 4, 8]) front(x + .22, 32.2, 'glass', 3.17);
        probe(new THREE.Vector3(2.1, 33, .2), new THREE.Vector3(0, -1, 0), 'stone', 'y', 31.23);
        const tx = customs.userData.spaceBundFrontageDetail.towerCenter[0];
        const face = detail.towerFront;
        for (const sign of [-1, 1]) {
          front(tx + sign * 6.10, 40.2, 'stone', -(face + .33));
          // The old front louvers must be removed, exposing the original masonry.
          front(tx + sign * 14.5 * .27, 38.2, 'root/147/5/0', -face);
        }
        for (let i = 0; i < 9; i++) front(tx - 4.64 + i * 1.16 + .40, 42.55, 'trim', -(face + .21));
        authoredCustomsRoof = {revision, surfaceRays, pavilions: 2, terraceWindows: 5, plinthPanels: 9, estimatedDimensions: true};
      }
      // Mirror the author scripts' root-local coordinates: Blender (x,y,z)
      // becomes glTF (x,z,-y). Hit the entire building, including legacy meshes,
      // and measure locally so a retained root transform cannot skew the depth.
      if (!peace?.userData.spacePeaceCrownRevision || !customs?.userData.spaceCustomsJunctionRevision || !bank?.userData.spaceHsbcDrumRevision) {
        throw new Error('Shanghai GLB is missing the current Peace crown, Customs junction or HSBC drum revision');
      }
      city.root.updateMatrixWorld(true);
      const gltfPoint = ([x, y, z]: readonly number[]) => new THREE.Vector3(x, z, -y);
      const firstSurface = (building: THREE.Object3D, label: string, origin: readonly number[], direction: readonly number[], id: string, depth: number) => {
        const start = gltfPoint(origin);
        const hit = new THREE.Raycaster(start.clone().applyMatrix4(building.matrixWorld), gltfPoint(direction).transformDirection(building.matrixWorld), 0, 100).intersectObject(building, true)[0];
        const measured = hit ? building.worldToLocal(hit.point.clone()).distanceTo(start) : NaN;
        if (hit?.object.userData.spaceId !== id || !Number.isFinite(measured) || Math.abs(measured - depth) > .025) {
          throw new Error(`${label}: expected ${id} at ${depth}, hit ${hit?.object.userData.spaceId} at ${measured}`);
        }
        return {label, firstId: id, depth: measured};
      };
      const boundPart = (id: string, property: string, part: string, materialId: string, shaderKey?: string) => {
        const mesh = roots.get(id);
        if (!(mesh instanceof THREE.Mesh) || mesh.userData[property] !== part ||
            !mesh.geometry.getAttribute('position')?.count || !mesh.geometry.getAttribute('normal') || !mesh.geometry.getAttribute('uv') ||
            !mesh.castShadow || !mesh.receiveShadow || !(mesh.material instanceof THREE.MeshStandardMaterial) ||
            mesh.material.userData.spaceMaterialId !== materialId || (shaderKey !== undefined && mesh.material.userData.spaceShaderKey !== shaderKey)) {
          throw new Error(`Authored part geometry, material or runtime binding lost: ${id}`);
        }
        return mesh.material;
      };
      let authoredPeaceCrown: unknown = null;
      if (peace?.userData.spacePeaceCrownRevision) {
        const revision = 'peace-crown-20260910', detail = peace.userData.spacePeaceCrownDetail;
        if (peace.userData.spacePeaceCrownRevision !== revision || detail?.lanternOpenings !== 4 || detail.louverBlades !== 40 ||
            detail.hipCapJoints !== 156 || detail.eavesSwags !== 80 || detail.newMeshes !== 3 || !(detail.removedRoofFaces > 0)) throw new Error('Peace crown metadata lost');
        for (const part of ['copper', 'raised-copper', 'recess']) boundPart(`${revision}/root/147/4/${part}`, 'spacePeaceCrownPart', part, `${revision}/${part}`, 'shanghai-illumination-0');
        const surfaceChecks = [];
        const half = 11.52588;
        const facePoint = (u: number, v: number, height: number, face: number) => {
          const c = Math.round(Math.cos(face * Math.PI / 2)), s = Math.round(Math.sin(face * Math.PI / 2));
          return [-1328 + u * c - v * s, -1367 + u * s + v * c, height];
        };
        const front = (face: number, u: number, height: number, start: number, part: string, surface: number, label: string) => {
          const angle = face * Math.PI / 2;
          surfaceChecks.push(firstSurface(peace, `Peace ${label} face ${face}`, facePoint(u, start, height, face),
            [Math.round(Math.sin(angle)), -Math.round(Math.cos(angle)), 0], `${revision}/root/147/4/${part}`, start - surface));
        };
        for (let face = 0; face < 4; face++) {
          for (let i = 0; i < 10; i++) {
            const bottom = 74.56 + i * .122;
            front(face, .23, bottom + .015, 2, 'raised-copper', 1.115, `louver ${i}`);
            front(face, .23, bottom + .070, 2, 'recess', 1.11 - .24 * .070 / .105, `louver cavity ${i}`);
          }
          // The retained central shield covers the fold and two swag centers.
          // Inspect the exposed fold and outer arcs of those same two swags.
          front(face, 2.3, 60.088, half + 1, 'raised-copper', half + .226, 'eaves fold');
          for (let i = 0; i < 20; i++) {
            const center = -half + (i + .5) * 2 * half / 20;
            const t = i === 9 ? 2 / 16 : i === 10 ? 14 / 16 : .5;
            front(face, center + (t - .5) * (2 * half / 20 - .11), 59.99 - .15 * Math.sin(Math.PI * t),
              half + 1, 'raised-copper', half + .212 + .039 / (2 * Math.SQRT2), `eaves swag ${i}`);
          }
          // Every short hip collar must remain outside the older continuous cap.
          const tangent = new THREE.Vector3(1.6 - half, 1.6 - half, 13.6).normalize();
          const cross = tangent.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
          const outward = tangent.clone().cross(cross).normalize().negate();
          const c = Math.round(Math.cos(face * Math.PI / 2)), s = Math.round(Math.sin(face * Math.PI / 2));
          const direction = [-outward.x * c + outward.y * s, -outward.x * s - outward.y * c, -outward.z];
          for (let i = 1; i < 40; i++) {
            const t = i / 40, u = half - (half - 1.6) * t;
            const origin = facePoint(u + outward.x * .5, u + outward.y * .5, 60 + 13.6 * t + outward.z * .5, face);
            surfaceChecks.push(firstSurface(peace, `Peace hip joint ${face}/${i}`, origin, direction,
              `${revision}/root/147/4/raised-copper`, .5 - .230 / (2 * Math.SQRT2)));
          }
        }
        authoredPeaceCrown = {revision, surfaceRays: surfaceChecks.length, surfaceChecks, estimatedDimensions: true};
      }
      let authoredCustomsJunctions: unknown = null;
      if (customs?.userData.spaceCustomsJunctionRevision) {
        const revision = 'customs-junctions-20260910', detail = customs.userData.spaceCustomsJunctionDetail;
        if (customs.userData.spaceCustomsJunctionRevision !== revision || detail?.returns?.length !== 2 || detail.removedFaces !== 640 ||
            detail.glassObjects?.length !== 3 || detail.plinthProjectors !== 5 || detail.projectorAnchors?.length !== 5) throw new Error('Customs junction metadata lost');
        boundPart(`${revision}/root/147/5/plinth-projectors`, 'spaceCustomsJunctionPart', 'plinth-projectors', `${revision}/plinth-projectors`, 'shanghai-illumination-0');
        boundPart(`${revision}/root/147/5/plinth-lenses`, 'spaceCustomsJunctionPart', 'plinth-lenses', `${revision}/plinth-lenses`, 'shanghai-illumination-1.2');
        const glassIds = ['root/147/5/1', 'bund-frontages-20260909/root/147/5/glass', 'customs-roof-20260910/root/147/5/glass'];
        const materialIds = new Set<string>();
        for (const id of glassIds) {
          const mesh = roots.get(id), mat = mesh instanceof THREE.Mesh ? mesh.material : undefined;
          if (!(mat instanceof THREE.MeshStandardMaterial) || ![`${revision}/glass-0`, `${revision}/glass-1`].includes(mat.userData.spaceMaterialId) ||
              Math.abs(mat.metalness) > .0001 || Math.abs(mat.roughness - .34) > .0001 || !detail.glassObjects.includes(id)) throw new Error(`Customs dielectric glazing lost: ${id}`);
          materialIds.add(mat.userData.spaceMaterialId);
        }
        if (materialIds.size !== 2) throw new Error('Customs glazing material identities lost');
        const surfaceChecks = [];
        for (const [center, half, back] of [[-16.45, 3.95, -7.486844062805176], [15.61, 4.22, -6.345259666442871]]) {
          const item = detail.returns.find((value: {center: number}) => value.center === center);
          if (!item || Math.abs(item.back - back) > .001) throw new Error('Customs cornice rear extent changed');
          for (const [height, projection] of [[36.98, .17], [37.20, .36], [37.53, .20], [38.00, .42], [38.40, .25], [39.46, .30]]) {
            for (const side of [-1, 1]) {
              // Inspect the newly extended side at two depths, not the already
              // checked front profile; leftover old ledges must be first-hit failures.
              for (const depth of [-3, back + .30]) surfaceChecks.push(firstSurface(customs, `Customs return ${center}/${height}/${side}/${depth}`,
                [center + side * (half + 1), depth, height], [-side, 0, 0], 'customs-roof-20260910/root/147/5/trim', 1 - projection));
            }
          }
        }
        const tx = -1.3615846633911133, face = -5.227914094924927 + 7.25;
        const normal = new THREE.Vector3(0, -.5, Math.sqrt(3) / 2);
        for (const [i, offset] of [-6.1, -3.05, 0, 3.05, 6.1].entries()) {
          const anchor = new THREE.Vector3(tx + offset, face + .44, 35.71);
          if (anchor.distanceTo(new THREE.Vector3(...detail.projectorAnchors[i])) > .001) throw new Error('Customs projector anchor changed');
          // Begin outside the lens but clear of the nearby stone pillar.
          surfaceChecks.push(firstSurface(customs, `Customs projector ${i}`, anchor.addScaledVector(normal, .12).toArray(), normal.clone().negate().toArray(),
            `${revision}/root/147/5/plinth-lenses`, .032));
        }
        authoredCustomsJunctions = {revision, surfaceRays: surfaceChecks.length, surfaceChecks, dielectricGlassObjects: 3, physicalProjectors: 5, runtimeLightingVerified: false, estimatedDimensions: true};
      }
      let authoredHsbcDrum: unknown = null;
      if (bank?.userData.spaceHsbcDrumRevision) {
        const revision = 'hsbc-drum-20260910', detail = bank.userData.spaceHsbcDrumDetail;
        if (bank.userData.spaceHsbcDrumRevision !== revision || detail?.frontDrumColumns !== 2 || detail.upperRecessedWindows !== 4 ||
            detail.upperBalconies !== 4 || detail.diagonalDecoratedPiers !== 4 || detail.crownBalustradeFaces !== 8 ||
            detail.flatHeadedDormers !== 4 || detail.projectors !== 32 || detail.newMeshes !== 5 || detail.reusedDomeId !== 'root/147/6/5') throw new Error('HSBC drum metadata lost');
        for (const part of ['stone', 'glass', 'trim', 'metal', 'dome', 'lenses']) {
          const id = part === 'dome' ? 'root/147/6/5' : `${revision}/root/147/6/${part}`;
          boundPart(id, 'spaceHsbcDrumPart', part, `${revision}/${part}`, part === 'lenses' ? 'shanghai-illumination-0.3' : undefined);
        }
        const surfaceChecks: ReturnType<typeof firstSurface>[] = [];
        const cy = -4.7, distance = 8.4 * Math.cos(Math.PI / 8);
        const probe = (label: string, origin: number[], direction: number[], part: string, depth: number) => surfaceChecks.push(firstSurface(bank, `HSBC ${label}`, origin, direction,
          part === 'dome' ? 'root/147/6/5' : `${revision}/root/147/6/${part}`, depth));
        // Exact 14 first-hit probes from refine_hsbc_drum.verify(). Dormer rays
        // sit above the legitimate stone handrail, not inside its lower pane.
        for (let side = 0; side < 8; side++) {
          const angle = side * Math.PI / 4, c = Math.cos(angle), s = Math.sin(angle);
          probe(`upper drum ${side}`, [.34 * c - (distance + 1.4) * s, .34 * s + (distance + 1.4) * c + cy, 35.58], [s, -c, 0], side % 2 === 0 ? 'glass' : 'stone', side % 2 === 0 ? 1.97 : 1.4);
        }
        for (let side = 0; side < 4; side++) {
          const angle = side * Math.PI / 2, c = Math.cos(angle), s = Math.sin(angle);
          probe(`dormer ${side}`, [.23 * c - 10 * s, .23 * s + 10 * c + cy, 38.72], [s, -c, 0], 'glass', 1.87);
        }
        probe('lower portico', [.40, cy + 10 * Math.cos(Math.PI / 8) + 1.4, 31.2], [0, -1, 0], 'glass', 2.22);
        probe('smooth dome', [0, cy + 10, 40.5], [0, -1, 0], 'dome', 10 - 8.3 * Math.sqrt(1 - ((40.5 - 37.9) / 5.312) ** 2));
        authoredHsbcDrum = {revision, surfaceRays: surfaceChecks.length, surfaceChecks, retainedDomeId: 'root/147/6/5', runtimeLightingVerified: false, estimatedDimensions: true};
      }
      results.push({key, source: city.root.userData.spaceSource, meshes, shaderMaterials, buildingAttributes, clocks: clocks.length, traffic: internal.traffic.root.userData.cars, boats: internal.boats.count, authoredJinMao, authoredLandmarks, authoredEntrances, authoredGalleries, authoredWindows, authoredHeroDetails, authoredFrontages, authoredPeaceRiverfront, authoredCustomsRoof, authoredPeaceCrown, authoredCustomsJunctions, authoredHsbcDrum});
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
