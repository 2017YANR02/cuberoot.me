import type { ICubeOptions } from './cube/options.js'
import { renderCubeSVG, resolveCubeOptions } from './render.js'

export { renderCubeSVG } from './render.js'
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
// parseArrows(raw) → Arrow[] {s1,s2,s3,scale,influence,color}. Pure DSL parse
// (`U0U2-red,U6U8`), no rendering; reused by /sim engine schematic export to draw the
// same annotation arrows on the live 3D cube (PLAN-sr-retirement §2b). Same retirement
// lifecycle as makeMasking above.
export { parseArrows, parseArrow } from './cube/parsing/arrow.js'
export type { ICubeOptions } from './cube/options.js'
export { resolvePlanVisibility, planSimplifyActive, ringStickerIndex, parseIndexList } from './cube/plan-simplify.js'
export type { PlanSimplifyOptions, PlanSideRule, PlanUpRule, PlanVisibility } from './cube/plan-simplify.js'
export { renderFromSimpleQuery, buildSimpleOptions } from './preset.js'
export type { SimpleVisualCubeQuery } from './preset.js'
export { CubeData } from './cube/simulation.js'
export { parseAlgorithm, parseCase } from './cube/parsing/algorithm.js'

export function cubeSVG(container: HTMLElement | string, extraOptions?: ICubeOptions) {
  const element = typeof container === 'string' ? document.querySelector(container) : container
  if (element) element.innerHTML = renderCubeSVG(extraOptions)
}

export function cubePNG(container: HTMLElement, extraOptions?: ICubeOptions) {
  if (extraOptions === void 0) {
    extraOptions = {}
  }
  let element = document.createElement('div')
  let options = resolveCubeOptions(extraOptions)
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
