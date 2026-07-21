import { ColorName } from './colors.js'
import { makeCubeGeometry } from './cube/geometry.js'
import { Axis } from './math.js'
import { renderCube, renderCubeSVG as renderCubeSVGInternal } from './cube/drawing.js'
import { ICubeOptions, ResolvedCubeOptions } from './cube/options.js'
import { DefaultColorScheme } from './cube/constants.js'
import { makeStickerColors } from './cube/stickers.js'
import { parseOptions } from './cube/parsing/options.js'
import { parseFaceletDefinitions } from './cube/parsing/faceletDefinitions.js'

export { Masking, Face, AllFaces } from './cube/constants.js'
// makeMasking(mask, cubeSize) → per-face colored/masked booleans. Pure mask DATA
// (no rendering); reused by /sim engine stickering to offer every visualcube stage
// mask on the live 3D cube (PLAN-sr-retirement §2b). Stays here until visualcube
// is retired, then the data relocates with it.
export { makeMasking } from './cube/masking.js'
export type { FaceValues } from './cube/masking.js'
export { Axis } from './math.js'
export { StickerDefinition } from './cube/models/sticker.js'
export { Arrow } from './cube/models/arrow.js'
export type { ICubeOptions } from './cube/options.js'
export { renderFromSimpleQuery, buildSimpleOptions } from './preset.js'
export type { SimpleVisualCubeQuery } from './preset.js'
export { CubeData } from './cube/simulation.js'
export { parseAlgorithm, parseCase } from './cube/parsing/algorithm.js'

const defaultOptions: ICubeOptions = {
  cubeSize: 3,
  width: 128,
  height: 128,
  viewportRotations: [[Axis.Y, 30], [Axis.X, -30]],
  colorScheme: DefaultColorScheme,
  cubeColor: ColorName.Black,
  cubeOpacity: 100,
  stickerOpacity: 100,
  dist: 5,
  outlineWidth: 0.94,
  strokeWidth: 0,
  viewbox: {
    x: -0.9,
    y: -0.9,
    width: 1.8,
    height: 1.8,
  },
}

/**
 * Pure-string renderer. Returns a complete `<svg>...</svg>` document for
 * the given options. Safe to call from Node — no DOM access.
 *
 * Use this for SSR, data-URI inlining, or anywhere you need the SVG
 * string directly. For the imperative DOM-mounting API, use `cubeSVG`.
 */
export function renderCubeSVG(extraOptions?: ICubeOptions): string {
  const options = getOptions(defaultOptions, extraOptions ?? {})
  const geometry = makeCubeGeometry(options)
  options.stickerColors = makeStickerColors(options)
  return renderCubeSVGInternal(geometry, options)
}

export function cubeSVG(container: HTMLElement | string, extraOptions?: ICubeOptions) {
  if (extraOptions === void 0) {
    extraOptions = {}
  }
  let options = getOptions(defaultOptions, extraOptions)
  let geomety = makeCubeGeometry(options)
  options.stickerColors = makeStickerColors(options)

  renderCube(container, geomety, options)
}

export function cubePNG(container: HTMLElement, extraOptions?: ICubeOptions) {
  if (extraOptions === void 0) {
    extraOptions = {}
  }
  let element = document.createElement('div')
  let options = getOptions(defaultOptions, extraOptions)
  cubeSVG(element, options)

  setTimeout(() => {
    let svgElement = element.querySelector('svg')
    let targetImage = document.createElement('img') // Where to draw the result
    container.appendChild(targetImage)
    let can = document.createElement('canvas') // Not shown on page
    let ctx = can.getContext('2d')
    let loader = new Image() // Not shown on page

    loader.width = can.width = targetImage.width = options.width || 128
    loader.height = can.height = targetImage.height = options.height || 128
    loader.onload = function() {
      ctx!.drawImage(loader, 0, 0, loader.width, loader.height)
      targetImage.src = can.toDataURL()
    }
    var svgAsXML = new XMLSerializer().serializeToString(svgElement!)
    loader.src = 'data:image/svg+xml,' + encodeURIComponent(svgAsXML)
  })
}

function getOptions(defaultOptions: ICubeOptions, extraOptions: string | ICubeOptions): ResolvedCubeOptions {
  let parsedOptions: ICubeOptions
  if (typeof extraOptions === 'string') {
    parsedOptions = parseOptions(extraOptions)
  } else {
    parsedOptions = extraOptions
  }

  if (typeof parsedOptions.facelets === 'string') {
    parsedOptions.facelets = parseFaceletDefinitions(parsedOptions.facelets)
  }

  // defaultOptions populates every required field of ResolvedCubeOptions, so the merge result is fully resolved.
  return { ...defaultOptions, ...parsedOptions } as ResolvedCubeOptions
}
