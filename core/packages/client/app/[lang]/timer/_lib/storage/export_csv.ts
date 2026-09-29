import { exportTimerSolvesCsv, type CsvExportResult } from '@cuberoot/shared/timer';
import { loadAll } from './db';
export type { CsvExportResult } from '@cuberoot/shared/timer';

export function exportSolvesCsv(): CsvExportResult {
  return exportTimerSolvesCsv(loadAll());
}
