import * as THREE from 'three';

/** Sutherland-Hodgman clipping, retaining n dot p + d >= 0. */
export function clipPolyByPlane(
  points: THREE.Vector3[],
  nx: number,
  ny: number,
  nz: number,
  d: number,
): THREE.Vector3[] {
  const output: THREE.Vector3[] = [];
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % count];
    const da = a.x * nx + a.y * ny + a.z * nz + d;
    const db = b.x * nx + b.y * ny + b.z * nz + d;
    if (da >= 0) {
      output.push(a);
      if (db < 0) output.push(new THREE.Vector3().lerpVectors(a, b, da / (da - db)));
    } else if (db >= 0) {
      output.push(new THREE.Vector3().lerpVectors(a, b, da / (da - db)));
    }
  }
  return output;
}

const color = new THREE.Color();

export function hexOf(r: number, g: number, b: number, srgb: boolean): string {
  if (srgb) {
    const byte = (value: number): string =>
      Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0');
    return `#${byte(r)}${byte(g)}${byte(b)}`;
  }
  color.setRGB(
    Math.min(1, Math.max(0, r)),
    Math.min(1, Math.max(0, g)),
    Math.min(1, Math.max(0, b)),
  );
  return `#${color.getHexString()}`;
}

export function fmt(value: number): number {
  return Math.round(value * 100) / 100;
}
