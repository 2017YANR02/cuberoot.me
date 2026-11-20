import { blendPalm, smoothPalm, projectPalm, encodePalm } from './math';

type NumericBuffer = Float32Array | Float64Array | Uint8Array | Uint16Array | Uint32Array;

function bufferKind(array: NumericBuffer): number {
  if (array instanceof Uint8Array) return 1;
  if (array instanceof Uint16Array) return 2;
  if (array instanceof Uint32Array) return 3;
  if (array instanceof Float32Array) return 4;
  return 5;
}

interface PalmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  allocate(kind: number, length: number): number;
  dataAddress(array: number): number;
  blendPalm(...arrays: number[]): void;
  smoothPalm(...arraysAndWeight: number[]): void;
  projectPalm(...arraysAndWeight: number[]): void;
  encodePalm(...arrays: number[]): void;
  accumulateNormals(...arrays: number[]): void;
  normalizeWeldedNormals(...arrays: number[]): void;
}

export interface PalmBuffers {
  linear: Float64Array;
  inverse: Float64Array;
  volume: Float64Array;
  bone: Float64Array;
  joints: Float64Array;
  blendVertices: Uint32Array;
  bones: Uint16Array;
  influences: Float32Array;
  rigid: Uint8Array;
  coords: Uint32Array;
  weights: Float64Array;
  means: Float64Array;
  offsets: Uint32Array;
  neighbors: Uint32Array;
  scratch: Float32Array;
  posed: Float32Array;
  posedNormals: Float32Array;
  positions: Float32Array;
  normals: Float32Array;
  sourceShape: Float32Array;
  blendOffsets: Uint32Array;
  volumeWeights: Float64Array;
}

function bindBuffers<Buffers extends { [Key in keyof Buffers]: NumericBuffer }>(
  buffers: Buffers, module: WebAssembly.Module,
) {
  const exports = new WebAssembly.Instance(module, {
    env: { abort: () => { throw new Error('Invalid half-palm kernel buffer'); } },
  }).exports as PalmExports;
  const keys = Object.keys(buffers) as (keyof Buffers & string)[];
  const arrays = keys.map(key => {
    const original = buffers[key];
    return exports.allocate(bufferKind(original), original.length);
  });
  // Allocate all arrays before creating views. A later allocation could
  // grow linear memory and invalidate earlier views.
  const pointers = new Map(keys.map((key, i) => [key, arrays[i]]));
  const data = keys.map(key => {
    const original = buffers[key];
    const prototype = original.constructor as new (buffer: ArrayBuffer, offset: number, length: number) => NumericBuffer;
    const view = new prototype(exports.memory.buffer, exports.dataAddress(pointers.get(key)!), original.length);
    view.set(original);
    return [key, view];
  });
  return { exports, pointers, views: Object.fromEntries(data) as Buffers };
}

export function createPalmKernels(buffers: PalmBuffers, module?: WebAssembly.Module) {
  let b = buffers;
  if (module) {
    const { exports, pointers, views } = bindBuffers(buffers, module);
    b = views;
    const blendArgs = (['linear', 'inverse', 'volume', 'bone', 'joints', 'blendVertices', 'bones', 'influences', 'rigid'] as const)
      .map(key => pointers.get(key)!);
    const smoothArgs = (['posed', 'scratch', 'coords', 'weights', 'means', 'offsets', 'neighbors'] as const)
      .map(key => pointers.get(key)!);
    const projectArgs = (['positions', 'sourceShape', 'posed', 'linear', 'volume', 'blendOffsets', 'volumeWeights', 'rigid'] as const)
      .map(key => pointers.get(key)!);
    const encodeArgs = (['posed', 'posedNormals', 'positions', 'normals', 'inverse', 'blendOffsets'] as const)
      .map(key => pointers.get(key)!);
    return {
      buffers: b,
      project: (weight: number) => exports.projectPalm(...projectArgs, weight),
      encode: () => exports.encodePalm(...encodeArgs),
      blend: () => exports.blendPalm(...blendArgs),
      smooth: (weight: number) => exports.smoothPalm(...smoothArgs, weight),
    };
  }
  return {
    buffers: b,
    project: (weight: number) => projectPalm(b.positions, b.sourceShape, b.posed, b.linear, b.volume,
      b.blendOffsets, b.volumeWeights, b.rigid, weight),
    encode: () => encodePalm(b.posed, b.posedNormals, b.positions, b.normals, b.inverse, b.blendOffsets),
    blend: () => blendPalm(b.linear, b.inverse, b.volume, b.bone, b.joints, b.blendVertices, b.bones, b.influences, b.rigid),
    smooth: (weight: number) => smoothPalm(b.posed, b.scratch, b.coords, b.weights, b.means, b.offsets, b.neighbors, weight),
  };
}

export function createNormalKernel(
  positionCount: number,
  topology: {
    sum: Float32Array; welded: Uint32Array;
    corners: Uint32Array; groups: Uint32Array; vertices: Uint32Array;
    changedCorners: Uint32Array; changedGroups: Uint32Array; changedVertices: Uint32Array;
  },
  module: WebAssembly.Module,
) {
  const { exports, pointers, views } = bindBuffers({
    ...topology,
    positions: new Float32Array(positionCount * 3),
    normals: new Float32Array(positionCount * 3),
  }, module);
  const ptr = (key: keyof typeof views) => pointers.get(key)!;
  const positions = ptr('positions'), normals = ptr('normals'), sum = ptr('sum'), welded = ptr('welded');
  const all = [ptr('corners'), ptr('groups'), ptr('vertices')];
  const changed = [ptr('changedCorners'), ptr('changedGroups'), ptr('changedVertices')];
  return (source: Float32Array, target: Float32Array, initialized: boolean) => {
    views.positions.set(source);
    // Keep the last normal for zero-area vertices, including on the first
    // frame after switching from the JavaScript path.
    views.normals.set(target);
    const [corners, groups, vertices] = initialized ? changed : all;
    exports.accumulateNormals(positions, corners, welded, sum);
    exports.normalizeWeldedNormals(sum, groups, vertices, welded, normals);
    target.set(views.normals);
  };
}

let modulePromise: Promise<WebAssembly.Module | undefined> | undefined;

export function loadPalmModule(): Promise<WebAssembly.Module | undefined> {
  return modulePromise ??= (async () => {
    if (typeof WebAssembly === 'undefined' || typeof window === 'undefined') return;
    const response = await fetch(new URL('./math.wasm', import.meta.url));
    if (response.ok) return WebAssembly.compile(await response.arrayBuffer());
  })().catch(() => undefined);
}
