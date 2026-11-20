import { ColorName } from './colors.js'
import { makeCubeGeometry } from './cube/geometry.js'
import { Axis } from './math.js'
import { renderCubeSVG as renderCubeSVGInternal } from './cube/drawing.js'
import type { ICubeOptions, ResolvedCubeOptions } from './cube/options.js'
import { DefaultColorScheme } from './cube/constants.js'
import { makeStickerColors } from './cube/stickers.js'
import { parseOptions } from './cube/parsing/options.js'
import { parseFaceletDefinitions } from './cube/parsing/faceletDefinitions.js'

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
 * Use this for SSR, data-URI inlining, or anywhere you need the SVG string.
 */
export function renderCubeSVG(extraOptions?: ICubeOptions): string {
  const options = resolveCubeOptions(extraOptions)
  const geometry = makeCubeGeometry(options)
  options.stickerColors = makeStickerColors(options)
  return renderCubeSVGInternal(geometry, options)
}

export function resolveCubeOptions(extraOptions: string | ICubeOptions = {}): ResolvedCubeOptions {
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
