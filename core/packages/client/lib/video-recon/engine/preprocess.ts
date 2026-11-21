/** OpenCV-style 8-bit RGB resize kernels, independent of browser canvas scaling. */
const f32 = Math.fround;
export function roundEven(value: number): number {
  const floor = Math.floor(value);
  return value - floor === 0.5
    ? floor % 2 === 0
      ? floor
      : floor + 1
    : Math.round(value);
}

interface AreaAxis {
  offsets: Uint32Array;
  indices: Uint32Array;
  weights: Float32Array;
}
// A bounded cache covers stable tracked ROIs without retaining every crop size
// seen during a long camera session. Plans contain only coefficients, not pixels.
const areaPlans = new Map<string, AreaAxis>();
const linearPlans = new Map<string, ReturnType<typeof buildLinearAxis>>();
function cached<T>(cache: Map<string, T>, key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const plan = build();
  if (cache.size === 32) cache.delete(cache.keys().next().value!);
  cache.set(key, plan);
  return plan;
}
export function areaAxis(source: number, target: number): AreaAxis {
  return cached(areaPlans, `${source}/${target}`, () => {
    const scale = source / target;
    const offsets = new Uint32Array(target + 1);
    const indices: number[] = [],
      weights: number[] = [];
    for (let i = 0; i < target; i++) {
      offsets[i] = indices.length;
      const start = i * scale,
        end = (i + 1) * scale;
      for (let p = Math.floor(start); p < Math.ceil(end); p++) {
        const weight = (Math.min(end, p + 1) - Math.max(start, p)) / scale;
        if (weight > 1e-9) {
          indices.push(Math.min(source - 1, Math.max(0, p)));
          weights.push(f32(weight));
        }
      }
    }
    offsets[target] = indices.length;
    return {
      offsets,
      indices: new Uint32Array(indices),
      weights: new Float32Array(weights),
    };
  });
}
// Calls are synchronous and scratch never escapes. Returned image buffers remain
// independently owned, including when a later call uses a different crop size.
let horizontalScratch = new Float32Array(0);
let rowScratch = new Float32Array(0);
export function resizeArea(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): Uint8ClampedArray {
  if (width === targetWidth && height === targetHeight) return rgba;
  const xs = areaAxis(width, targetWidth),
    ys = areaAxis(height, targetHeight);
  const rowLength = targetWidth * 3;
  const needed = height * rowLength;
  if (horizontalScratch.length < needed)
    horizontalScratch = new Float32Array(needed);
  if (rowScratch.length < rowLength) rowScratch = new Float32Array(rowLength);
  const horizontal = horizontalScratch,
    row = rowScratch;
  let dest = 0;
  for (let y = 0; y < height; y++) {
    const sourceRow = y * width * 4;
    for (let x = 0; x < targetWidth; x++) {
      let r = 0,
        g = 0,
        b = 0;
      const end = xs.offsets[x + 1];
      for (let tap = xs.offsets[x]; tap < end; tap++) {
        const at = sourceRow + xs.indices[tap] * 4,
          weight = xs.weights[tap];
        r = f32(r + f32(rgba[at] * weight));
        g = f32(g + f32(rgba[at + 1] * weight));
        b = f32(b + f32(rgba[at + 2] * weight));
      }
      horizontal[dest++] = r;
      horizontal[dest++] = g;
      horizontal[dest++] = b;
    }
  }
  const output = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const fast2 = width === targetWidth * 2 && height === targetHeight * 2;
  dest = 0;
  for (let y = 0; y < targetHeight; y++) {
    row.fill(0, 0, rowLength);
    const end = ys.offsets[y + 1];
    // Visit contiguous RGB rows instead of gathering each pixel's channels.
    // Keep the original float32 accumulation order for every channel.
    for (let tap = ys.offsets[y]; tap < end; tap++) {
      const sourceRow = ys.indices[tap] * rowLength,
        weight = ys.weights[tap];
      for (let i = 0; i < rowLength; i++)
        row[i] = f32(row[i] + f32(horizontal[sourceRow + i] * weight));
    }
    for (let i = 0; i < rowLength; i += 3) {
      output[dest++] = fast2 ? Math.floor(row[i] + 0.5) : roundEven(row[i]);
      output[dest++] = fast2
        ? Math.floor(row[i + 1] + 0.5)
        : roundEven(row[i + 1]);
      output[dest++] = fast2
        ? Math.floor(row[i + 2] + 0.5)
        : roundEven(row[i + 2]);
      output[dest++] = 255;
    }
  }
  return output;
}

function buildLinearAxis(source: number, target: number) {
  return Array.from({ length: target }, (_, i) => {
    let at = f32(((i + 0.5) * source) / target - 0.5),
      index = Math.floor(at),
      weight = f32(at - index);
    if (index < 0) {
      index = 0;
      weight = 0;
    }
    if (index >= source - 1) {
      index = source - 1;
      weight = 0;
    }
    return {
      a: index,
      b: Math.min(source - 1, index + 1),
      wa: roundEven(f32((1 - weight) * 2048)),
      wb: roundEven(f32(weight * 2048)),
    };
  });
}
export function linearAxis(source: number, target: number) {
  return cached(linearPlans, `${source}/${target}`, () =>
    buildLinearAxis(source, target),
  );
}
export function resizeLinear(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): Uint8ClampedArray {
  if (width === targetWidth && height === targetHeight) return rgba;
  const xs = linearAxis(width, targetWidth),
    ys = linearAxis(height, targetHeight);
  const output = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  let dest = 0;
  for (let y = 0; y < targetHeight; y++) {
    const yy = ys[y],
      topRow = yy.a * width * 4,
      bottomRow = yy.b * width * 4;
    for (let x = 0; x < targetWidth; x++) {
      const xx = xs[x],
        left = xx.a * 4,
        right = xx.b * 4;
      const tl = topRow + left,
        tr = topRow + right;
      const bl = bottomRow + left,
        br = bottomRow + right;
      const r0 = rgba[tl] * xx.wa + rgba[tr] * xx.wb;
      const g0 = rgba[tl + 1] * xx.wa + rgba[tr + 1] * xx.wb;
      const b0 = rgba[tl + 2] * xx.wa + rgba[tr + 2] * xx.wb;
      const r1 = rgba[bl] * xx.wa + rgba[br] * xx.wb;
      const g1 = rgba[bl + 1] * xx.wa + rgba[br + 1] * xx.wb;
      const b1 = rgba[bl + 2] * xx.wa + rgba[br + 2] * xx.wb;
      output[dest++] = Math.floor(
        (r0 * yy.wa + r1 * yy.wb + 2097152) / 4194304,
      );
      output[dest++] = Math.floor(
        (g0 * yy.wa + g1 * yy.wb + 2097152) / 4194304,
      );
      output[dest++] = Math.floor(
        (b0 * yy.wa + b1 * yy.wb + 2097152) / 4194304,
      );
      output[dest++] = 255;
    }
  }
  return output;
}

/** Native pose path: ROI --INTER_AREA--> viewSize --INTER_LINEAR--> model size. */
export function posePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  viewSize: number,
  size: number,
) {
  return resizeLinear(
    resizeArea(rgba, width, height, viewSize, viewSize),
    viewSize,
    viewSize,
    size,
    size,
  );
}
export function paddedPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  inputWidth: number,
  inputHeight: number,
  padX: number,
  padY: number,
) {
  if (width === inputWidth && height === inputHeight) return rgba;
  const output = new Uint8ClampedArray(inputWidth * inputHeight * 4);
  for (let i = 0; i < output.length; i += 4) {
    output[i] = output[i + 1] = output[i + 2] = 114;
    output[i + 3] = 255;
  }
  for (let y = 0; y < height; y++)
    output.set(
      rgba.subarray(y * width * 4, (y + 1) * width * 4),
      ((y + padY) * inputWidth + padX) * 4,
    );
  return output;
}
