import {
  canonicalSq1Alg,
  compactSq1Alg,
  parseSq1Tokens,
  simplifySq1Alg,
} from '@cuberoot/shared/sq1-notation';

type LocalizedNotation = { en: string; zh: string };

export const SQ1_NOTATION_MODES = ['compact', 'karnaukh', 'full'] as const;
export type Sq1NotationMode = (typeof SQ1_NOTATION_MODES)[number];

const SOURCE_LABEL = /^(?:Source mnemonic|原表助记)[：:]\s*/i;

const SINGLE_TURN_SYMBOLS = new Map<string, string>([
  ['3,0', 'U'], ['-3,0', "U'"], ['0,3', 'D'], ['0,-3', "D'"],
  ['2,-1', 'u'], ['-2,1', "u'"], ['-1,2', 'd'], ['1,-2', "d'"],
  ['3,-3', 'E'], ['-3,3', "E'"], ['3,3', 'e'], ['-3,-3', "e'"],
  ['4,1', 'F'], ['-4,-1', "F'"], ['1,4', 'f'], ['-1,-4', "f'"],
  ['5,-1', 'u2'], ['-5,1', "u2'"], ['-1,5', 'd2'], ['1,-5', "d2'"],
  ['2,-4', 'T'], ['-2,4', "T'"], ['4,-2', 't'], ['-4,2', "t'"],
  ['5,2', 'K'], ['-5,-2', "K'"], ['2,5', 'k'], ['-2,-5', "k'"],
]);

function packedTurn(top: number, bot: number): string {
  return `${top}${bot}`;
}

/**
 * 把任意可执行 SQ1 数字公式转换成卡脑壳记号。
 * 已定义的单转使用字母，其余转动保留原表采用的无逗号数字写法；空格表示切片。
 */
export function generatedSq1KarnaukhNotation(alg: string): string | null {
  const tokens = parseSq1Tokens(simplifySq1Alg(alg, 'wca'));
  if (tokens.length === 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === 'turn') {
      parts.push(SINGLE_TURN_SYMBOLS.get(`${token.top},${token.bot}`) ?? packedTurn(token.top, token.bot));
      continue;
    }

    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    // 两个转动之间的普通切片由空格表示；开头、结尾或连续切片必须显式保留。
    if (previous?.kind !== 'turn' || next?.kind !== 'turn') parts.push('/');
  }

  return parts.join(' ');
}

/**
 * 卡脑壳记号只用于阅读；数字公式仍留在 entry.alg 供播放器和校验使用。
 * PBL 优先使用原表助记，其他 SQ1 套系由数字公式生成。
 */
export function sq1KarnaukhNotation(
  alg: string,
  sourceNote?: LocalizedNotation,
): LocalizedNotation | null {
  if (!sourceNote) {
    const generated = generatedSq1KarnaukhNotation(alg);
    return generated ? { en: generated, zh: generated } : null;
  }

  const en = sourceNote.en.replace(SOURCE_LABEL, '').trim();
  const zh = sourceNote.zh.replace(SOURCE_LABEL, '').trim();
  if (!en && !zh) return null;

  return {
    en: en || zh,
    zh: zh || en,
  };
}

/** SQ1 公式库三种阅读记号的单一格式化入口。 */
export function sq1NotationText(
  alg: string,
  mode: Sq1NotationMode,
  sourceNote?: LocalizedNotation,
): LocalizedNotation | null {
  if (mode === 'karnaukh') return sq1KarnaukhNotation(alg, sourceNote);

  const text = mode === 'full' ? canonicalSq1Alg(alg) : compactSq1Alg(alg);
  return text ? { en: text, zh: text } : null;
}
