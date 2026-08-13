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

function moveToDumbZh(move: ParsedMove): string {
  const specialMove = specialMoveToZh(move);
  if (specialMove) return specialMove;
  if (move.kind === 'rotation' || move.kind === 'slice') return move.raw;

  const family = move.family;
  const face = FACE_ZH[family[0]?.toUpperCase()];
  if (!face) return move.raw;

  const doubleLayer = doubleLayerOf(move);
  if (doubleLayer == null) return move.raw;
  const layer = doubleLayer ? '双层' : '';

  const quarterTurns = Math.abs(move.amount);
  if (!Number.isFinite(quarterTurns) || quarterTurns === 0) return move.raw;
  if (quarterTurns === 2) return `${face}${layer}转180度`;

  const direction = move.amount < 0 ? '逆时针' : '顺时针';
  return `${face}${layer}${direction}转${quarterTurns * 90}度`;
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
