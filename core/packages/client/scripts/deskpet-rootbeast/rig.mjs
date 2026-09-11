// Original B2 character. These outlines are traced from the approved artwork;
// Articulation and native SVG facial expressions extend the original skin.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { animateCharacter, resolvePose } from './character.mjs';
import { choreography } from './choreography.mjs';
import { createAnimator } from '../deskpet-animation.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(join(here, 'parts.json'), 'utf8'));
export const [red, blue, ink, cream] = meta.palette;
export const gold = '#FFD35A', pink = '#FF99BC', mint = '#6BD5BD', violet = '#AFA0F6';
export const defs = Object.entries(meta.parts).map(([name, size]) => {
  const source = readFileSync(join(here, 'parts', `${name}.svg`), 'utf8');
  const inner = source.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1];
  if (!inner || /<(?:image|script|foreignObject)\b/.test(inner)) throw Error(`Invalid traced part: ${name}`);
  const symbol = (id, art) => `<symbol id="rb-${id}" viewBox="0 0 ${size.width} ${size.height}">${art}</symbol>`;
  // Detach the original smile and the eye silhouette from the actual traced
  // paths. Neither gaze nor expression is baked into the shell any longer.
  if (name === 'body') {
    const paths = [...inner.matchAll(/<path\b[^>]*\/>/g)].map(match => match[0]);
    return symbol(name, inner) + symbol('shell', paths.filter((_, i) => i !== 15).join(''));
  }
  if (name === 'eye') {
    const outline = inner.match(/<path\b[^>]*\/>/)[0];
    return symbol(name, inner) + symbol('eye-outline', outline.replace(/fill="[^"]+"/, 'fill="currentColor"'));
  }
  return symbol(name, inner);
}).join('\n');
export const p = (d, fill = cream) => `<path d="${d}" fill="${fill}"/>`;
export const line = (d, stroke = cream, width = 6) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const rect = (x, y, w, h, fill = cream, radius = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
export const circle = (x, y, r, fill = cream) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
export const at = (art, x = 0, y = 0, scale = 1, angle = 0) => `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${angle})">${art}</g>`;
export const t = (x = 0, y = 0, angle = 0, sx = 1, sy = sx) => `transform:translate(${x}px,${y}px) rotate(${angle}deg) scale(${sx},${sy});`;
export const opacity = (value) => `opacity:${value};`;
export const star = (color = gold) => p('M0-23 6-7 23 0 6 6 0 23-6 6-23 0-6-7Z', color);
export const heart = p('M0 22C-6 14-29 1-23-13-17-26-3-20 0-12 5-23 21-23 25-11 30 2 7 17 0 22Z', pink);
export const cloud = circle(-28, 0, 23) + circle(0, -15, 31) + circle(28, 0, 23) + rect(-28, 0, 56, 23);
export const moon = p('M12-42C-35-39-52 18-12 42 9 55 39 37 44 17 4 35-18-9 12-42Z', gold);
export const bug = line('M-17-8-28-17M-19 2-32 3M-14 13-24 23M17-8 28-17M19 2 32 3M14 13 24 23', ink, 4) + circle(0, 2, 19, ink) + circle(4, -15, 11, ink) + circle(1, -17, 3) + circle(9, -17, 3);
export const butterfly = p('M0 1C-45-55-57-4-14 10-49 42-11 46 0 13 14 47 47 37 16 9 62-12 37-55 0 1Z', pink) + line('M0-5V22', ink, 5);
export const tile = (color = blue, size = 44) => rect(-size / 2, -size / 2, size, size, cream, size * .22) + rect(-size / 2 + 5, -size / 2 + 5, size - 10, size - 10, color, size * .15);
export const cube = (size = 108, alg = '') => renderFromSimpleQuery({ size: String(size), alg }).replace('<svg ', `<svg x="${-size / 2}" y="${-size / 2}" `);
// The keyboard is on the far side, next to the pet. The viewer sees the lid back.
export const laptop = `<g data-prop-facing="pet" data-prop="laptop">${p('M-79 17H79L109 44Q112 49 103 51H-103Q-112 49-109 44Z',ink)+p('M-77 22H77L99 43H-99Z',cream)+rect(-93,-59,186,102,ink,12)+rect(-85,-51,170,85,blue,7)+line('M-76 44H76',cream,3)+circle(74,25,3,mint)}</g>`;
// Covers face the viewer; the thin, sloping page edges open toward the reader.
export const book = `<g data-prop-facing="pet" data-prop="book">${p('M0-8Q-46-33-89-17V47Q-44 35 0 61 43 36 89 47V-17Q45-32 0-8Z',ink)+p('M-3-5Q-46-25-84-12V43Q-44 33-3 55Z',blue)+p('M3-5Q45-25 84-12V43Q44 33 3 55Z',mint)+p('M-85-17Q-45-39 0-14 45-39 85-17L83-9Q44-26 0-3-44-26-83-9Z',cream)+line('M0-3V55',ink,3)+line('M-78-17Q-43-30-9-13M9-13Q44-30 78-17',mint,2)}</g>`;
export const magnifier = circle(0, 0, 48, cream) + circle(0, 0, 38, mint) + circle(-10, -9, 15, cream) + line('M33 35 74 79', ink, 18);
export const balloon = p('M0 42C-70 15-55-60 0-58 58-57 65 15 0 42Z', red) + p('M0 37-8 53H8Z', red) + line('M-24-23Q-20-37-9-39', cream, 6);
export const umbrella = p('M-123 0Q-114-114 0-112 112-113 123 0Q88-29 62 0 30-28 0 0-31-27-61 0-90-26-123 0Z', red) + p('M0-112Q-42-76-61 0-30-28 0 0 28-29 62 0 42-79 0-112Z', cream) + line('M0-117V126Q0 157 27 147', ink, 7);
export const board = rect(-139, -8, 278, 19, violet, 9) + circle(-94, 27, 17, ink) + circle(94, 27, 17, ink) + circle(-94, 27, 7, cream) + circle(94, 27, 7, cream);
export const cup = rect(-35, -60, 70, 85, cream, 12) + rect(-29, -42, 58, 50, pink, 6) + line('M14-37 24-97 49-105', blue, 7);

const part = (name, x, y, w, h) => `<use href="#rb-${name}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
export const pawGrip = ([px, py, rotation, , sy]) => {
  const radians = rotation * Math.PI / 180;
  return [px - Math.sin(radians) * 65 * sy, py + Math.cos(radians) * 65 * sy];
};
export function stage(id, duration, draw, sceneId) {
  const { a, styles } = createAnimator(`rb${id}`, duration);
  const v = (art, start = 20, end = 80) => a(art, [[0, opacity(0)], [Math.max(0, start - 1), opacity(0)], [start, opacity(1)], [end, opacity(1)], [Math.min(100, end + 1), opacity(0)], [100, opacity(0)]]);
  const float = (art, x, y, amount = 12) => at(a(art, [[0, t()], [50, t(0, -amount)], [100, t()]]), x, y);
  const glints = (x, y) => at(a(star(), [[0, t(0, 0, 0, .25)], [35, t(0, -7, 35, 1)], [70, t(0, 0, 90, .35)]]), x, y) + at(a(star(cream), [[0, t(0, 0, 0, .6)], [55, t(0, 8, -45, .25)]]), x + 48, y + 30, .5);
  const plan = choreography[sceneId];
  if (!plan) throw new Error(`Missing character choreography: ${sceneId}`);
  const petPlacement = { x: 320, y: 520, scale: .73 };
  // Scene-space handoffs use the same resolved wrist as held artwork.
  const grip = (time, bone = 'L', offset = [0, 0]) => {
    const key = plan.poses.find(([at]) => Math.abs(at - time) < .0001);
    if (!key) throw Error(`Missing grip key at ${time}% in ${sceneId}`);
    const state = resolvePose(key[1], key[2]);
    if (!state[bone]) throw Error(`Unknown grip bone ${bone}`);
    const [px, py] = pawGrip(state[bone]);
    const radians = state.spin * Math.PI / 180;
    const x = (px + offset[0]) * state.zoom, y = (py + offset[1] + 190) * state.zoom;
    return [petPlacement.x + petPlacement.scale * (state.rx + x * Math.cos(radians) - y * Math.sin(radians)),
      petPlacement.y + petPlacement.scale * (state.ry - 190 + x * Math.sin(radians) + y * Math.cos(radians))];
  };
  const pet = (options = {}) => animateCharacter({ a, part, at, t, plan, options: { ...petPlacement, ...options }, id, duration, pawGrip, colors: { red, blue, ink, cream, pink } });
  const art = draw({ a, v, float, glints, pet, grip });
  return { art, css: styles.join('\n') };
}
