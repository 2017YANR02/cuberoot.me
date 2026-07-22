/**
 * Phase 4 本地验收(PLAN-sr-retirement):engine_render 渲 4 拼图 × solved/alg,
 * 落盘 SVG 到 client/.tmp/png/engine-render/ 供肉眼对照。
 *
 *   pnpm -F @cuberoot/server exec tsx src/tools/engine_render_smoke.ts
 *
 * 不起 hono / 不连 DB —— 只验证 headless 渲染路径本身。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderEngineIsoSVG } from '../routes/engine_render.js';

// cwd 基准(从 server 包目录跑;esbuild bundle 后 import.meta.url 会变位,别用它)。
const OUT = path.resolve(process.cwd(), '../client/.tmp/png/engine-render');
mkdirSync(OUT, { recursive: true });

const CASES: Array<[string, 'sq1' | 'megaminx' | 'pyraminx' | 'skewb', string]> = [
  ['pyra-solved', 'pyraminx', ''],
  ['pyra-alg', 'pyraminx', "R U R'"],
  ['skewb-solved', 'skewb', ''],
  ['skewb-alg', 'skewb', "R U R' U'"],
  ['mega-solved', 'megaminx', ''],
  ['mega-alg', 'megaminx', "R U R'"],
  ['sq1-solved', 'sq1', ''],
  ['sq1-alg', 'sq1', '(1,0) / (-1,0)'],
];

let pass = 0;
for (const [name, puzzle, alg] of CASES) {
  const t0 = performance.now();
  const svg = renderEngineIsoSVG(puzzle, alg, undefined, 256);
  const ms = (performance.now() - t0).toFixed(0);
  if (!svg || !svg.includes('<svg')) {
    console.log(`FAIL ${name} -> ${svg === null ? 'null' : 'no <svg>'}`);
    continue;
  }
  const paths = (svg.match(/<path/g) || []).length;
  writeFileSync(path.join(OUT, `${name}.svg`), svg);
  console.log(` ok  ${name.padEnd(13)} ${paths} paths  ${ms}ms  ${svg.length}B`);
  pass++;
}
console.log(`\n${pass}/${CASES.length} rendered`);
if (pass !== CASES.length) process.exit(1);
