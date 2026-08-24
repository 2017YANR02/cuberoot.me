export type NotationTranslator = (zh: string, en: string) => string;

export function formatPyraminxMoveDescription(move: string, t: NotationTranslator): string {
  const root = move.replace("'", '');
  const direction = move.endsWith("'")
    ? t('逆时针120度', '120 degrees counter-clockwise')
    : t('顺时针120度', '120 degrees clockwise');
  if (/^[ULRB]$/.test(root)) return t(`两层，${direction}`, `Two layers, ${direction}`);
  if (/^[ulrb]$/.test(root)) return t(`尖角，${direction}`, `Tip only, ${direction}`);
  if (root.endsWith('w')) return t(`对面层，${direction}`, `Opposite face layer, ${direction}`);
  return t(`整体转体，${direction}`, `Whole-puzzle rotation, ${direction}`);
}

export function formatSkewbMoveDescription(move: string, t: NotationTranslator): string {
  const root = move.replace(/[2']/g, '');
  if (/^[xyz]$/.test(root)) {
    if (move.endsWith('2')) return t('整体转体180度', 'Whole-puzzle rotation, 180 degrees');
    return move.endsWith("'")
      ? t('整体逆时针转体90度', 'Whole-puzzle rotation, 90 degrees counter-clockwise')
      : t('整体顺时针转体90度', 'Whole-puzzle rotation, 90 degrees clockwise');
  }
  return move.endsWith("'")
    ? t('顶点层逆时针120度', 'Corner layer, 120 degrees counter-clockwise')
    : t('顶点层顺时针120度', 'Corner layer, 120 degrees clockwise');
}

export function formatSquare1MoveDescription(move: string, t: NotationTranslator): string {
  if (move === '/') return t('右半部翻转180度', 'Flip the right half 180 degrees');
  const match = /^\((-?\d+),(-?\d+)\)$/.exec(move);
  if (!match) return move;
  return t(`上层${match[1]}格，下层${match[2]}格`, `Top ${match[1]} notches, bottom ${match[2]} notches`);
}

export function formatMegaminxMoveDescription(move: string, t: NotationTranslator): string {
  const descriptions: Record<string, [string, string]> = {
    'R++': ['竖排面顺时针144度', 'Vertical column, 144 degrees clockwise'],
    'R--': ['竖排面逆时针144度', 'Vertical column, 144 degrees counter-clockwise'],
    'D++': ['横排面顺时针144度', 'Horizontal row, 144 degrees clockwise'],
    'D--': ['横排面逆时针144度', 'Horizontal row, 144 degrees counter-clockwise'],
    U: ['顶面顺时针72度', 'Top face, 72 degrees clockwise'],
    "U'": ['顶面逆时针72度', 'Top face, 72 degrees counter-clockwise'],
  };
  const description = descriptions[move];
  return description ? t(...description) : move;
}

export function formatClockMoveDescription(move: string, t: NotationTranslator): string {
  if (move === 'y2') return t('翻到背面', 'Flip to the back face');
  const match = /^(UR|DR|DL|UL|U|R|D|L|ALL)(\d+)([+-])$/.exec(move);
  if (!match) return move;
  const pinNames: Record<string, [string, string]> = {
    UR: ['抬起右上立柱', 'Raise the upper-right pin'],
    DR: ['抬起右下立柱', 'Raise the lower-right pin'],
    DL: ['抬起左下立柱', 'Raise the lower-left pin'],
    UL: ['抬起左上立柱', 'Raise the upper-left pin'],
    U: ['抬起上方两根立柱', 'Raise both upper pins'],
    R: ['抬起右侧两根立柱', 'Raise both right pins'],
    D: ['抬起下方两根立柱', 'Raise both lower pins'],
    L: ['抬起左侧两根立柱', 'Raise both left pins'],
    ALL: ['抬起四根立柱', 'Raise all four pins'],
  };
  const pins = pinNames[match[1]];
  const direction = match[3] === '+'
    ? t('顺时针', 'clockwise')
    : t('逆时针', 'counter-clockwise');
  return t(
    `${pins[0]}，表盘${direction}转${match[2]}小时`,
    `${pins[1]}, turn the dial ${match[2]} hour ${direction}`,
  );
}
