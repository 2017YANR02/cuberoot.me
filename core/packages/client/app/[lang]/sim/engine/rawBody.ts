/**
 * rawBody — 原核 (raw / stickerless body) for the in-house, NON-instanced engine
 * puzzles (SQ1 / Skewb / Megaminx / Pyraminx / … and future cube-faced ones).
 *
 * Generalizes the NxN `rawCore.ts` idea — "each plastic body is colored like a
 * stickerless puzzle, no black core" — to engines whose pieces are individual
 * meshes (a dark body + raised colored sticker meshes) rather than an
 * InstancedMesh. The shared trick: don't draw the stickers; instead recolor the
 * BODY so every fragment takes the color of the body face it sits on (edges split
 * along the ridge between two faces, corners three-way), exactly the real
 * stickerless look.
 *
 * Why normal-based (not NxN's position-based argmax): NxN cubelets are unit boxes
 * centered at the origin, so `dot(localPos, faceNormal)` cleanly bisects each
 * dihedral. These bodies are arbitrary off-center polytopes (rounded Minkowski
 * solids, beveled extrudes), where position-argmax would mis-split. Comparing the
 * fragment's OWN object-space normal against each colored face normal instead is
 * robust to any shape: a flat face's normal matches its own face exactly (solid
 * color), and the rounded ridge between two faces blends at the geometric crease.
 *
 * Reuse contract (zero per-puzzle branching here): every cube-faced engine already
 * tags each sticker `userData.simRole='sticker'` + `userData.simStickerNormal`
 * (the outward face normal in the body's local/parent frame — `makeSticker` sets
 * it for skewb/mega/pyra/dino/redi/rex/heli/ivy/fto; SQ1 sets it explicitly). So a
 * body's colored faces are derived at apply-time from its sibling stickers
 * (normal + cap color), no build-time face table. The invariant that makes the
 * frames line up: a body mesh is added to its piece group with identity rotation,
 * so its geometry's object-space normals share the frame `simStickerNormal` is in.
 *
 * Orchestrated by `applyEngineBodyOverlay` (debugColors.ts) — the single owner of
 * these puzzles' body materials — which swaps in a raw material per body and hides
 * the stickers when raw is on. This module only builds the material + derives faces.
 */
import * as THREE from 'three';

/** Max colored faces per piece fed to the shader (mega corner=3, SQ1 middle=4). */
const MAX_RAW_FACES = 8;

export interface RawFace { n: THREE.Vector3; c: THREE.Color; }

/** The colored faces (outward normal + cap color) of `body`, read from its sibling
 *  sticker meshes (same parent group). Normal is in the body's object frame; cap
 *  color is `material[0]` for the `[cap, wall]` arrays `makeSticker` builds, else
 *  the single material's color. Empty ⇒ caller leaves the body's base material. */
export function deriveRawFaces(body: THREE.Mesh): RawFace[] {
  const parent = body.parent;
  if (!parent) return [];
  const faces: RawFace[] = [];
  for (const sib of parent.children) {
    const s = sib as THREE.Mesh;
    if (s.userData?.simRole !== 'sticker') continue;
    const n = s.userData.simStickerNormal as THREE.Vector3 | undefined;
    if (!n) continue;
    const mat = s.material;
    const capMat = (Array.isArray(mat) ? mat[0] : mat) as THREE.Material & { color?: THREE.Color };
    if (!capMat?.color) continue;
    faces.push({ n: n.clone().normalize(), c: capMat.color.clone() });
    if (faces.length >= MAX_RAW_FACES) break;
  }
  return faces;
}

/** Unique program cache key per raw material. onBeforeCompile materials that
 *  generate identical source would otherwise SHARE one compiled program — and the
 *  reused program keeps only the FIRST material's uniforms, so every body would
 *  render with one piece's colors. A unique key forces a per-body program (only a
 *  handful of pieces per puzzle, so the program count is fine). Module counter,
 *  not Date/random (deterministic, resume-safe). */
let _rawMatSeq = 0;

/** Build a per-body raw material: clone the lit Phong look of `base` (so the body
 *  still shades in 3D) and inject "nearest colored face by object-space normal"
 *  coloring from `faces`. One instance per body (uniforms differ); cache it on the
 *  body so toggling raw on/off reuses the same material + program. */
export function makeRawBodyMaterial(base: THREE.Material | THREE.Material[], faces: RawFace[]): THREE.MeshPhongMaterial {
  const src = (Array.isArray(base) ? base[0] : base) as THREE.MeshPhongMaterial;
  const m = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: src?.specular ? src.specular.clone() : new THREE.Color(0x222222),
    shininess: src?.shininess ?? 20,
    side: src?.side ?? THREE.FrontSide,
  });

  const nArr: THREE.Vector3[] = [];
  const cArr: THREE.Color[] = [];
  for (let i = 0; i < MAX_RAW_FACES; i++) {
    const f = faces[i];
    nArr.push(f ? f.n.clone() : new THREE.Vector3());
    cArr.push(f ? f.c.clone() : new THREE.Color(0xffffff));
  }
  const count = Math.min(faces.length, MAX_RAW_FACES);

  const key = `rawBody_${_rawMatSeq++}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRawCount = { value: count };
    shader.uniforms.uRawN = { value: nArr };
    shader.uniforms.uRawC = { value: cArr };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRawNrm;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvRawNrm = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRawNrm;
uniform int uRawCount;
uniform vec3 uRawN[${MAX_RAW_FACES}];
uniform vec3 uRawC[${MAX_RAW_FACES}];`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 nn = normalize(vRawNrm);
  float best = -1e30;
  vec3 rawCol = diffuse;
  for (int i = 0; i < ${MAX_RAW_FACES}; i++) {
    if (i >= uRawCount) break;
    float d = dot(nn, uRawN[i]);
    if (d > best) { best = d; rawCol = uRawC[i]; }
  }
  diffuseColor.rgb = rawCol;
}`,
      );
  };
  return m;
}
