/**
 * Vendored fork of sr-puzzlegen v1.0.4 (tdecker91/puzzle-visualizer, ISC — see LICENSE).
 *
 * In-repo copy so the exotic-puzzle vector renderer is owned, typed (strict), and
 * patch-free. Deviations from upstream:
 *  - SVG-only: the PNG/canvas renderers, DelayedSvgRenderer, demos and the predefined
 *    `Masks` table are removed (the site renders sr exclusively through <PuzzleSVG>).
 *  - `PolygonRenderer.renderPolygons` paints `#333` inner faces in a first pass so
 *    colored stickers always win at sq1 kerf cuts (was a runtime prototype patch).
 *  - Camera distance is a real option (`SVGVisualizerOptions.cameraDist`) driving the
 *    透视 slider, instead of the old module-level `setSrPerspective` hack.
 *  - Strict-mode type fixes throughout; no behavioral changes (golden-locked by
 *    tests/puzzle-image-render.test.ts + scripts/verify_puzzle_image_golden.cjs).
 */
export * from "./visualizer";
export type { IColor } from "./geometry/color";
