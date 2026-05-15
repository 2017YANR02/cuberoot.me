/**
 * Vendor wrapper for sr-puzzlegen.
 *
 * sr-puzzlegen ships ESM-style `import "./foo"` (no .js extensions) and no
 * `type: module` flag — Node ESM strict mode can't resolve those bare paths,
 * so `node dist/index.js` in server prod crashes the first time srSVG runs.
 *
 * Build emits a single bundled ESM file via esbuild (mirrors the
 * `@cuberoot/visualcube` pattern). Dev (tsx / vite) resolves the `default`
 * condition to this src file directly, which is fine because tsx/vite both
 * handle missing-extension specifiers via esbuild's resolver.
 */
export { SVG } from 'sr-puzzlegen';
