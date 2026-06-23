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

/** Bright debug materials, one per structural role. Lit (Lambert) so curved
 *  shells / spheres still read as 3D; DoubleSide so shell interiors show. Shared
 *  app-lifetime singletons — never disposed, never color-mutated. */
export const DEBUG_BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x00e0d0, side: THREE.DoubleSide });
export const DEBUG_CORE_MAT = new THREE.MeshLambertMaterial({ color: 0xff2bd6, side: THREE.DoubleSide });

const ROLE_MAT: Record<string, THREE.Material> = {
  body: DEBUG_BODY_MAT,
  core: DEBUG_CORE_MAT,
};

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
