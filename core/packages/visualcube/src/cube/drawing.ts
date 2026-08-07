import { ColorCode, ColorName } from './../colors.js'
import { FaceletToFace, FaceletDefinition, FaceletToColor } from './../constants.js'
import { CubeGeometry, FaceStickers, FaceRotations, rotateFaces } from './geometry.js'
import { Vec3, transScale, scale, translate, radians2Degrees } from '../math.js'
import { Face, AllFaces } from './constants.js'
import { ResolvedCubeOptions } from './options.js'
import {
  planSimplifyActive,
  resolvePlanVisibility,
  type PlanSimplifyOptions,
  type PlanVisibility,
} from './plan-simplify.js'
import { Arrow } from './models/arrow.js'
import { parseArrows } from './parsing/arrow.js'

/**
 * Utility methods for rendering cube geometry as native SVG strings.
 *
 * Pure-string output: no DOM, no svg.js. Safe to call from Node (SSR).
 * `renderCubeSVG(opts)` returns a complete `<svg>...</svg>` document.
 * `renderCube(container, geometry, options)` is a thin DOM shim that
 * sets `container.innerHTML` to the rendered string (kept for backwards
 * compatibility with the original imperative API).
 */

// Rotation vectors to track visibility of each face
const defaultFaceRotations: FaceRotations = {
  [Face.U]: [0, -1, 0],
  [Face.R]: [1, 0, 0],
  [Face.F]: [0, 0, -1],
  [Face.D]: [0, 1, 0],
  [Face.L]: [-1, 0, 0],
  [Face.B]: [0, 0, 1],
}

// Minimal attribute escaper. Internal inputs are mostly hex / numbers,
// but be defensive against user-provided color strings.
function attr(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/**
 * Render a complete SVG document for the given cube options.
 * Pure function — no DOM access.
 */
export function renderCubeSVG(geometry: CubeGeometry, options: ResolvedCubeOptions): string {
  if (options.view === 'q2look') return renderQ2LookSVG(options)
  if (options.view === 'qlast') return renderQLastSVG(options)
  if (options.view === 'qcube') return renderQCubeSVG(options)

  const faceRotations = rotateFaces(defaultFaceRotations, options.viewportRotations)
  const renderOrder = getRenderOrder(faceRotations)

  const hiddenFaces = renderOrder.filter(face => !faceVisible(face, faceRotations))
  const visibleFaces = renderOrder.filter(face => faceVisible(face, faceRotations))

  // Plan-view simplification. `null` unless a knob asked for it → untouched renders
  // stay byte-identical to the pre-feature output.
  const planVisibility = planVisibilityOf(options)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${attr(options.width)}" height="${attr(options.height)}" ` +
      `viewBox="${attr(options.viewbox.x)} ${attr(options.viewbox.y)} ${attr(options.viewbox.width)} ${attr(options.viewbox.height)}">`
  )

  parts.push(renderBackground(options))

  // Render hidden faces if cube color has transparency
  if (options.cubeOpacity < 100) {
    const outlines: string[] = []
    hiddenFaces.forEach(face => {
      parts.push(renderFaceStickers(face, geometry[face], options))
      outlines.push(renderCubeOutline(geometry[face], options))
    })
    parts.push(wrapCubeOutlineGroup(outlines.join(''), options))
  }

  const visibleOutlines: string[] = []
  const visibleStickers: string[] = []
  visibleFaces.forEach(face => {
    visibleOutlines.push(renderCubeOutline(geometry[face], options))
    // Only the U face has a plan-view "up" rule; every other face renders normally.
    const upMask = planVisibility && face === Face.U ? planVisibility.up : undefined
    visibleStickers.push(renderFaceStickers(face, geometry[face], options, upMask))
  })
  // svg.js originally created the outline group lazily, then appended
  // outlines and stickers in interleaved order per visible face. The
  // resulting Z-order is: all outlines (in one group) below all stickers,
  // because the outline group was created first. Preserve that.
  parts.push(wrapCubeOutlineGroup(visibleOutlines.join(''), options))
  parts.push(visibleStickers.join(''))

  if (options.view === 'plan') {
    const ollPieces: string[] = []
    ;[Face.R, Face.F, Face.L, Face.B].forEach(face => {
      ollPieces.push(renderOLLStickers(face, geometry[face], faceRotations, options, planVisibility))
    })
    parts.push(wrapOllLayerGroup(ollPieces.join(''), options))
  }

  let arrowDefinitions: Arrow[] = []
  if (Array.isArray(options.arrows)) {
    arrowDefinitions = options.arrows
  } else if (typeof options.arrows === 'string') {
    arrowDefinitions = parseArrows(options.arrows)
  }

  if (arrowDefinitions.length > 0) {
    const arrowPieces: string[] = []
    arrowDefinitions.forEach(arrow => {
      arrowPieces.push(renderArrow(geometry, arrow, options.defaultArrowColor))
    })
    parts.push(wrapArrowGroup(arrowPieces.join(''), geometry[0].length - 1))
  }

  parts.push(`</svg>`)
  return parts.join('')
}

interface FlatSticker {
  face: Face
  row: number
  col: number
  x: number
  y: number
  width?: number
  height?: number
}

interface FlatBlock {
  x: number
  y: number
  width: number
  height: number
}

/** Shared SVG pipeline for csTimer's qCube, qLast, and q2Look projections. */
function renderFlatCubeSVG(
  options: ResolvedCubeOptions,
  contentWidth: number,
  contentHeight: number,
  blocks: FlatBlock[],
  cells: FlatSticker[],
): string {
  const inset = 0.07
  const pad = 0.1
  const viewBox = {
    x: -pad,
    y: -pad,
    width: contentWidth + pad * 2,
    height: contentHeight + pad * 2,
  }
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${attr(options.width)}" height="${attr(options.height)}" ` +
      `viewBox="${attr(viewBox.x)} ${attr(viewBox.y)} ${attr(viewBox.width)} ${attr(viewBox.height)}">`,
    options.backgroundColor
      ? `<rect x="${attr(viewBox.x)}" y="${attr(viewBox.y)}" width="${attr(viewBox.width)}" height="${attr(viewBox.height)}" fill="${attr(options.backgroundColor)}"/>`
      : `<rect x="${attr(viewBox.x)}" y="${attr(viewBox.y)}" width="${attr(viewBox.width)}" height="${attr(viewBox.height)}" fill="none" opacity="0"/>`,
    `<g opacity="${attr(options.cubeOpacity / 100)}" fill="${attr(options.cubeColor)}">` +
      blocks.map(block =>
        `<rect x="${attr(block.x)}" y="${attr(block.y)}" width="${attr(block.width)}" height="${attr(block.height)}"/>`
      ).join('') +
      `</g>`,
  ]

  const stickers: string[] = []
  cells.forEach(cell => {
    const color = getStickerColor(cell.face, cell.row, cell.col, options)
    if (color === ColorName.Transparent) return
    const width = cell.width ?? 1
    const height = cell.height ?? 1
    const p1: Vec3 = [cell.x + inset, cell.y + inset, 0]
    const p2: Vec3 = [cell.x + width - inset, cell.y + inset, 0]
    const p3: Vec3 = [cell.x + width - inset, cell.y + height - inset, 0]
    const p4: Vec3 = [cell.x + inset, cell.y + height - inset, 0]
    stickers.push(renderSticker(p1, p2, p3, p4, color, options.cubeColor))
  })

  parts.push(
    `<g opacity="${attr(options.stickerOpacity / 100)}" stroke-opacity="0.5" ` +
      `stroke-width="${attr(options.strokeWidth)}" stroke-linejoin="round">${stickers.join('')}</g>`,
    `</svg>`,
  )
  return parts.join('')
}

/** Complete U face, top two F rows, and R top row folded into a side strip. */
function renderQ2LookSVG(options: ResolvedCubeOptions): string {
  const n = options.cubeSize
  const frontRows = Math.min(2, n)
  const gap = 0.12
  const cells: FlatSticker[] = []

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) cells.push({ face: Face.U, row, col, x: col, y: row })
  }
  for (let row = 0; row < frontRows; row++) {
    for (let col = 0; col < n; col++) cells.push({ face: Face.F, row, col, x: col, y: n + gap + row })
  }
  for (let pos = 0; pos < n; pos++) {
    cells.push({ face: Face.R, row: 0, col: n - 1 - pos, x: n + gap, y: pos })
  }

  return renderFlatCubeSVG(
    options,
    n + 1 + gap,
    n + frontRows + gap,
    [
      { x: 0, y: 0, width: n, height: n },
      { x: 0, y: n + gap, width: n, height: frontRows },
      { x: n + gap, y: 0, width: 1, height: n },
    ],
    cells,
  )
}

/** qLast adds L and B rim strips around q2Look for full last-layer recognition. */
function renderQLastSVG(options: ResolvedCubeOptions): string {
  const n = options.cubeSize
  const frontRows = Math.min(2, n)
  const gap = 0.12
  const offset = 1 + gap
  const cells: FlatSticker[] = []

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      cells.push({ face: Face.U, row, col, x: offset + col, y: offset + row })
      if (row < frontRows) {
        cells.push({ face: Face.F, row, col, x: offset + col, y: offset + n + gap + row })
      }
    }
  }
  for (let pos = 0; pos < n; pos++) {
    // Standard URFDLB orientation around U: B is above (reversed), L is left
    // (natural top-row order), R is right (reversed), and F is below.
    cells.push({ face: Face.B, row: 0, col: n - 1 - pos, x: offset + pos, y: 0 })
    cells.push({ face: Face.L, row: 0, col: pos, x: 0, y: offset + pos })
    cells.push({ face: Face.R, row: 0, col: n - 1 - pos, x: offset + n + gap, y: offset + pos })
  }

  return renderFlatCubeSVG(
    options,
    n + 2 + gap * 2,
    n + frontRows + 1 + gap * 2,
    [
      { x: offset, y: 0, width: n, height: 1 },
      { x: 0, y: offset, width: 1, height: n },
      { x: offset, y: offset, width: n, height: n },
      { x: offset + n + gap, y: offset, width: 1, height: n },
      { x: offset, y: offset + n + gap, width: n, height: frontRows },
    ],
    cells,
  )
}

/** qCube stacks complete U and F faces, with L/R folded into side strips. */
function renderQCubeSVG(options: ResolvedCubeOptions): string {
  const n = options.cubeSize
  const gap = 0.12
  const mainX = 1 + gap
  const frontY = n + gap
  const rightX = mainX + n + gap
  const cells: FlatSticker[] = []

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      cells.push({ face: Face.U, row, col, x: mainX + col, y: row })
      cells.push({ face: Face.F, row, col, x: mainX + col, y: frontY + row })
    }
  }
  for (let pos = 0; pos < n - 1; pos++) {
    // L's top row runs back → front beside U's left edge; R runs back → front
    // only after reversal. This is URFDLB orientation, not csTimer's internal
    // DLBURF storage orientation.
    cells.push({ face: Face.L, row: 0, col: pos, x: 0, y: pos })
    cells.push({ face: Face.R, row: 0, col: n - 1 - pos, x: rightX, y: pos })
  }
  cells.push({ face: Face.L, row: 0, col: n - 1, x: 0, y: n - 1, height: 2 + gap })
  cells.push({ face: Face.R, row: 0, col: 0, x: rightX, y: n - 1, height: 2 + gap })
  for (let row = 1; row < n; row++) {
    cells.push({ face: Face.L, row, col: n - 1, x: 0, y: frontY + row })
    cells.push({ face: Face.R, row, col: 0, x: rightX, y: frontY + row })
  }

  return renderFlatCubeSVG(
    options,
    n + 2 + gap * 2,
    n * 2 + gap,
    [
      { x: 0, y: 0, width: 1, height: n * 2 + gap },
      { x: mainX, y: 0, width: n, height: n },
      { x: mainX, y: frontY, width: n, height: n },
      { x: rightX, y: 0, width: 1, height: n * 2 + gap },
    ],
    cells,
  )
}

/**
 * Backwards-compatible imperative API. Mounts rendered SVG into a DOM
 * container. Use `renderCubeSVG` directly for SSR / pure-string output.
 */
export function renderCube(container: HTMLElement | string, geometry: CubeGeometry, options: ResolvedCubeOptions) {
  const el = typeof container === 'string' ? (document.querySelector(container) as HTMLElement) : container
  if (!el) return
  el.innerHTML = renderCubeSVG(geometry, options)
}

/**
 * Determines face render order based on z position. Faces further away
 * will render first so anything closer will be drawn on top.
 */
function getRenderOrder(faceRotations: FaceRotations): Face[] {
  let renderOrder = [...AllFaces].sort((a: Face, b: Face) => {
    return faceRotations[b][2] - faceRotations[a][2]
  })
  return renderOrder
}

function renderBackground(options: ResolvedCubeOptions): string {
  const { x, y, width, height } = options.viewbox
  if (!options.backgroundColor) {
    return `<rect x="${attr(x)}" y="${attr(y)}" width="${attr(width)}" height="${attr(height)}" fill="none" opacity="0"/>`
  }
  return `<rect x="${attr(x)}" y="${attr(y)}" width="${attr(width)}" height="${attr(height)}" fill="${attr(options.backgroundColor)}"/>`
}

function faceVisible(face: Face, rotations: FaceRotations) {
  return rotations[face][2] < -0.105
}

function wrapCubeOutlineGroup(inner: string, options: ResolvedCubeOptions): string {
  return (
    `<g opacity="${attr(options.cubeOpacity / 100)}" stroke-width="0.1" stroke-linejoin="round">` +
    inner +
    `</g>`
  )
}

function wrapOllLayerGroup(inner: string, options: ResolvedCubeOptions): string {
  return (
    `<g opacity="${attr(options.stickerOpacity / 100)}" stroke-opacity="1" stroke-width="0.02" stroke-linejoin="round">` +
    inner +
    `</g>`
  )
}

function wrapArrowGroup(inner: string, cubeSize: number): string {
  return (
    `<g opacity="1" stroke-opacity="1" stroke-width="${attr(0.12 / cubeSize)}" stroke-linecap="round">` +
    inner +
    `</g>`
  )
}

function pointsAttr(points: number[][]): string {
  // svg.js polygon serialises [[x,y], ...] as "x,y x,y ..."
  return points.map(p => `${p[0]},${p[1]}`).join(' ')
}

function renderCubeOutline(face: FaceStickers, options: ResolvedCubeOptions): string {
  const cubeSize = face.length - 1
  const width = options.outlineWidth
  const outlinePoints = [
    [face[0][0][0] * width, face[0][0][1] * width],
    [face[cubeSize][0][0] * width, face[cubeSize][0][1] * width],
    [face[cubeSize][cubeSize][0] * width, face[cubeSize][cubeSize][1] * width],
    [face[0][cubeSize][0] * width, face[0][cubeSize][1] * width],
  ]
  return `<polygon points="${pointsAttr(outlinePoints)}" fill="${attr(options.cubeColor)}" stroke="${attr(options.cubeColor)}"/>`
}

function renderFaceStickers(
  face: Face,
  stickers: FaceStickers,
  options: ResolvedCubeOptions,
  /** Plan-view U-face rule: per row-major position, false = omit the polygon. */
  visible?: boolean[]
): string {
  const cubeSize = stickers.length - 1
  const inner: string[] = []

  for (let i = 0; i < cubeSize; i++) {
    for (let j = 0; j < cubeSize; j++) {
      if (visible && !visible[i * cubeSize + j]) continue
      const centerPoint: Vec3 = [
        (stickers[j][i][0] + stickers[j + 1][i + 1][0]) / 2,
        (stickers[j][i][1] + stickers[j + 1][i + 1][1]) / 2,
        0,
      ]

      // Scale points in towards centre
      const p1 = transScale(stickers[j][i], centerPoint, 0.85)
      const p2 = transScale(stickers[j + 1][i], centerPoint, 0.85)
      const p3 = transScale(stickers[j + 1][i + 1], centerPoint, 0.85)
      const p4 = transScale(stickers[j][i + 1], centerPoint, 0.85)

      const color = getStickerColor(face, i, j, options)
      if (color !== ColorName.Transparent) {
        inner.push(renderSticker(p1, p2, p3, p4, color, options.cubeColor))
      }
    }
  }

  return (
    `<g opacity="${attr(options.stickerOpacity / 100)}" stroke-opacity="0.5" stroke-width="${attr(options.strokeWidth)}" stroke-linejoin="round">` +
    inner.join('') +
    `</g>`
  )
}

function renderSticker(
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  p4: Vec3,
  stickerColor: string,
  cubeColor: string
): string {
  const stickerPoints = [[p1[0], p1[1]], [p2[0], p2[1]], [p3[0], p3[1]], [p4[0], p4[1]]]
  return `<polygon points="${pointsAttr(stickerPoints)}" fill="${attr(stickerColor)}" stroke="${attr(cubeColor)}"/>`
}

/**
 * Starting with U, stickers are numbered from
 * their face starting with the top left corner
 * sticker.
 *
 * U Face
 * 1 | 2 | 3
 * ----------
 * 4 | 5 | 6
 * ----------
 * 7 | 8 | 9
 *
 * And so on for faces R, F, D, L, B.
 * So R's top left corner for a 3x3 cube would be # 10
 *
 * An individual sticker's color is obtained by indexing
 * into the array of sticker colors by the number the sticker is
 */
function getStickerColor(face: Face, row: number, col: number, options: ResolvedCubeOptions): string {
  const faceIndex = AllFaces.indexOf(face)
  const stickerNumber = row * options.cubeSize + col
  const colorIndex = faceIndex * (options.cubeSize * options.cubeSize) + stickerNumber

  if (!Array.isArray(options.facelets) && Array.isArray(options.stickerColors)) {
    if (options.stickerColors.length <= colorIndex) {
      return ColorName.Black
    }

    return options.stickerColors[colorIndex]
  } else if (Array.isArray(options.facelets)) {
    if (options.facelets.length <= colorIndex) {
      return ColorCode.DarkGray
    }

    let fd = options.facelets[colorIndex]
    if (FaceletToFace[fd] != null) {
      const face = FaceletToFace[fd]
      return options.colorScheme[face]
    }

    return FaceletToColor[fd] || ColorCode.DarkGray
  } else {
    return options.colorScheme[face] || ColorName.Black
  }
}

/**
 * The plan-view simplify knobs, as one option object. `hideGreySides` is the
 * shorthand for the common case, so both spellings run the SAME pipeline — there is
 * no second implementation to drift.
 */
function planSimplifyOf(options: ResolvedCubeOptions): PlanSimplifyOptions | undefined {
  const explicit = options.planSimplify
  if (!options.hideGreySides) return planSimplifyActive(explicit) ? explicit : undefined
  return { ...(explicit ?? {}), hideGrey: true }
}

/**
 * Which plan stickers survive, or `null` when nothing is asked for (in which case the
 * renderer takes its original path and emits byte-identical output).
 */
function planVisibilityOf(options: ResolvedCubeOptions): PlanVisibility | null {
  if (options.view !== 'plan') return null
  const simplify = planSimplifyOf(options)
  if (!simplify) return null
  // `makeStickerColors` already ran, so options.stickerColors is the final painted
  // state — masks applied, algorithm applied. That is what the rules must read.
  const colors = Array.isArray(options.stickerColors) ? options.stickerColors : null
  if (!colors) return null
  return resolvePlanVisibility({
    stickerColors: colors,
    cubeSize: options.cubeSize,
    colorScheme: options.colorScheme,
    maskColor: typeof options.maskColor === 'string' ? options.maskColor : ColorCode.DarkGray,
    options: simplify,
  })
}

/** rim draw position (face, column) → 1-based ring index. Inverse of ringStickerIndex. */
function ringIndexOf(face: Face, col: number, cubeSize: number): number {
  const strip = [Face.B, Face.R, Face.F, Face.L].indexOf(face)
  return strip * cubeSize + (cubeSize - 1 - col) + 1
}

// Renders the top rim of the R U L and B faces out from side of cube
export function renderOLLStickers(
  face: Face,
  stickers: FaceStickers,
  rotations: FaceRotations,
  options: ResolvedCubeOptions,
  visibility?: PlanVisibility | null
): string {
  // Translation vector, to move faces out
  const v1 = scale(rotations[face], 0)
  const v2 = scale(rotations[face], 0.2)
  const inner: string[] = []
  for (let i = 0; i < options.cubeSize; i++) {
    // find center point of sticker
    const centerPoint: Vec3 = [
      (stickers[i][0][0] + stickers[i + 1][1][0]) / 2,
      (stickers[i][0][1] + stickers[i + 1][1][1]) / 2,
      0,
    ]
    const p1 = translate(transScale(stickers[i][0], centerPoint, 0.94), v1)
    const p2 = translate(transScale(stickers[i + 1][0], centerPoint, 0.94), v1)
    const p3 = translate(transScale(stickers[i + 1][1], centerPoint, 0.94), v2)
    const p4 = translate(transScale(stickers[i][1], centerPoint, 0.94), v2)

    const stickerColor = getStickerColor(face, 0, i, options)

    if (stickerColor === ColorName.Transparent) continue
    // Simplification omits a rim sticker ENTIRELY — no polygon at all, not a
    // transparent one. `visibility` is null unless a knob asked for it, so the
    // untouched path stays byte-identical.
    if (visibility && !visibility.side[ringIndexOf(face, i, options.cubeSize) - 1]) continue

    inner.push(renderSticker(p1, p2, p3, p4, stickerColor, options.cubeColor))
  }
  return inner.join('')
}

/**
 * Generates SVG markup for an arrow pointing from sticker s1 to s2.
 */
export function renderArrow(geometry: CubeGeometry, arrow: Arrow, defaultColor?: string): string {
  const cubeSize = geometry[0].length - 1
  const color = arrow.color ?? defaultColor ?? ColorCode.Gray

  // Find center point for each facelet
  const p1y = Math.floor(arrow.s1.n / cubeSize)
  const p1x = arrow.s1.n % cubeSize
  let p1: Vec3 = [
    (geometry[arrow.s1.face][p1x][p1y][0] + geometry[arrow.s1.face][p1x + 1][p1y + 1][0]) / 2,
    (geometry[arrow.s1.face][p1x][p1y][1] + geometry[arrow.s1.face][p1x + 1][p1y + 1][1]) / 2,
    0,
  ]

  const p2y = Math.floor(arrow.s2.n / cubeSize)
  const p2x = arrow.s2.n % cubeSize
  let p2: Vec3 = [
    (geometry[arrow.s1.face][p2x][p2y][0] + geometry[arrow.s1.face][p2x + 1][p2y + 1][0]) / 2,
    (geometry[arrow.s1.face][p2x][p2y][1] + geometry[arrow.s1.face][p2x + 1][p2y + 1][1]) / 2,
    0,
  ]

  // Find midpoint between p1 and p2
  const center: Vec3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0]

  // Shorten arrows towards midpoint according to config
  p1 = transScale(p1, center, arrow.scale / 10)
  p2 = transScale(p2, center, arrow.scale / 10)

  let p3: Vec3 | undefined
  if (arrow.s3) {
    const p3y = Math.floor(arrow.s3.n / cubeSize)
    const p3x = arrow.s3.n % cubeSize
    p3 = [
      (geometry[arrow.s1.face][p3x][p3y][0] + geometry[arrow.s1.face][p3x + 1][p3y + 1][0]) / 2,
      (geometry[arrow.s1.face][p3x][p3y][1] + geometry[arrow.s1.face][p3x + 1][p3y + 1][1]) / 2,
      0,
    ]
    p3 = transScale(p3, center, arrow.influence / 5)
  }

  // Calculate arrow rotation
  const p_ = p3 ? p3 : p1
  let rotation = p_[1] > p2[1] ? 270 : 90
  if (p2[0] - p_[0] != 0) {
    rotation = radians2Degrees(Math.atan((p2[1] - p_[1]) / (p2[0] - p_[0])))
    rotation = p_[0] > p2[0] ? rotation + 180 : rotation
  }

  // Draw line. svg.js .stroke({color, opacity}) emits stroke + stroke-opacity attrs.
  const d = `M ${p1[0]},${p1[1]} ${p3 ? 'Q ' + p3[0] + ',' + p3[1] : 'L'} ${p2[0]},${p2[1]}`
  const linePart = `<path d="${d}" fill="none" stroke="${attr(color)}" stroke-opacity="1"/>`

  // Draw arrow head. svg.js `.style({fill})` writes inline style="fill:...".
  // svg.js `.attr` overrides set stroke-width/stroke-linejoin attributes.
  const headPart =
    `<path d="M 5.77,0.0 L -2.88,5.0 L -2.88,-5.0 L 5.77,0.0 z" ` +
    `transform="translate(${p2[0]},${p2[1]}) scale(${0.033 / cubeSize}) rotate(${rotation})" ` +
    `style="fill:${attr(color)}" stroke-width="0" stroke-linejoin="round"/>`

  return linePart + headPart
}
