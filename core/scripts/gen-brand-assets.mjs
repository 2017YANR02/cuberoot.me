// 从中性品牌源生成 Web/PWA 图标，并同步 Web 的部署副本。
//
//   node scripts/gen-brand-assets.mjs
//
// 单一来源是 assets/brand/CubeRoot-mark.svg —— 改 logo 后重跑这个脚本,别手动导图。
//
// 两条硬约束(踩过):
//   1) **必须不透明**。iOS 把带 alpha 的 apple-touch-icon 合成到黑底上,透明底 logo 会
//      变成"黑方块里一个深灰根号"。所以统一 flatten 到白底。
//   2) maskable 那张要留 20% 安全边 —— Android launcher 会把它裁成圆 / 圆角方,art 只能
//      占中间 80%。
//
// sharp 是 core 根工具依赖,由 pnpm-lock.yaml 锁定,不扫描 pnpm 私有目录。
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { resolveWorkspacePath } from './resolve-workspace-path.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = join(HERE, '..');
const BRAND_ASSETS = join(CORE_ROOT, 'assets', 'brand');
const WEB_ICONS = join(CORE_ROOT, resolveWorkspacePath('@cuberoot/client'), 'public', 'icons');

const BG = '#ffffff';

const raw = readFileSync(join(BRAND_ASSETS, 'CubeRoot-mark.svg'), 'utf8');
const markViewBox = raw.match(/<svg[^>]*\bviewBox="([^"]+)"/)?.[1];
if (!markViewBox) throw new Error('CubeRoot-mark.svg must declare a viewBox');
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** 把横版 mark 居中嵌进一个 size×size 的不透明方块。pad 是四边留白占比。 */
function compose(size, pad) {
  const inset = Math.round(size * pad);
  const box = size - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" fill="${BG}"/>`
    + `<svg x="${inset}" y="${inset}" width="${box}" height="${box}" viewBox="${markViewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`
    + `</svg>`;
}

const JOBS = [
  ['apple-touch-icon.png', 180, 0.07],
  ['icon-192.png', 192, 0.07],
  ['icon-512.png', 512, 0.07],
  ['icon-maskable-512.png', 512, 0.20],
];

for (const [name, size, pad] of JOBS) {
  await sharp(Buffer.from(compose(size, pad)), { density: 512 })
    .resize(size, size)
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(join(BRAND_ASSETS, name));
  console.log('wrote', name, `${size}×${size}`);
}

mkdirSync(WEB_ICONS, { recursive: true });
for (const name of ['CubeRoot-mark.svg', ...JOBS.map(([file]) => file)]) {
  copyFileSync(join(BRAND_ASSETS, name), join(WEB_ICONS, name));
}
