/** Independent pinhole-camera fixture; no detector/projection helper is reused. */
export function cubePhotoFixture(occluded: boolean, perspective = 0.1, facelet?: string, size: 2 | 3 = 3) {
  const point = (u: number, v: number, w: number) => {
    const z = 1 + u * perspective + v * 0.04 + w * 0.015;
    return { x: (310 - 165 * u + 165 * v + 5 * w) / z, y: (85 + 90 * u + 80 * v + 215 * w) / z };
  };
  const faces = [
    (u: number, v: number) => facelet ? point(v, u, 0) : point(u, v, 0),
    (u: number, v: number) => point(1, u, v),
    (u: number, v: number) => point(1 - u, 1, v),
  ];
  const colors = ['#f9dc28', '#1075db', '#e82b35', '#21b05b', '#f7f5ed', '#f5841d'];
  const polygons = faces.map((face, f) => {
    const outline = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => face(u, v)).map(p => `${p.x},${p.y}`).join(' ');
    let out = `<polygon points="${outline}" fill="#181b20"/>`;
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const a = (col + 0.055) / size, b = (row + 0.055) / size, c = (col + 0.945) / size, d = (row + 0.945) / size;
      const points = [[a, b], [c, b], [c, d], [a, d]].map(([u, v]) => face(u, v)).map(p => `${p.x},${p.y}`).join(' ');
      const standardColors: Record<string, string> = { U: colors[0], R: colors[2], F: colors[1], D: colors[4], L: colors[5], B: colors[3] };
      const color = facelet ? standardColors[facelet[[0, 2 * size * size, size * size][f] + row * size + col]]
        : f > 0 && row > 0 ? colors[f] : colors[(row * 3 + col + f) % colors.length];
      out += `<polygon points="${points}" fill="${color}"/>`;
    }
    return out;
  }).join('');
  const covering = occluded ? '<path d="M110 305 Q160 285 205 330 Q260 335 320 353 Q370 304 430 298 Q490 286 510 355 L520 510 L100 510Z" fill="#c89a7e"/>' : '';
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="540"><rect width="640" height="540" fill="#b8bec7"/>${polygons}${covering}</svg>`,
    top: [point(0, 0, 0), point(1, 0, 0), point(1, 1, 0), point(0, 1, 0)],
    corners: [point(0, 0, 0), point(1, 0, 0), point(1, 1, 0), point(0, 1, 0), point(1, 0, 1), point(1, 1, 1), point(0, 1, 1)],
  };
}
