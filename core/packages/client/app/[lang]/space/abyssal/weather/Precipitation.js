// ABYSSAL, MIT, Copyright (c) 2026 Davi (Token-Gremlin). See LICENSE and UPSTREAM.md.
import * as THREE from 'three';
import { NOISE_GLSL } from '../gfx/NoiseGLSL.js';
import { SHADING_GLSL } from '../gfx/ShadingGLSL.js';

/**
 * Rain, entirely in the vertex shader.
 *
 * Each instance owns a fixed slot in a box that travels with the camera. The
 * slot's position is a hash of its index; the drop falls at its own terminal
 * velocity, is pushed sideways by the wind, and wraps modulo the box height, so
 * the whole field is a closed-form function of time with no simulation state
 * and no CPU work at all.
 *
 * A drop is drawn as a streak: the quad is stretched along the drop's velocity
 * by roughly the distance it covers during the shutter interval, which is what
 * a camera actually records. Streaks are shaded as thin water cylinders — they
 * refract the sky behind them, so they read bright against a dark sea and dark
 * against a bright sky, exactly like real rain.
 */

const RAIN_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
in float aIndex;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uCamPos;
uniform vec3 uCamFwd;
uniform float uTime;
uniform float uRain;
uniform vec2 uWindDir;
uniform float uWindSpeed;
uniform float uGustiness;
uniform vec2 uBox;          // (half extent, height)
uniform float uCount;
uniform float uStreak;      // shutter length in seconds
uniform float uSeaLevel;
uniform float uPixelScale;  // world units per pixel at one metre of depth
uniform float uDebug;

out vec2 vUv;
out float vFade;
out float vSeed;
out float vThin;
out vec3 vWorld;

${NOISE_GLSL}

void main(){
  float id = aIndex;
  vec3 h = hash33(vec3(id * 0.0013, id * 0.0071, id * 0.0037));
  vSeed = h.z;

  // Only a fraction of the slots are live at low rain rates. Fading a drop in
  // rather than popping it keeps the onset of a squall smooth.
  float live = step(h.x, clamp(uRain * 1.15, 0.0, 1.0));

  // Bias the field toward the camera's view direction: rain behind the lens is
  // wasted geometry, so the box is pushed forward along the look vector.
  vec3 anchor = uCamPos + uCamFwd * uBox.x * 0.45;
  anchor.y = uCamPos.y;

  // terminal velocity of a raindrop, 4 m/s for drizzle to 9 m/s for a downpour
  float size = mix(0.35, 1.0, h.y);
  float vy = mix(4.2, 9.4, size) * mix(0.85, 1.15, h.z);
  vec2 gust = uWindDir * uWindSpeed * (0.78 + uGustiness * 0.5 * sin(uTime * 0.7 + h.z * 6.28));

  // wrap the fall so the slot recycles without any state
  float fall = mod(h.z * uBox.y + uTime * vy, uBox.y);
  vec3 wp;
  wp.y = anchor.y + uBox.y * 0.55 - fall;

  // Uniform density in space wastes almost every drop: at 80 m a raindrop is
  // far under a pixel. Biasing the radius toward the camera gives roughly
  // uniform density on screen instead, which is what the eye reads as rain.
  float ang = h.x * 6.2831853;
  float rad = uBox.x * pow(h.y, 1.7);
  vec2 drift = gust * (fall / max(vy, 0.1));
  wp.xz = anchor.xz + vec2(cos(ang), sin(ang)) * rad + drift;
  // keep the slab centred on the camera as the drift carries it away
  wp.xz -= floor((wp.xz - anchor.xz) / (2.0 * uBox.x) + 0.5) * (2.0 * uBox.x);

  vec3 vel = vec3(gust.x, -vy, gust.y);
  float speed = length(vel);
  vec3 dir = vel / max(speed, 1e-4);

  vec3 toEye = uCamPos - wp;
  float dist = length(toEye);
  toEye /= max(dist, 1e-4);
  vec3 side = normalize(cross(dir, toEye));

  // The streak is what the shutter integrates: the drop's own length is
  // irrelevant, only how far it travels while the frame is open.
  float len = clamp(speed * uStreak, 0.30, 3.2) * mix(0.7, 1.3, size);

  // A raindrop is a few millimetres across, which is far under a pixel at any
  // useful distance. Rasterising that honestly gives a flickering dotted mess,
  // so the quad is held at a floor of about one pixel and the opacity is scaled
  // down by exactly the factor it was widened. That keeps the total light the
  // streak contributes correct, and it is what makes distant rain settle into a
  // grey veil instead of a swarm of confetti.
  float worldPerPx = uPixelScale * dist;
  float trueWide = mix(0.006, 0.016, size);
  float wide = max(trueWide, worldPerPx * 1.15);
  vThin = clamp(trueWide / wide, 0.10, 1.0);

  vec3 p = wp + dir * (position.y - 0.5) * len + side * position.x * wide;

  // Rain arrives in curtains, not as a uniform field. A slow noise sheet
  // drifting downwind gates whole swathes of the box, which is most of what
  // sells a squall — and it means the near field breathes as gusts pass.
  vec2 curtainUv = (wp.xz - uWindDir * uTime * 9.0) * 0.0055;
  float curtain = fbm2Tiled(curtainUv, 64.0, 3) * 0.5 + 0.55;
  curtain = smoothstep(0.30, 0.72, curtain + uRain * 0.35);

  // fade at the box edges and kill anything that has fallen into the sea
  float edge = 1.0 - smoothstep(uBox.x * 0.72, uBox.x, length(wp.xz - anchor.xz));
  float above = smoothstep(-0.5, 2.0, wp.y - uSeaLevel);
  vFade = live * edge * above * curtain * clamp(uRain * 1.6, 0.0, 1.0);

  vUv = vec2(position.x, position.y);
  vWorld = wp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (vFade <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
}
`;

const RAIN_FRAG = /* glsl */ `
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in float vFade;
in float vSeed;
in float vThin;
in vec3 vWorld;

uniform sampler2D uEnvMap;
uniform float uEnvMaxLod;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uCamPos;
uniform vec3 uLightningColor;
uniform float uAmbientFlash;
uniform float uDebug;

${SHADING_GLSL}

layout(location = 0) out vec4 oColor;

void main(){
  // cylindrical cross-section: bright core falling off to the edges
  float r = vUv.x * 2.0;
  float body = sqrt(max(1.0 - r * r, 0.0));
  float ends = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
  if (uDebug > 0.5) {
    float ad = vFade * body * ends;
    oColor = vec4(vec3(30.0, 0.0, 30.0) * ad, ad);

    return;
  }

  // A drop is a lens. It gathers light from a wide cone and concentrates it
  // toward the eye, which is why rain reads bright against a dark sea even
  // under a flat grey sky — the streak is far brighter than the sky behind it.
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 look = normalize(vWorld - uCamPos);
  vec3 refr = normalize(mix(look, up, 0.55 + r * 0.25));
  vec3 lens = textureLod(uEnvMap, dirToEquirect(refr), uEnvMaxLod * 0.45).rgb;

  // total internal reflection puts a hard glint on the sun side of the drop
  float glint = pow(max(dot(refr, uSunDir), 0.0), 24.0);
  vec3 col = lens * (1.15 + body * 0.7) + uSunColor * uSunIntensity * glint * 0.9;
  col += uLightningColor * uAmbientFlash * 2.5;

  float a = vFade * body * ends * vThin * 0.7;
  oColor = vec4(col * a, a);
  // leave the velocity/depth buffer alone: these are transparent overlays and
  // should inherit the motion of whatever they are drawn over

}
`;

export class Rain {
  constructor(quality, U, roofShader, roofUniforms) {
    this.U = U;
    const geom = new THREE.InstancedBufferGeometry();
    const quad = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0,
      -0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    geom.setAttribute('position', new THREE.BufferAttribute(quad, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    this.max = quality.rainCount ?? 24000;
    const idx = new Float32Array(this.max);
    for (let i = 0; i < this.max; i++) idx[i] = i;
    geom.setAttribute('aIndex', new THREE.InstancedBufferAttribute(idx, 1));
    geom.instanceCount = 0;
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.RawShaderMaterial({
      name: 'Rain',
      glslVersion: THREE.GLSL3,
      vertexShader: RAIN_VERT.replace('void main(){', roofShader + '\nvoid main(){').replace('vUv = vec2(position.x, position.y);', 'vFade *= step(roofAt(wp.xz) + len, wp.y); vUv = vec2(position.x, position.y);'),
      fragmentShader: RAIN_FRAG,
      uniforms: {
        ...roofUniforms,
        uCamPos: this.U.uCamPos,
        uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
        uTime: this.U.uTime,
        uRain: this.U.uRain,
        uWindDir: this.U.uWindDir,
        uWindSpeed: this.U.uWindSpeed,
        uGustiness: this.U.uGustiness,
        uSeaLevel: this.U.uSeaLevel,
        uBox: { value: new THREE.Vector2(80, 52) },
        uCount: { value: this.max },
        uStreak: { value: 0.042 },
        uPixelScale: { value: 0.002 },
        uEnvMap: this.U.uEnvMap,
        uEnvMaxLod: this.U.uEnvMaxLod,
        uSunDir: this.U.uSunDir,
        uSunColor: this.U.uSunColor,
        uSunIntensity: this.U.uSunIntensity,
        uLightningColor: this.U.uLightningColor,
        uAmbientFlash: this.U.uAmbientFlash,
        uDebug: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      // colour is premultiplied in the shader
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.geom = geom;
  }

  setQuality(q) {
    this.max = Math.min(this.max, q.rainCount ?? this.max);
    this.budget = q.rainCount ?? this.max;
  }

  update(camera, rain, viewHeightPx) {
    const n = Math.min(this.max, Math.ceil((this.budget ?? this.max) * Math.min(rain * 1.2, 1)));
    this.geom.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    camera.getWorldDirection(this.material.uniforms.uCamFwd.value);
    // metres per pixel per metre of depth, so the shader only has to multiply
    const h = Math.max(viewHeightPx || 720, 16);
    this.material.uniforms.uPixelScale.value =
      2 * Math.tan(camera.fov * 0.5 * Math.PI / 180) / h;
  }
  dispose() { this.geom.dispose(); this.material.dispose(); this.mesh.removeFromParent(); }

}

