/** Table inventory only. Timings are machine-specific in unified-benchmark.ts.
 * Mac inventory: Opt1–9, native Opt10 v2, H7/H10. H11 remains code-only.
 * Historical raw reports are retained off-page.
 */
export type Bilingual = { zh: string; en: string };
export type Family = 'opt' | 'nissy' | 'rust' | 'rust-opt' | 'rust-wasm';
export type SolverComparisonRow = {
  id: string;
  label: string;
  family: Family;
  eoBits: number;
  tableBytes: number;
  mainTableBytes: number;
  auxiliaryBytes: number;
  tableAvailable: boolean;
  execution: 'supported' | 'disabled';
};

export const H48_AUXILIARY_BYTES = 2060648;
export function h48TableBytes(h: number): number {
  if (!Number.isInteger(h) || h < 0 || h > 11) throw new RangeError('H48 h must be 0..11');
  return 64 * Math.ceil((3393 * 34650 * 2 ** h) / 254) + H48_AUXILIARY_BYTES;
}

// [Opt tier, pruning file bytes, auxiliary snapshot bytes]
const OPT_TABLES = [
  [1, 30401280, 816856], [2, 121605120, 816952],
  [3, 243210240, 816952], [4, 486420480, 816952],
  [5, 972840960, 816952], [6, 1945681920, 816952],
  [7, 3891363840, 816952], [8, 7782727680, 818008],
  [9, 15565455360, 818008],
] as const;
const optRows: SolverComparisonRow[] = (['opt', 'rust-opt', 'rust-wasm'] as const).flatMap(family =>
  OPT_TABLES.map(([tier, main, auxiliary]) => ({
    id: family === 'opt' ? `opt-${tier}` : family === 'rust-opt' ? `rust-opt-${tier}` : `rust-wasm-opt-${tier}`,
    label: `Opt${tier}`, family, eoBits: tier === 1 ? 0 : tier,
    tableBytes: main + auxiliary, mainTableBytes: main, auxiliaryBytes: auxiliary,
    tableAvailable: true, execution: 'supported',
  })),
);
optRows.push({ id: 'rust-opt-10', label: 'Opt10', family: 'rust-opt', eoBits: 10,
  mainTableBytes: 31130911744, auxiliaryBytes: 818008, tableBytes: 31131729752,
  tableAvailable: true, execution: 'supported' });

const hRows: SolverComparisonRow[] = (['nissy', 'rust'] as const).flatMap(family =>
  Array.from({ length: 12 }, (_, h) => ({
    id: `${family}-h${h}`, label: `H${h}`, family, eoBits: h,
    tableBytes: h48TableBytes(h), mainTableBytes: h48TableBytes(h) - H48_AUXILIARY_BYTES,
    auxiliaryBytes: H48_AUXILIARY_BYTES, tableAvailable: h === 7 || h === 10,
    execution: h === 11 ? 'disabled' : 'supported',
  })),
);
export const COMPARISON_ROWS: readonly SolverComparisonRow[] = [...optRows, ...hRows];
