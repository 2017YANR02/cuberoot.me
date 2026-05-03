import { parseColor } from './color.js'
import { ColorAbbreviationToCode } from '../../constants.js'
import { expandRepeats } from './repeatExpand.js'

export function parseFaceletColors(rawValue: string): string[] {
  let colors = []
  if (rawValue.indexOf(',') > -1) {
    // Parse as comma separated colors
    rawValue.split(',').forEach(value => {
      let parsed = parseColor(value)
      if (parsed) {
        colors.push(parsed)
      }
    })
  } else {
    // PHP V0.6.5 repeat-count pre-pass: y20r6 -> 20 y's then 6 r's
    const expanded = expandRepeats(rawValue)
    // parse as abbreviations (ex 'yyyyyyyyyrrrrrrrrrbbbbbbbbb....')
    for (let i = 0; i < expanded.length; i++) {
      colors.push(ColorAbbreviationToCode[expanded.charAt(i)])
    }
  }
  return colors
}
