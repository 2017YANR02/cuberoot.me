/**
 * Structure-coloring debug overlay for the local cuber engine (NxN / SQ1 / Ivy).
 *
 * A developer toggle (`SimSettings.debugStructureColor`) recolors a puzzle's
 * INTERNAL geometry to bright, unmistakable hues so you can see exactly what a
 * turn-opening reveals — answering "is that black a void/bug, or real internal
 * structure?" without a one-off `__sim` console hack. The outer color stickers
 * are left untouched (so orientation still reads); only the hidden body / core
 * shows debug colors.
 *
 * Mechanism — material SWAP by role, never color mutation:
 *   Each puzzle builder tags its meshes `userData.simRole`:
 *     - 'body' — the solid filler under each sticker (Ivy shell walls, SQ1 piece
 *                extrude, NxN frame). Debug → cyan.
 *     - 'core' — a shared central mass (e.g. NxN inner box). Debug → magenta.
 *                (Ivy has no core mesh — its pieces are solid wedges that cap the
 *                interior sphere themselves; only their 'body' role shows.)
 *     - 'sticker' (optional tag) — left untouched.
 *   `applyDebugStructureColors(root, on)` traverses and, per tagged mesh, swaps
 *   `mesh.material` to the role's debug material (stashing the original in
 *   `userData.origMat`) or restores it. It NEVER mutates a material's `.color`,
 *   because bodies SHARE one material instance (e.g. all 18 Ivy shells + the core
 *   sphere share `IvyCube.bodyMat`) — a single `.color` write would bleed across
 *   roles and survive the toggle.
 *
 * MUST run AFTER applySettings: applySettings re-sets NxN frame/inner materials
 * on every call (the `hollow` setter writes unconditionally). The
 * `mesh.material !== dbg` capture guard then re-captures the fresh base each call
 * for NxN, and captures-once for SQ1/Ivy (whose materials applySettings never
 * touches) — so restore stays correct even if `hollow` is toggled mid-overlay.
 */
import * as THREE from 'three';
import { deriveRawFaces, makeRawBodyMaterial } from './rawBody';

/** Bright debug materials, one per structural role. Lit (Lambert) so curved
 *  shells / spheres still read as 3D; DoubleSide so shell interiors show. Shared
 *  app-lifetime singletons — never disposed, never color-mutated. */
export const DEBUG_BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x00e0d0, side: THREE.DoubleSide });
export const DEBUG_CORE_MAT = new THREE.MeshLambertMaterial({ color: 0xff2bd6, side: THREE.DoubleSide });

const ROLE_MAT: Record<string, THREE.Material> = {
  body: DEBUG_BODY_MAT,
  core: DEBUG_CORE_MAT,
};

/** See-through body material for the "hollow" (镂空) look on the in-house engine
 *  puzzles — mirrors NxN's `Cubelet.TRANS` (gray, opacity 0.1, no depth write) so a
 *  hollowed body matches across every puzzle type. App-lifetime singleton, never
 *  color-mutated (bodies share one material, so a `.color` write would bleed). */
export const HOLLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x808080, transparent: true, opacity: 0.1, depthWrite: false,
});

/**
 * Single deterministic owner of every body/core mesh material for the in-house
 * engine puzzles (SQ1 / Ivy / Dino / Redi / Rex / Heli / Skewb), composing the
 * "hollow" (镂空) and "structure colors" debug toggles in ONE pass so they can't
 * corrupt each other the way two independent material-swap layers would (each
 * stashing/restoring `origMat` clobbers the other when both transition).
 *
 * The genuine build material is captured ONCE per mesh into `userData.simBaseMat`
 * — this function is the only thing that ever sets these materials, so the first
 * read is always the real base (never HOLLOW_MAT / DEBUG_* / raw). Every call then
 * derives the effective material purely from that base + the current flags, in
 * priority raw > debug > hollow > base. Idempotent; call on every applySettings.
 *
 * 原核 (raw, stickerless body): when on, each 'body' mesh shows a per-piece raw
 * material (built once from its sibling stickers, cached on `userData.simRawMat`)
 * that paints the plastic like a stickerless puzzle, and the raised sticker tiles
 * are hidden. See rawBody.ts. Raw wins over debug/hollow; a body with no derivable
 * colored faces (no sibling stickers) falls through to the normal priority.
 *
 * (NxN is NOT routed here: its thickness/hollow/hint/faceColors/raw live on the
 * InstancedRenderer, and its debug overlay runs via applyDebugStructureColors
 * after the NxN block — see SettingDrawer.applySettings.)
 */
export function applyEngineBodyOverlay(root: THREE.Object3D, hollow: boolean, debug: boolean, raw: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const role = mesh.userData.simRole as string | undefined;
    if (role === 'sticker') {
      // 原核 paints the body itself → hide the raised sticker tiles. Idempotent; a
      // carved (hidden) parent still hides its children regardless of this flag.
      mesh.visible = !raw;
      return;
    }
    if (role !== 'body' && role !== 'core') return;
    if (mesh.userData.simBaseMat === undefined) mesh.userData.simBaseMat = mesh.material;
    const base = mesh.userData.simBaseMat as THREE.Material | THREE.Material[];
    if (raw && role === 'body') {
      let rawMat = mesh.userData.simRawMat as THREE.Material | null | undefined;
      if (rawMat === undefined) {
        const faces = deriveRawFaces(mesh);
        rawMat = faces.length > 0 ? makeRawBodyMaterial(base, faces) : null;
        mesh.userData.simRawMat = rawMat; // cache null too: skip re-deriving every call
      }
      if (rawMat) { mesh.material = rawMat; return; }
    }
    mesh.material = debug ? ROLE_MAT[role] : hollow ? HOLLOW_MAT : base;
  });
}

/** Swap (on) / restore (off) bright debug materials on every mesh tagged with a
 *  recolorable `userData.simRole` ('body' / 'core'). Idempotent. Stickers and
 *  untagged meshes are ignored. Call AFTER applySettings (see file header). */
export function applyDebugStructureColors(root: THREE.Object3D, on: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const role = mesh.userData.simRole as string | undefined;
    const dbg = role ? ROLE_MAT[role] : undefined;
    if (!dbg) return;
    if (on) {
      // Capture the current (non-debug) material as the restore target. The
      // `!== dbg` guard means NxN re-captures its freshly-reset base each call,
      // while SQ1/Ivy capture once (their material is already dbg on re-runs).
      if (mesh.material !== dbg) mesh.userData.origMat = mesh.material;
      mesh.material = dbg;
    } else if (mesh.userData.origMat) {
      mesh.material = mesh.userData.origMat as THREE.Material;
      mesh.userData.origMat = undefined;
    }
  });
}

// (removed) Arc-stroke debug overlay — was an Ivy-only tool for verifying curved
// sticker arcs stay continuous (occlusion bug #12). Deleted: only Ivy had curved
// edges, and structure-coloring + hold-partial + the analytic vertex check cover
// that failure mode without a per-piece tube-geometry overlay.
