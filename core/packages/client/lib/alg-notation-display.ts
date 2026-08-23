import { tokenizeMoves, type ParsedMove } from '@cuberoot/shared/alg-notation';

/**
 * 公式列表的展示记号。标准记号永远保留为真源；其它选项只能改显示和复制文本，
 * 不能送进播放器、校验器或数据库。以后新增中文记号时在这里加一种 style 即可。
 */
export const ALG_NOTATION_STYLES = ['standard', 'dumb', 'zh-compact'] as const;
export type AlgNotationStyle = (typeof ALG_NOTATION_STYLES)[number];

const FACE_ZH: Record<string, string> = {
  U: '上面',
  D: '下面',
  L: '左面',
  R: '右面',
  F: '前面',
  B: '后面',
};

const FACE_SHORT_ZH: Record<string, string> = {
  U: '上',
  D: '下',
  L: '左',
  R: '右',
  F: '前',
  B: '后',
};

const FACE_WIDE_SHORT_ZH: Record<string, string> = {
  U: '让',
  D: '吓',
  L: '佐',
  R: '佑',
  F: '剪',
  B: '垢',
};

const ROTATION_ZH: Record<string, string> = {
  x: '天',
  y: '地',
  z: '人',
};

const SLICE_ZH: Record<string, string> = {
  E: '赤',
  M: '中',
  S: '经',
  e: '赤',
  m: '中',
  s: '经',
};

const ROTATION_AXIS_ZH: Record<string, string> = {
  x: '右层',
  y: '上层',
  z: '前层',
};

const ROTATION_AXIS_EN: Record<string, string> = {
  x: 'right-layer',
  y: 'up-layer',
  z: 'front-layer',
};

const SLICE_FACE_ZH: Record<string, string> = {
  E: '下面',
  M: '左面',
  S: '前面',
};

const SLICE_FACE_EN: Record<string, string> = {
  E: 'bottom',
  M: 'left',
  S: 'front',
};

function specialMoveToZh(move: ParsedMove): string | null {
  if (move.layer != null) return null;

  const symbol = move.kind === 'rotation'
    ? ROTATION_ZH[move.family]
    : move.kind === 'slice'
      ? SLICE_ZH[move.family]
      : undefined;
  return symbol ? `${symbol}${move.raw.slice(move.family.length)}` : null;
}

function doubleLayerOf(move: ParsedMove): '' | '双' | null {
  if (move.kind !== 'wide') return '';
  const family = move.family;
  const isWideFamily = family.endsWith('w') || family[0] === family[0]?.toLowerCase();
  // 2Fw / Fw / f 都是双层；3Rw、2R 等不能谎称双层，先原样保留。
  return isWideFamily && (move.layer == null || move.layer === '2') ? '双' : null;
}

function turnZh(amount: number): string | null {
  const turns = Math.abs(amount);
  if (!Number.isFinite(turns) || turns === 0) return null;
  if (turns === 2) return '转180度';
  return `${amount < 0 ? '逆时针' : '顺时针'}转${turns * 90}度`;
}

function turnEn(amount: number): string | null {
  const turns = Math.abs(amount);
  if (!Number.isFinite(turns) || turns === 0) return null;
  if (turns === 2) return '180 degrees';
  return `${amount < 0 ? 'counter-clockwise' : 'clockwise'} ${turns * 90} degrees`;
}

function layerRangeZh(layer: string): string {
  const [from, to] = layer.split('-');
  return to ? `第${from}至第${to}层` : `第${from}层`;
}

function layerRangeEn(layer: string): string {
  const [from, to] = layer.split('-');
  return to ? `layers ${from} through ${to}` : `layer ${from}`;
}

function wideLayerCountZh(layer: string): string {
  const [from, to] = layer.split('-');
  return to ? `外侧第${from}至第${to}层` : `外侧${from}层`;
}

function wideLayerCountEn(layer: string): string {
  const [from, to] = layer.split('-');
  return to ? `outer layers ${from} through ${to}` : `outer ${from} layers`;
}

function cubeMoveSubjectZh(move: ParsedMove): string | null {
  if (move.kind === 'rotation') {
    const axis = ROTATION_AXIS_ZH[move.family];
    return axis ? `整体沿${axis}` : null;
  }

  if (move.kind === 'slice') {
    const family = move.family.toUpperCase();
    const face = SLICE_FACE_ZH[family];
    if (!face) return null;
    return move.family === family ? `${face}第二层` : `${face}方向所有内层`;
  }

  const face = FACE_ZH[move.family[0]?.toUpperCase()];
  if (!face) return null;
  const wideFamily = move.family.endsWith('w') || move.family === move.family.toLowerCase();
  if (wideFamily) {
    if (move.layer && move.layer !== '2') return `${face}${wideLayerCountZh(move.layer)}`;
    return `${face}双层`;
  }
  if (move.layer) return `${face}${layerRangeZh(move.layer)}`;
  return face;
}

function cubeMoveSubjectEn(move: ParsedMove): string | null {
  if (move.kind === 'rotation') {
    const axis = ROTATION_AXIS_EN[move.family];
    return axis ? `Whole puzzle around the ${axis} axis` : null;
  }

  if (move.kind === 'slice') {
    const family = move.family.toUpperCase();
    const face = SLICE_FACE_EN[family];
    if (!face) return null;
    return move.family === family ? `Second layer from the ${face}` : `All inner layers along the ${face} axis`;
  }

  const faceKey = move.family[0]?.toUpperCase();
  const face = ({ U: 'Up', D: 'Down', L: 'Left', R: 'Right', F: 'Front', B: 'Back' } as Record<string, string>)[faceKey];
  if (!face) return null;
  const wideFamily = move.family.endsWith('w') || move.family === move.family.toLowerCase();
  if (wideFamily) {
    if (move.layer && move.layer !== '2') return `${face} ${wideLayerCountEn(move.layer)}`;
    return `${face} two layers`;
  }
  if (move.layer) return `${face} ${layerRangeEn(move.layer)}`;
  return `${face} face`;
}

function describeParsedCubeMove(move: ParsedMove, language: 'zh' | 'en'): string {
  const subject = language === 'zh' ? cubeMoveSubjectZh(move) : cubeMoveSubjectEn(move);
  const turn = language === 'zh' ? turnZh(move.amount) : turnEn(move.amount);
  if (!subject || !turn) return move.raw;
  return language === 'zh' ? `${subject}${turn}` : `${subject}, ${turn}`;
}

/** Shared single-move wording used by notation guides and foolproof display. */
export function formatCubeMoveDescription(move: string, language: 'zh' | 'en'): string {
  const { moves, junk } = tokenizeMoves(move);
  const parsed = moves[0];
  if (!parsed || moves.length !== 1 || junk.length > 0 || parsed.raw !== move) return move;
  return describeParsedCubeMove(parsed, language);
}

function moveToDumbZh(move: ParsedMove): string {
  return describeParsedCubeMove(move, 'zh');
}

function compactSuffix(amount: number): string {
  const turns = Math.abs(amount);
  return `${turns === 1 ? '' : turns}${amount < 0 ? "'" : ''}`;
}

/** 紧凑中文显示只替换面名，保留 2 和撇号后缀。 */
function moveToCompactZh(move: ParsedMove): string {
  const specialMove = specialMoveToZh(move);
  if (specialMove) return specialMove;
  if (move.kind === 'rotation' || move.kind === 'slice') return move.raw;

  const faceKey = move.family[0]?.toUpperCase();
  if (!faceKey) return move.raw;
  const face = FACE_SHORT_ZH[faceKey];
  const doubleLayer = doubleLayerOf(move);
  const quarterTurns = Math.abs(move.amount);
  if (!face || doubleLayer == null || !Number.isFinite(quarterTurns) || quarterTurns === 0) return move.raw;

  const compactFace = doubleLayer ? FACE_WIDE_SHORT_ZH[faceKey] : face;
  return `${compactFace}${compactSuffix(move.amount)}`;
}

interface DisplayPiece {
  raw: string;
  moves: ParsedMove[] | null;
}

/**
 * 连写公式（如 M'L / R'U）要拆成多步，但未知英文单词不能被拆出末尾的 e 当成切层。
 * 因此先按“单词式片段”切，再要求整段都能被共享 tokenizer 吃完才转换。
 */
function displayPieces(alg: string): DisplayPiece[] {
  const runs = alg.match(/[A-Za-z0-9'\-]+|[^A-Za-z0-9'\-]+/g) ?? [];
  return runs.map((raw) => {
    if (!/^[A-Za-z0-9'\-]+$/.test(raw)) return { raw, moves: null };
    const { moves, junk } = tokenizeMoves(raw);
    const fullyParsed = junk.length === 0 && moves.map(move => move.raw).join('') === raw;
    return { raw, moves: fullyParsed && moves.length > 0 ? moves : null };
  });
}

export function formatAlgNotation(alg: string, style: AlgNotationStyle): string {
  if (style === 'standard' || alg.length === 0) return alg;

  const pieces = displayPieces(alg);
  const moveDisplay = style === 'zh-compact' ? moveToCompactZh : moveToDumbZh;
  const moveSeparator = style === 'zh-compact' ? ' ' : '，';
  return pieces.map((piece, index) => {
    if (piece.moves) return piece.moves.map(moveDisplay).join(moveSeparator);

    // 傻瓜记号用逗号隔开连续转动；紧凑记号保留原空格。括号、换位子标点和未知内容照原文保留。
    if (/^\s+$/.test(piece.raw) && pieces[index - 1]?.moves && pieces[index + 1]?.moves) {
      return style === 'dumb' ? '，' : piece.raw;
    }
    return piece.raw;
  }).join('');
}
