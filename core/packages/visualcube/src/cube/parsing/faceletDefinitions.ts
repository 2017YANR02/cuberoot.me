import { FaceletDefinition, FaceletAbbreviateToDefinition } from '../../constants.js'
import { expandRepeats } from './repeatExpand.js'

export function parseFaceletDefinitions(rawValue: string): FaceletDefinition[] {
  // PHP V0.6.5 repeat-count pre-pass: u9r9f9d9l9b9 -> full solved cube fd
  const expanded = expandRepeats(rawValue)
  let colors = []
  for (let i = 0; i < expanded.length; i++) {
    colors.push(FaceletAbbreviateToDefinition[expanded.charAt(i)])
  }
  return colors
}
