export interface Sq1PblMnemonicEntry {
  symbol: string;
  expansion: string;
  sourceCell: string;
  sourceNote?: string;
}

export interface Sq1PblMnemonicGroup {
  id: 'basic' | 'secondary' | 'pbl' | 'combined-j' | 'combined-r';
  title: { zh: string; en: string };
  intro: { zh: string; en: string };
  entries: readonly Sq1PblMnemonicEntry[];
}

/**
 * Daniel's Public PBL Doc, Help!B18:N43.
 *
 * These are memory mnemonics, not an executable Square-1 notation. Keep them
 * separate from AlgEntry.alg and the SQ1 parser/player contract.
 */
export const SQ1_PBL_MNEMONIC_GROUPS: readonly Sq1PblMnemonicGroup[] = [
  {
    id: 'basic',
    title: { zh: '基础记号', en: 'Foundation' },
    intro: { zh: '原表标为最基础、必须先学的转动。', en: 'The source marks these as the most basic moves to learn first.' },
    entries: [
      { symbol: '\\', expansion: 'Down starting slice', sourceCell: 'B18:C18' },
      { symbol: 'U', expansion: '3,0', sourceCell: 'B19:C19' },
      { symbol: "U'", expansion: '-3,0', sourceCell: 'B20:C20' },
      { symbol: 'D', expansion: '0,3', sourceCell: 'B21:C21' },
      { symbol: "D'", expansion: '0,-3', sourceCell: 'B22:C22' },
      { symbol: 'u', expansion: '2,-1', sourceCell: 'B23:C23' },
      { symbol: "u'", expansion: '-2,1', sourceCell: 'B24:C24' },
      { symbol: 'd', expansion: '-1,2', sourceCell: 'B25:C25' },
      { symbol: "d'", expansion: '1,-2', sourceCell: 'B26:C26' },
      { symbol: 'E', expansion: '3,-3', sourceCell: 'B27:C27' },
      { symbol: "E'", expansion: '-3,3', sourceCell: 'B28:C28' },
      { symbol: 'e', expansion: '3,3', sourceCell: 'B29:C29' },
      { symbol: "e'", expansion: '-3,-3', sourceCell: 'B30:C30' },
      { symbol: 'F', expansion: '4,1', sourceCell: 'B31:C31' },
      { symbol: "F'", expansion: '-4,-1', sourceCell: 'B32:C32' },
      { symbol: 'f', expansion: '1,4', sourceCell: 'B33:C33' },
      { symbol: "f'", expansion: '-1,-4', sourceCell: 'B34:C34' },
      { symbol: 'M', expansion: '1,1 or -1,-1', sourceCell: 'B35:C35' },
      { symbol: 'm', expansion: '2,2 or -2,-2', sourceCell: 'B36:C36' },
      { symbol: 'u2', expansion: '5,-1', sourceCell: 'B37:C37' },
      { symbol: "u2'", expansion: '-5,1', sourceCell: 'B38:C38' },
      { symbol: 'd2', expansion: '-1,5', sourceCell: 'B39:C39' },
      { symbol: "d2'", expansion: '1,-5', sourceCell: 'B40:C40' },
      { symbol: '//', expansion: 'Cancels into e.g. JJ//RJ', sourceCell: 'B41:C41' },
    ],
  },
  {
    id: 'secondary',
    title: { zh: '二级记号', en: 'Secondary moves' },
    intro: { zh: '原表标为 Secondary，并注明学习 OBL 必须掌握。', en: 'The source labels these “Secondary” and says they must be learned for OBL.' },
    entries: [
      { symbol: 'W', expansion: '3,0/-3,0/', sourceCell: 'D19:E19' },
      { symbol: "W'", expansion: '-3,0/3,0/', sourceCell: 'D20:E20' },
      { symbol: 'B', expansion: '0,3/0,-3/', sourceCell: 'D21:E21' },
      { symbol: "B'", expansion: '0,-3/0,3/', sourceCell: 'D22:E22' },
      { symbol: 'w', expansion: '2,-1/-2,1/', sourceCell: 'D23:E23' },
      { symbol: "w'", expansion: '-2,1/2,-1/', sourceCell: 'D24:E24' },
      { symbol: 'b', expansion: '-1,2/1,-2/', sourceCell: 'D25:E25' },
      { symbol: "b'", expansion: '1,-2/-1,2/', sourceCell: 'D26:E26' },
      { symbol: 'Ɇ', expansion: '3,0/0,-3/', sourceCell: 'D27:E27' },
      { symbol: "Ɇ'", expansion: '-3,0/0,3/', sourceCell: 'D28:E28' },
      { symbol: 'ɇ', expansion: '3,0/0,3/', sourceCell: 'D29:E29' },
      { symbol: "ɇ'", expansion: '-3,0/0,-3/', sourceCell: 'D30:E30' },
      { symbol: 'F2', expansion: '4,1/-4,-1/', sourceCell: 'D31:E31' },
      { symbol: "F2'", expansion: '-4,-1/4,1', sourceCell: 'D32:E32' },
      { symbol: 'f2', expansion: '1,4/-1,-4', sourceCell: 'D33:E33' },
      { symbol: "f2'", expansion: '-1,-4/1,4', sourceCell: 'D34:E34' },
      { symbol: 'T', expansion: '2,-4', sourceCell: 'D35:E35' },
      { symbol: "T'", expansion: '-2,4', sourceCell: 'D36:E36' },
      { symbol: 't', expansion: '4,-2', sourceCell: 'D37:E37' },
      { symbol: "t'", expansion: '-4,2', sourceCell: 'D38:E38' },
    ],
  },
  {
    id: 'pbl',
    title: { zh: 'PBL 记号', en: 'PBL moves' },
    intro: { zh: '原表标为 PBL based，并注明“all <6 slice PBLs essential for 2 alg”。', en: 'The source labels these “PBL based” and notes “all <6 slice PBLs essential for 2 alg”.' },
    entries: [
      { symbol: 'U3', expansion: '3,0/-3,0/3,0/', sourceCell: 'F19:G19' },
      { symbol: "U3'", expansion: '-3,0/3,0/-3,0/', sourceCell: 'F20:G20' },
      { symbol: 'D3', expansion: '0,3/0,-3/0,3/', sourceCell: 'F21:G21' },
      { symbol: "D3'", expansion: '0,-3/0,3/0,-3/', sourceCell: 'F22:G22' },
      { symbol: 'u3', expansion: '2,-1/-2,1/2,-1/', sourceCell: 'F23:G23' },
      { symbol: "u3'", expansion: '-2,1/2,-1/-2,1/', sourceCell: 'F24:G24' },
      { symbol: 'd3', expansion: '-1,2/1,-2/-1,2/', sourceCell: 'F25:G25' },
      { symbol: "d3'", expansion: '1,-2/-1,2/1,-2/', sourceCell: 'F26:G26' },
      { symbol: 'UU', expansion: '3,0/3,0', sourceCell: 'F27:G27' },
      { symbol: "UU'", expansion: '-3,0/-3,0', sourceCell: 'F28:G28' },
      { symbol: 'F3', expansion: '4,1/-4,-1/4,1/', sourceCell: 'F29:G29' },
      { symbol: "F3'", expansion: '-4,-1/4,1/-4,-1/', sourceCell: 'F30:G30' },
      { symbol: 'f3', expansion: '1,4/-1,-4/1,4/', sourceCell: 'F31:G31' },
      { symbol: "f3'", expansion: '-1,-4/1,4/-1,-4/', sourceCell: 'F32:G32' },
      { symbol: 'K', expansion: '5,2', sourceCell: 'F33:G33' },
      { symbol: "K'", expansion: '-5,-2', sourceCell: 'F34:G34' },
      { symbol: 'k', expansion: '2,5', sourceCell: 'F35:G35' },
      { symbol: "k'", expansion: '-2,-5', sourceCell: 'F36:G36' },
    ],
  },
  {
    id: 'combined-j',
    title: { zh: 'J、N 与 Adj 组合', en: 'J, N, and Adj combinations' },
    intro: { zh: '大小写和前缀会改变对齐，必须按完整符号查表。', en: 'Case and prefixes change alignment, so look up the complete symbol.' },
    entries: [
      { symbol: 'JJ', expansion: '/0,-3/3,3/-3,0/', sourceCell: 'K19:L19', sourceNote: 'Alt: /3,0/-3,-3/0,3/' },
      { symbol: 'jJ', expansion: '1,0/0,-3/3,3/-3,0/-1,0', sourceCell: 'K20:L20', sourceNote: 'Alt: 1,0/3,0/-3,-3/0,3/-1,0' },
      { symbol: 'Jj', expansion: '0,-1/0,-3/3,3/-3,0/0,1', sourceCell: 'K21:L21', sourceNote: 'Alt: 0,-1/3,0/-3,-3/0,3/0,1' },
      { symbol: 'jj', expansion: '1,-1/0,-3/3,3/-3,0/-1,1', sourceCell: 'K22:L22', sourceNote: 'Alt: 1,-1/3,0/-3,-3/0,3/-1,1' },
      { symbol: 'bJJ', expansion: '/-3,0/3,3/0,-3/', sourceCell: 'K23:L23' },
      { symbol: 'bjJ', expansion: '1,0/-3,0/3,3/0,-3/-1,0', sourceCell: 'K24:L24' },
      { symbol: 'bJj', expansion: '0-1/-3,0/3,3/0,-3/0,1', sourceCell: 'K25:L25' },
      { symbol: 'bjj', expansion: '1,-1/-3,0/3,3/0,-3/-1,1', sourceCell: 'K26:L26' },
      { symbol: 'JN', expansion: '/0,-3/0,3/0,-3/0,3/', sourceCell: 'K28:L28' },
      { symbol: 'jN', expansion: '1,0/0,-3/0,3/0,-3/0,3/-1,0', sourceCell: 'K29:L29' },
      { symbol: 'Jn', expansion: '0,-1/0,-3/0,3/0,-3/0,3/0,1', sourceCell: 'K30:L30' },
      { symbol: 'jn', expansion: '1,-1/0,-3/0,3/0,-3/0,3/-1,1', sourceCell: 'K31:L31' },
      { symbol: 'NJ', expansion: '/3,0/-3,0/3,0/-3,0/', sourceCell: 'K32:L32' },
      { symbol: 'nJ', expansion: '1,0/3,0/-3,0/3,0/-3,0/-1,0', sourceCell: 'K33:L33' },
      { symbol: 'Nj', expansion: '0,-1/3,0/-3,0/3,0/-3,0/0,1', sourceCell: 'K34:L34' },
      { symbol: 'nj', expansion: '1,-1/3,0/-3,0/3,0/-3,0/-1,1', sourceCell: 'K35:L35' },
      { symbol: 'NN', expansion: '/3,-3/-3,3/', sourceCell: 'K37:L37' },
      { symbol: '-NN', expansion: '/-3,3/3,-3/', sourceCell: 'K38:L38' },
      { symbol: '30Adj', expansion: '1,0/3,0/-1,-1/-2,1/-1,0', sourceCell: 'K40:L40' },
      { symbol: '03Adj', expansion: '1,0/0,3/-1,-1/1,-2/-1,0', sourceCell: 'K41:L41' },
      { symbol: '-30Adj', expansion: '0,-1/-3,0/1,1/2,-1/0,1', sourceCell: 'K42:L42' },
      { symbol: '0-3Adj', expansion: '0,-1/0,-3/1,1/-1,2/0,1', sourceCell: 'K43:L43' },
    ],
  },
  {
    id: 'combined-r',
    title: { zh: 'R 与其他组合', en: 'R and other combinations' },
    intro: { zh: '原表右侧列出的完整组合宏。', en: 'The complete combination macros listed on the right side of the source guide.' },
    entries: [
      { symbol: 'JR', expansion: '/-3,-3/2,-1/-2,1/3,3/', sourceCell: 'M19:N19' },
      { symbol: 'jR', expansion: '1,0/-3,-3/2,-1/-2,1/3,3/-1,0', sourceCell: 'M20:N20' },
      { symbol: 'Jr', expansion: '0,-1/-3,-3/1,-2/-1,2/3,3/0,1', sourceCell: 'M21:N21' },
      { symbol: 'jr', expansion: '1,-1/-3,-3/1,-2/-1,2/3,3/-1,1', sourceCell: 'M22:N22' },
      { symbol: 'RJ', expansion: '\\3,3/1,-2/-1,2/-3,-3/', sourceCell: 'M24:N24' },
      { symbol: 'rJ', expansion: '1,0/3,3/2,-1/-2,1/-3,-3/', sourceCell: 'M25:N25' },
      { symbol: 'Rj', expansion: '0,-1/3,3/1,-2/-1,2/-3,-3/0,1', sourceCell: 'M26:N26' },
      { symbol: 'rj', expansion: '1,-1/3,3/2,-1/-2,1/-3,-3/-1,1', sourceCell: 'M27:N27' },
      { symbol: 'bRJ', expansion: '/-3,-3/-2,1/2,-1/3,3/', sourceCell: 'M28:N28' },
      { symbol: 'brJ', expansion: '1,0/-3,-3/-1,2/1,-2/3,3/-1,0', sourceCell: 'M29:N29' },
      { symbol: 'bRj', expansion: '0,-1/-3,-3/-2,1/2,-1/3,3/0,1', sourceCell: 'M30:N30' },
      { symbol: 'brj', expansion: '1,-1/-3,-3/-1,2/1,-2/3,3/-1,1', sourceCell: 'M31:N31' },
      { symbol: 'RR', expansion: '1,0/2,-1/-2,4/5,-1/-2,1/-1,0', sourceCell: 'M33:N33' },
      { symbol: 'rr', expansion: '0,-1/-2,1/5,-1/-2,4/2,-1/0,1', sourceCell: 'M34:N34' },
      { symbol: 'pJ', expansion: '0-1/-2,1/2,2/0,-3/0,1', sourceCell: 'M36:N36' },
      { symbol: 'fpJ', expansion: '1,0/2,-1/-2,-2/0,3/-1,0', sourceCell: 'M37:N37' },
      { symbol: 'AA', expansion: '1,0/0,-3/2,2/0,-3/-2,4/-1,0', sourceCell: 'M39:N39' },
      { symbol: 'aa', expansion: '0-1/1,-2/2,2/1,-2/-4,2/0,1', sourceCell: 'M40:N40' },
      { symbol: 'TT', expansion: '1,0/5,-1/-3,0/-2,-2/0,3/-1,0', sourceCell: 'M42:N42' },
    ],
  },
] as const;

export const SQ1_PBL_MNEMONIC_SOURCE = {
  spreadsheet: 'https://docs.google.com/spreadsheets/d/1VQNYNwdOLqqBkacHcfYtEBst22FOVhH9EAhTOYOZTgo/',
  tutorial: 'https://www.youtube.com/watch?v=-vf8O4wbDnk',
  definitionRange: 'Help!B18:N43',
  headingsRange: 'Help!C15:C17',
  introductionCell: 'Help!F6',
} as const;

/** Exact source comment; it acknowledges the forms without defining them numerically. */
export const SQ1_PBL_MNEMONIC_VARIANT_NOTE = {
  sourceCell: 'Help!K37',
  text: 'nN Nn nn shenanigans also apply here\n\nsame with pN/pN which is just pN',
} as const;

/** Used in recommendations but not numerically defined by either Help sheet. */
export const SQ1_PBL_UNDEFINED_MNEMONICS = [
  "M'", "m'",
  'DD', "DD'", 'Dd', 'dD',
  'U2D', "U2D'", "U2'",
  'U4', "U4'", 'u4', "u4'", 'd4', "d4'",
  'E2', 'FF', 'FV', 'VF', 'VV',
  '3Adj',
  'Nn', 'nN', 'nn', '-nN', '-nn',
  'pN',
  'OaOpp', 'OppO', 'PS', 'ZZ',
] as const;
