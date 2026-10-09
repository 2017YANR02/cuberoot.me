import { exportTimerCstimerJson, type TimerCstimerExportResult } from '@cuberoot/shared/timer';
import { loadAll } from './db';

export async function exportCstimerJson(): Promise<TimerCstimerExportResult> {
  return exportTimerCstimerJson(loadAll());
}
