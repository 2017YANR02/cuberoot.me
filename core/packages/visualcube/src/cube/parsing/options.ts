import { ICubeOptions } from '../options.js'
import { Masking } from '../constants.js'
import type { PlanSideRule, PlanUpRule } from '../plan-simplify.js'
import { parseRotationSequence } from './rotation.js'
import { parseFaceletColors } from './faceletColors.js'
import { parseColorScheme } from './colorScheme.js'
import { parseFaceletDefinitions } from './faceletDefinitions.js'
import { parseColor } from './color.js'

/**
 * Utility methods for parsing the old query param style options
 */

export function parseOptions(rawOptions: string): ICubeOptions {
  let options: ICubeOptions = {} as any
  let params = parseQuery(rawOptions)

  Object.keys(params).forEach(key => {
    let paramValue = params[key]
    switch (key) {
      case 'pzl':
        options.cubeSize = parseInt(paramValue) || 3
        break
      case 'size':
        let size = parseInt(paramValue) || 250
        options.width = size
        options.height = size
        break
      case 'view':
        options.view = paramValue
        break
      case 'stage':
        options.mask = paramValue as Masking
        break
      case 'ngs':
        // "no grey sides" — plan view drops the masked side-rim stickers. Not a PHP
        // param; ours. `ngs=0` stays off so an explicit falsy value reads naturally.
        options.hideGreySides = paramValue !== '0' && paramValue !== ''
        break
      // Plan-view recognition simplification (cube/plan-simplify.ts). All ours.
      case 'psr':
        options.planSimplify = { ...options.planSimplify, side: paramValue as PlanSideRule }
        break
      case 'pur':
        options.planSimplify = { ...options.planSimplify, up: paramValue as PlanUpRule }
        break
      case 'psy':
        options.planSimplify = {
          ...options.planSimplify,
          showYellow: paramValue !== '0' && paramValue !== '',
        }
        break
      case 'pfs':
        options.planSimplify = { ...options.planSimplify, forceShow: paramValue }
        break
      case 'pfh':
        options.planSimplify = { ...options.planSimplify, forceHide: paramValue }
        break
      case 'r':
        options.viewportRotations = parseRotationSequence(paramValue)
        break
      case 'alg':
        options.algorithm = paramValue
        break
      case 'case':
        options.case = paramValue
        break
      case 'fc':
        options.stickerColors = parseFaceletColors(paramValue)
        break
      case 'sch':
        options.colorScheme = parseColorScheme(paramValue)
        break
      case 'bg':
        options.backgroundColor = paramValue
        break
      case 'cc':
        options.cubeColor = paramValue
        break
      case 'co':
        options.cubeOpacity = parseInt(paramValue) || 100
        break
      case 'fo':
        options.stickerOpacity = parseInt(paramValue) || 100
        break
      case 'dist':
        options.dist = parseInt(paramValue) || 5
        break
      case 'arw':
        options.arrows = paramValue
        break
      case 'fd':
        options.facelets = parseFaceletDefinitions(paramValue)
        break
      case 'ac': {
        // PHP fcs index.php ~1029: default arrow color, ignored when value parses as transparent ('t').
        const parsed = parseColor(paramValue)
        if (parsed && paramValue !== 't') {
          options.defaultArrowColor = parsed
        }
        break
      }
    }
  })

  // PHP visualcube `view=trans` is a preset (cc=silver, co=50). Explicit
  // cc/co in the query still win — see _php_reference/index.php:356/365.
  // Strip the view value because our renderer only recognises 'plan'.
  if (params.view === 'trans') {
    if (options.cubeColor === undefined) options.cubeColor = 'silver'
    if (options.cubeOpacity === undefined) options.cubeOpacity = 50
    options.view = undefined
  }

  return options
}

function parseQuery(url: string): { [key: string]: string } {
  let queryString = url.indexOf('?') > -1 ? url.substr(url.indexOf('?') + 1) : url
  var query: { [key: string]: string } = {}
  var pairs = queryString.split('&')
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=')
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '')
  }
  return query
}
