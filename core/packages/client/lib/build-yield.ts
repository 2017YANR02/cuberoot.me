/**
 * Let a long build loop breathe.
 *
 * The OLL / PLL lookup tables are built by walking a whole alg set through
 * cubing.js — parse, invert, apply, simplify, per case per variant per AUF.
 * That is a few thousand alg parses, and it used to run as one uninterrupted
 * synchronous loop: measured at a single 402ms task on desktop, on the critical
 * path of opening the reconstruction. The panel painted and then froze — you
 * could see it but not scroll it.
 *
 * Nothing about the work needs to be atomic. Yielding every few milliseconds
 * costs a little wall-clock and gives the browser its chance to scroll, paint
 * and handle input, which is the whole complaint.
 *
 * `setTimeout(0)` rather than a microtask on purpose: a resolved promise does
 * NOT yield to the event loop, so awaiting one would keep the task exactly as
 * long as it was.
 */

/** Longest we'll hold the main thread between yields. Under one frame. */
const SLICE_MS = 8;

/**
 * Run `each` over `items`, yielding whenever the current slice has run long
 * enough. Use inside an already-async builder — callers await the result and
 * cannot tell the difference except that the page stayed alive.
 */
export async function forEachYielding<T>(
  items: readonly T[],
  each: (item: T, index: number) => void,
): Promise<void> {
  let sliceStart = Date.now();
  for (let i = 0; i < items.length; i++) {
    each(items[i], i);
    if (Date.now() - sliceStart >= SLICE_MS) {
      await new Promise((r) => { setTimeout(r, 0); });
      sliceStart = Date.now();
    }
  }
}
