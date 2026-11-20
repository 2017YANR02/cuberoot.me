import { exportTimerSolvesCsv } from '@cuberoot/shared/timer/export-csv';
import { exportTimerCstimerJson } from '@cuberoot/shared/timer/export-cstimer';
import { exportSpeedstacks } from '@cuberoot/shared/timer/export-speedstacks';
import { parseCstimerExport } from '@cuberoot/shared/timer/import-cstimer';
import { planTimerImport, type TimerImportSession } from '@cuberoot/shared/timer/import-timer';
import { TIMER_MORE_ACTION_COPY, timerClearCurrentEventConfirmation } from '@cuberoot/shared/timer/more-actions';
import {
  MAX_TIMER_BACKUP_BYTES,
  parseTimerStoreJson,
  summarizeTimerDatabase,
  type TimerSolvesByEvent,
} from '@cuberoot/shared/timer/persistence';
import { timerSettingFieldContract } from '@cuberoot/shared/timer/settings-contract';
import { eventInfo, type EventId } from '@cuberoot/shared/timer/types';
import { getMiniProgramLocale, receiveNativeLocale, tr, type MiniProgramLocale } from './i18n';
import { nativeUserDataPath, type NativeFileEnvironment } from './native-file-path';
import type { NativeTimer } from './native-timer';
import { nativeTimerTextBytes } from './native-timer-text';
import { miniProgramApi } from './platform';

const exportFields = {
  cuberoot: 'settings.data.export-cuberoot',
  cstimer: 'settings.data.export-cstimer',
  csv: 'settings.data.export-csv',
  speedstacks: 'settings.data.export-speedstacks',
} as const;

type TimerExportFormat = keyof typeof exportFields;

export function nativeTimerSettingsDataCommands(busy: boolean, language = getMiniProgramLocale()) {
  const importField = timerSettingFieldContract('settings.data.import-file');
  return {
    importControl: { id: importField.id, label: tr(importField.copy, language), disabled: busy },
    exports: Object.entries(exportFields).map(([format, id]) => ({
      id,
      format: format as TimerExportFormat,
      label: tr(timerSettingFieldContract(id).copy, language),
      disabled: busy,
    })),
  };
}

export function switchNativeTimerLanguage(): MiniProgramLocale {
  const locale = getMiniProgramLocale() === 'zh' ? 'en' : 'zh';
  receiveNativeLocale({ type: 'cuberoot:locale', locale });
  return getMiniProgramLocale();
}

type ClearTimer = Pick<NativeTimer, 'busy' | 'event' | 'sessions' | 'solves'>;

export async function confirmNativeTimerClearEvent(
  timer: ClearTimer,
  guard: { isCurrent(): boolean; clear(sessionId: string, event: EventId): boolean },
  language = getMiniProgramLocale(),
  api: Pick<typeof wx, 'showModal'> = miniProgramApi(),
): Promise<boolean> {
  if (timer.busy || !guard.isCurrent() || !timer.solves.length) return false;
  const event = timer.event;
  const { activeSessionId } = timer.sessions;
  const solves = [...timer.solves];
  const info = eventInfo(event);
  const eventName = language === 'zh' ? info.nameZh : info.nameEn;
  const confirmed = await new Promise<boolean>(resolve => api.showModal({
    title: tr(TIMER_MORE_ACTION_COPY['more.clear-event'], language),
    content: tr(timerClearCurrentEventConfirmation(eventName, solves.length), language),
    success: result => resolve(result.confirm),
    fail: () => resolve(false),
  }));
  if (!confirmed || timer.busy || !guard.isCurrent() || event !== timer.event
    || activeSessionId !== timer.sessions.activeSessionId) return false;
  const latestSolves = timer.solves;
  if (latestSolves.length !== solves.length || latestSolves.some((solve, index) => solve !== solves[index])) return false;
  return guard.clear(activeSessionId, event);
}

export interface NativeTimerExport {
  filename: string;
  mime: string;
  text: string;
}

type ExportTimer = Pick<NativeTimer, 'busy' | 'solves' | 'records' | 'exportBackup'>;

export function prepareNativeTimerExport(timer: ExportTimer, format: unknown, now = new Date()): NativeTimerExport | undefined {
  if (timer.busy) return;
  const date = now.toISOString().slice(0, 10);
  if (format === 'cuberoot') {
    return { filename: `cuberoot-timer-${date}.json`, mime: 'application/json', text: timer.exportBackup() };
  }
  if (format === 'speedstacks') {
    return timer.solves.length > 0 ? {
      filename: `cuberoot-speedstacks-${date}.txt`,
      mime: 'text/plain;charset=utf-8',
      text: exportSpeedstacks(timer.solves),
    } : undefined;
  }
  if ((format !== 'cstimer' && format !== 'csv') || !timer.records.length) return;
  const byEvent: TimerSolvesByEvent = {};
  for (const solve of timer.records) (byEvent[solve.event] ??= []).push(solve);
  if (format === 'cstimer') {
    const result = exportTimerCstimerJson(byEvent);
    return result.solveCount > 0 ? {
      filename: `cuberoot-cstimer-${date}.json`, mime: 'application/json', text: result.json,
    } : undefined;
  }
  const result = exportTimerSolvesCsv(byEvent);
  return result.solveCount > 0 ? {
    filename: `cuberoot-csv-${date}.csv`, mime: 'text/csv;charset=utf-8', text: result.csv,
  } : undefined;
}

export function copyNativeTimerExport(transfer: NativeTimerExport, api: Pick<typeof wx, 'setClipboardData'> = miniProgramApi()) {
  return new Promise<void>((resolve, reject) => api.setClipboardData({ data: transfer.text, success: () => resolve(), fail: reject }));
}

export function readNativeTimerImportClipboard(api: Pick<typeof wx, 'getClipboardData'> = miniProgramApi()) {
  return new Promise<string>((resolve, reject) => api.getClipboardData({ success: result => resolve(result.data), fail: reject }));
}

const exportFilenamePattern = /^cuberoot-(?:(?:timer|cstimer|csv|speedstacks)-\d{4}-\d{2}-\d{2}\.(?:json|csv|txt)|scrambles-[a-z0-9_-]+-\d{1,3}\.txt)$/;
const privateFilenamePattern = /^\d+-\d+-(cuberoot-(?:timer|cstimer|csv|speedstacks)-\d{4}-\d{2}-\d{2}\.(?:json|csv|txt))$/;
let fileSequence = 0;
type TimerFileApi = NativeFileEnvironment & {
  getFileSystemManager(): Pick<WechatMiniprogram.FileSystemManager, 'mkdirSync' | 'writeFile' | 'readdirSync' | 'readFile'>;
};

export interface NativeTimerSavedFile {
  id: string;
  filename: string;
}

function nativeTimerFilesPath(api: TimerFileApi) {
  const path = nativeUserDataPath(api);
  if (!path) throw new Error('Timer file storage unavailable');
  return `${path}/timer-files`;
}

/** Save to this Mini Program's private file directory, which can also be read in-app. */
export async function saveNativeTimerExport(
  transfer: NativeTimerExport,
  api: TimerFileApi = miniProgramApi(),
): Promise<NativeTimerSavedFile> {
  const { filename, text } = transfer;
  if (!exportFilenamePattern.test(filename)) throw new Error('Invalid timer export filename');
  const directory = nativeTimerFilesPath(api);
  const fs = api.getFileSystemManager();
  const id = `${Date.now()}-${++fileSequence}-${filename}`;
  try { fs.mkdirSync(directory, true); }
  catch { /* File write reports an inaccessible directory. */ }
  await new Promise<void>((resolve, reject) => fs.writeFile({
    filePath: `${directory}/${id}`, data: text, encoding: 'utf8', success: () => resolve(), fail: reject,
  }));
  return { id, filename };
}

export function listNativeTimerImportFiles(api: TimerFileApi = miniProgramApi()): NativeTimerSavedFile[] {
  try {
    return api.getFileSystemManager().readdirSync(nativeTimerFilesPath(api))
      .sort((left, right) => right.localeCompare(left, 'en', { numeric: true }))
      .flatMap(id => {
        const filename = privateFilenamePattern.exec(id)?.[1];
        return filename?.endsWith('.json') ? [{ id, filename }] : [];
      });
  } catch { return []; }
}

export async function readNativeTimerImportFile(id: string, api: TimerFileApi = miniProgramApi()): Promise<string> {
  if (!privateFilenamePattern.exec(id)?.[1]?.endsWith('.json')) throw new Error('Invalid timer import file');
  return new Promise<string>((resolve, reject) => api.getFileSystemManager().readFile({
    filePath: `${nativeTimerFilesPath(api)}/${id}`,
    encoding: 'utf8',
    success: result => typeof result.data === 'string' ? resolve(result.data) : reject(new Error('Expected text file')),
    fail: reject,
  }));
}

type ImportTimer = Pick<NativeTimer, 'settings'>;
export type NativeTimerImport =
  | { kind: 'sessions'; sessions: TimerImportSession[]; plan: ReturnType<typeof planTimerImport> }
  | { kind: 'backup'; text: string; sessionCount: number; solveCount: number }
  | { kind: 'invalid'; reason: 'too-large' | 'format' | 'binary-file-required' };

let importSequence = 0;
export function prepareNativeTimerImport(timer: ImportTimer, text: string): NativeTimerImport {
  if (text.length > MAX_TIMER_BACKUP_BYTES || nativeTimerTextBytes(text) > MAX_TIMER_BACKUP_BYTES) return { kind: 'invalid', reason: 'too-large' };
  const source = text.replace(/^\uFEFF/, '');
  if (source.startsWith('SQLite format 3\0')) return { kind: 'invalid', reason: 'binary-file-required' };
  const sessions = parseCstimerExport(source, () => `solve-${Date.now()}-${++importSequence}`);
  if (sessions.length) return { kind: 'sessions', sessions, plan: planTimerImport(sessions) };
  const backup = parseTimerStoreJson(source, timer.settings);
  return backup ? { kind: 'backup', text: source, ...summarizeTimerDatabase(backup.database) }
    : { kind: 'invalid', reason: 'format' };
}
