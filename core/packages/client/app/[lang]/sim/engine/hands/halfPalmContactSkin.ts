import * as THREE from 'three';
import { createPalmKernels, loadPalmModule } from '@/wasm/half-palm/accelerator';
import type { FingerName, HandModel } from './handModel';
import { createPoseNormalUpdater } from './handModelMano';
import { IndexSkinFold } from './indexSkinFold';
import { HalfPalmContactTurn } from './halfPalmContactTurn';

type SkinEdge = { a: number; b: number; rest: number; gripRest?: number; share: number };

const strokeFingers = ['index', 'middle', 'ring'] as const;
type StrokeFinger = typeof strokeFingers[number];
export type SkinStroke = Record<StrokeFinger, number> & { middleSlice?: boolean };
const surfaceRegion = { arch: 1, index: 2, middle: 4, ring: 8, middleSlice: 16 } as const;
const edgeLimits = {
  web: { min: .65, max: 1.5, passes: 4, strength: 1, useGrip: false },
  press: { min: .85, max: 1.16, passes: 24, strength: 1.25, useGrip: true },
  grip: { min: .56, max: 1.36, passes: 4, strength: 1, useGrip: true },
};

type KnuckleRing = {
  center: number; neighbors: number[]; blend: number; weight: number;
  restOffset: THREE.Vector3; posedOffset: THREE.Vector3; restEdges: THREE.Vector3[];
};

/** Local contact corrective layered over MANO. A palm adjustment must not
 * propagate learned proximal pose deformations into a stationary fingertip.
 * Preserve its material surface and fade the correction across the proximal
 * skin using the existing skin weights. No bone lengths or weights are edited. */
export class HalfPalmContactSkin {
  readonly turn = new HalfPalmContactTurn();
  private readonly mesh?: THREE.SkinnedMesh;
  private readonly vertices: { index: number; weight: number; finger: FingerName; distal: boolean; target: THREE.Vector3 }[] = [];
  private readonly position?: THREE.BufferAttribute;
  private readonly normal?: THREE.BufferAttribute;
  private readonly savedPosition?: Float32Array;
  private readonly savedNormal?: Float32Array;
  private readonly sourceShape?: Float32Array;
  private readonly updateNormals?: () => void;
  private readonly posedPosition?: THREE.BufferAttribute;
  private readonly posedNormal?: THREE.BufferAttribute;
  private readonly meshInverse = new THREE.Matrix4();
  private readonly tipInverse: Record<FingerName, THREE.Matrix4> = {
    thumb: new THREE.Matrix4(), index: new THREE.Matrix4(), middle: new THREE.Matrix4(),
    ring: new THREE.Matrix4(), pinky: new THREE.Matrix4(),
  };

  private readonly influenceBones: Uint16Array;
  private readonly influenceWeights: Float32Array;
  private readonly boneMatrices: THREE.Matrix4[] = [];

  private readonly current = new THREE.Vector3();
  private readonly skinPosition = new THREE.Vector3();
  private readonly realBones: THREE.Quaternion[] = [];
  private readonly dualBones: THREE.Quaternion[] = [];
  private readonly scaleBones: THREE.Vector3[] = [];
  private kernels?: ReturnType<typeof createPalmKernels>;
  private readonly webEdges: SkinEdge[] = [];
  private readonly palmEdges: SkinEdge[] = [];
  private readonly palmStrips: SkinEdge[] = [];
  private readonly archEdges: SkinEdge[] = [];
  private readonly archPatch = { positions: [] as number[], weights: [] as number[], knuckleClearance: [] as number[], normals: [] as number[] };
  private readonly heelSpans: SkinEdge[] = [];
  private readonly palmRays: {
    bone: number; axis: THREE.Vector3; base: THREE.Vector3; length: number;
    skin: { index: number; projection: number; weight: number }[];
  }[] = [];
  private readonly knuckleEdges: Record<StrokeFinger, SkinEdge[]> = { index: [], middle: [], ring: [] };
  private readonly knuckleRings: Record<StrokeFinger, KnuckleRing[]> = { index: [], middle: [], ring: [] };
  private readonly gripEdges: Record<StrokeFinger, SkinEdge[]> = { index: [], middle: [], ring: [] };
  private readonly sliceFaces: number[][] = [];
  private readonly adjacentFaces: number[][] = [];
  private sliceTravel?: Float32Array;
  private sliceOriginal?: Float32Array;
  private adjacentBounds?: Float32Array;
  private readonly sliceEdges: SkinEdge[] = [];
  private readonly slicePatch = { positions: [] as number[], normals: [] as number[] };
  private readonly indexFold?: IndexSkinFold;
  private readonly indexRollWeights: number[] = [];
  private readonly rollRotation = new THREE.Quaternion();
  private readonly rollAxis = new THREE.Vector3();
  private readonly knucklePatch = {
    index: { positions: [] as number[], normals: [] as number[] },
    middle: { positions: [] as number[], normals: [] as number[] },
    ring: { positions: [] as number[], normals: [] as number[] },
  };
  private readonly webSeams: { copy: number; source: number }[] = [];
  private volumeWeight = 0;
  private webWeight = 0;
  private upWeight = 0;
  private restored = true;
  private active = false;

  constructor(private readonly model: HandModel) {
    const mesh = model.meshes.find(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh | undefined;
    const vertexCount = mesh?.geometry.getAttribute('position').count ?? 0;
    this.influenceBones = new Uint16Array(vertexCount * 4);
    this.influenceWeights = new Float32Array(vertexCount * 4);
    if (!mesh) return;
    this.mesh = mesh;
    this.position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.normal = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    this.savedPosition = new Float32Array(this.position.array.length);
    this.savedNormal = new Float32Array(this.normal.array.length);
    this.sourceShape = new Float32Array(this.position.array.length);

    // Weld the same UV seams as the source, but calculate normals on the
    // final posed surface. Bind-space normals alone are wrong after an inverse
    // skin correction and can make smooth fingers look like angular slabs.
    const posed = new THREE.BufferGeometry();
    this.posedPosition = this.position.clone();
    this.posedNormal = this.normal.clone();
    posed.setAttribute('position', this.posedPosition);
    posed.setAttribute('normal', this.posedNormal);
    posed.setIndex(mesh.geometry.index);
    this.updateNormals = createPoseNormalUpdater(posed);
    const held = new Map<THREE.Object3D, FingerName>();
    for (const [name, finger] of Object.entries(model.fingers))
      finger.tip.traverse(bone => held.set(bone, name as FingerName));
    const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
    for (const _bone of mesh.skeleton.bones) {
      this.boneMatrices.push(new THREE.Matrix4());
      this.realBones.push(new THREE.Quaternion());
      this.dualBones.push(new THREE.Quaternion());
      this.scaleBones.push(new THREE.Vector3());
    }
    // UV seams and neighbouring vertices often have the same influences.
    // Build each packed 3×4 transform once per set of weights and bones.
    const blendKeys = new Map<string, number>();
    const blendVertices: number[] = [], blendOffsets: number[] = [];
    const rigidSkin: boolean[] = [], volumeWeights: number[] = [], webWeights: number[] = [];
    const heldWeights = new Float32Array(this.position.count);
    const indexIntermediate = new Float32Array(this.position.count);
    const knuckles = { index: new Float32Array(this.position.count), middle: new Float32Array(this.position.count), ring: new Float32Array(this.position.count) };
    for (let index = 0; index < this.position.count; index++) {
      const key = [0, 1, 2, 3].map(k => indices.getComponent(index, k) + '/' + weights.getComponent(index, k)).join(',');
      let blend = blendKeys.get(key);
      if (blend === undefined) {
        blend = blendVertices.length;
        blendKeys.set(key, blend);
        blendVertices.push(index);
      }
      blendOffsets.push(blend * 12);
      let weight = 0;
      let forearm = 0, proximal = 0;
      let finger: FingerName | undefined, strongest = -1, dominant = 0;
      for (let k = 0; k < 4; k++) {
        const bone = mesh.skeleton.bones[indices.getComponent(index, k)], w = weights.getComponent(index, k);
        this.influenceBones[index * 4 + k] = indices.getComponent(index, k);
        this.influenceWeights[index * 4 + k] = w;
        if (w > weights.getComponent(index, dominant)) dominant = k;
        if (held.has(bone) && w > strongest) { strongest = w; finger = held.get(bone); }
        if (held.has(bone)) weight += w;
        if (bone.name === 'index-finger-phalanx-proximal') knuckles.index[index] += w;
        if (bone.name === 'index-finger-phalanx-intermediate') indexIntermediate[index] += w;
        if (bone.name === 'middle-finger-phalanx-proximal') knuckles.middle[index] += w;
        if (bone.name === 'ring-finger-phalanx-proximal') knuckles.ring[index] += w;
        if (bone === model.forearm?.bone) forearm += w;
        if (/metacarpal|phalanx-proximal|phalanx-intermediate/.test(bone.name)) proximal += w;
      }
      heldWeights[index] = Math.min(1, weight * 4);
      rigidSkin.push(weights.getComponent(index, dominant) === 1);
      volumeWeights.push(1 - forearm);
      webWeights.push(Math.min(1, proximal * 2) * Math.max(0, 1 - weight * 4));

      if (weight <= 0) continue;
      // With four skin influences a dominant distal weight is at least 1/4.
      // Hold only that contact region; leave intermediate/proximal flesh free.
      const t = Math.min(1, weight * 4);
      this.vertices.push({ index, weight: t * t * (3 - 2 * t), finger: finger!,
        distal: held.has(mesh.skeleton.bones[indices.getComponent(index, dominant)]), target: new THREE.Vector3() });
    }
    // Build adjacency on welded positions so UV islands do not open cracks.
    const canonical = new Map<string, number>(), welded: number[] = [];
    for (let i = 0; i < this.position.count; i++) {
      const key = `${this.position.getX(i)},${this.position.getY(i)},${this.position.getZ(i)}`;
      if (!canonical.has(key)) canonical.set(key, i);
      welded.push(canonical.get(key)!);
    }
    const edges = Array.from({length: this.position.count}, () => new Set<number>());
    const faces = mesh.geometry.index!;
    for (let i = 0; i < faces.count; i += 3) {
      const a = welded[faces.getX(i)], b = welded[faces.getX(i+1)], c = welded[faces.getX(i+2)];
      edges[a].add(b).add(c); edges[b].add(a).add(c); edges[c].add(a).add(b);
    }
    const handFrame = this.model.group.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    const centers = { index: new THREE.Vector3(), middle: new THREE.Vector3(), ring: new THREE.Vector3() };
    const lengths = { index: 0, middle: 0, ring: 0 };
    for (const name of strokeFingers) {
      const finger = this.model.fingers[name];
      this.model.group.worldToLocal(finger.root.getWorldPosition(centers[name]));
      lengths[name] = centers[name].distanceTo(this.model.group.worldToLocal(finger.mid.getWorldPosition(this.current)));
    }
    // Keep the material length of the webs within a soft band. The contact
    // mask pins each pad and prevents a knuckle correction from moving it.
    for (const i of canonical.values()) {
      for (const j of edges[i]) {
        const mobility = webWeights[i] + webWeights[j];
        if (i >= j || !mobility) continue;
        const rest = this.current.fromBufferAttribute(this.position, i)
          .distanceTo(this.skinPosition.fromBufferAttribute(this.position, j));
        for (const name of strokeFingers) {
          const a = knuckles[name][i] * webWeights[i], b = knuckles[name][j] * webWeights[j];
          if (a + b <= 0) continue;
          const edge = { a: i * 3, b: j * 3, rest, share: a / (a + b) };
          this.knuckleEdges[name].push(edge);
          const midpoint = this.current.fromBufferAttribute(this.position, i)
            .lerp(this.skinPosition.fromBufferAttribute(this.position, j), .5).applyMatrix4(handFrame);
          if (midpoint.distanceTo(centers[name]) < lengths[name] * .75) this.gripEdges[name].push(edge);
        }
        this.webEdges.push({ a: i * 3, b: j * 3, rest, share: webWeights[i] / mobility });
      }
    }
    welded.forEach((source, copy) => {
      if (source !== copy) this.webSeams.push({ copy: copy * 3, source: source * 3 });
    });
    for (const name of strokeFingers) {
      // A material edge can keep its length and still fold back through its
      // neighbour. Retain the rest surface offset from each welded one-ring.
      for (const i of canonical.values()) {
        const weight = THREE.MathUtils.smoothstep(knuckles[name][i], .005, .18) * webWeights[i];
        if (!weight || !edges[i].size) continue;
        const neighbors = Array.from(edges[i], j => 3 * j);
        const center = new THREE.Vector3().fromBufferAttribute(this.position, i);
        // Each endpoint contributes half of its rotated edge to the target
        // differential. Preserve the orientation of the dorsal arc and folds.
        const restEdges = neighbors.map(j => center.clone()
          .sub(this.current.fromBufferAttribute(this.position!, j / 3)).multiplyScalar(.5 / neighbors.length));
        const restOffset = new THREE.Vector3();
        for (const edge of restEdges) restOffset.add(edge);
        this.knuckleRings[name].push({ center: i * 3, neighbors, blend: blendOffsets[i],
          weight, restEdges, restOffset, posedOffset: new THREE.Vector3() });
      }
      const normalVertices = new Set<number>();
      welded.forEach((source, i) => {
        if (!knuckles[name][source] || !webWeights[source]) return;
        this.knucklePatch[name].positions.push(i * 3);
        if (name === 'index') this.indexRollWeights.push(knuckles.index[source] * webWeights[source]);
        normalVertices.add(source);
        for (const neighbor of edges[source]) normalVertices.add(neighbor);
      });
      welded.forEach((source, i) => { if (normalVertices.has(source)) this.knucklePatch[name].normals.push(i * 3); });
    }
    this.indexFold = new IndexSkinFold(faces, welded, knuckles.index, indexIntermediate,
      new Map(this.knuckleRings.index.map(ring => [ring.center, ring.weight])));
    // Longitudinal material limits measured in the original mesh. Include
    // wrist-weighted palm flesh but pin the wrist seam and all distal pads.
    const inverseBind = mesh.bindMatrix.clone().invert();
    const bindCenter = (index: number) => new THREE.Vector3().setFromMatrixPosition(
      mesh.skeleton.boneInverses[index].clone().invert(),
    ).applyMatrix4(inverseBind);
    const wristIndex = mesh.skeleton.bones.findIndex(b => b.name === 'wrist');
    const middleIndex = mesh.skeleton.bones.findIndex(b => b.name === 'middle-finger-phalanx-proximal');
    if (wristIndex >= 0 && middleIndex >= 0) {
      const wrist = bindCenter(wristIndex);
      const axis = bindCenter(middleIndex).sub(wrist);
      const palmLength = axis.length();
      axis.normalize();
      const points = welded.map((_, i) => new THREE.Vector3().fromBufferAttribute(this.position!, i));
      for (const { bone, end } of model.palmSupports ?? []) {
        const boneIndex = mesh.skeleton.bones.indexOf(bone);
        const base = bindCenter(boneIndex);
        const axis = end.clone().normalize(), length = end.length();
        const skin = [];
        for (const i of canonical.values()) {
          for (let k = 0; k < 4; k++) {
            if (indices.getComponent(i, k) !== boneIndex || !weights.getComponent(i, k)) continue;
            const projection = this.current.subVectors(points[i], base).dot(axis);
            skin.push({ index: 3 * i, projection, weight: weights.getComponent(i, k) });
          }
        }
        this.palmRays.push({ bone: boneIndex, axis, base, length, skin });
      }
      // Pin the boundary of each weighted strip. Material on neighbouring
      // rays can share load; material beyond the palm stays in its authored pose.
      const freedom = new Map<number, number>();
      for (const ray of this.palmRays) for (const v of ray.skin) freedom.set(v.index / 3, Math.min(1, 8 * v.weight));
      // Fade into adjacent mesh rings so the edge of a weighted strip
      // cannot accumulate all of the extension at a single skin edge.
      for (let ring = 0; ring < 3; ring++) {
        for (const [i, w] of [...freedom]) for (const j of edges[i]) {
          if (heldWeights[j] > 0 || Math.abs(this.current.subVectors(points[j], wrist).dot(axis)) < .09 * palmLength) continue;
          freedom.set(j, Math.max(freedom.get(j) ?? 0, .58 * w));
        }
      }
      // Only wrist- and ray-dominated palm flesh is mobile. The finger
      // roots, thumb pad and forearm retain their own calibrated skin shape.
      const supportIndices = new Set([wristIndex, ...this.palmRays.map(ray => ray.bone)]);
      for (const [i, mobility] of freedom) {
        let palmWeight = 0;
        for (let k = 0; k < 4; k++) {
          if (supportIndices.has(indices.getComponent(i, k))) palmWeight += weights.getComponent(i, k);
        }
        const weight = mobility * THREE.MathUtils.smoothstep(palmWeight, .51, .81);
        if (weight > .001) freedom.set(i, weight);
        else freedom.delete(i);
      }
      const normalHalo = new Set<number>();
      for (const [i, wi] of freedom) {
        normalHalo.add(i);
        for (const j of edges[i]) {
          normalHalo.add(j);
          const wj = freedom.get(j) ?? 0;
          if (wj && j < i) continue;
          if (Math.abs(this.current.subVectors(points[j], points[i]).dot(axis)) < .52 * this.current.length()) continue;
          this.archEdges.push({ a: i * 3, b: j * 3, rest: points[i].distanceTo(points[j]), share: wi / (wi + wj) });
        }
      }
      welded.forEach((source, i) => {
        const weight = freedom.get(source);
        if (weight !== undefined) {
          this.archPatch.positions.push(3 * i);
          this.archPatch.weights.push(weight);
          // F and upper U already solve local knuckle strain. Fade the
          // longitudinal adjustment out before their proximal skin patch.
          this.archPatch.knuckleClearance.push(1 - THREE.MathUtils.smoothstep(
            Math.max(knuckles.index[source], knuckles.middle[source]), .015, .07));
        }
        if (normalHalo.has(source)) this.archPatch.normals.push(3 * i);
      });
      const along = points.map(p => this.current.subVectors(p, wrist).dot(axis) / palmLength);
      const mobility = along.map((t, i) => THREE.MathUtils.smoothstep(t, .05, .25)
        * (1 - THREE.MathUtils.smoothstep(t, .88, 1.2)) * (1 - heldWeights[i]));
      const heels = [.03, .12, .21].map(t => [...canonical.values()].filter(i => along[i] >= t && along[i] < t + .09));
      for (const i of canonical.values()) {
        if (!mobility[i]) continue;
        for (const heel of heels) {
          if (along[i] <= .45 || !heel.length) continue;
          // Match along the palm, keeping each material strip on its own side.
          let nearest = heel[0], best = Infinity;
          for (const j of heel) {
            const transverse = this.current.subVectors(points[i], points[j]);
            transverse.addScaledVector(axis, -transverse.dot(axis));
            if (transverse.lengthSq() < best) { nearest = j; best = transverse.lengthSq(); }
          }
          this.heelSpans.push({ a: i * 3, b: nearest * 3, rest: points[i].distanceTo(points[nearest]), share: mobility[i] });
        }
        // Longer links carry wrist-to-knuckle tension across several rings
        // in one pass, following the surface on the same side of the palm.
        let node = i;
        for (let step = 1; step <= 7; step++) {
          let next = node, best = .25;
          for (const j of edges[node]) {
            const axial = (along[node] - along[j]) * palmLength;
            const alignment = axial / points[node].distanceTo(points[j]);
            if (alignment > best && along[j] >= 0) { next = j; best = alignment; }
          }
          if (next === node) break;
          node = next;
          if (step === 3 || step === 7) this.palmStrips.push({
            a: i * 3, b: node * 3, rest: points[i].distanceTo(points[node]),
            share: mobility[i] / (mobility[i] + mobility[node]),
          });
        }
        for (const j of edges[i]) {
          if (mobility[j] && j < i) continue;
          const rest = points[i].distanceTo(points[j]);
          if (Math.abs(along[i] - along[j]) * palmLength < rest * .45) continue;
          this.palmEdges.push({ a: i * 3, b: j * 3, rest, share: mobility[i] / (mobility[i] + mobility[j]) });
        }
      }
    }
    const vertices = new Uint8Array(vertexCount);
    for (const offset of this.archPatch.positions) vertices[offset / 3] |= surfaceRegion.arch;
    for (const finger of strokeFingers) {
      for (const offset of this.knucklePatch[finger].positions) vertices[offset / 3] |= surfaceRegion[finger];
    }
    model.surfacePatch = { vertices, active: 0 };
    const offsets = [0], coords: number[] = [], weightsForPass: number[] = [], means: number[] = [];
    const neighbors: number[] = [];
    for (let vertex = 0; vertex < this.position.count; vertex++) {
      const adjacent = edges[welded[vertex]];
      if (!webWeights[vertex] || !adjacent.size) continue;
      coords.push(vertex * 3);
      weightsForPass.push(webWeights[vertex]);
      means.push(1 / adjacent.size);
      for (const neighbor of adjacent) neighbors.push(3 * neighbor);
      offsets.push(neighbors.length);
    }
    const matrixLength = blendVertices.length * 12;
    const buffers = {
      linear: new Float64Array(matrixLength),
      inverse: new Float64Array(matrixLength),
      volume: new Float64Array(matrixLength),
      bone: new Float64Array(mesh.skeleton.bones.length * 12),
      joints: new Float64Array(mesh.skeleton.bones.length * 11),
      blendVertices: Uint32Array.from(blendVertices), bones: this.influenceBones,
      influences: this.influenceWeights, rigid: Uint8Array.from(rigidSkin, Number),
      coords: Uint32Array.from(coords), weights: Float64Array.from(weightsForPass),
      means: Float64Array.from(means), offsets: Uint32Array.from(offsets),
      neighbors: Uint32Array.from(neighbors),
      scratch: new Float32Array(this.position.array.length),
      posed: this.posedPosition.array as Float32Array,
      posedNormals: this.posedNormal.array as Float32Array,
      positions: this.position.array as Float32Array,
      normals: this.normal.array as Float32Array,
      sourceShape: this.sourceShape,
      blendOffsets: Uint32Array.from(blendOffsets),
      volumeWeights: Float64Array.from(volumeWeights),
    };
    this.kernels = createPalmKernels(buffers);
    void loadPalmModule().then(module => {
      if (!module) return;
      const accelerated = createPalmKernels(buffers, module);
      this.kernels = accelerated;
      // The normal updater reads this same attribute on every invocation.
      this.posedPosition!.array = accelerated.buffers.posed;
      this.posedNormal!.array = accelerated.buffers.posedNormals;
    }).catch(() => { /* Retain the JavaScript kernels if the browser cannot initialize WebAssembly. */ });
  }

  /** The fingers already flex in their resting grip. Use the length of the
   * actual skinned web there as the starting material shape for F strokes. */
  captureGripKnuckles(middleSlice = false): void {
    if (!this.mesh || !this.position) return;
    this.model.group.updateMatrixWorld(true);
    const points = new Map<number, THREE.Vector3>();
    const point = (offset: number) => {
      let p = points.get(offset);
      if (!p) {
        const vertex = offset / 3;
        p = new THREE.Vector3().fromBufferAttribute(this.position!, vertex);
        this.mesh!.applyBoneTransform(vertex, p);
        points.set(offset, p);
      }
      return p;
    };
    if (middleSlice) this.captureSliceWeb(point);
    this.indexFold?.capture(point);
    for (const edges of Object.values(this.knuckleEdges)) for (const edge of edges) {
      edge.gripRest = point(edge.a).distanceTo(point(edge.b));
    }
  }

  /** The ring and pinky share skin with the palm outside the proximal bone's
   * influence mask. Capture the material lengths in the actual starting grip. */
  private captureSliceWeb(point: (offset: number) => THREE.Vector3): void {
    const mesh = this.mesh!, geometry = mesh.geometry;
    const count = this.position!.count, canonical = Uint32Array.from({ length: count }, (_, i) => i);
    for (const { copy, source } of this.webSeams) canonical[copy / 3] = source / 3;
    const root = mesh.worldToLocal(this.model.fingers.ring.root.getWorldPosition(new THREE.Vector3()));
    const radius = root.distanceTo(mesh.worldToLocal(this.model.fingers.ring.mid.getWorldPosition(new THREE.Vector3())));
    const mobility = new Float32Array(count), normals = new Set<number>();
    const owner = new Array<string>(count);
    const indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
    for (let i = 0; i < count; i++) {
      if (canonical[i] !== i) continue;
      let dominant = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, dominant)) dominant = k;
      const bone = mesh.skeleton.bones[indices.getComponent(i, dominant)].name;
      owner[i] = bone.split('-')[0];
      if ((owner[i] !== 'ring' && owner[i] !== 'wrist') || /distal|tip/.test(bone)) continue;
      const distance = point(i * 3).distanceTo(root) / radius;
      mobility[i] = 1 - THREE.MathUtils.smoothstep(distance, .57, .9);
    }
    const seen = new Set<number>(), faces = geometry.index!;
    for (let j = 0; j < faces.count; j += 3) for (let k = 0; k < 3; k++) {
      const a = canonical[faces.getX(j + k)], b = canonical[faces.getX(j + (k + 1) % 3)];
      const sum = mobility[a] + mobility[b], key = Math.min(a, b) * count + Math.max(a, b);
      if (!sum || seen.has(key) || a === b) continue;
      seen.add(key);
      const rest = point(a * 3).distanceTo(point(b * 3));
      this.sliceEdges.push({ a: a * 3, b: b * 3, rest, share: mobility[a] / sum });
      normals.add(a); normals.add(b);
    }
    for (let j = 0; j < faces.count; j += 3) {
      const face = [0, 1, 2].map(k => canonical[faces.getX(j + k)]);
      if (face.every(i => owner[i] === 'ring') && face.some(i => mobility[i])) this.sliceFaces.push(face.map(i => i * 3));
      if (face.every(i => owner[i] === 'middle') || face.every(i => owner[i] === 'pinky')) this.adjacentFaces.push(face.map(i => i * 3));
    }
    this.sliceTravel = new Float32Array(count);
    this.sliceOriginal = new Float32Array(count * 3);
    this.adjacentBounds = new Float32Array(this.adjacentFaces.length * 6);
    for (let i = 0; i < count; i++) {
      if (mobility[canonical[i]]) {
        this.slicePatch.positions.push(i * 3);
        this.model.surfacePatch!.vertices[i] |= surfaceRegion.middleSlice;
      }
      if (normals.has(canonical[i])) this.slicePatch.normals.push(i * 3);
    }
  }

  /** Bound the web correction by the space the articulated ring already has.
   * Overlapping triangle bounds pin that triangle to its original surface. */
  private measureSliceTravel(): void {
    const original = this.sliceOriginal!, travel = this.sliceTravel!, bounds = this.adjacentBounds!;
    travel.fill(Infinity);
    for (let i = 0; i < this.adjacentFaces.length; i++) {
      const [a, b, c] = this.adjacentFaces[i];
      for (let k = 0; k < 3; k++) {
        bounds[6 * i + k] = Math.min(original[a + k], original[b + k], original[c + k]);
        bounds[6 * i + k + 3] = Math.max(original[a + k], original[b + k], original[c + k]);
      }
    }
    for (const [a, b, c] of this.sliceFaces) {
      const loX = Math.min(original[a], original[b], original[c]), hiX = Math.max(original[a], original[b], original[c]);
      const loY = Math.min(original[a + 1], original[b + 1], original[c + 1]), hiY = Math.max(original[a + 1], original[b + 1], original[c + 1]);
      const loZ = Math.min(original[a + 2], original[b + 2], original[c + 2]), hiZ = Math.max(original[a + 2], original[b + 2], original[c + 2]);
      let limit = Infinity;
      for (let j = 0; j < bounds.length && limit > 0; j += 6) {
        const dx = Math.max(bounds[j] - hiX, loX - bounds[j + 3], 0), dy = Math.max(bounds[j + 1] - hiY, loY - bounds[j + 4], 0);
        const dz = Math.max(bounds[j + 2] - hiZ, loZ - bounds[j + 5], 0);
        limit = Math.min(limit, dx * dx + dy * dy + dz * dz);
      }
      travel[a / 3] = Math.min(travel[a / 3], limit);
      travel[b / 3] = Math.min(travel[b / 3], limit);
      travel[c / 3] = Math.min(travel[c / 3], limit);
    }
  }

  private limitSliceTravel(positions: Float32Array): void {
    const original = this.sliceOriginal!, travel = this.sliceTravel!;
    for (const i of this.slicePatch.positions) {
      const dx = positions[i] - original[i], dy = positions[i + 1] - original[i + 1], dz = positions[i + 2] - original[i + 2];
      const length = dx * dx + dy * dy + dz * dz, limit = travel[i / 3];
      if (length <= limit) continue;
      const t = .9 * Math.sqrt(limit / length);
      positions[i] = original[i] + t * dx;
      positions[i + 1] = original[i + 1] + t * dy;
      positions[i + 2] = original[i + 2] + t * dz;
    }
  }

  /** Restore before evaluating any new pose, including a return to home. This
   * keeps MANO's coefficient cache independent of this render-only layer. */
  restore(): void {
    this.active = false;
    if (this.model.surfacePatch) this.model.surfacePatch.active = 0;
    if (this.restored || !this.position || !this.normal) return;
    this.position.array.set(this.savedPosition!);
    this.normal.array.set(this.savedNormal!);
    this.position.needsUpdate = this.normal.needsUpdate = true;
    this.restored = true;
  }

  capture(weight = 1, turnAngle = 0, upward = 1): void {
    if (!this.mesh || !this.position) return;
    this.model.poseCorrective?.(true);
    this.sourceShape!.set(this.position.array);
    this.model.group.updateWorldMatrix(true, false);
    this.model.group.updateMatrixWorld(true);
    this.turn.begin(this.model.group.parent);
    if (turnAngle) {
      for (const name of Object.keys(this.tipInverse) as FingerName[])
        this.tipInverse[name].copy(this.model.fingers[name].tip.matrixWorld).invert();
    }
    const mesh = this.mesh, indices = this.influenceBones, weights = this.influenceWeights;
    const transforms = this.kernels!.buffers.bone;
    for (let i = 0; i < this.boneMatrices.length; i++) {
      const matrix = this.boneMatrices[i].multiplyMatrices(mesh.skeleton.bones[i].matrixWorld, mesh.skeleton.boneInverses[i]);
      packAffine(matrix.multiply(mesh.bindMatrix), transforms, i * 12);
    }
    const toWorld = this.meshInverse.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
    const source = this.sourceShape!;
    for (const vertex of this.vertices) {
      const v = vertex.index * 3, influence = vertex.index * 4;
      const x = source[v], y = source[v+1], z = source[v+2];
      let tx = 0, ty = 0, tz = 0;
      for (let k = 0; k < 4; k++) {
        const w = weights[influence+k];
        if (!w) continue;
        const m = indices[influence+k] * 12;
        tx += w * (transforms[m]*x + transforms[m+1]*y + transforms[m+2]*z + transforms[m+3]);
        ty += w * (transforms[m+4]*x + transforms[m+5]*y + transforms[m+6]*z + transforms[m+7]);
        tz += w * (transforms[m+8]*x + transforms[m+9]*y + transforms[m+10]*z + transforms[m+11]);
      }
      vertex.target.set(tx, ty, tz).applyMatrix4(toWorld);
      if (turnAngle && vertex.distal && this.current.copy(vertex.target).applyMatrix4(this.tipInverse[vertex.finger]).z >= 0)
        this.turn.consider(vertex.finger, vertex.target);
    }
    this.turn.finish(turnAngle, this.model.side === -1 ? 1 : -1);
    if (turnAngle) for (const vertex of this.vertices) this.turn.transform(vertex.finger, vertex.target);
    this.active = true;
    this.volumeWeight = weight;
    this.upWeight = weight * upward;
    this.webWeight = .06 * weight + .94 * this.upWeight;
  }

  apply(frontIndex = 0, frontMiddle = 0, frontBlend?: number, indexRoll = 0, gripStretchWeight = 0, stroke?: Readonly<SkinStroke>, foldRegion?: 'pip' | 'proximal'): void {
    // Engage gradually as the long fingers cup; a neutral grip needs no pass.
    let arch = 0;
    for (const name of ['index', 'middle', 'ring', 'pinky'] as const) {
      const q = this.model.fingers[name].meta?.quaternion;
      if (q) arch = Math.max(arch, 1 - q.w * q.w);
    }
    arch = this.archEdges.length ? THREE.MathUtils.smoothstep(arch, .0001, .008) : 0;
    const hasStroke = stroke && (stroke.index || stroke.middle || stroke.ring);
    if ((!this.active && !hasStroke && frontIndex === 0 && frontMiddle === 0 && !arch) || !this.mesh || !this.position || !this.normal) return;
    const mesh = this.mesh;
    this.model.group.updateMatrixWorld(true);
    this.savedPosition!.set(this.position.array);
    this.savedNormal!.set(this.normal.array);
    // Linear blend skinning shrinks and creases a web when the palm and
    // proximal bones rotate apart. Blend rigid transforms as dual quaternions
    // for this corrective pose, then encode the result back through LBS.
    for (let i = 0; i < mesh.skeleton.bones.length; i++) {
      const bone = this.boneMatrices[i].multiplyMatrices(mesh.skeleton.bones[i].matrixWorld, mesh.skeleton.boneInverses[i]);
      bone.multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse);
      bone.decompose(this.skinPosition, this.realBones[i], this.scaleBones[i]);
      this.dualBones[i].set(this.skinPosition.x, this.skinPosition.y, this.skinPosition.z, 0)
        .multiply(this.realBones[i]);
    }
    this.updateBlends();
    const { kernels } = this;
    const buffers = kernels!.buffers;
    buffers.positions.set(this.position.array);
    buffers.sourceShape.set(this.active ? this.sourceShape! : this.position.array);
    // Retain the source gesture's flesh shape before projecting into the
    // current pose. Synthetic metacarpal joints are outside MANO's pose basis.
    kernels!.project(this.active ? this.volumeWeight : 0);
    const posedPositions = buffers.posed;
    // Stay in posed space through contact correction and smoothing. Encoding
    // and immediately skinning every intermediate result costs extra inverses.
    if (this.active) {
      this.meshInverse.copy(mesh.matrixWorld).invert();
      const segmentScale = this.model.group.matrixWorld.getMaxScaleOnAxis() * .15;
      const toWorld = mesh.matrixWorld.elements, toLocal = this.meshInverse.elements;
      for (const vertex of this.vertices) {
        const i = vertex.index * 3, x = posedPositions[i], y = posedPositions[i+1], z = posedPositions[i+2];
        const target = vertex.target;
        const dx = target.x - (toWorld[0]*x + toWorld[4]*y + toWorld[8]*z + toWorld[12]);
        const dy = target.y - (toWorld[1]*x + toWorld[5]*y + toWorld[9]*z + toWorld[13]);
        const dz = target.z - (toWorld[2]*x + toWorld[6]*y + toWorld[10]*z + toWorld[14]);
        const limit = this.model.fingers[vertex.finger].segLens[2] * segmentScale;
        const lengthSq = dx*dx + dy*dy + dz*dz;
        const w = lengthSq*vertex.weight*vertex.weight > limit*limit ? limit/Math.sqrt(lengthSq) : vertex.weight;
        // Clamp in world units, then transport only the displacement back.
        posedPositions[i] = x + w*(toLocal[0]*dx + toLocal[4]*dy + toLocal[8]*dz);
        posedPositions[i+1] = y + w*(toLocal[1]*dx + toLocal[5]*dy + toLocal[9]*dz);
        posedPositions[i+2] = z + w*(toLocal[2]*dx + toLocal[6]*dy + toLocal[10]*dz);
      }
      // Local non-shrinking relaxation removes the narrow web creases left by
      // inverse contact skinning. Distal contacts and the wrist stay pinned.
      kernels!.smooth(this.volumeWeight);
      this.relaxEdges(posedPositions, this.webEdges, this.webWeight);
      this.limitPalmLength(posedPositions);
    } else {
      // Only the proximal skin can move. The distal pad and nail follow the
      // calibrated bone frame while the knuckle retains its material lengths.
      const frontPress = frontBlend !== undefined;
      if (indexRoll && frontIndex) this.rollIndexSkin(posedPositions, indexRoll * frontIndex);
      if (frontPress && frontBlend < 1) buffers.scratch.set(posedPositions);
      if (frontIndex) this.relaxEdges(posedPositions, this.knuckleEdges.index, frontIndex, frontPress ? 'press' : 'web');
      if (frontMiddle) this.relaxEdges(posedPositions, this.knuckleEdges.middle, frontMiddle, frontPress ? 'press' : 'web');
      if (frontPress && frontBlend < 1) {
        for (let k = 0; k < posedPositions.length; k++)
          posedPositions[k] = THREE.MathUtils.lerp(buffers.scratch[k], posedPositions[k], frontBlend);
      }
      if (frontPress) {
        // Blending two folded surfaces can shorten a web edge even when both
        // endpoints of the transition are clear. Recheck local material strain.
        if (frontIndex) this.relaxEdges(posedPositions, this.knuckleEdges.index, frontIndex);
        if (frontMiddle) this.relaxEdges(posedPositions, this.knuckleEdges.middle, frontMiddle);
      }
    }
    if (arch && !this.active) {
      this.model.surfacePatch!.active |= surfaceRegion.arch;
      buffers.scratch.set(posedPositions);
      for (let i = 0; i < 5; i++) this.limitStretch(posedPositions, this.archEdges, 1.08, arch * .7);
      for (let v = 0; v < this.archPatch.positions.length; v++) {
        const i = this.archPatch.positions[v];
        const w = this.archPatch.weights[v] * (frontBlend !== undefined ? this.archPatch.knuckleClearance[v] : 1);
        for (let k = i; k < i + 3; k++) posedPositions[k] = THREE.MathUtils.lerp(buffers.scratch[k], posedPositions[k], w);
      }
    }
    if (gripStretchWeight) {
      for (let pass = 0; pass < 8; pass++)
        this.limitStretch(posedPositions, this.knuckleEdges.index, 1.22, gripStretchWeight, false, true);
    }
    if (hasStroke) for (const finger of strokeFingers) {
      if (!stroke[finger]) continue;
      this.model.surfacePatch!.active |= surfaceRegion[finger];
      this.restoreKnuckleCurvature(posedPositions, finger, stroke[finger], frontBlend !== undefined || gripStretchWeight > 0);
    }
    if (foldRegion && stroke?.index) this.indexFold?.apply(posedPositions, stroke.index, foldRegion);
    const sliceWeight = stroke?.middleSlice ? stroke.ring : 0;
    if (sliceWeight && this.sliceOriginal) {
      this.sliceOriginal.set(posedPositions);
      this.model.surfacePatch!.active |= surfaceRegion.middleSlice;
      this.measureSliceTravel();
      this.relaxEdges(posedPositions, this.sliceEdges, sliceWeight, 'press', true);
    }
    this.closeWebSeams(posedPositions);
    this.updateNormals!();
    kernels!.encode();
    if (this.active) {
      this.position.array.set(buffers.positions);
      this.normal.array.set(buffers.normals);
    } else {
      if (arch) {
        for (const i of this.archPatch.positions)
          for (let k = i; k < i + 3; k++) this.position.array[k] = buffers.positions[k];
        for (const i of this.archPatch.normals) for (let k = i; k < i + 3; k++)
          this.normal.array[k] = THREE.MathUtils.lerp(this.savedNormal![k], buffers.normals[k], arch);
      }
      if (sliceWeight) {
        for (const i of this.slicePatch.positions) for (let k = i; k < i + 3; k++) this.position.array[k] = buffers.positions[k];
        for (const i of this.slicePatch.normals) for (let k = i; k < i + 3; k++)
          this.normal.array[k] = THREE.MathUtils.lerp(this.savedNormal![k], buffers.normals[k], sliceWeight);
      }
      // Keep the original skin outside the active knuckle, including the
      // normals on all supporting fingers. Only normals need a one-ring halo.
      for (const name of strokeFingers) {
        const press = name === 'index' ? frontIndex : name === 'middle' ? frontMiddle : 0;
        const weight = Math.max(press, stroke?.[name] ?? 0);
        if (!weight) continue;
        const patch = this.knucklePatch[name];
        for (const i of patch.positions) for (let k = i; k < i + 3; k++) this.position.array[k] = buffers.positions[k];
        for (const i of patch.normals) for (let k = i; k < i + 3; k++) {
          this.normal.array[k] = THREE.MathUtils.lerp(this.savedNormal![k], buffers.normals[k], weight);
        }
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
    this.restored = false;
  }

  // Use the existing proximal skin weights for the roll left over at the PIP
  // hinge limit. Work around the actual MCP–PIP shaft in posed mesh space.
  private rollIndexSkin(positions: Float32Array, angle: number): void {
    const finger = this.model.fingers.index;
    this.meshInverse.copy(this.mesh!.matrixWorld).invert();
    const root = this.skinPosition.setFromMatrixPosition(finger.root.matrixWorld).applyMatrix4(this.meshInverse);
    this.rollAxis.setFromMatrixPosition(finger.mid.matrixWorld).applyMatrix4(this.meshInverse).sub(root).normalize();
    this.rollRotation.setFromAxisAngle(this.rollAxis, angle);
    const patch = this.knucklePatch.index.positions;
    for (let j = 0; j < patch.length; j++) {
      const i = patch[j];
      const p = this.current.fromArray(positions, i).sub(root).applyQuaternion(this.rollRotation).add(root);
      const weight = this.indexRollWeights[j];
      positions[i] += (p.x - positions[i]) * weight;
      positions[i + 1] += (p.y - positions[i + 1]) * weight;
      positions[i + 2] += (p.z - positions[i + 2]) * weight;
    }
  }

  private limitPalmLength(positions: Float32Array): void {
    // On the palm-up side, tether the raised arch to its heel. The flatter
    // palm-down side distributes tension across shorter material strips.
    const up = .65 * this.upWeight, down = .30 * (this.volumeWeight - this.upWeight);
    // Restrain excess longitudinal slide against the posed rigid ray. Keep
    // transverse cupping and the height of the dorsal and palmar surfaces.
    for (const ray of this.palmRays) {
      const transform = this.boneMatrices[ray.bone];
      const base = this.skinPosition.copy(ray.base).applyMatrix4(transform);
      const axis = this.current.copy(ray.axis).transformDirection(transform);
      for (const { index: i, projection, weight } of ray.skin) {
        const along = (positions[i] - base.x) * axis.x + (positions[i+1] - base.y) * axis.y
          + (positions[i+2] - base.z) * axis.z;
        const slip = along - projection, allowance = ray.length * .045;
        const correction = (slip - THREE.MathUtils.clamp(slip, -allowance, allowance))
          * Math.min(1, 6 * weight) * this.volumeWeight;
        positions[i] -= correction * axis.x;
        positions[i+1] -= correction * axis.y;
        positions[i+2] -= correction * axis.z;
      }
    }
    for (let pass = 0; pass < (up ? 12 : 5); pass++) {
      if (up) this.limitStretch(positions, this.heelSpans, 1.04, up, true);
      const stripWeight = pass < 6 ? down : 0;
      if (pass < 3) this.limitStretch(positions, this.palmStrips, 1.045, stripWeight + .16 * up);
      this.limitStretch(positions, this.palmEdges, 1.08, up + stripWeight);
    }
  }

  private limitStretch(positions: Float32Array, edges: SkinEdge[], ratio: number, weight: number, fixedHeel = false, fromGrip = false): void {
    for (const { a, b, rest, gripRest, share } of edges) {
      const dx = positions[b] - positions[a], dy = positions[b+1] - positions[a+1], dz = positions[b+2] - positions[a+2];
      const lengthSq = dx*dx + dy*dy + dz*dz, maxLength = ratio * (fromGrip ? gripRest ?? rest : rest);
      if (lengthSq <= maxLength * maxLength) continue;
      const excess = weight * (1 - maxLength / Math.sqrt(lengthSq));
      const left = excess * share, right = fixedHeel ? 0 : excess * (1 - share);
      positions[a] += left * dx; positions[a+1] += left * dy; positions[a+2] += left * dz;
      positions[b] -= right * dx; positions[b+1] -= right * dy; positions[b+2] -= right * dz;
    }
  }

  private relaxEdges(positions: Float32Array, edges: SkinEdge[], weight: number, mode: keyof typeof edgeLimits = 'web', limitSlice = false): void {
    // A fixed palm transfers the F stroke through the MCP. Converge the
    // local material lengths more tightly while the pad and nail stay pinned.
    const { min, max, passes, strength, useGrip } = edgeLimits[mode];
    for (let pass = 0; pass < passes; pass++) {
      for (const edge of edges) {
        const { a, b, share } = edge;
        const rest = useGrip ? edge.gripRest ?? edge.rest : edge.rest;
        const dx = positions[b] - positions[a], dy = positions[b+1] - positions[a+1], dz = positions[b+2] - positions[a+2];
        const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (length < 1e-10) continue;
        const target = THREE.MathUtils.clamp(length, min * rest, max * rest);
        const correction = (1 - target / length) * strength * weight;
        if (!correction) continue;
        const left = correction * share, right = correction * (1 - share);
        positions[a] += left * dx; positions[a+1] += left * dy; positions[a+2] += left * dz;
        positions[b] -= right * dx; positions[b+1] -= right * dy; positions[b+2] -= right * dz;
      }
      if (limitSlice) this.limitSliceTravel(positions);
    }
  }

  private restoreKnuckleCurvature(positions: Float32Array, finger: StrokeFinger, weight: number, limitGrip: boolean): void {
    const rings = this.knuckleRings[finger];
    const { linear, volume, rigid, blendOffsets } = this.kernels!.buffers;
    for (const ring of rings) {
      ring.posedOffset.set(0, 0, 0);
      addRotatedEdge(ring.posedOffset, ring.restOffset, rigid[ring.center / 3] ? linear : volume, ring.blend);
      for (let k = 0; k < ring.neighbors.length; k++) {
        const vertex = ring.neighbors[k] / 3;
        addRotatedEdge(ring.posedOffset, ring.restEdges[k], rigid[vertex] ? linear : volume, blendOffsets[vertex]);
      }
    }
    // Transport the local curvature with the bone rotation. The pad, nail
    // and adjacent fingers provide fixed boundary positions for this patch.
    const passes = limitGrip ? 32 : 64;
    for (let pass = 0; pass < passes; pass++) {
      for (const { center, neighbors, posedOffset, weight: mobility } of rings) {
        let x = 0, y = 0, z = 0;
        for (const j of neighbors) { x += positions[j]; y += positions[j+1]; z += positions[j+2]; }
        const w = .8 * weight * mobility;
        positions[center] += w * (x / neighbors.length + posedOffset.x - positions[center]);
        positions[center+1] += w * (y / neighbors.length + posedOffset.y - positions[center+1]);
        positions[center+2] += w * (z / neighbors.length + posedOffset.z - positions[center+2]);
      }
    }
    // A fixed-palm press also needs its calibrated material lengths. During
    // a free hook, projecting those lengths last can pinch the moving web.
    if (limitGrip) this.relaxEdges(positions, this.gripEdges[finger], weight, 'grip');
  }

  private closeWebSeams(positions: Float32Array): void {
    for (const { copy, source } of this.webSeams) {
      positions[copy] = positions[source]; positions[copy+1] = positions[source+1]; positions[copy+2] = positions[source+2];
    }
  }

  private updateBlends(): void {
    const kernels = this.kernels!;
    const { joints, bone } = kernels.buffers;
    for (let i = 0; i < this.boneMatrices.length; i++) {
      packAffine(this.boneMatrices[i], bone, i * 12);
      const q = this.realBones[i], d = this.dualBones[i], scale = this.scaleBones[i];
      const o = i * 11;
      joints[o] = q.x; joints[o + 1] = q.y; joints[o + 2] = q.z; joints[o + 3] = q.w;
      joints[o + 4] = d.x; joints[o + 5] = d.y; joints[o + 6] = d.z; joints[o + 7] = d.w;
      joints[o + 8] = scale.x; joints[o + 9] = scale.y; joints[o + 10] = scale.z;
    }
    kernels.blend();
  }
}

// Packed 3x4 skin transform. An edge is a direction, so translation drops out.
function addRotatedEdge(sum: THREE.Vector3, edge: THREE.Vector3, matrix: Float64Array, m: number): void {
  const { x, y, z } = edge;
  sum.x += matrix[m] * x + matrix[m+1] * y + matrix[m+2] * z;
  sum.y += matrix[m+4] * x + matrix[m+5] * y + matrix[m+6] * z;
  sum.z += matrix[m+8] * x + matrix[m+9] * y + matrix[m+10] * z;
}

function packAffine(matrix: THREE.Matrix4, output: Float64Array, offset: number): void {
  const e = matrix.elements;
  for (let row = 0; row < 3; row++) {
    const o = offset + row * 4;
    output[o] = e[row]; output[o+1] = e[row+4]; output[o+2] = e[row+8]; output[o+3] = e[row+12];
  }
}
