import { tokenizeMoves, type ParsedMove } from '@cuberoot/shared/alg-notation';

/**
 * 公式列表的展示记号。标准记号永远保留为真源；其它选项只能改显示和复制文本，
 * 不能送进播放器、校验器或数据库。以后新增中文记号时在这里加一种 style 即可。
 */
export const ALG_NOTATION_STYLES = ['standard', 'zh-cstimer'] as const;
export type AlgNotationStyle = (typeof ALG_NOTATION_STYLES)[number];

const FACE_ZH: Record<string, string> = {
  U: '上面',
  D: '下面',
  L: '左面',
  R: '右面',
  F: '前面',
  B: '后面',
};

/** x/y/z 与 E/M/S（含小写内层切）按产品约定保留标准原文。 */
function moveToCsTimerZh(move: ParsedMove): string {
  if (move.kind === 'rotation' || move.kind === 'slice') return move.raw;

  const family = move.family;
  const face = FACE_ZH[family[0]?.toUpperCase()];
  if (!face) return move.raw;

  let layer = '';
  if (move.kind === 'wide') {
    const isWideFamily = family.endsWith('w') || family[0] === family[0]?.toLowerCase();
    // 2Fw / Fw / f 都是双层；3Rw、2R 等不能谎称双层，先原样保留。
    if (!isWideFamily || (move.layer != null && move.layer !== '2')) return move.raw;
    layer = '双层';
  }

  const quarterTurns = Math.abs(move.amount);
  if (!Number.isFinite(quarterTurns) || quarterTurns === 0) return move.raw;
  if (quarterTurns === 2) return `${face}${layer}转180度`;

  const direction = move.amount < 0 ? '逆时针' : '顺时针';
  return `${face}${layer}${direction}转${quarterTurns * 90}度`;
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
  return pieces.map((piece, index) => {
    if (piece.moves) return piece.moves.map(moveToCsTimerZh).join('，');

    // csTimer 风格用逗号隔开连续招式；括号、换位子标点和未知内容照原文保留。
    if (/^\s+$/.test(piece.raw) && pieces[index - 1]?.moves && pieces[index + 1]?.moves) {
      return '，';
    }
    return piece.raw;
  }).join('');
}
