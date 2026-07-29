import { Axis } from './../math.js'
import { Arrow } from './models/arrow.js'
import { Masking } from './constants.js'
import { FaceletDefinition } from '../constants.js'
import type { PlanSimplifyOptions } from './plan-simplify.js'

export interface ICubeOptions {
  dist?: number
  algorithm?: string
  case?: string
  backgroundColor?: string
  cubeColor?: string
  outlineWidth?: number
  strokeWidth?: number
  cubeSize?: number
  cubeOpacity?: number
  stickerOpacity?: number
  colorScheme?: { [face: number]: string }
  maskColor?: string
  stickerColors?: string[]
  facelets?: string[] | FaceletDefinition[]
  viewportRotations?: [Axis, number][]
  view?: string
  width?: number
  height?: number
  /**
   * `view: 'plan'` only — drop the side-rim ("OLL") stickers that carry the masked
   * fill instead of drawing them grey, so an OLL thumbnail keeps just the coloured
   * bars. Never touches the U face: the rim is drawn by its own pass
   * (`renderOLLStickers`), so the 9 top stickers are byte-identical either way.
   *
   * "Masked fill" = `maskColor` (default DarkGray). A caller that feeds explicit
   * `stickerColors` instead of a `mask` (the /sim plan export pushes engine colours)
   * declares its own grey by setting `maskColor` to it.
   *
   * Shorthand for `planSimplify: { hideGrey: true }` — same pipeline, one flag.
   */
  hideGreySides?: boolean
  /**
   * `view: 'plan'` only — recognition-oriented sticker simplification (auto class
   * rules + explicit show/hide lists). See cube/plan-simplify.ts.
   */
  planSimplify?: PlanSimplifyOptions
  mask?: Masking
  maskAlg?: string
  arrows?: Arrow[] | string
  // Default color for arrows that don't specify one. Mirrors PHP visualcube's `ac=` param.
  defaultArrowColor?: string
  viewbox?: {
    // SVG viewbox settings
    x: number
    y: number
    width: number
    height: number
  }
}

// Internal type used after merging with defaults — fields the renderer relies on
// are guaranteed present. Not part of the public API.
export type ResolvedCubeOptions = ICubeOptions &
  Required<
    Pick<
      ICubeOptions,
      | 'cubeSize'
      | 'width'
      | 'height'
      | 'viewportRotations'
      | 'colorScheme'
      | 'cubeColor'
      | 'cubeOpacity'
      | 'stickerOpacity'
      | 'dist'
      | 'outlineWidth'
      | 'strokeWidth'
      | 'viewbox'
    >
  >
