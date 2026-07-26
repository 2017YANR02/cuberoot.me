/**
 * Shared scene-orbit helpers for /sim drag handlers. Every puzzle's "drag empty
 * space / miss the cube → rotate the whole view" fallback applies the same screen-
 * delta-to-scene-rotation math; centralizing it keeps the per-puzzle pointer code to
 * its own pick/resolve logic. (NxN orbits through its own Controller and does NOT use
 * these — it converts orbit into whole-cube y/x twists; see SimPage onOrbit.)
 */
import type World from './world';

/** Orbit the scene by a screen drag delta (dx, dy in px, scaled by `k`). Pitch (x) is
 *  clamped to ±90° so the cube never flips past vertical; yaw (y) is unbounded. Marks
 *  the world dirty so the next frame re-renders. */
export function orbitScene(world: World, dx: number, dy: number, k: number): void {
  world.scene.rotation.y += dx * k;
  world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x + dy * k));
  world.scene.updateMatrix();
  world.dirty = true;
}

/** Sign to apply to a horizontal drag delta before it lands in `scene.rotation.y`.
 *
 *  `scene.rotation` is an 'XYZ' euler with z=0, i.e. M = Rx(pitch)·Ry(yaw): yaw spins
 *  about the cube's OWN up-axis, which Rx then tilts. Once pitch passes ±90° that axis
 *  points down in world space, so the same dx reads as the opposite direction on screen
 *  ("D 面朝上时左右拖反了"). cos(pitch) < 0 is exactly the upside-down half — negate there.
 *  Modes that keep pitch inside ±90° (orbitScene's clamp, NxN's commit-at-90° orbit/rotate)
 *  always get +1, so this is a no-op for them. */
export function yawSign(pitch: number): number {
  return Math.cos(pitch) < 0 ? -1 : 1;
}

/** Snap the scene orientation to the nearest 90° about each axis — the release behavior
 *  for the "drag empty space = rotate" setting, so the cube settles to an axis-aligned
 *  pose instead of a tilted one. */
export function snapViewToQuadrant(world: World): void {
  const q = Math.PI / 2;
  world.scene.rotation.y = Math.round(world.scene.rotation.y / q) * q;
  world.scene.rotation.x = Math.round(world.scene.rotation.x / q) * q;
  world.scene.updateMatrix();
  world.dirty = true;
}
