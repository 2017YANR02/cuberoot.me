import type { ImageEffects } from '../state/types';

/** RGB → HSL. Components 0..1. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return [h / 6, s, l];
}

/** HSL (0..1) → RGB (0..255). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

/** Apply all 7 effects in one pass (hue/sat/vibrance share HSL conversion). */
export function applyEffects(src: ImageData, fx: ImageEffects): ImageData {
  // Short-circuit if all zero
  const anyColor = fx.hue !== 0 || fx.saturation !== 0 || fx.vibrance !== 0;
  const anyBc = fx.brightness !== 0 || fx.contrast !== 0;
  const anyNoise = fx.noise > 0;
  const anySharp = fx.sharpenAmount > 0;

  if (!anyColor && !anyBc && !anyNoise && !anySharp) {
    return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  }

  const w = src.width, h = src.height;
  const data = new Uint8ClampedArray(src.data);

  // brightness/contrast: same formula as glfx brightnessContrast.
  // contrast in [-1,1]: > 0 steepens, < 0 flattens.
  const bAdd = fx.brightness * 255;
  let cSlope = 1;
  let cIntercept = 0;
  if (anyBc && fx.contrast !== 0) {
    if (fx.contrast > 0) cSlope = 1 / (1 - fx.contrast);
    else cSlope = 1 + fx.contrast;
    cIntercept = (1 - cSlope) * 127.5;
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    if (anyBc) {
      r = r * cSlope + cIntercept + bAdd;
      g = g * cSlope + cIntercept + bAdd;
      b = b * cSlope + cIntercept + bAdd;
    }

    if (anyColor) {
      let [hh, ss, ll] = rgbToHsl(
        Math.max(0, Math.min(255, r)),
        Math.max(0, Math.min(255, g)),
        Math.max(0, Math.min(255, b)),
      );
      if (fx.hue !== 0) { hh = (hh + fx.hue + 1) % 1; }
      if (fx.saturation !== 0) { ss = Math.min(1, ss + fx.saturation); }
      if (fx.vibrance !== 0) {
        // vibrance boosts low-sat more than high-sat
        const boost = fx.vibrance * (1 - ss);
        ss = Math.max(0, Math.min(1, ss + boost));
      }
      const rgb = hslToRgb(hh, ss, ll);
      r = rgb[0]; g = rgb[1]; b = rgb[2];
    }

    if (anyNoise) {
      const n = (Math.random() - 0.5) * fx.noise * 255;
      r += n; g += n; b += n;
    }

    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }

  if (!anySharp) return new ImageData(data, w, h);

  // Unsharp mask: blur(3x3 box blur, twice) → subtract from original × amount.
  const amount = fx.sharpenAmount;
  const blurred = new Uint8ClampedArray(data);
  const tmp = new Uint8ClampedArray(data.length);
  const boxBlur = (input: Uint8ClampedArray, output: Uint8ClampedArray) => {
    // horizontal
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rr = 0, gg = 0, bb = 0, cnt = 0;
        for (let dx = -1; dx <= 1; dx++) {
          const sx = x + dx;
          if (sx < 0 || sx >= w) continue;
          const si = (sx + y * w) * 4;
          rr += input[si]; gg += input[si + 1]; bb += input[si + 2]; cnt++;
        }
        const di = (x + y * w) * 4;
        output[di] = rr / cnt; output[di + 1] = gg / cnt; output[di + 2] = bb / cnt; output[di + 3] = 255;
      }
    }
    // vertical
    const hOut = new Uint8ClampedArray(output);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rr = 0, gg = 0, bb = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const sy = y + dy;
          if (sy < 0 || sy >= h) continue;
          const si = (x + sy * w) * 4;
          rr += hOut[si]; gg += hOut[si + 1]; bb += hOut[si + 2]; cnt++;
        }
        const di = (x + y * w) * 4;
        output[di] = rr / cnt; output[di + 1] = gg / cnt; output[di + 2] = bb / cnt; output[di + 3] = 255;
      }
    }
  };
  boxBlur(blurred, tmp);
  boxBlur(tmp, blurred);

  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i] + (data[i] - blurred[i]) * amount;
    out[i + 1] = data[i + 1] + (data[i + 1] - blurred[i + 1]) * amount;
    out[i + 2] = data[i + 2] + (data[i + 2] - blurred[i + 2]) * amount;
    out[i + 3] = 255;
  }
  return new ImageData(out, w, h);
}
