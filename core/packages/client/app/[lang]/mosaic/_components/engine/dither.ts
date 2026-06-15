import type { RGB } from '../state/types';

function colorDist(a: RGB, b: RGB) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function approximate(color: RGB, palette: RGB[]): RGB {
  let best = palette[0];
  let bestD = colorDist(color, palette[0]);
  for (let i = 1; i < palette.length; i++) {
    const d = colorDist(color, palette[i]);
    if (d < bestD) { bestD = d; best = palette[i]; }
  }
  return best;
}

/** Gradient: grayscale tone → palette[i] where i is the first range border exceeding tone. */
export function applyGradient(src: ImageData, palette: RGB[], ranges: number[]): ImageData {
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const tone = (d[i] + d[i + 1] + d[i + 2]) / 3;
    let c: RGB = palette[palette.length - 1];
    for (let j = 0; j < ranges.length; j++) {
      if (tone < ranges[j]) { c = palette[j]; break; }
    }
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return out;
}

/** Closest color (no lightness weight). */
export function applyClosest(src: ImageData, palette: RGB[]): ImageData {
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const c = approximate([d[i], d[i + 1], d[i + 2]], palette);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return out;
}

/** Bayer 4x4 ordered dither. `ratio` scales the matrix perturbation. */
export function applyOrdered(src: ImageData, palette: RGB[], ratio: number): ImageData {
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = out.data;
  const w = src.width, h = src.height;
  const m = [
    [ 1,  9,  3, 11],
    [13,  5, 15,  7],
    [ 4, 12,  2, 10],
    [16,  8, 14,  6],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (x + y * w) * 4;
      const m4 = m[x & 3][y & 3] * ratio;
      // Uint8Clamped: reads auto-clamp, writes too — accumulate via local vars.
      const r = Math.max(0, Math.min(255, d[i] + m4));
      const g = Math.max(0, Math.min(255, d[i + 1] + m4));
      const b = Math.max(0, Math.min(255, d[i + 2] + m4));
      const c = approximate([r, g, b], palette);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  return out;
}

/** Floyd-Steinberg-ish error diffusion (source has quirky index arithmetic; preserve behaviour). */
export function applyErrorDiffusion(src: ImageData, palette: RGB[], ratioDenom: number): ImageData {
  const w = src.width, h = src.height;
  // Working buffer as floats to preserve diffusion precision.
  const work = new Float32Array(src.data.length);
  for (let i = 0; i < src.data.length; i++) work[i] = src.data[i];

  const outData = new Uint8ClampedArray(src.data.length);
  const ratioDenomScaled = 1.5 + (ratioDenom / 5) * (15 - 1.5);
  const ratio = 1 / (ratioDenomScaled * 4);

  const idx = (x: number, y: number) => (x + y * w) * 4;
  const inBounds = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const oldR = work[i], oldG = work[i + 1], oldB = work[i + 2];
      const approx = approximate([oldR, oldG, oldB], palette);
      const qr = oldR - approx[0];
      const qg = oldG - approx[1];
      const qb = oldB - approx[2];

      // Diffuse (7/16, 3/16, 5/16, 1/16) in non-standard cell order — matches source.
      const diffuse = (nx: number, ny: number, w7: number) => {
        if (!inBounds(nx, ny)) return;
        const ni = idx(nx, ny);
        work[ni] += w7 * ratio * qr;
        work[ni + 1] += w7 * ratio * qg;
        work[ni + 2] += w7 * ratio * qb;
      };
      diffuse(x + 1, y, 7);
      diffuse(x - 1, y + 1, 3);
      diffuse(x, y + 1, 5);
      diffuse(x + 1, y + 1, 1);

      outData[i] = approx[0];
      outData[i + 1] = approx[1];
      outData[i + 2] = approx[2];
      outData[i + 3] = 255;
    }
  }
  return new ImageData(outData, w, h);
}
