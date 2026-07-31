// 生成主屏 / PWA 图标集(public/icons/{apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png)。
//
//   node packages/client/scripts/gen-app-icons.mjs
//
// 单一来源是 public/icons/CubeRoot-mark.svg —— 改 logo 后重跑这个脚本,别手动 PS 导图。
//
// 两条硬约束(踩过):
//   1) **必须不透明**。iOS 把带 alpha 的 apple-touch-icon 合成到黑底上,透明底 logo 会
//      变成"黑方块里一个深灰根号"。所以统一 flatten 到白底。
//   2) maskable 那张要留 20% 安全边 —— Android launcher 会把它裁成圆 / 圆角方,art 只能
//      占中间 80%。
//
// sharp 只在 pnpm store 里(没被任何 package 直接依赖),这里从 store 里捞;捞不到就
// `pnpm -F @cuberoot/client add -D sharp` 再跑。
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = join(HERE, '..', 'public', 'icons');
const CORE = join(HERE, '..', '..', '..');

function loadSharp() {
  const req = createRequire(join(CORE, 'noop.js'));
  try { return req('sharp'); } catch { /* 没链接到 workspace,继续去 store 里找 */ }
  const store = join(CORE, 'node_modules', '.pnpm');
  const dir = readdirSync(store).find((d) => /^sharp@/.test(d));
  if (!dir) throw new Error('找不到 sharp:先 `pnpm -F @cuberoot/client add -D sharp`');
  return req(join(store, dir, 'node_modules', 'sharp'));
}

const MARK_VB = '71.81 4.82 686.92 392.99'; // CubeRoot-mark.svg 的 viewBox(已收紧到墨迹)
const BG = '#ffffff';

const raw = readFileSync(join(ICONS, 'CubeRoot-mark.svg'), 'utf8');
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** 把横版 mark 居中嵌进一个 size×size 的不透明方块。pad 是四边留白占比。 */
function compose(size, pad) {
  const inset = Math.round(size * pad);
  const box = size - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" fill="${BG}"/>`
    + `<svg x="${inset}" y="${inset}" width="${box}" height="${box}" viewBox="${MARK_VB}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`
    + `</svg>`;
}

const JOBS = [
  ['apple-touch-icon.png', 180, 0.07],
  ['icon-192.png', 192, 0.07],
  ['icon-512.png', 512, 0.07],
  ['icon-maskable-512.png', 512, 0.20],
];

const sharp = loadSharp();
for (const [name, size, pad] of JOBS) {
  await sharp(Buffer.from(compose(size, pad)), { density: 512 })
    .resize(size, size)
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(join(ICONS, name));
  console.log('wrote', name, `${size}×${size}`);
}
