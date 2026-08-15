import { describe, expect, it } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { FACE } from '@/app/[lang]/sim/engine/define';
import { OUTLINE_DEFAULT } from '@/app/[lang]/sim/engine/nxn/stickerOutline';
import { FM_IGNORED, FM_OUTLINE } from '@/app/[lang]/sim/engine/nxn/stickering';
import {
  PICTURE_FACE_ORDER,
  buildPictureSlotAttributes,
  countPictureFaces,
  emptyPictureFaces,
  normalizePictureCrop,
  normalizePictureFaces,
  panPictureCropBy,
  pictureCropGeometry,
  pictureFacesKey,
  renderPictureCubeNetSvg,
  zoomPictureCropAt,
} from '@/app/[lang]/sim/engine/nxn/pictureCube';

describe('picture cube face data', () => {
  it('normalizes only browser-safe image data URLs', () => {
    expect(normalizePictureFaces({
      U: 'data:image/webp;base64,AAA',
      R: 'https://example.com/image.png',
      F: 12,
      B: 'data:text/html;base64,AAA',
    })).toEqual({
      U: 'data:image/webp;base64,AAA', R: '', F: '', D: '', L: '', B: '',
    });
  });

  it('counts faces and produces a stable content key', () => {
    const faces = emptyPictureFaces();
    faces.U = 'data:image/webp;base64,U';
    faces.F = 'data:image/webp;base64,F';
    expect(countPictureFaces(faces)).toBe(2);
    expect(pictureFacesKey(faces)).toBe(PICTURE_FACE_ORDER.map((face) => faces[face]).join('\u0000'));
  });

  it('normalizes crop rotation, pan, and zoom bounds', () => {
    expect(normalizePictureCrop({ rotation: 89, x: -2, y: Number.NaN, zoom: 99 })).toEqual({
      rotation: 90, x: -1, y: 0, zoom: 4,
    });
    expect(normalizePictureCrop({ rotation: -90, x: 0.25, y: 2, zoom: 0.2 })).toEqual({
      rotation: 270, x: 0.25, y: 1, zoom: 1,
    });
  });

  it('maps wide-image pan to the exact cover overflow and swaps axes after rotation', () => {
    expect(pictureCropGeometry(800, 400, 400, { rotation: 0, x: -1, y: 0, zoom: 1 })).toEqual({
      scale: 1,
      drawnWidth: 800,
      drawnHeight: 400,
      overflowX: 400,
      overflowY: 0,
      offsetX: -200,
      offsetY: 0,
    });
    expect(pictureCropGeometry(800, 400, 400, { rotation: 90, x: 0, y: 1, zoom: 1 })).toEqual({
      scale: 1,
      drawnWidth: 400,
      drawnHeight: 800,
      overflowX: 0,
      overflowY: 400,
      offsetX: 0,
      offsetY: 200,
    });
  });

  it('expands both crop axes at higher zoom', () => {
    expect(pictureCropGeometry(800, 400, 400, {
      rotation: 0, x: 0.5, y: -1, zoom: 2,
    })).toEqual({
      scale: 2,
      drawnWidth: 1600,
      drawnHeight: 800,
      overflowX: 1200,
      overflowY: 400,
      offsetX: 300,
      offsetY: -200,
    });
  });

  it('adds only the zoom needed when dragging an image with no crop overflow', () => {
    const moved = panPictureCropBy(
      400,
      400,
      400,
      { rotation: 0, x: 0, y: 0, zoom: 1 },
      40,
      -20,
    );
    expect(moved.zoom).toBeCloseTo(1.2);
    expect(moved.x).toBeCloseTo(1);
    expect(moved.y).toBeCloseTo(-0.5);
    expect(pictureCropGeometry(400, 400, 400, moved)).toMatchObject({
      offsetX: 40,
      offsetY: -20,
    });
  });

  it('unlocks the covered axis when dragging a wide image vertically', () => {
    const moved = panPictureCropBy(
      800,
      400,
      400,
      { rotation: 0, x: 0, y: 0, zoom: 1 },
      0,
      40,
    );
    expect(moved.zoom).toBeCloseTo(1.2);
    expect(moved.x).toBe(0);
    expect(moved.y).toBeCloseTo(1);
  });

  it('keeps the image beneath the zoom anchor stationary', () => {
    const zoomed = zoomPictureCropAt(
      800,
      400,
      400,
      { rotation: 0, x: 0, y: 0, zoom: 1 },
      2,
      100,
      0,
    );
    expect(zoomed.zoom).toBe(2);
    expect(zoomed.x).toBeCloseTo(-1 / 6);
    expect(zoomed.y).toBe(0);
  });

  it('follows the moving center of a pinch while zooming', () => {
    const zoomed = zoomPictureCropAt(
      800,
      400,
      400,
      { rotation: 0, x: 0, y: 0, zoom: 1 },
      2,
      0,
      0,
      40,
      -20,
    );
    expect(zoomed.x).toBeCloseTo(1 / 15);
    expect(zoomed.y).toBeCloseTo(-0.1);
  });
});

describe('picture cube sticker slots', () => {
  it('maps solved 3x3 HOME stickers into six distinct atlas regions', () => {
    const N = 3;
    const max = N - 1;
    const slots: Array<{ cubeletInitial: number; face: number }> = [];
    const at = (x: number, y: number, z: number) => x + y * N + z * N * N;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) slots.push({ cubeletInitial: at(x, max, z), face: FACE.U });
    for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) slots.push({ cubeletInitial: at(max, y, z), face: FACE.R });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) slots.push({ cubeletInitial: at(x, y, max), face: FACE.F });
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) slots.push({ cubeletInitial: at(x, 0, z), face: FACE.D });
    for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) slots.push({ cubeletInitial: at(0, y, z), face: FACE.L });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) slots.push({ cubeletInitial: at(x, y, 0), face: FACE.B });

    const attrs = buildPictureSlotAttributes(slots, N);
    expect(attrs.faces).toHaveLength(54);
    expect([...new Set(attrs.faces)]).toEqual(expect.arrayContaining([...PICTURE_FACE_ORDER]));
    expect(Array.from(attrs.enabled.array)).toEqual(new Array(54).fill(0));
    for (let i = 0; i < attrs.directions.count; i++) {
      const expected = attrs.faces[i] === 'B' ? -1 : 1;
      expect(attrs.directions.getX(i)).toBe(expected);
      expect(attrs.directions.getY(i)).toBe(expected);
    }
    for (let i = 0; i < attrs.centers.count; i++) {
      expect(attrs.centers.getX(i)).toBeGreaterThan(0);
      expect(attrs.centers.getX(i)).toBeLessThan(1);
      expect(attrs.centers.getY(i)).toBeGreaterThan(0);
      expect(attrs.centers.getY(i)).toBeLessThan(1);
    }
  });
});

describe('Cube.serializePictureFacelets', () => {
  it('is identity-oriented in the solved state for several NxN orders', () => {
    for (const order of [2, 3, 4]) {
      const tiles = new Cube(order).serializePictureFacelets();
      expect(tiles).toHaveLength(6 * order * order);
      for (let face = 0; face < 6; face++) {
        const slice = tiles.slice(face * order * order, (face + 1) * order * order);
        expect(slice.map((tile) => tile.face)).toEqual(new Array(order * order).fill(PICTURE_FACE_ORDER[face]));
        expect(slice.map((tile) => tile.index)).toEqual(Array.from({ length: order * order }, (_, index) => index));
        expect(slice.map((tile) => tile.rotation)).toEqual(new Array(order * order).fill(0));
      }
    }
  });

  it('exports artwork once per source face and reuses it for physical tiles', () => {
    const cube = new Cube(3);
    const faces = emptyPictureFaces();
    faces.U = 'data:image/webp;base64,UP';
    const svg = renderPictureCubeNetSvg({
      order: 3,
      facelets: cube.serializePictureFacelets(),
      faces,
      faceColors: { U: '#fff', R: '#f00', F: '#0f0', D: '#ff0', L: '#f80', B: '#00f' },
      bodyColor: '#111',
      stickerOpacity: 80,
    });
    expect(svg.match(/data:image\/webp;base64,UP/g)).toHaveLength(1);
    expect(svg.match(/href="#picture-source-U"/g)).toHaveLength(9);
    expect(svg).toContain('viewBox="0 0 12 9"');
    expect(svg).toContain('opacity="0.8"');
    expect(svg).toContain('fill="#f00"');
  });

  it('keeps every artwork tile attached to one physical sticker through turns', () => {
    const cube = new Cube(3);
    const solved = cube.serializePictureFacelets();
    cube.twister.setup("R U R' F2 D");
    const turned = cube.serializePictureFacelets();
    const tileIds = (tiles: typeof solved) => tiles.map(({ face, index }) => `${face}${index}`).sort();
    expect(tileIds(turned)).toEqual(tileIds(solved));
    expect(turned.some(({ rotation }) => rotation !== 0)).toBe(true);
    expect(turned.map(({ rotation }) => rotation).every((rotation) => [0, 90, 180, 270].includes(rotation))).toBe(true);

    cube.twister.setup("R U R' F2 D D' F2 R U' R'");
    expect(cube.serializePictureFacelets()).toEqual(solved);
  });

  it('replaces picture tiles with stage colors in exported SVGs', () => {
    const cube = new Cube(2);
    const faces = emptyPictureFaces();
    faces.U = 'data:image/webp;base64,UP';
    const stickering = new Uint8Array(24);
    stickering[0] = FM_IGNORED;
    stickering[1] = FM_OUTLINE;
    const svg = renderPictureCubeNetSvg({
      order: 2,
      facelets: cube.serializePictureFacelets(),
      faces,
      faceColors: { U: '#ffffff', R: '#ff0000', F: '#00ff00', D: '#ffff00', L: '#ff8800', B: '#0000ff' },
      bodyColor: '#111111',
      stickering,
    });
    expect(svg.match(/href="#picture-source-U"/g)).toHaveLength(3);
    expect(svg).toContain('fill="#666666"');
    expect(svg).toContain(`stroke="${OUTLINE_DEFAULT}" stroke-width="0.08"`);
  });
});
