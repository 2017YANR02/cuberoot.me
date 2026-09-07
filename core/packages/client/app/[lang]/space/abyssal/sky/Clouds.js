// ABYSSAL, MIT, Copyright (c) 2026 Davi (Token-Gremlin). See LICENSE and UPSTREAM.md.
import * as THREE from 'three';
import { FullScreenPass, makeRT } from '../gfx/FullScreenPass.js';
import { ATMO_COMMON } from './AtmosphereGLSL.js';
import { SHADING_GLSL } from '../gfx/ShadingGLSL.js';
import { NOISE_GLSL } from '../gfx/NoiseGLSL.js';

/**
 * Raymarched volumetric cloud layer.
 *
 * The layer is a spherical shell around the planet so it curves down to the
 * horizon instead of ending in a flat plate. Density comes from the baked
 * Perlin-Worley 3D volume, eroded by a smaller worley volume; lighting uses a
 * short march toward the sun with a Beer-Powder term, dual-lobe HG phase and a
 * three-octave multiple-scattering approximation.
 *
 * Screen rays use half resolution; a separate probe serves planar mirrors.
 */

const CLOUD_COMMON = /* glsl */ `
uniform sampler3D uCloudShape;
uniform sampler3D uCloudDetail;
uniform sampler2D uCurlTex;
uniform sampler2D uWeatherMap;
uniform float uWeatherScaleM;   // metres per weather-map repeat
uniform vec4 uShapeLo;
uniform vec4 uShapeHi;
uniform vec4 uDetailLo;
uniform vec4 uDetailHi;

uniform float uCoverage;
uniform float uCloudDensity;
uniform float uCloudBottom;
uniform float uCloudTop;
uniform float uAnvil;
uniform float uStorm;
uniform vec2  uCloudWind;
uniform float uCloudTime;
uniform float uCloudScaleM;    // metres per shape-texture repeat
uniform float uCloudAspect;    // vertical squash: how many cells fit in the deck
uniform float uCloudContrast;  // how hard the weather map breaks the deck up
uniform float uSunIntensity;
uniform vec3  uSunDir;
uniform float uAmbientFlash;

// Skylight reaching the deck, in the same units as everything else in the
// frame. Written once per fragment from the sky LUT rather than carried as a
// uniform, because an ad-hoc ambient constant is impossible to keep in step
// with the sun's intensity and leaves storm cloud undersides pure black.
vec3 gAmbTop = vec3(0.0);
vec3 gAmbBottom = vec3(0.0);
uniform vec3  uLightningColor;
uniform vec4  uLightning0;
uniform vec4  uLightning1;

const float PLANET_R = 6360000.0;

float remap(float v, float a, float b, float c, float d) {
  return c + (v - a) * (d - c) / max(b - a, 1e-5);
}

// normalise a baked channel onto its measured 2..98 percentile range
vec4 shapeTex(vec3 uvw) {
  return clamp((textureLod(uCloudShape, uvw, 0.0) - uShapeLo) / (uShapeHi - uShapeLo), 0.0, 1.0);
}
vec4 detailTex(vec3 uvw) {
  return clamp((textureLod(uCloudDetail, uvw, 0.0) - uDetailLo) / (uDetailHi - uDetailLo), 0.0, 1.0);
}

/**
 * Vertical density profile. The type parameter runs 0 = flat stratus slab,
 * 0.5 = fair weather cumulus, 1 = full cumulonimbus tower with an anvil.
 */
float heightProfile(float h, float type) {
  // Blend where the profile rises and falls, not two already-evaluated curves.
  // Averaging a low stratus slab against a taller cumulus gives a curve that
  // never reaches 1 — above h=0.38 the old blend capped at 0.6, and since the
  // coverage threshold sits near 0.9 that made cloud *impossible* up there. The
  // deck collapsed into flat-lidded slabs all topping out at one altitude,
  // because the only thing still clearing the threshold was the narrow band
  // where both curves happened to overlap.
  float t = clamp(type * 2.0, 0.0, 1.0);
  float rise = mix(0.05, 0.13, t);       // stratus base is crisper than cumulus
  float fallFrom = mix(0.16, 0.48, t);   // where the shoulders start eroding
  float fallTo = mix(0.38, 0.95, t);     // and where nothing is left
  float lo = smoothstep(0.0, rise, h) * (1.0 - smoothstep(fallFrom, fallTo, h));

  // column that punches the whole deck and flares into an anvil
  float tower = smoothstep(0.0, 0.04, h) * (1.0 - smoothstep(0.88, 1.0, h));
  float anvil = smoothstep(0.58, 0.74, h) * (1.0 - smoothstep(0.90, 1.0, h));
  float cb = max(tower * 0.9, anvil);

  return mix(lo, cb, clamp(type * 2.0 - 1.0, 0.0, 1.0));
}

/**
 * Large-scale organisation. A real sky is never statistically uniform: cells
 * come in clusters and bands tens of kilometres across with clear lanes
 * between them, and that structure is most of what the eye uses to judge
 * whether a cloudscape is real. Returns (coverage, type, base lift).
 */
vec3 weatherAt(vec2 xz) {
  // The map drifts as a whole and the cells inside it drift again, so a system
  // evolves as it crosses the sky instead of sliding past rigidly.
  // Explicit level, always. Screen-space derivatives inside a raymarch loop are
  // meaningless — neighbouring fragments are at different steps, or have exited
  // entirely — and letting the hardware pick a mip from them tears the deck
  // along hard seams wherever the chosen level happens to change.
  vec2 w = xz + uCloudWind * uCloudTime * 0.6;
  vec4 m = textureLod(uWeatherMap, w / uWeatherScaleM, 0.0);
  vec4 n = textureLod(uWeatherMap, w / (uWeatherScaleM * 0.27)
                 + vec2(0.37, 0.11) - uCloudWind * uCloudTime * 0.00002, 0.0);

  float field = m.r * 0.62 + m.g * 0.22 + n.g * 0.16;
  // Contrast pivots about the requested coverage: uCoverage says how much sky
  // is cloud, the field says where. Narrowing that spread near the ends is
  // tempting but wrong — it starves exactly the light-coverage case, where each
  // surviving cell is already only a few shape voxels across and turns to
  // cubes. Instead only the zero itself is gated, because the pivot alone lets
  // an above-average field manufacture cloud out of a request for none, and
  // "clear sky" has to actually clear.
  float cover = clamp((field - 0.5) * uCloudContrast + uCoverage, 0.0, 1.0)
              * smoothstep(0.0, 0.05, uCoverage);
  // Cloud type: 0 is a flat stratus slab, 0.5 a fair-weather cumulus, 1 a
  // cumulonimbus tower. Fair weather is made of cumulus, so the floor sits
  // there and the storm control lifts the deepest cells into towers. Running
  // the whole range off uAnvil meant a clear day was drawn as a field of
  // stratus pancakes — the right density in entirely the wrong shape.
  float type = clamp(0.30 + 0.20 * m.b + uAnvil * (0.34 + 0.55 * m.b + 0.6 * m.a), 0.0, 1.0);
  // How far this column's whole profile rides above or below the nominal deck.
  // Without it the base is a geometric plane at a constant altitude, and once
  // coverage is high enough to close the gaps an observer underneath sees a
  // featureless grey ceiling — which is why an overcast storm can end up
  // reading as flat haze while the same cloud model looks fine at a distance.
  float lift = (n.r * 0.6 + m.g * 0.4 - 0.5) * 0.34;
  return vec3(cover, type, lift);
}

// diagnostics: last raw shape value / post-threshold base, read by the probe
float gShapeR = 0.0;
float gBase = 0.0;
// march internals, written unconditionally and only read when uCloudDebug asks
float gT0 = 0.0, gT1 = 0.0, gIters = 0.0, gSpent = 0.0, gCov = 0.0;

/**
 * @param detail how much erosion to apply, 0..2. Continuous on purpose: a hard
 *   LOD switch changes the density, not just its frequency content, and since
 *   the switch happens at a fixed distance it stamps a sharp arc across the sky
 *   wherever the deck crosses it.
 */
float cloudDensity(vec3 p, float h, float detail) {
  // Higher layers outrun the base: the shear is what tilts a tower downwind
  // and smears its anvil, and it costs nothing.
  vec3 q = p;
  q.xz += uCloudWind * uCloudTime * (0.6 + h * 1.5);

  vec3 wm = weatherAt(q.xz);
  float type = wm.y;
  // Anvils spread aloft, so the top of a mature cell covers far more sky — but
  // only a mature cell does. Keyed on plain cumulus this lays a translucent
  // sheet across the entire top of the deck and the sky hazes over.
  float anvilness = smoothstep(0.62, 1.0, type);
  float cov = mix(wm.x, min(wm.x * 1.8 + 0.24, 1.0), smoothstep(0.55, 0.88, h) * anvilness);
  gCov = max(gCov, cov);
  if (cov <= 0.01) return 0.0;

  // Ride the whole profile up or down with the system. heightProfile is zero
  // outside the unit interval, so this carves a ragged base and top rather than
  // merely fading the slab.
  float hs = h - wm.z;
  if (hs <= 0.0 || hs >= 1.0) return 0.0;

  vec3 uvw = q / uCloudScaleM;
  uvw.y *= uCloudAspect;
  // Scattered cloud slices the top few percent of the shape field, and the
  // maxima of a trilinearly interpolated 128^3 volume are its own voxel corners
  // — so at low coverage the sky came out as a field of axis-aligned bricks. A
  // domain warp finer than that lattice moves the isosurface off it without
  // touching the value distribution, so coverage still means what it says.
  vec3 warp = (detailTex(uvw * 11.0).rgb - 0.5) * 0.011;
  vec4 shape = shapeTex(uvw + warp);

  float fbmLow = shape.g * 0.625 + shape.b * 0.25 + shape.a * 0.125;
  // Schneider's dilation: widen the perlin-worley field by its own fbm so the
  // billows stay connected instead of breaking into popcorn
  float base = remap(shape.r, fbmLow * 0.92 - 1.0, 1.0, 0.0, 1.0);
  base *= heightProfile(hs, type);
  gShapeR = max(gShapeR, shape.r);
  gBase = max(gBase, base);

  // Coverage sweeps a threshold across the base distribution. The dilation
  // above lifts the mean of base well past 0.5, so the sweep still has to start
  // near 1.0 for zero coverage to mean a genuinely empty sky. What it must not
  // do is spend the low end of its travel up in the tail: sliced above ~0.85 a
  // cell is only three or four shape-texture voxels across, and a trilinear
  // blob that small is a rounded box that no amount of erosion can rescue. The
  // gamma keeps both endpoints exact and gets off the tail quickly, so light
  // coverage means a few real cumulus rather than a field of bricks.
  float d = remap(base, mix(0.99, 0.20, pow(cov, 0.67)), 1.0, 0.0, 1.0);
  if (d <= 0.0) return 0.0;

  // A cloud is not a soft blob: liquid water content ramps up fast just inside
  // the boundary. The smoothstep puts that hard edge back, which is most of
  // what separates "convincing cumulus" from "grey smudge".
  d = d * d * (3.0 - 2.0 * d);

  float w1 = clamp(detail, 0.0, 1.0);
  if (w1 > 0.001) {
    // Curl-distorted erosion: wispy tendrils at the base where the updraught
    // shears, cauliflower billows at the top where it punches through.
    vec2 curl = textureLod(uCurlTex, uvw.xz * 3.1, 0.0).rg * 2.0 - 1.0;
    vec3 dp = q / (uCloudScaleM * 0.2);
    dp.xz += curl * (1.0 - h) * 3.5;
    vec3 det = detailTex(dp).rgb;
    float detFbm = det.r * 0.625 + det.g * 0.25 + det.b * 0.125;
    float mod3 = mix(1.0 - detFbm, detFbm, clamp(h * 4.0, 0.0, 1.0));
    // Erosion bites hardest at the silhouette and barely at all in the core,
    // which is what turns a smooth blob into billows. It used to be capped low
    // so the boundary could not flicker between amortisation phases — but the
    // cure for that belongs in the resolve, and paying for it here meant never
    // carving a shape in the first place.
    float bite = mix(0.78, 0.14, smoothstep(0.20, 0.78, d));
    d = mix(d, remap(d, mod3 * bite, 1.0, 0.0, 1.0), w1);
    if (d <= 0.0) return 0.0;

    float w2 = clamp(detail - 1.0, 0.0, 1.0);
    if (w2 > 0.001) {
      // The octave that actually reads as cauliflower: tens of metres across,
      // on the lit shoulders. Warped by the curl again at a different rate so
      // it never sits in register with the octave above it.
      vec3 fp = dp * 3.1;
      fp.xz += curl * 0.9;
      vec3 fine = detailTex(fp).rgb;
      float f = fine.r * 0.62 + fine.g * 0.26 + fine.b * 0.12;
      float fbite = mix(0.46, 0.08, smoothstep(0.25, 0.85, d));
      d = mix(d, remap(d, f * fbite, 1.0, 0.0, 1.0), w2);
      if (d <= 0.0) return 0.0;
    }
  }

  return clamp(d, 0.0, 1.0) * uCloudDensity;
}

/** Intersect a ray with a sphere of radius r centred at the planet core. */
vec2 shellIntersect(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(-1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

/**
 * Folds atmospheric extinction between the eye and the cloud into the layer,
 * so distant cells wash out into the horizon haze exactly like the real thing.
 * Returns the premultiplied layer colour for "sky * a + rgb" compositing.
 */
vec3 applyAerial(vec3 scatter, float transmittance, float dist, vec3 hazeColor) {
  if (dist <= 0.0) return scatter;
  // sea-level extinction, thinned a little for the altitude of the deck
  vec3 beta = (vec3(5.802e-6, 13.558e-6, 33.1e-6)
             + vec3(3.996e-6) * uAtmoTurbidity) * 0.72;
  vec3 Ta = exp(-beta * dist);
  return scatter * Ta + hazeColor * (1.0 - Ta) * (1.0 - transmittance);
}

vec3 lightningGlow(vec3 p) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec4 l = (i == 0) ? uLightning0 : uLightning1;
    if (l.w <= 0.0001) continue;
    float d2 = dot(l.xyz - p, l.xyz - p);
    sum += uLightningColor * l.w * 6.0e6 / max(d2, 4.0e4);
  }
  return sum;
}
`;

const CLOUD_MARCH = /* glsl */ `
uniform int uSteps;
uniform int uLightSteps;
uniform sampler2D uSkyAmbLUT;
// Ranges over which the two erosion octaves fade out, in metres along the ray.
uniform vec3 uDetailFade;

/**
 * Skylight arriving at the deck, split into what reaches the tops and what
 * crawls in under the base. Both come straight out of the sky LUT so they
 * track sunset, overcast and night without any hand-tuned constants.
 */
void skyAmbient(vec3 viewPos, vec3 rd) {
  vec3 up = getValFromSkyLUT(uSkyAmbLUT, viewPos, vec3(0.0, 1.0, 0.0), uSunDir);
  // Under a deck the only light comes in sideways from the bright ring at the
  // horizon, then bounces once off the water on its way up.
  vec3 side = getValFromSkyLUT(uSkyAmbLUT, viewPos,
                normalize(vec3(rd.x, 0.07, rd.z)), uSunDir);
  // Skylight is blue and comes from everywhere, so it is also the term that
  // flattens a cloud. Too much of it and a sunlit cumulus reads as a pale blue
  // smudge with no lit side and no shaded side — which is not a lighting bug
  // you can tonemap your way out of, it is the shape disappearing.
  gAmbTop = up * uSunIntensity * 1.45;
  // Still generous. A deck kilometres thick is optically opaque, so a strictly
  // single-scattering base integrates to black and the overcast stops reading
  // as weather and starts reading as night. The light is really there: it
  // arrives sideways from the bright ring under the deck edge and is piped
  // through the cloud by high-order scattering the light march truncates.
  gAmbBottom = (side * 0.50 + up * 0.15) * uSunIntensity * vec3(0.80, 0.88, 1.0);
}

// Extinction per unit density per metre. Real cumulus sit around 0.05/m, which
// makes a 500 m cell optically thick enough to hide the sun completely; we run
// a little under that because the raymarch cannot afford steps short enough to
// resolve the ~20 m skin where all the visible shading actually happens.
const float SIGMA = 0.022;

/**
 * Energy-conserving multiple-scattering approximation (Wrenninge octaves).
 * Light taps grow exponentially so a handful of samples still cover the deck.
 */
vec3 sampleLight(vec3 p, float mu, vec3 sunColor, float selfDensity, float jitter, int steps) {
  vec3 ld = uSunDir;
  float thickness = uCloudTop - uCloudBottom;
  float stepLen = thickness * 0.045;
  float depth = 0.0;
  // Small: the shadow march is smooth, so jitter here buys almost no banding
  // relief and costs visible noise in the lighting.
  float travelled = stepLen * (0.25 + 0.3 * jitter);
  for (int i = 0; i < 8; i++) {
    if (i >= steps) break;
    travelled += stepLen;
    vec3 sp = p + ld * travelled;
    float sh = clamp((length(sp) - (PLANET_R + uCloudBottom)) / thickness, 0.0, 1.0);
    // base octave only: the shadow of a wisp is not worth a 3D texture fetch
    depth += cloudDensity(sp, sh, 0.0) * stepLen;
    stepLen *= 1.62;
  }

  vec3 lum = vec3(0.0);
  float a = 1.0, b = 1.0, c = 1.0;
  for (int o = 0; o < 3; o++) {
    float beer = exp(-depth * SIGMA * b);
    // Powder: light that scattered back out of a dense edge before it could be
    // absorbed. It is the thing that makes a sunlit cumulus edge read as solid
    // rather than translucent, and it must key off the LOCAL density, not the
    // path integral, or it darkens the whole cloud instead of its rim.
    float powder = 1.0 - exp(-selfDensity * 14.0);
    float phase = dualHG(mu, 0.82 * c, -0.32 * c, 0.55);
    lum += sunColor * a * phase * beer * mix(1.0, powder, 0.6);
    // Successive octaves stand for light that has already bounced: each one is
    // dimmer but penetrates much further, and it is that long tail that keeps
    // the inside of a thick cell luminous grey instead of black. The tail has
    // to keep decaying though — at b = 0.09 the third octave barely attenuates
    // at all, so it acts as a second flat ambient and erases the very gradient
    // between the lit shoulder and the shaded flank it exists to soften.
    a *= 0.5; b *= 0.42; c *= 0.68;
  }
  return lum;
}

/**
 * Two-speed raymarch: long cheap strides (no detail octave) hunt for the cloud
 * boundary, then we back up and integrate with short detailed steps. Leaving a
 * cell reverts to striding. This is what makes a 4 km deck affordable at
 * horizon distances where the ray can cover 200 km inside the shell.
 *
 * @return vec4(scattered radiance, transmittance)
 */
vec4 marchClouds(vec3 ro, vec3 rd, float rayJitter, vec3 sunColor, out vec4 diag) {
  // diag = (first-hit distance, peak raw shape, peak density, taps inside cloud)
  diag = vec4(-1.0, 0.0, 0.0, 0.0);
  float depthOut = -1.0;
  float peakDensity = 0.0;
  vec3 center = vec3(0.0, -PLANET_R, 0.0);
  vec3 o = ro - center;

  float thickness = uCloudTop - uCloudBottom;
  float rInner = PLANET_R + uCloudBottom;
  float rOuter = PLANET_R + uCloudTop;
  vec2 tOuter = shellIntersect(o, rd, rOuter);
  if (tOuter.y < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 tInner = shellIntersect(o, rd, rInner);

  float t0, t1;
  float ro_r = length(o);
  if (ro_r < rInner) {
    if (tInner.y < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
    t0 = tInner.y; t1 = tOuter.y;
  } else if (ro_r < rOuter) {
    t0 = 0.0;
    t1 = (tInner.x > 0.0) ? tInner.x : tOuter.y;
  } else {
    t0 = max(tOuter.x, 0.0);
    t1 = (tInner.x > 0.0) ? tInner.x : tOuter.y;
  }
  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);

  // Beyond this the deck is a few pixels tall on the horizon and the aerial
  // perspective has already washed it into the haze, so marching further only
  // buys banding.
  float maxDist = 140000.0;
  t1 = min(t1, t0 + maxDist);
  float span = t1 - t0;
  gT0 = t0; gT1 = t1;

  // Fine steps resolve the cell; they have to stay short enough that a single
  // step cannot swallow the whole optical depth, or the visible skin of the
  // cloud collapses to one flat sample. Tying this to the deck thickness would
  // make a 12 km storm deck step in 250 m chunks, which is exactly the case
  // where the skin matters most. Distance relaxes it because a far cell is a
  // pixel wide anyway.
  float nearFine = clamp(thickness * 0.005, 22.0, 48.0);

  float mu = dot(rd, uSunDir);
  vec3 scatter = vec3(0.0);
  float transmittance = 1.0;

  float t = t0 + nearFine * rayJitter;
  bool inside = false;
  int emptyRun = 0;
  int spent = 0;

  for (int i = 0; i < 512; i++) {
    gIters = float(i);
    if (spent >= uSteps || t > t1 || transmittance < 0.004) break;
    // Sample spacing is a quality decision and must not be stretched to make
    // the ray reach the far shell: a 500 m step swallows the whole optical
    // depth of a storm cell in one go, which flattens its skin to a single
    // sample and turns the ray-start jitter into salt-and-pepper noise.
    // Instead the step only grows once the budget is nearly gone, smoothly,
    // so a ray that runs long fades out rather than cutting off.
    float budget = float(uSteps - spent) / float(uSteps);
    float fine = nearFine * clamp(1.0 + t / 9000.0, 1.0, 22.0)
               * (1.0 + 7.0 * (1.0 - smoothstep(0.0, 0.35, budget)));
    // The stride is what hunts for the cloud boundary, so it cannot be longer
    // than the features it is hunting for: stride past a wisp and the ray
    // reports empty, and whether it does depends on the jitter, which is
    // precisely how a cloud edge turns into salt-and-pepper. Distance growth
    // is compounding, so this still reaches 140 km in about 120 taps.
    float stride = fine * 3.0;
    vec3 p = o + rd * t;
    float h = clamp((length(p) - rInner) / thickness, 0.0, 1.0);

    if (!inside) {
      if (cloudDensity(p, h, 0.0) > 0.0) {
        // Rewind to just before the boundary. The rewind lands on a grid that
        // is nearly identical for neighbouring rays, so without re-jittering
        // here the sample phase correlates across the screen and prints a comb
        // of stripes across every cloud face. One fine step of jitter is enough
        // to break that up; a whole stride just turns the comb into noise.
        t = max(t - stride + fine * rayJitter, t0);
        inside = true;
        emptyRun = 0;
      } else {
        t += stride;
      }
      continue;
    }

    // Detail octaves retire when what they carve stops resolving. Retiring the
    // fine octave at a kilometre and a bit — nearer than the cloud base itself
    // — meant every cloud in the sky was drawn from the base shape alone, and a
    // 128-cell volume stretched over seven kilometres holds nothing smaller
    // than a three-hundred-metre blob. That, and not the march resolution, is
    // what made the deck read as cotton wool.
    float detail = 2.0 - smoothstep(uDetailFade.x, uDetailFade.y, t)
                       - smoothstep(uDetailFade.y, uDetailFade.z, t);
    float dens = cloudDensity(p, h, detail);
    peakDensity = max(peakDensity, dens);
    spent++;
    if (dens > 0.0005) {
      diag.w += 1.0;
      emptyRun = 0;
      if (depthOut < 0.0) depthOut = t;

      // Once the cloud in front has eaten most of the light, nothing behind it
      // is resolvable, so the light march can drop to a couple of taps.
      int ls = transmittance > 0.25 ? uLightSteps : 2;
      vec3 lum = sampleLight(p, mu, sunColor, dens, rayJitter, ls);
      // Ambient: sky from above, ocean-tinted bounce from below, attenuated by
      // how deep inside the deck we are — that vertical gradient is what gives
      // a cloud its dark base and bright shoulders.
      // Skylight has to fight its way down through whatever cloud stands above
      // this sample. Without this the ambient term is the same everywhere along
      // the base and an overcast deck integrates to a flat grey sheet: the
      // relief is all there in the geometry, but nothing shades it. Two coarse
      // taps are enough, because what matters is the difference between a
      // sample under two hundred metres of cloud and one under two kilometres.
      float above = 0.0;
      {
        float span = max(uCloudTop - uCloudBottom, 200.0);
        vec3 up = normalize(p);
        above += cloudDensity(p + up * span * 0.10, min(h + 0.10, 1.0), 0.0) * span * 0.22;
        above += cloudDensity(p + up * span * 0.34, min(h + 0.34, 1.0), 0.0) * span * 0.46;
      }
      float skyVis = exp(-above * SIGMA * 0.55);

      vec3 amb = mix(gAmbBottom, gAmbTop, h);
      lum += amb * mix(0.55, 1.0, h) * mix(0.16, 1.0, skyVis);
      lum += lightningGlow(p + center);
      lum += uAmbientFlash * uLightningColor * 0.25;

      float tr = exp(-dens * SIGMA * fine);
      // analytic slab integration keeps banding away at low step counts
      scatter += lum * transmittance * (1.0 - tr);
      transmittance *= tr;
    } else if (++emptyRun > 4) {
      inside = false;
    }
    t += fine;
  }

  diag.x = depthOut;
  diag.y = gShapeR;
  diag.z = max(gBase, peakDensity);
  gSpent = float(spent);
  return vec4(scatter, transmittance);
}
`;

const CLOUD_ENV_FRAG = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;

uniform vec3 uCamPos;
uniform float uFrame;
uniform mat4 uInvViewProj;

${ATMO_COMMON}
${SHADING_GLSL}
${NOISE_GLSL}
${CLOUD_COMMON}
${CLOUD_MARCH}

uniform sampler2D uTransmittanceLUT;
uniform sampler2D uSkyViewLUT;

in vec2 vUv;
layout(location = 0) out vec4 oColor;

void main(){
  #ifdef SCREEN_SPACE
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 p0 = uInvViewProj * vec4(ndc, -1.0, 1.0); p0 /= p0.w;
  vec4 p1 = uInvViewProj * vec4(ndc, 1.0, 1.0); p1 /= p1.w;
  vec3 rd = normalize(p1.xyz - p0.xyz);
  #else
  vec3 rd = equirectToDir(vUv);
  #endif
  if (rd.y < -0.02) { oColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec3 viewPos = vec3(0.0, groundRadiusMM + max(uCamPos.y, 0.2) * 1e-6, 0.0);
  vec3 sunColor = getValFromTLUT(uTransmittanceLUT, viewPos, uSunDir) * uSunIntensity;
  skyAmbient(viewPos, rd);

  vec4 diag;
  // Fixed spatial jitter breaks march bands without temporal sparkle.
  float jitter = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
  vec4 cl = marchClouds(uCamPos, rd, jitter, sunColor, diag);
  vec3 haze = getValFromSkyLUT(uSkyViewLUT, viewPos, rd, uSunDir) * uSunIntensity;
  cl.rgb = applyAerial(cl.rgb, cl.a, diag.x, haze);
  oColor = cl;
}
`;

export class Clouds {
  constructor(renderer, atmosphere, textures, quality, U) {
    this.U = U;
    this.renderer = renderer;
    this.atmosphere = atmosphere;
    this.enabled = true;
    this.frame = 0;
    this.reset = true;

    const pct = (tex) => {
      const p = tex?.userData?.percentiles;
      return p
        ? [new THREE.Vector4(...p.lo), new THREE.Vector4(...p.hi)]
        : [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(1, 1, 1, 1)];
    };
    const [shapeLo, shapeHi] = pct(textures.cloudShape);
    const [detLo, detHi] = pct(textures.cloudDetail);

    this.shared = {
      uCloudShape: { value: textures.cloudShape },
      uCloudDetail: { value: textures.cloudDetail },
      uShapeLo: { value: shapeLo }, uShapeHi: { value: shapeHi },
      uDetailLo: { value: detLo }, uDetailHi: { value: detHi },
      uCurlTex: this.U.uCurlTex,
      uWeatherMap: { value: textures.weather },
      uWeatherScaleM: { value: 58000 },
      uCoverage: { value: 0.4 },
      uCloudDensity: { value: 0.6 },
      uCloudBottom: { value: 1200 },
      uCloudTop: { value: 5200 },
      uAnvil: { value: 0.0 },
      uStorm: this.U.uStormFactor,
      uCloudWind: { value: new THREE.Vector2(6, 2) },
      uCloudTime: { value: 0 },
      uCloudScaleM: { value: 15000 },
      uCloudAspect: { value: 2.6 },
      uCloudContrast: { value: 1.6 },
      uSunIntensity: this.U.uSunIntensity,
      uSunDir: this.U.uSunDir,
      uSkyAmbLUT: { value: atmosphere.skyViewRT.texture },
      uAmbientFlash: this.U.uAmbientFlash,
      uLightningColor: this.U.uLightningColor,
      uLightning0: this.U.uLightning0,
      uLightning1: this.U.uLightning1,
      uTransmittanceLUT: { value: atmosphere.transmittanceRT.texture },
      uSkyViewLUT: { value: atmosphere.skyViewRT.texture },
      uAtmoTurbidity: this.U.uAtmoTurbidity,
      uAtmoMieG: this.U.uAtmoMieG,
      uAtmoGroundAlbedo: this.U.uAtmoGroundAlbedo,
      uSteps: { value: 64 },
      uLightSteps: { value: 6 },
    };

    this.envPass = new FullScreenPass(CLOUD_ENV_FRAG, {
      ...this.shared,
      uCamPos: this.U.uCamPos,
      uFrame: this.U.uFrame,
      uSteps: { value: 18 },
      uLightSteps: { value: 3 },
      // The probe feeds reflections, which never resolve an erosion octave.
      uDetailFade: { value: new THREE.Vector3(9000, 34000, 95000) },
    }, { name: 'cloudEnv' });

    this.screenPass = new FullScreenPass(CLOUD_ENV_FRAG, {
      ...this.shared,
      uCamPos: this.U.uCamPos,
      uInvViewProj: this.U.uInvViewProj,
      uDetailFade: { value: new THREE.Vector3(9000, 34000, 95000) },
    }, { name: 'cloudScreen', defines: { SCREEN_SPACE: 1 } });
    this.screenRT = makeRT(1, 1, { name: 'cloudScreen' });

    this.setQuality(quality);
  }

  setQuality(q) {
    this.screenPass.uniforms.uSteps.value = q.cloudSteps;
    this.screenPass.uniforms.uLightSteps.value = q.cloudLightSteps;
    this.envPass.uniforms.uSteps.value = 160;
    this.envPass.uniforms.uLightSteps.value = 3;
    this.envRT?.dispose();
    this.envRT = makeRT(q.envSize, q.envSize / 2, { name: 'cloudEnv' });
    this.envRT.texture.wrapS = THREE.RepeatWrapping;
  }

  update(time, width, height, refreshEnvironment) {
    const s = this.shared;
    s.uCloudTime.value = time;
    const thickness = Math.max(s.uCloudTop.value - s.uCloudBottom.value, 200);
    s.uCloudAspect.value = THREE.MathUtils.clamp(s.uCloudScaleM.value / (thickness * 4.4), 0.8, 1.7);
    const scale = Math.min(0.5, 900 / width);
    this.screenRT.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    if (s.uCoverage.value > 0) {
      this.screenPass.render(this.renderer, this.screenRT);
      if (refreshEnvironment) this.envPass.render(this.renderer, this.envRT);
    }
  }

  get envTexture() { return this.envRT.texture; }
  dispose() { this.envRT.dispose(); this.envPass.dispose(); this.screenRT.dispose(); this.screenPass.dispose(); }
}
