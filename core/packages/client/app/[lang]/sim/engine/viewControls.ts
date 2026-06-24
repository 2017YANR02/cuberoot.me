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
