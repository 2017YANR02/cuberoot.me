// Fixed illustration pigments belong to the characters, independently of page theme.
export const C = { ink: '#253445', cream: '#FFF0D2', orange: '#E56D3E', coral: '#EF7658', blue: '#347ABB', navy: '#233F67', lightBlue: '#91BEE5', mint: '#7DAD9D', teal: '#56817E', gold: '#EBC45C', brown: '#68503E', green: '#80A06A' };
export const p = (d, fill, stroke = 'none', width = 1.8) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const e = (x, y, rx, ry, fill, stroke = 'none', width = 1.8) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
export const r = (x, y, w, h, fill, radius = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
export const line = (d, color = C.ink, width = 1.8) => p(d, 'none', color, width);
export function face(j, { x = 112, y = 121, gap = 16, size = 6, color = C.ink, white = C.cream, pixel = false, smile = true } = {}) {
  const eyes = pixel
    ? [-gap, gap].map(dx => r(x + dx - size, y - size, size * 2, size * 2, color) + r(x + dx - size + 2, y - size + 2, 2, 2, white)).join('')
    : [-gap, gap].map(dx => e(x + dx, y, size, size * 1.27, white)).join('') + j('gaze', [-gap, gap].map(dx => e(x + dx, y + .7, size * .66, size * .92, color) + e(x + dx - size * .17, y - size * .42, size * .18, size * .24, white)).join(''), [x, y]);
  return j('blink', pixel ? j('gaze', eyes, [x, y]) : eyes, [x, y]) + (smile ? j('mouth', pixel ? p(`M${x - 5} ${y + 11}h3v3h4v-3h3v5h-10z`, color) : line(`M${x - 5} ${y + 11}q5 5 10 0`, color, 1.7), [x, y + 11]) : '');
}
export const paper = (d, color, shade = C.brown) => p(d, shade) + `<g transform="translate(0 -1.6)">${p(d, color)}</g>`;
