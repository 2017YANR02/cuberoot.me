import { Axis } from './../math'
import { Arrow } from './models/arrow'
import { Masking } from './constants'
import { FaceletDefinition } from '../constants'

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
  mask?: Masking
  maskAlg?: string
  arrows?: Arrow[] | string
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
