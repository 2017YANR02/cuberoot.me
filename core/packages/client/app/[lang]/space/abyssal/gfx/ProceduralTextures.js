// ABYSSAL, MIT, Copyright (c) 2026 Davi (Token-Gremlin). See LICENSE and UPSTREAM.md.
import * as THREE from 'three';
import { FullScreenPass, makeRT } from './FullScreenPass.js';
import { NOISE_GLSL } from './NoiseGLSL.js';

/**
 * Every texture in the demo is baked on the GPU at start-up.
 * Nothing is loaded from disk or the network.
 */

// Perlin-Worley cloud base shape, baked to a horizontal atlas then uploaded as 3D.
const CLOUD_SHAPE_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uRes;
uniform float uTilesX;
in vec2 vUv;
layout(location = 0) out vec4 oCol;
void main(){
  vec2 px = floor(vUv * vec2(uRes * uTilesX, uRes * uRes / uTilesX));
  float tileX = floor(px.x / uRes);
  float tileY = floor(px.y / uRes);
  float z = tileX + tileY * uTilesX;
  vec3 uvw = vec3((mod(px.x, uRes) + 0.5) / uRes, (mod(px.y, uRes) + 0.5) / uRes, (z + 0.5) / uRes);

  // Five octaves from 4 tops out at frequency 64, which is Nyquist for a 128^3
  // volume. Seven ran to 256: the last two octaves alias into per-texel grit,
  // and once the coverage threshold slices that field the grit becomes
  // single-voxel blobs — a sky of little cubes no erosion pass can smooth.
  float freq = 4.0;
  float perlin = clamp(perlinFbm3(uvw * freq, freq, 5) * 0.5 + 0.5, 0.0, 1.0);

  // billowy worley octaves (inverted so high == dense)
  float w0 = 1.0 - worleyFbm3(uvw, 4.0);
  float w1 = 1.0 - worleyFbm3(uvw, 8.0);
  float w2 = 1.0 - worleyFbm3(uvw, 14.0);
  float w3 = 1.0 - worleyFbm3(uvw, 22.0);

  // Schneider's perlin-worley: dilate the perlin field by the low worley so the
  // result keeps perlin's connectedness with worley's cauliflower edges.
  float perlinWorley = w0 + perlin * (1.0 - w0);

  oCol = vec4(clamp(perlinWorley, 0.0, 1.0), w1, w2, w3);
}
`;

const CLOUD_DETAIL_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uRes;
uniform float uTilesX;
in vec2 vUv;
layout(location = 0) out vec4 oCol;
void main(){
  vec2 px = floor(vUv * vec2(uRes * uTilesX, uRes * uRes / uTilesX));
  float tileX = floor(px.x / uRes);
  float tileY = floor(px.y / uRes);
  float z = tileX + tileY * uTilesX;
  vec3 uvw = vec3((mod(px.x, uRes) + 0.5) / uRes, (mod(px.y, uRes) + 0.5) / uRes, (z + 0.5) / uRes);
  float w0 = 1.0 - worleyFbm3(uvw, 3.0);
  float w1 = 1.0 - worleyFbm3(uvw, 6.0);
  float w2 = 1.0 - worleyFbm3(uvw, 11.0);
  oCol = vec4(w0, w1, w2, (w0 + w1 + w2) / 3.0);
}
`;

/**
 * Cloud weather map. Deciding where cloud goes from a couple of taps into the
 * 3D shape volume looks fine in isolation but stamps the volume's texel grid
 * across the sky the moment you threshold it, because a 128³ trilinear field
 * is only C0 continuous. Baking the decision into a dedicated high-resolution
 * 2D field costs one fetch instead of two and has no grid to show.
 *
 *   r  synoptic coverage — the scale of whole weather systems
 *   g  cell modulation — which parts of a system are actively building
 *   b  cloud type — flat stratus through to a towering cumulonimbus
 *   a  convective cores, used to place the anvils
 */
const WEATHER_FRAG = /* glsl */ `
${NOISE_GLSL}
in vec2 vUv;
layout(location = 0) out vec4 oCol;

void main(){
  vec2 p = vUv;

  // Synoptic scale: broad fronts and clear lanes. Ridged noise gives the long
  // filamentary bands a satellite image actually shows, rather than the
  // isotropic blobs a plain fbm produces. The ridge is smoothed because a bare
  // absolute value has a crease along its zero set, and a crease in coverage
  // becomes a dead-straight edge to the cloud deck kilometres long.
  float f1 = fbm2Tiled(p, 4.0, 5);
  float f2 = fbm2Tiled(p + vec2(3.7, 1.3), 6.0, 5);
  float r = f2 * 2.0 - 1.0;
  float band = 1.0 - sqrt(r * r + 0.035);
  float synoptic = clamp(f1 * 0.62 + band * 0.55 - 0.10, 0.0, 1.0);

  // Mesoscale cells inside a system, with worley to give them discrete edges.
  float cells = 1.0 - worley2Tiled(p + vec2(0.41, 0.77), 9.0);
  float meso = clamp(fbm2Tiled(p * 1.0 + vec2(9.1, 4.4), 11.0, 4) * 0.7 + cells * 0.5, 0.0, 1.0);

  // Type: the deepest, most persistent parts of a system grow towers.
  float type = clamp(smoothstep(0.42, 0.86, synoptic) * 0.8
                   + fbm2Tiled(p + vec2(6.3, 2.9), 7.0, 3) * 0.5, 0.0, 1.0);

  // Convective cores: sparse, small, and only inside an active region.
  float core = smoothstep(0.55, 0.95, 1.0 - worley2Tiled(p + vec2(2.2, 8.8), 14.0));
  core *= smoothstep(0.35, 0.8, synoptic);

  oCol = vec4(synoptic, meso, type, core);
}
`;

// 2D curl/turbulence field used for cloud edge distortion and spray advection
const CURL_FRAG = /* glsl */ `
${NOISE_GLSL}
in vec2 vUv;
layout(location = 0) out vec4 oCol;
void main(){
  float e = 1.0 / 256.0;
  float n1 = fbm2Tiled(vUv + vec2(0.0, e), 6.0, 4);
  float n2 = fbm2Tiled(vUv - vec2(0.0, e), 6.0, 4);
  float n3 = fbm2Tiled(vUv + vec2(e, 0.0), 6.0, 4);
  float n4 = fbm2Tiled(vUv - vec2(e, 0.0), 6.0, 4);
  vec2 curl = vec2(n1 - n2, n4 - n3) / (2.0 * e);
  curl = normalize(curl + 1e-6) * 0.5 + 0.5;
  oCol = vec4(curl, fbm2Tiled(vUv, 12.0, 5), fbm2Tiled(vUv, 3.0, 4));
}
`;

function bake(renderer, frag, w, h, uniforms = {}, type = THREE.UnsignedByteType) {
  const rt = makeRT(w, h, { type, wrap: THREE.RepeatWrapping, name: 'bake' });
  const pass = new FullScreenPass(frag, uniforms, { name: 'bake' });
  pass.render(renderer, rt);
  pass.dispose();
  return rt;
}

/**
 * Per-channel 2%/98% percentiles. Procedural noise recipes rarely fill [0,1]
 * evenly, and a compressed channel makes every downstream threshold impossible
 * to tune, so the consumer normalises with these instead of magic numbers.
 */
function channelPercentiles(buf, count, p = 0.02) {
  const lo = [], hi = [];
  for (let c = 0; c < 4; c++) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < count; i++) hist[buf[i * 4 + c]]++;
    let acc = 0, l = 0, hgh = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= count * p) { l = i; break; } }
    acc = 0;
    for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= count * p) { hgh = i; break; } }
    if (hgh <= l) hgh = Math.min(255, l + 1);
    lo.push(l / 255); hi.push(hgh / 255);
  }
  return { lo, hi };
}

function atlasTo3D(renderer, rt, res, tilesX, tilesY) {
  const w = res * tilesX, h = res * tilesY;
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  const stats = channelPercentiles(buf, w * h);
  const out = new Uint8Array(res * res * res * 4);
  for (let z = 0; z < res; z++) {
    const tx = z % tilesX, ty = Math.floor(z / tilesX);
    for (let y = 0; y < res; y++) {
      const srcRow = ((ty * res + y) * w + tx * res) * 4;
      const dstRow = ((z * res + y) * res) * 4;
      out.set(buf.subarray(srcRow, srcRow + res * 4), dstRow);
    }
  }
  const tex = new THREE.Data3DTexture(out, res, res, res);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  tex.userData.percentiles = stats;
  return tex;
}

export async function bakeProceduralTextures(renderer, onProgress = () => {}, signal) {
  const out = {};
  try {
  const yieldFrame = () => new Promise(r => setTimeout(r, 0));

  onProgress('baking curl turbulence field');
  await yieldFrame();
  signal?.throwIfAborted();
  const curlRT = bake(renderer, CURL_FRAG, 256, 256);
  curlRT.texture.wrapS = curlRT.texture.wrapT = THREE.RepeatWrapping;
  out.curl = curlRT.texture;
  out._curlRT = curlRT;

  onProgress('baking synoptic weather map');
  await yieldFrame();
  signal?.throwIfAborted();
  const weatherRT = bake(renderer, WEATHER_FRAG, 1024, 1024);
  weatherRT.texture.wrapS = weatherRT.texture.wrapT = THREE.RepeatWrapping;
  weatherRT.texture.minFilter = THREE.LinearMipmapLinearFilter;
  weatherRT.texture.generateMipmaps = true;
  weatherRT.texture.needsUpdate = true;
  out.weather = weatherRT.texture;
  out._weatherRT = weatherRT;

  onProgress('baking volumetric cloud shape (128³)');
  await yieldFrame();
  signal?.throwIfAborted();
  const SHAPE_RES = 128, SHAPE_TX = 16, SHAPE_TY = 8;
  const shapeRT = bake(renderer, CLOUD_SHAPE_FRAG, SHAPE_RES * SHAPE_TX, SHAPE_RES * SHAPE_TY, {
    uRes: { value: SHAPE_RES }, uTilesX: { value: SHAPE_TX },
  });
  out.cloudShape = atlasTo3D(renderer, shapeRT, SHAPE_RES, SHAPE_TX, SHAPE_TY);
  shapeRT.dispose();

  onProgress('baking volumetric cloud detail (32³)');
  await yieldFrame();
  signal?.throwIfAborted();
  const DET_RES = 32, DET_TX = 8, DET_TY = 4;
  const detRT = bake(renderer, CLOUD_DETAIL_FRAG, DET_RES * DET_TX, DET_RES * DET_TY, {
    uRes: { value: DET_RES }, uTilesX: { value: DET_TX },
  });
  out.cloudDetail = atlasTo3D(renderer, detRT, DET_RES, DET_TX, DET_TY);
  detRT.dispose();

  return out;
  } catch (error) { disposeProceduralTextures(out); throw error; }
}

export function disposeProceduralTextures(textures) {
  textures._curlRT?.dispose(); textures._weatherRT?.dispose();
  textures.cloudShape?.dispose(); textures.cloudDetail?.dispose();
}
