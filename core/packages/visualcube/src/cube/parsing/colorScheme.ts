import { ColorCode } from './../../colors.js'
import { ICubeColorScheme } from '../models/color-scheme.js'
import { parseColor } from './color.js'
import { ColorNameToCode, ColorAbbreviationToCode } from '../../constants.js'
import { AllFaces, DefaultColorScheme } from '../constants.js'
import { expandRepeats } from './repeatExpand.js'

export function parseColorScheme(rawValue: string): ICubeColorScheme {
  if (rawValue.indexOf(',') > -1) {
    return parseCommaSeparatedValues(rawValue)
  } else {
    // PHP V0.6.5 repeat-count pre-pass: y6 -> 6 y's
    return parseAbbreviations(expandRepeats(rawValue))
  }
}

function parseAbbreviations(rawValue: string): ICubeColorScheme {
  let scheme: ICubeColorScheme = {}
  if (rawValue.length < AllFaces.length) {
    return DefaultColorScheme
  }

  AllFaces.forEach((face, index) => {
    if (rawValue.length > index) {
      scheme[face] = ColorAbbreviationToCode[rawValue.charAt(index)]
    }
  })

  return scheme
}

function parseCommaSeparatedValues(rawValue: string): ICubeColorScheme {
  let scheme: ICubeColorScheme = {}

  // Parse as comma separated list of colors
  let rawColors = rawValue.split(',')
  if (rawColors.length < AllFaces.length) {
    return DefaultColorScheme
  }
  AllFaces.forEach((face, index) => {
    if (rawColors.length > index) {
      let parsedColor = parseColor(rawColors[index])
      let colorCode: ColorCode = ColorNameToCode[parsedColor] || (parsedColor as ColorCode)
      if (parsedColor) {
        scheme[face] = colorCode
      }
    }
  })

  return scheme
}
