import * as THREE from 'three';
import { STICKER_INNER } from '../define';
import { engineHomeSid } from './netIndex';
import {
  FM_OUTLINE, FM_REGULAR, faceletDisplayColor, type FaceletMask,
} from './stickering';
import { OUTLINE_DEFAULT, type StickerMaterial } from './stickerOutline';

export const PICTURE_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type PictureFace = (typeof PICTURE_FACE_ORDER)[number];
export type PictureFaces = Record<PictureFace, string>;

export const EMPTY_PICTURE_FACES: PictureFaces = {
  U: '', R: '', F: '', D: '', L: '', B: '',
};

const FACE_CELL: Record<PictureFace, readonly [number, number]> = {
  U: [0, 0], R: [1, 0], F: [2, 0],
  D: [0, 1], L: [1, 1], B: [2, 1],
};
const ATLAS_COLS = 3;
const ATLAS_ROWS = 2;
const ATLAS_TILE = 384;
const ATLAS_GUTTER = 2;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const EDIT_SOURCE_MAX_SIDE = 2048;

export type PictureRotation = 0 | 90 | 180 | 270;

export const PICTURE_CROP_MIN_ZOOM = 1;
export const PICTURE_CROP_MAX_ZOOM = 4;

export interface PictureCrop {
  rotation: PictureRotation;
  /** Position of the image inside the square crop, normalized to [-1, 1]. */
  x: number;
  y: number;
  /** Multiplier applied after the image has been scaled to cover the crop. */
  zoom: number;
}

export const DEFAULT_PICTURE_CROP: PictureCrop = { rotation: 0, x: 0, y: 0, zoom: 1 };

export interface PictureCropGeometry {
  scale: number;
  drawnWidth: number;
  drawnHeight: number;
  overflowX: number;
  overflowY: number;
  offsetX: number;
  offsetY: number;
}

export function emptyPictureFaces(): PictureFaces {
  return { ...EMPTY_PICTURE_FACES };
}

export function normalizePictureFaces(value: unknown): PictureFaces {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = emptyPictureFaces();
  for (const face of PICTURE_FACE_ORDER) {
    const src = source[face];
    result[face] = typeof src === 'string' && src.startsWith('data:image/') ? src : '';
  }
  return result;
}

export function countPictureFaces(faces: PictureFaces): number {
  return PICTURE_FACE_ORDER.reduce((count, face) => count + (faces[face] ? 1 : 0), 0);
}

export function pictureFacesKey(faces: PictureFaces): string {
  return PICTURE_FACE_ORDER.map((face) => faces[face]).join('\u0000');
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

async function decodeFile(file: File): Promise<DecodedImage> {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('too-large');
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Some browsers expose createImageBitmap but reject valid SVG or HEIF images.
      // Let the regular image decoder try before reporting a broken upload.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode-failed'));
    image.src = src;
  });
}

function clampCropPosition(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampCropZoom(value: number): number {
  if (!Number.isFinite(value)) return PICTURE_CROP_MIN_ZOOM;
  return Math.max(PICTURE_CROP_MIN_ZOOM, Math.min(PICTURE_CROP_MAX_ZOOM, value));
}

export function normalizePictureCrop(
  value: { rotation?: number; x?: number; y?: number; zoom?: number } | null | undefined,
): PictureCrop {
  const rawRotation = Number.isFinite(value?.rotation) ? Number(value?.rotation) : 0;
  const rotation = (((Math.round(rawRotation / 90) * 90) % 360) + 360) % 360 as PictureRotation;
  return {
    rotation,
    x: clampCropPosition(value?.x ?? 0),
    y: clampCropPosition(value?.y ?? 0),
    zoom: clampCropZoom(value?.zoom ?? PICTURE_CROP_MIN_ZOOM),
  };
}

/** Exact cover geometry shared by the crop preview and exported square. Positive
 * offsets move the picture right/down, matching direct manipulation on the canvas. */
export function pictureCropGeometry(
  width: number,
  height: number,
  size: number,
  crop: PictureCrop,
): PictureCropGeometry {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const safeSize = Math.max(1, size);
  const normalized = normalizePictureCrop(crop);
  const sideways = normalized.rotation === 90 || normalized.rotation === 270;
  const rotatedWidth = sideways ? safeHeight : safeWidth;
  const rotatedHeight = sideways ? safeWidth : safeHeight;
  const scale = Math.max(safeSize / rotatedWidth, safeSize / rotatedHeight) * normalized.zoom;
  const drawnWidth = rotatedWidth * scale;
  const drawnHeight = rotatedHeight * scale;
  const overflowX = Math.max(0, drawnWidth - safeSize);
  const overflowY = Math.max(0, drawnHeight - safeSize);
  return {
    scale,
    drawnWidth,
    drawnHeight,
    overflowX,
    overflowY,
    offsetX: normalized.x * overflowX / 2,
    offsetY: normalized.y * overflowY / 2,
  };
}

/** Move the picture by crop-canvas pixels. When the current zoom has no room
 * for that movement, increase it only as much as needed to keep the crop full. */
export function panPictureCropBy(
  width: number,
  height: number,
  size: number,
  crop: PictureCrop,
  deltaX: number,
  deltaY: number,
): PictureCrop {
  const current = normalizePictureCrop(crop);
  const currentGeometry = pictureCropGeometry(width, height, size, current);
  const baseGeometry = pictureCropGeometry(width, height, size, {
    ...current,
    zoom: PICTURE_CROP_MIN_ZOOM,
  });
  const safeSize = Math.max(1, size);
  const desiredOffsetX = currentGeometry.offsetX + (Number.isFinite(deltaX) ? deltaX : 0);
  const desiredOffsetY = currentGeometry.offsetY + (Number.isFinite(deltaY) ? deltaY : 0);
  const neededZoomX = (safeSize + Math.abs(desiredOffsetX) * 2) / baseGeometry.drawnWidth;
  const neededZoomY = (safeSize + Math.abs(desiredOffsetY) * 2) / baseGeometry.drawnHeight;
  const next = normalizePictureCrop({
    ...current,
    zoom: Math.max(current.zoom, neededZoomX, neededZoomY),
  });
  const nextGeometry = pictureCropGeometry(width, height, size, next);
  return normalizePictureCrop({
    ...next,
    x: nextGeometry.overflowX > 0 ? desiredOffsetX * 2 / nextGeometry.overflowX : 0,
    y: nextGeometry.overflowY > 0 ? desiredOffsetY * 2 / nextGeometry.overflowY : 0,
  });
}

/** Zoom while keeping the image point beneath `anchor` under `target`. All
 * coordinates are relative to the crop center, in crop-canvas pixels. Supplying
 * a different target also supports the translation that occurs during a pinch. */
export function zoomPictureCropAt(
  width: number,
  height: number,
  size: number,
  crop: PictureCrop,
  zoom: number,
  anchorX: number,
  anchorY: number,
  targetX = anchorX,
  targetY = anchorY,
): PictureCrop {
  const current = normalizePictureCrop(crop);
  const currentGeometry = pictureCropGeometry(width, height, size, current);
  const next = normalizePictureCrop({ ...current, zoom });
  const nextGeometry = pictureCropGeometry(width, height, size, next);
  const scaleRatio = nextGeometry.scale / currentGeometry.scale;
  const offsetX = targetX - (anchorX - currentGeometry.offsetX) * scaleRatio;
  const offsetY = targetY - (anchorY - currentGeometry.offsetY) * scaleRatio;
  return normalizePictureCrop({
    ...next,
    x: nextGeometry.overflowX > 0 ? offsetX * 2 / nextGeometry.overflowX : 0,
    y: nextGeometry.overflowY > 0 ? offsetY * 2 / nextGeometry.overflowY : 0,
  });
}

export function drawPictureCrop(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  size: number,
  crop: PictureCrop,
): PictureCropGeometry {
  const normalized = normalizePictureCrop(crop);
  const geometry = pictureCropGeometry(width, height, size, normalized);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2 + geometry.offsetX, size / 2 + geometry.offsetY);
  ctx.rotate(normalized.rotation * Math.PI / 180);
  ctx.drawImage(
    source,
    -width * geometry.scale / 2,
    -height * geometry.scale / 2,
    width * geometry.scale,
    height * geometry.scale,
  );
  ctx.restore();
  return geometry;
}

function decodedToSquareDataUrl(
  decoded: DecodedImage,
  crop: PictureCrop,
  maxSize: number,
): string {
  if (decoded.width < 1 || decoded.height < 1) throw new Error('decode-failed');
  const side = Math.max(1, Math.min(maxSize, decoded.width, decoded.height));
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  drawPictureCrop(ctx, decoded.source, decoded.width, decoded.height, side, crop);
  return canvas.toDataURL('image/webp', 0.84);
}

/** Upload image → adjustable square WebP data URL. The cap keeps six faces small
 * enough for mobile localStorage while retaining enough detail for high-order cubes. */
export async function fileToPictureFaceDataUrl(
  file: File,
  maxSize = ATLAS_TILE,
  crop: PictureCrop = DEFAULT_PICTURE_CROP,
): Promise<string> {
  const decoded = await decodeFile(file);
  try {
    return decodedToSquareDataUrl(decoded, crop, maxSize);
  } finally {
    decoded.close?.();
  }
}

/** Session-only full-frame source for crop adjustment. It is deliberately not
 * persisted; only the final 384px square is stored in localStorage. */
export async function fileToPictureEditSourceDataUrl(
  file: File,
  maxSide = EDIT_SOURCE_MAX_SIDE,
): Promise<string> {
  const decoded = await decodeFile(file);
  try {
    if (decoded.width < 1 || decoded.height < 1) throw new Error('decode-failed');
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-unavailable');
    ctx.drawImage(decoded.source, 0, 0, decoded.width, decoded.height, 0, 0, width, height);
    return canvas.toDataURL('image/webp', 0.88);
  } finally {
    decoded.close?.();
  }
}

export async function pictureEditSourceToFaceDataUrl(
  src: string,
  crop: PictureCrop,
  maxSize = ATLAS_TILE,
): Promise<string> {
  const image = await loadImage(src);
  return decodedToSquareDataUrl(
    { source: image, width: image.naturalWidth, height: image.naturalHeight },
    crop,
    maxSize,
  );
}

async function drawAtlasFace(
  ctx: CanvasRenderingContext2D,
  src: string,
  cellX: number,
  cellY: number,
): Promise<void> {
  const image = await loadImage(src);
  const x = cellX * (ATLAS_TILE + ATLAS_GUTTER * 2);
  const y = cellY * (ATLAS_TILE + ATLAS_GUTTER * 2);
  const g = ATLAS_GUTTER;
  const t = ATLAS_TILE;
  const sw = image.naturalWidth;
  const sh = image.naturalHeight;
  // Main image plus replicated edge pixels. The gutter prevents linear filtering
  // from borrowing a neighbouring face at the outermost sticker edge.
  ctx.drawImage(image, 0, 0, sw, sh, x + g, y + g, t, t);
  ctx.drawImage(image, 0, 0, 1, sh, x, y + g, g, t);
  ctx.drawImage(image, sw - 1, 0, 1, sh, x + g + t, y + g, g, t);
  ctx.drawImage(image, 0, 0, sw, 1, x + g, y, t, g);
  ctx.drawImage(image, 0, sh - 1, sw, 1, x + g, y + g + t, t, g);
  ctx.drawImage(image, 0, 0, 1, 1, x, y, g, g);
  ctx.drawImage(image, sw - 1, 0, 1, 1, x + g + t, y, g, g);
  ctx.drawImage(image, 0, sh - 1, 1, 1, x, y + g + t, g, g);
  ctx.drawImage(image, sw - 1, sh - 1, 1, 1, x + g + t, y + g + t, g, g);
}

export async function buildPictureAtlas(faces: PictureFaces): Promise<THREE.CanvasTexture> {
  const cell = ATLAS_TILE + ATLAS_GUTTER * 2;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * cell;
  canvas.height = ATLAS_ROWS * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  await Promise.all(PICTURE_FACE_ORDER.map(async (face) => {
    if (!faces[face]) return;
    const [x, y] = FACE_CELL[face];
    await drawAtlasFace(ctx, faces[face], x, y);
  }));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export interface PictureSlotAttributes {
  centers: THREE.InstancedBufferAttribute;
  directions: THREE.InstancedBufferAttribute;
  enabled: THREE.InstancedBufferAttribute;
  faces: PictureFace[];
}

/** Stable per-instance atlas centres. Slots are bound to HOME stickers, so these
 * attributes automatically travel with the physical pieces through every turn. */
export function buildPictureSlotAttributes(
  slots: readonly { cubeletInitial: number; face: number }[],
  order: number,
): PictureSlotAttributes {
  const centers = new Float32Array(slots.length * 2);
  const directions = new Float32Array(slots.length * 2);
  const enabled = new Float32Array(slots.length);
  const faces = new Array<PictureFace>(slots.length);
  const cell = ATLAS_TILE + ATLAS_GUTTER * 2;
  const atlasW = ATLAS_COLS * cell;
  const atlasH = ATLAS_ROWS * cell;
  for (let i = 0; i < slots.length; i++) {
    const sid = engineHomeSid(slots[i].cubeletInitial, slots[i].face, order);
    const face = sid[0] as PictureFace;
    const index = Number(sid.slice(1));
    const row = Math.floor(index / order);
    const col = index % order;
    const [cellX, cellY] = FACE_CELL[face];
    centers[i * 2] = (cellX * cell + ATLAS_GUTTER + ((col + 0.5) / order) * ATLAS_TILE) / atlasW;
    centers[i * 2 + 1] = 1 - (
      cellY * cell + ATLAS_GUTTER + ((row + 0.5) / order) * ATLAS_TILE
    ) / atlasH;
    // The B sticker plane is produced by rotating the shared geometry 180deg
    // around X. Its local +x/+y therefore point opposite to the canonical net
    // right/up basis; flip both axes so neighbouring artwork tiles stay joined.
    directions[i * 2] = face === 'B' ? -1 : 1;
    directions[i * 2 + 1] = face === 'B' ? -1 : 1;
    faces[i] = face;
  }
  return {
    centers: new THREE.InstancedBufferAttribute(centers, 2),
    directions: new THREE.InstancedBufferAttribute(directions, 2),
    enabled: new THREE.InstancedBufferAttribute(enabled, 1),
    faces,
  };
}

export interface PictureUniforms {
  atlas: { value: THREE.Texture };
  scale: { value: THREE.Vector2 };
}

/** Compose after stickerOutline: the picture replaces the normal face colour first,
 * then the existing outline shader may draw its marker on top. */
export function injectPictureCube(mats: readonly StickerMaterial[], order: number): PictureUniformController {
  const white = new Uint8Array([255, 255, 255, 255]);
  const fallback = new THREE.DataTexture(white, 1, 1);
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  const atlas = { value: fallback as THREE.Texture };
  const scale = { value: new THREE.Vector2() };
  const updateScale = (stickerScale: number) => {
    const cell = ATLAS_TILE + ATLAS_GUTTER * 2;
    scale.value.set(
      ATLAS_TILE / (ATLAS_COLS * cell * order * STICKER_INNER * stickerScale),
      ATLAS_TILE / (ATLAS_ROWS * cell * order * STICKER_INNER * stickerScale),
    );
  };
  updateScale(1);
  for (const mat of mats) {
    const previousCompile = mat.onBeforeCompile;
    const previousKey = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer);
      shader.uniforms.uPictureAtlas = atlas;
      shader.uniforms.uPictureScale = scale;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec2 aPictureCenter;
          attribute vec2 aPictureDirection;
          attribute float aPictureOn;
          uniform vec2 uPictureScale;
          varying vec2 vPictureUv;
          varying float vPictureOn;
          varying float vPictureFront;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vPictureUv = aPictureCenter + position.xy * aPictureDirection * uPictureScale;
          vPictureOn = aPictureOn;
          vPictureFront = normal.z;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uPictureAtlas;
          varying vec2 vPictureUv;
          varying float vPictureOn;
          varying float vPictureFront;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (vPictureOn > 0.5 && vPictureFront > 0.5) {
            diffuseColor.rgb = texture2D(uPictureAtlas, vPictureUv).rgb;
          }`,
        );
    };
    mat.customProgramCacheKey = () => `${previousKey()}|picture-cube`;
  }
  return Object.assign({ atlas, scale }, { updateScale });
}

export type PictureUniformController = PictureUniforms & { updateScale: (stickerScale: number) => void };

export interface PictureFacelet {
  face: PictureFace;
  index: number;
  rotation: 0 | 90 | 180 | 270;
}

const NET_ORIGIN: Record<PictureFace, readonly [number, number]> = {
  U: [1, 0], R: [2, 1], F: [1, 1],
  D: [1, 2], L: [0, 1], B: [3, 1],
};

function escapeSvgAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (char) => ({
    '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;',
  })[char] ?? char);
}

/** Standalone unfolded SVG used by the image studio. Artwork is defined once per
 * face, then each physical sticker crops its HOME tile and carries its rotation. */
export function renderPictureCubeNetSvg(options: {
  order: number;
  facelets: readonly PictureFacelet[];
  faces: PictureFaces;
  faceColors: Record<PictureFace, string>;
  bodyColor: string;
  stickerOpacity?: number;
  stickering?: ArrayLike<number>;
}): string {
  const {
    order, facelets, faces, faceColors, bodyColor,
    stickerOpacity = 100, stickering,
  } = options;
  const opacity = Math.max(0, Math.min(100, stickerOpacity)) / 100;
  const defs = PICTURE_FACE_ORDER
    .filter((face) => faces[face])
    .map((face) => `<image id="picture-source-${face}" href="${escapeSvgAttribute(faces[face])}" width="${order}" height="${order}" preserveAspectRatio="none"/>`)
    .join('');
  const cells: string[] = [];
  const faceArea = order * order;
  for (let displayIndex = 0; displayIndex < PICTURE_FACE_ORDER.length; displayIndex++) {
    const displayFace = PICTURE_FACE_ORDER[displayIndex];
    const [faceX, faceY] = NET_ORIGIN[displayFace];
    for (let localIndex = 0; localIndex < faceArea; localIndex++) {
      const tile = facelets[displayIndex * faceArea + localIndex];
      if (!tile) continue;
      const row = Math.floor(localIndex / order);
      const col = localIndex % order;
      const sourceRow = Math.floor(tile.index / order);
      const sourceCol = tile.index % order;
      const x = faceX * order + col;
      const y = faceY * order + row;
      const cx = x + 0.5;
      const cy = y + 0.5;
      const source = faces[tile.face];
      const code = (stickering?.[displayIndex * faceArea + localIndex] ?? FM_REGULAR) as FaceletMask;
      const showPicture = code === FM_REGULAR || code === FM_OUTLINE;
      cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${escapeSvgAttribute(bodyColor)}"/>`);
      if (source && showPicture) {
        const transform = tile.rotation ? ` transform="rotate(${tile.rotation} ${cx} ${cy})"` : '';
        cells.push(`<g${transform} opacity="${opacity}"><svg x="${x}" y="${y}" width="1" height="1" viewBox="${sourceCol} ${sourceRow} 1 1" preserveAspectRatio="none" overflow="hidden"><use href="#picture-source-${tile.face}"/></svg></g>`);
      } else {
        const fill = faceletDisplayColor(code, faceColors[tile.face]);
        cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${escapeSvgAttribute(fill)}" opacity="${opacity}"/>`);
      }
      if (code === FM_OUTLINE) {
        cells.push(`<rect x="${x + 0.1}" y="${y + 0.1}" width="0.8" height="0.8" fill="none" stroke="${escapeSvgAttribute(OUTLINE_DEFAULT)}" stroke-width="0.08"/>`);
      }
      cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="none" stroke="${escapeSvgAttribute(bodyColor)}" stroke-width="0.06"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${4 * order} ${3 * order}" role="img"><defs>${defs}</defs>${cells.join('')}</svg>`;
}
