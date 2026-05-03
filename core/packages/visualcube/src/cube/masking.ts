import { Masking, Face, AllFaces } from './constants'

export type FaceValues = { [face: number]: any[] }
type MaskingFunctions = {
  [masking: string]: {
    [face: number]: (row: number, col: number, cubeSize: number) => boolean
  }
}

/**
 * 3x3 masks ported verbatim from PHP visualcube `index.php`.
 *
 * Each value is a 54-char string of '0'/'1' (1 = colored, 0 = masked).
 * Face order matches PHP / TS: U R F D L B. Within each 9-char chunk,
 * indices 0..8 are row-major (row * 3 + col, top-left to bottom-right).
 *
 * Only consulted when cubeSize === 3. For other sizes the mask is treated
 * as unknown (an exception will be thrown by makeMasking).
 */
const stringMasks3x3: { [masking: string]: string } = {
  [Masking.TWO_BY_TWO_BY_TWO]: '000000000000110110000011011011011000000000000000000000',
  [Masking.TWO_BY_TWO_BY_THREE]: '000000000000110110000111111111111000000011011000000000',
  [Masking.CROSS_PARTIAL]: '000000000000000010000000010010111010000000010000000010',
  [Masking.CROSS_FR]: '000000000000000010000000010010011000000000000000000000',
  [Masking.CROSS_BR]: '000000000000000010000000000000011010000000000000000010',
  [Masking.CROSS_FB]: '000000000000000000000000010010010010000000000000000010',
  [Masking.CROSS_LR]: '000000000000000010000000000000111000000000010000000000',
  [Masking.XCROSS_FR]: '000000000000110110000011011011111010000010010000010010',
  [Masking.XCROSS_BR]: '000000000000011011000010010010111011000010010000110110',
  [Masking.XCROSS_FL]: '000000000000010010000110110110111010000011011000010010',
  [Masking.XCROSS_BL]: '000000000000010010000010010010111110000110110000011011',
  [Masking.XXCROSS]: '000000000000011011000010010010111111000110110000111111',
  [Masking.DEC]: '000000000000110110000011011011111110000110110000011011',
  [Masking.TEC_FR]: '000000000000011011000110110110111111000111111000111111',
  [Masking.TEC_FL]: '000000000000111111000011011011111111000110110000111111',
  [Masking.TEC_BL]: '000000000000111111000111111111111011000011011000110110',
  [Masking.TEC_BR]: '000000000000110110000111111111111110000111111000011011',
  [Masking.PAIR]: '000000000000110110000011011011111010000010010000010010',
  [Masking.EO_ORBIT]: '010101010000000000000101000010101010000000000000101000',
  [Masking.EO_OUTER_ORBIT]: '000000000010101010010000010000000000010101010010000010',
  [Masking.EOLRB_R]: '010101010111000000000000000010000010010000000000000000',
  [Masking.EOLRB_L]: '010101010010000000000000000010000010111000000000000000',
  [Masking.EOLRB_F]: '010101010010000000101000000010000010010000000000000000',
  [Masking.EOLRB_B]: '010101010010000000000000000010000010010000000101000000',
  [Masking.EOLS]: '010111010000111111000111111111111111000111111000111111',
  [Masking.L5EF]: '010111010010111011010111110110111111010111111010111111',
  [Masking.ROUX_CO]: '101000101000000000000000000000000000000000000000000000',
  [Masking.ROUX_DR]: '000000000000000010000100100100101100000111111000001001',
  [Masking.ROUX_DR_ONLY]: '000000000000000010000000000000001000000000000000000000',
  [Masking.FB]: '000000000000000000000100100100100100000111111000001001',
  [Masking.SB]: '000000000000111111000001001001001001000000000000100100',
  [Masking.FB1]: '000000000000000000000100100100100000000011011000000000',
  [Masking.FB2]: '000000000000000000000000000000100100000110110000001001',
  [Masking.SB1]: '000000000000110110000001001001001000000000000000000000',
  [Masking.SB2]: '000000000000011011000000000000001001000000000000100100',
  [Masking.ONE_ONE_TWO]: '000000000000000000000100100100000000000001001000000000',
  [Masking.ONE_TWO_TWO]: '000000000000100100000011011011000000000000000000000000',
  [Masking.TWO_TWO_TWO_FL]: '000000000000000000000110110110110000000011011000000000',
  [Masking.TWO_TWO_TWO_BL]: '000000000000000000000000000000110110000110110000011011',
  [Masking.TWO_TWO_TWO_BR]: '000000000000011011000000000000011011000000000000110110',
  [Masking.SQ_RDF]: '000000000000110110000011001001011000000000000000000000',
  [Masking.SQ_FDR]: '000000000000110100000011011011010000000000000000000000',
  [Masking.SQ_DFR]: '000000000000010110000010011011011000000000000000000000',
  [Masking.DR]: '111101111000000000000101000111101111000000000000101000',
  [Masking.DR_R]: '001001001000000000000001000001001001000000000000100000',
  [Masking.DR_R_U2_RP]: '100100101000000000000001000001000000000000000000000000',
  [Masking.DR_R_U_RP]: '000000111000000000000001000001000000000000000000000000',
  [Masking.DR_R_UP_RP]: '110000001000000000000001000001000000000000000000000000',
  [Masking.DR_U]: '000000000111000000010000000000000000111000000010000000',
  [Masking.MEHTA_SQ]: '000000000000000110000000011011011000000000000000000000',
  [Masking.MEHTA_BELT2]: '000000000000111000000111110110110110000111111000111011',
  [Masking.MEHTA_EOLE2]: '010111010000111000000111110110111110000111111000111011',
  [Masking.MEHTA_TDR]: '000000000000000111000000001001001001000000000000000100',
}

const maskingFunctions: MaskingFunctions = {
  [Masking.FL]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => true,
    [Face.R]: (row, col, cubeSize) => row == cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row == cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row == cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row == cubeSize - 1,
  },
  [Masking.F2L]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => true,
    [Face.R]: (row, col, cubeSize) => row > 0,
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0,
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.LL]: {
    [Face.U]: (row, col, cubeSize) => true,
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => row == 0,
    [Face.L]: (row, col, cubeSize) => row == 0,
    [Face.F]: (row, col, cubeSize) => row == 0,
    [Face.B]: (row, col, cubeSize) => row == 0,
  },
  [Masking.CLL]: {
    [Face.U]: (row, col, cubeSize) =>
      (row > 0 && col > 0 && row < cubeSize - 1 && col < cubeSize - 1) || // is center
      ((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
    [Face.L]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
    [Face.F]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
    [Face.B]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
  },
  [Masking.ELL]: {
    [Face.U]: (row, col, cubeSize) => !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
  },
  [Masking.OLL]: {
    [Face.U]: (row, col, cubeSize) => true,
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => false,
    [Face.L]: (row, col, cubeSize) => false,
    [Face.F]: (row, col, cubeSize) => false,
    [Face.B]: (row, col, cubeSize) => false,
  },
  [Masking.OCLL]: {
    [Face.U]: (row, col, cubeSize) =>
      (row > 0 && col > 0 && row < cubeSize - 1 && col < cubeSize - 1) || // is center
      ((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => false,
    [Face.L]: (row, col, cubeSize) => false,
    [Face.F]: (row, col, cubeSize) => false,
    [Face.B]: (row, col, cubeSize) => false,
  },
  [Masking.OELL]: {
    [Face.U]: (row, col, cubeSize) => !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => false,
    [Face.L]: (row, col, cubeSize) => false,
    [Face.F]: (row, col, cubeSize) => false,
    [Face.B]: (row, col, cubeSize) => false,
  },
  [Masking.COLL]: {
    [Face.U]: (row, col, cubeSize) => true,
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
    [Face.L]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
    [Face.F]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
    [Face.B]: (row, col, cubeSize) => row == 0 && (col == 0 || col == cubeSize - 1),
  },
  [Masking.OCELL]: {
    [Face.U]: (row, col, cubeSize) => true,
    [Face.D]: (row, col, cubeSize) => false,
    [Face.R]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row == 0 && col > 0 && col < cubeSize - 1,
  },
  [Masking.WV]: {
    [Face.U]: (row, col, cubeSize) => true,
    [Face.D]: (row, col, cubeSize) => true,
    [Face.R]: (row, col, cubeSize) => row > 0,
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0,
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.VH]: {
    [Face.U]: (row, col, cubeSize) => !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.D]: (row, col, cubeSize) => true,
    [Face.R]: (row, col, cubeSize) => row > 0,
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0,
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.ELS]: {
    [Face.U]: (row, col, cubeSize) => !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.D]: (row, col, cubeSize) => (row == 0 ? col < cubeSize - 1 : true),
    [Face.R]: (row, col, cubeSize) => row > 0 && (row == cubeSize - 1 ? col > 0 : true),
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0 && (row == cubeSize - 1 ? col < cubeSize - 1 : true),
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.CLS]: {
    [Face.U]: (row, col, cubeSize) => true,
    [Face.D]: (row, col, cubeSize) => true,
    [Face.R]: (row, col, cubeSize) => row > 0,
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0,
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.CMLL]: {
    [Face.U]: (row, col, cubeSize) => (row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1),
    [Face.D]: (row, col, cubeSize) => true,
    [Face.R]: (row, col, cubeSize) => row > 0 || col == 0 || col == cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row > 0 || col == 0 || col == cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => col == 0 || col == cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => col == 0 || col == cubeSize - 1,
  },
  [Masking.CROSS]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.R]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
  },
  [Masking.F2L3]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) =>
      (row == 0 && col == cubeSize - 1) || !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)),
    [Face.R]: (row, col, cubeSize) => row > 0 && col < cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row > 0 && col > 0,
    [Face.B]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
  },
  [Masking.F2L2]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => row > 0 || (col > 0 && col < cubeSize - 1),
    [Face.R]: (row, col, cubeSize) => row > 0 && col > 0,
    [Face.L]: (row, col, cubeSize) => row > 0 && col < cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.F2LSM]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) =>
      !((row == 0 || row == cubeSize - 1) && (col == 0 || col == cubeSize - 1)) ||
      (col == 0 && row == cubeSize - 1) ||
      (row == 0 && col == cubeSize - 1),
    [Face.R]: (row, col, cubeSize) => row > 0 && col < cubeSize - 1,
    [Face.L]: (row, col, cubeSize) => row > 0 && col < cubeSize - 1,
    [Face.F]: (row, col, cubeSize) => row > 0 && col > 0,
    [Face.B]: (row, col, cubeSize) => row > 0 && col > 0,
  },
  [Masking.F2L1]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => row !== 0 || col !== cubeSize - 1,
    [Face.R]: (row, col, cubeSize) => row > 0 && col > 0,
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0 && col < cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row > 0,
  },
  [Masking.F2B]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => col == 0 || col == cubeSize - 1,
    [Face.R]: (row, col, cubeSize) => row > 0,
    [Face.L]: (row, col, cubeSize) => row > 0,
    [Face.F]: (row, col, cubeSize) => row > 0 && (col == 0 || col == cubeSize - 1),
    [Face.B]: (row, col, cubeSize) => row > 0 && (col == 0 || col == cubeSize - 1),
  },
  [Masking.LINE]: {
    [Face.U]: (row, col, cubeSize) => false,
    [Face.D]: (row, col, cubeSize) => col > 0 && col < cubeSize - 1,
    [Face.R]: (row, col, cubeSize) => false,
    [Face.L]: (row, col, cubeSize) => false,
    [Face.F]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
    [Face.B]: (row, col, cubeSize) => row > 0 && col > 0 && col < cubeSize - 1,
  },
}

export function makeMasking(masking: Masking, cubeSize: number): FaceValues {
  // Data-driven (3x3-only) masks ported from PHP take precedence: they cover
  // shapes (DR, Mehta, EOLR, Roux blocks, etc.) that don't decompose cleanly
  // into row/col predicates.
  if (cubeSize === 3 && stringMasks3x3[masking]) {
    return faceValuesFromString(stringMasks3x3[masking])
  }

  if (!maskingFunctions[masking]) {
    throw new Error(`invalid masking ${masking}`)
  }

  let numStickers = cubeSize * cubeSize
  let faceValues = {
    [Face.U]: [],
    [Face.F]: [],
    [Face.R]: [],
    [Face.D]: [],
    [Face.L]: [],
    [Face.B]: [],
  }

  for (let i = 0; i < numStickers; i++) {
    let row = Math.floor(i / cubeSize)
    let col = i % cubeSize

    AllFaces.forEach(face => {
      faceValues[face].push(maskingFunctions[masking][face](row, col, cubeSize))
    })
  }

  return faceValues
}

/**
 * Convert a 54-char PHP-style mask string ('1' = colored, '0' = masked,
 * face order U R F D L B, row-major within face) to FaceValues for 3x3.
 */
function faceValuesFromString(maskStr: string): FaceValues {
  const faceValues: FaceValues = {
    [Face.U]: [],
    [Face.F]: [],
    [Face.R]: [],
    [Face.D]: [],
    [Face.L]: [],
    [Face.B]: [],
  }
  // PHP order: U R F D L B; index per face is row * 3 + col.
  const phpOrder = [Face.U, Face.R, Face.F, Face.D, Face.L, Face.B]
  for (let f = 0; f < phpOrder.length; f++) {
    const face = phpOrder[f]
    for (let i = 0; i < 9; i++) {
      faceValues[face].push(maskStr.charAt(f * 9 + i) === '1')
    }
  }
  return faceValues
}
