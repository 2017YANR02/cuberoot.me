/** Current native Opt9/Opt10 inventory. Historical raw reports remain archived. */
export type Bilingual = { zh: string; en: string };
export type SolverComparisonRow = {
  id: string;
  label: string;
  family: 'rust-opt';
  eoBits: number;
  tableBytes: number;
  mainTableBytes: number;
  auxiliaryBytes: number;
  tableAvailable: boolean;
  execution: 'supported';
};

export const COMPARISON_ROWS: readonly SolverComparisonRow[] = [
  { id: 'rust-opt-9', label: 'Opt9', family: 'rust-opt', eoBits: 9,
    mainTableBytes: 15565455360, auxiliaryBytes: 818008, tableBytes: 15566273368,
    tableAvailable: true, execution: 'supported' },
  { id: 'rust-opt-10', label: 'Opt10', family: 'rust-opt', eoBits: 10,
    mainTableBytes: 31130911744, auxiliaryBytes: 818008, tableBytes: 31131729752,
    tableAvailable: true, execution: 'supported' },
];
