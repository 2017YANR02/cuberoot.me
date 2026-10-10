/** Fixed-state optimal HTM corpus. Row = topIndex * caseCount + bottomIndex. */
export const DOUBLE_ZBLL_RECORD_BYTES = 21;
export const DOUBLE_ZBLL_MOVES = ['U', 'R', 'F', 'D', 'L', 'B']
  .flatMap(face => [face, `${face}2`, `${face}'`]);

export interface DoubleZbllManifest {
  schema: 1;
  version: string;
  caseCount: number;
  pairCount: number;
  recordBytes: 21;
  moves: string[];
  metric: 'HTM';
  dataFile: string;
  dataBytes: number;
  dataSha256: string;
  casesFile: string;
  casesSha256: string;
  generatedAt: string;
}

export function decodeDoubleZbll(data: Uint8Array, caseCount: number, top: number, bottom: number): string {
  if (![caseCount, top, bottom].every(Number.isInteger) || caseCount < 1
    || top < 0 || bottom < 0 || top >= caseCount || bottom >= caseCount
    || data.length !== caseCount * caseCount * DOUBLE_ZBLL_RECORD_BYTES) {
    throw new Error('Invalid Double ZBLL corpus or case index');
  }
  const offset = (top * caseCount + bottom) * DOUBLE_ZBLL_RECORD_BYTES;
  const length = data[offset];
  if (length < 1 || length > 20) throw new Error('Missing Double ZBLL record');
  const moves: string[] = [];
  for (let i = 1; i <= length; i++) {
    const move = DOUBLE_ZBLL_MOVES[data[offset + i]];
    if (!move) throw new Error('Invalid Double ZBLL move');
    moves.push(move);
  }
  return moves.join(' ');
}
