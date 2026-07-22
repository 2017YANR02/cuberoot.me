/**
 * audit-sim-svg — 对任意 /sim 示意导出 SVG 文件跑几何不变量全套判据。
 *
 * 判据实现在 tests/_svg_invariants.mjs(与 CI 单测同一份):层序结构、逐 path
 * opacity、贴纸⊂面板墨迹覆盖、共享角顶点重合。用途:浏览器现抓的伴图 SVG、用户
 * 反馈附带的导出件,离线复判「和 visualcube 是否同构」,不用再手搓一次采样脚本。
 *
 *   pnpm --filter @cuberoot/client audit:svg <file.svg> [more.svg ...]
 *   pnpm --filter @cuberoot/client audit:svg ours.svg --vs vc.svg   # 追加逐字节比对
 *
 * --vs 用于「按构造应当逐字节一致」的视图(plan 已直调 visualcube 本体):任何
 * 差异都打印首个分歧偏移与上下文。立体视图(normal/trans)相机不同构,别用 --vs,
 * 结构判据本身就是对齐依据。
 */
import { readFileSync } from 'node:fs';
import { auditSchematicSvg } from '../tests/_svg_invariants.mjs';

const args = process.argv.slice(2);
const vsIdx = args.indexOf('--vs');
const vsFile = vsIdx >= 0 ? args[vsIdx + 1] : null;
const files = args.filter((_a, i) => vsIdx < 0 || (i !== vsIdx && i !== vsIdx + 1));
if (files.length === 0) {
  console.error('用法: audit:svg <file.svg> [more.svg ...] [--vs reference.svg]');
  process.exit(2);
}

let allPass = true;
for (const f of files) {
  const svg = readFileSync(f, 'utf-8');
  const { pass, checks } = auditSchematicSvg(svg);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${f}`);
  for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'BAD '} ${c.name}: ${c.detail}`);
  if (!pass) allPass = false;

  if (vsFile) {
    const ref = readFileSync(vsFile, 'utf-8');
    if (svg === ref) {
      console.log(`  ok   bytes: 与 ${vsFile} 逐字节一致`);
    } else {
      allPass = false;
      let i = 0;
      while (i < Math.min(svg.length, ref.length) && svg[i] === ref[i]) i++;
      console.log(`  BAD  bytes: 与 ${vsFile} 不一致,首个分歧 @${i}`);
      console.log(`       ours: …${svg.slice(Math.max(0, i - 40), i + 40)}…`);
      console.log(`       ref : …${ref.slice(Math.max(0, i - 40), i + 40)}…`);
    }
  }
}
process.exit(allPass ? 0 : 1);
