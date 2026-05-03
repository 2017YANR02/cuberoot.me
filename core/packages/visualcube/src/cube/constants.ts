import { ColorCode } from './../colors'
import { Axis } from './../math'
import { ICubeColorScheme } from './models/color-scheme'

export enum Face {
  U = 0,
  R = 1,
  F = 2,
  D = 3,
  L = 4,
  B = 5,
}

export const AllFaces = [Face.U, Face.R, Face.F, Face.D, Face.L, Face.B]

export class FaceRotationVectors {
  static U = [0, -1, 0]
  static R = [1, 0, 0]
  static F = [0, 0, -1]
  static D = [0, 1, 0]
  static L = [-1, 0, 0]
  static B = [0, 0, 1]
}

export const DefaultColorScheme: ICubeColorScheme = {
  [Face.U]: ColorCode.Yellow,
  [Face.R]: ColorCode.Red,
  [Face.F]: ColorCode.Blue,
  [Face.D]: ColorCode.White,
  [Face.L]: ColorCode.Orange,
  [Face.B]: ColorCode.Green,
}

export const JapaneseColorScheme: ICubeColorScheme = {
  [Face.U]: ColorCode.Blue,
  [Face.R]: ColorCode.Orange,
  [Face.F]: ColorCode.Green,
  [Face.D]: ColorCode.White,
  [Face.L]: ColorCode.Red,
  [Face.B]: ColorCode.Yellow,
}

export enum AlgorithmUnit {
  F = 'F',
  U = 'U',
  R = 'R',
  L = 'L',
  D = 'D',
  B = 'B',
  M = 'M',
  E = 'E',
  S = 'S',
  X = 'x',
  Y = 'y',
  Z = 'z',
}

export const AxisSymbolToAxis = {
  x: Axis.X,
  y: Axis.Y,
  z: Axis.Z,
}

export const possibleMoves: string[] = [
  AlgorithmUnit.F,
  AlgorithmUnit.U,
  AlgorithmUnit.R,
  AlgorithmUnit.L,
  AlgorithmUnit.D,
  AlgorithmUnit.B,
  AlgorithmUnit.M,
  AlgorithmUnit.E,
  AlgorithmUnit.S,
  AlgorithmUnit.X,
  AlgorithmUnit.Y,
  AlgorithmUnit.Z,
]

export const cubeRotations: string[] = [AlgorithmUnit.X, AlgorithmUnit.Y, AlgorithmUnit.Z]

export enum TurnAbbreviation {
  Clockwise = '',
  CounterClockwise = "'",
  Double = '2',
  DoubleCounter1 = "2'",
  DoubleCounter2 = "'2",
}

export enum Masking {
  FL = 'fl',
  F2L = 'f2l',
  LL = 'll',
  CLL = 'cll',
  ELL = 'ell',
  OLL = 'oll',
  OCLL = 'ocll',
  OELL = 'oell',
  COLL = 'coll',
  OCELL = 'ocell',
  WV = 'wv',
  VH = 'vh',
  ELS = 'els',
  CLS = 'cls',
  CMLL = 'cmll',
  CROSS = 'cross',
  F2L3 = 'f2l_3',
  F2L2 = 'f2l_2',
  F2LSM = 'f2l_sm',
  F2L1 = 'f2l_1',
  F2B = 'f2b',
  LINE = 'line',

  // Extended masks (ported from PHP visualcube `index.php`, cubeSize=3 only)
  // Block-building blocks
  TWO_BY_TWO_BY_TWO = '2x2x2',
  TWO_BY_TWO_BY_THREE = '2x2x3',
  // Cross variants (one cross edge missing -> partial cross subsets)
  CROSS_FR = 'cross_fr',
  CROSS_BR = 'cross_br',
  CROSS_FB = 'cross_fb',
  CROSS_LR = 'cross_lr',
  CROSS_PARTIAL = 'cross_partial', // PHP "Cross" — D-edge UF only
  // X-Cross (cross + one F2L pair)
  XCROSS_FR = 'xcross_fr',
  XCROSS_BR = 'xcross_br',
  XCROSS_FL = 'xcross_fl',
  XCROSS_BL = 'xcross_bl',
  XXCROSS = 'xxcross',
  // F2L progress (DE/TE/etc edge / corner subsets)
  DEC = 'dec',
  TEC_FR = 'tec_fr',
  TEC_FL = 'tec_fl',
  TEC_BL = 'tec_bl',
  TEC_BR = 'tec_br',
  PAIR = 'pair',
  // EO / orbit
  EO_ORBIT = 'eo_orbit',
  EO_OUTER_ORBIT = 'eo_outer_orbit',
  // EOLR variants (EO + LR pair) — PHP suffix is bandage-style
  EOLRB_R = 'eolrb_r',
  EOLRB_L = 'eolrb_l',
  EOLRB_F = 'eolrb_f',
  EOLRB_B = 'eolrb_b',
  EOLS = 'eols',
  L5EF = 'l5ef',
  // Roux blocks
  ROUX_CO = 'roux_co',
  ROUX_DR = 'roux_dr',
  ROUX_DR_ONLY = 'roux_dronly',
  FB = 'fb',
  SB = 'sb',
  FB1 = 'fb1',
  FB2 = 'fb2',
  SB1 = 'sb1',
  SB2 = 'sb2',
  // 1x1x2 / 1x2x2 / 2x2x2 partials
  ONE_ONE_TWO = '112',
  ONE_TWO_TWO = '122',
  TWO_TWO_TWO_FL = '222_fl',
  TWO_TWO_TWO_BL = '222_bl',
  TWO_TWO_TWO_BR = '222_br',
  // Square-1 first-block variants (kept as 3x3 mask shapes)
  SQ_RDF = 'sq_rdf',
  SQ_FDR = 'sq_fdr',
  SQ_DFR = 'sq_dfr',
  // DR (Domino Reduction)
  DR = 'dr',
  DR_R = 'dr_r',
  DR_R_U2_RP = 'dr_r_u2_rp',
  DR_R_U_RP = 'dr_r_u_rp',
  DR_R_UP_RP = 'dr_r_up_rp',
  DR_U = 'dr_u',
  // Mehta
  MEHTA_SQ = 'mehta_sq',
  MEHTA_BELT2 = 'mehta_belt2',
  MEHTA_EOLE2 = 'mehta_eole2',
  MEHTA_TDR = 'mehta_tdr',
}
