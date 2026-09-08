// Subset the existing local font through Three.js's official TTF converter.
// Run from core: pnpm --filter @cuberoot/client exec node scripts/build-shanghai-sign-font.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';

const manifest = JSON.parse(readFileSync(new URL('../app/[lang]/space/space-shanghai-signs-data.json', import.meta.url), 'utf8'));
const characters = [...new Set(manifest.flatMap(s => [...s.lines.map(l => l.text).join(''), ...(s.blade ? s.blade.text + s.blade.english : '')]))].sort();
const bytes = readFileSync(new URL('../public/fonts/wqy-microhei.ttf', import.meta.url));
const font = new TTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
for (const char of characters) if (!font.glyphs[char]) throw new Error(`Missing sign glyph: ${char}`);
font.glyphs = Object.fromEntries(characters.map(char => [char, font.glyphs[char]]));
font.familyName = 'CubeRoot Bund signage subset of WenQuanYi Micro Hei';
writeFileSync(new URL('../public/assets/space/shanghai-v1/sign-font.json', import.meta.url), JSON.stringify(font) + '\n');
console.log(`Bund signage font: ${characters.length} glyphs, ${Buffer.byteLength(JSON.stringify(font))} bytes`);
