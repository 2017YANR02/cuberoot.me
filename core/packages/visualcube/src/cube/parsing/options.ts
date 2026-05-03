import { ICubeOptions } from '../options'
import { Masking } from '../constants'
import { parseRotationSequence } from './rotation'
import { parseFaceletColors } from './faceletColors'
import { parseColorScheme } from './colorScheme'
import { parseFaceletDefinitions } from './faceletDefinitions'
import { parseColor } from './color'

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
