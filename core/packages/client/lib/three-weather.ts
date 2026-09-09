import * as THREE from 'three';

/** Shared by the room weather and the paper landscape; no scene or camera ownership. */
export const WEATHER_NOISE_GLSL = `
float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`;

export function precipitationGeometry(count: number) {
  if (!Number.isInteger(count) || count < 0 || count > 24_000) throw new RangeError('Particle count must be an integer from 0 to 24000');
  const seeds = new Float32Array(count * 4);
  // Local state keeps independent weather instances from changing each other's random stream.
  let state = 7283;
  for (let i = 0; i < seeds.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    seeds[i] = state / 0x100000000;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  return geometry;
}

/** Original /space debris trajectory, normalized so an authored slope can set its own scale. */
export function debrisFlowSample(index: number, elapsed: number) {
  if (!Number.isInteger(index) || index < 0 || !Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Invalid debris animation sample');
  const t = (index * .61803398875 + elapsed * .045) % 1;
  return { x: Math.sin(t * 5) * .2 + Math.sin(index * 3.1) / 3 * (.45 + t * .75), y: (1 - t) ** 3, z: t };
}
