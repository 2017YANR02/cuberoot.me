import { afterEach, describe, expect, it, vi } from 'vitest';
import { planTimerImport } from '@cuberoot/shared/timer/import-timer';
import { timerClearCurrentEventConfirmation } from '@cuberoot/shared/timer/more-actions';
import { createTimerStoreData, MAX_TIMER_BACKUP_BYTES, serializeTimerStoreData } from '@cuberoot/shared/timer/persistence';
import { eventInfo, type Solve } from '@cuberoot/shared/timer/types';
import {
  confirmNativeTimerClearEvent, copyNativeTimerExport, listNativeTimerImportFiles, nativeTimerSettingsDataCommands,
  prepareNativeTimerExport, prepareNativeTimerImport, readNativeTimerImportClipboard, readNativeTimerImportFile,
  saveNativeTimerExport, switchNativeTimerLanguage,
} from '../src/lib/native-timer-settings-data';
import { nativeTimerSettingsMoreCommand, nativeTimerSettingsMoreCommands } from '../src/lib/native-timer-settings';

const three: Solve = { id: 'first', event: '333', ts: 1700000000000, timeMs: 1234, penalty: 'ok', scramble: "R U'", comment: '三阶' };
const two: Solve = { ...three, id: 'second', event: '222', timeMs: 2000, comment: '二阶' };

function fixture() {
  const data = createTimerStoreData(0, 'main', 'zh');
  data.database.dataBySession.main = { '333': [three], '222': [two] };
  return {
    event: '333' as const,
    busy: false,
    records: [three, two],
    solves: [three],
    sessions: { activeSessionId: 'main', sessions: data.database.sessions },
    settings: data.settings,
    currentSource: 'wca' as const,
    exportBackup: () => serializeTimerStoreData(data),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('native timer data actions', () => {
  it('uses shared command copy, category, and disable conditions', () => {
    const timer = fixture();
    expect(nativeTimerSettingsDataCommands(false, 'zh')).toMatchObject({
      importControl: { label: '一键导入' },
      exports: [{ label: 'CubeRoot' }, { label: 'csTimer' }, { label: 'CSV' }, { label: 'Speedstacks' }],
    });
    expect(nativeTimerSettingsMoreCommands(timer, 'zh')).toMatchObject([
      { id: 'more.language-mobile', category: 'appearance', label: '语言：EN', disabled: false },
      { id: 'more.clear-event', category: 'data', danger: true, disabled: false },
    ]);
    expect(nativeTimerSettingsMoreCommand(timer, 'data', 'more.clear-event')).toBe('clear-event');
    expect(nativeTimerSettingsMoreCommand({ ...timer, solves: [] }, 'data', 'more.clear-event')).toBeUndefined();
    expect(nativeTimerSettingsMoreCommand({ ...timer, busy: true }, 'appearance', 'more.language-mobile')).toBeUndefined();
  });

  it('confirms only the same event/session and solve snapshot', async () => {
    const timer = fixture();
    let modal!: WechatMiniprogram.ShowModalOption;
    const api = { showModal: (options: WechatMiniprogram.ShowModalOption) => { modal = options; } } as Pick<typeof wx, 'showModal'>;
    const clear = vi.fn(() => true);
    const guard = { isCurrent: () => true, clear };
    const stale = confirmNativeTimerClearEvent(timer, guard, 'zh', api);
    expect(modal.content).toBe(timerClearCurrentEventConfirmation(eventInfo('333').nameZh, 1).zh);
    timer.solves = [{ ...three, penalty: '+2' }];
    modal.success?.({ confirm: true, cancel: false, content: '', errMsg: 'showModal:ok' });
    await expect(stale).resolves.toBe(false);
    expect(clear).not.toHaveBeenCalled();
    const latest = confirmNativeTimerClearEvent(timer, guard, 'zh', api);
    modal.success?.({ confirm: true, cancel: false, content: '', errMsg: 'showModal:ok' });
    await expect(latest).resolves.toBe(true);
    expect(clear).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledWith('main', '333');
  });

  it('switches the same persisted language read by other native pages', () => {
    let locale = 'zh';
    const refreshLocale = vi.fn();
    vi.stubGlobal('getCurrentPages', () => [{ refreshLocale }]);
    vi.stubGlobal('wx', {
      getStorageSync: () => locale,
      setStorageSync: (_key: string, value: string) => { locale = value; },
      setTabBarItem: vi.fn(),
    });
    expect(switchNativeTimerLanguage()).toBe('en');
    expect(switchNativeTimerLanguage()).toBe('zh');
    expect(refreshLocale).toHaveBeenCalledTimes(2);
  });

  it('exports App-compatible file formats with matching session and event scopes', () => {
    const timer = fixture();
    const date = new Date('2026-11-18T01:02:03Z');
    const backup = prepareNativeTimerExport(timer, 'cuberoot', date)!;
    expect(backup.filename).toBe('cuberoot-timer-2026-11-18.json');
    expect(prepareNativeTimerImport(timer, backup.text)).toMatchObject({ kind: 'backup', sessionCount: 1, solveCount: 2 });
    const cstimer = prepareNativeTimerExport(timer, 'cstimer', date)!;
    expect(prepareNativeTimerImport(timer, cstimer.text)).toMatchObject({ kind: 'sessions', plan: { solveCount: 2 } });
    const csv = prepareNativeTimerExport(timer, 'csv', date)!;
    expect(csv.text.codePointAt(0)).toBe(0xfeff);
    expect(csv.text).toContain('三阶');
    expect(csv.text).toContain('二阶');
    expect(prepareNativeTimerExport(timer, 'speedstacks', date)).toMatchObject({
      filename: 'cuberoot-speedstacks-2026-11-18.txt', text: '00:01.234\n',
    });
    expect(prepareNativeTimerExport({ ...timer, records: [] }, 'csv', date)).toBeUndefined();
    expect(prepareNativeTimerExport({ ...timer, busy: true }, 'cuberoot', date)).toBeUndefined();
  });

  it('stages unknown csTimer events and blocks invalid or oversized input', () => {
    const timer = fixture();
    const source = JSON.stringify({ session1: [[[0, 4800], "U R2", '', 1680000000]],
      properties: { sessionData: JSON.stringify({ 1: { name: 'Unmatched', opt: { scrType: 'unknown-scrambler' } } }) } });
    const stage = prepareNativeTimerImport(timer, `\uFEFF${source}`);
    expect(stage.kind).toBe('sessions');
    if (stage.kind !== 'sessions') return;
    expect(stage.plan.unresolvedSessionIds).toEqual(['1']);
    expect(planTimerImport(stage.sessions, { 1: '222' })).toMatchObject({
      solveCount: 1, unresolvedSessionIds: [], sessions: [{ event: '222' }],
    });
    expect(prepareNativeTimerImport(timer, 'SQLite format 3\0')).toEqual({ kind: 'invalid', reason: 'binary-file-required' });
    expect(prepareNativeTimerImport(timer, '{}')).toEqual({ kind: 'invalid', reason: 'format' });
    expect(prepareNativeTimerImport(timer, '🧩'.repeat(MAX_TIMER_BACKUP_BYTES / 4 + 1)))
      .toEqual({ kind: 'invalid', reason: 'too-large' });
  });

  it('transfers exact text only through native clipboard or private file adapters', async () => {
    const transfer = prepareNativeTimerExport(fixture(), 'cuberoot')!;
    const privateFiles = new Map<string, string>();
    let clipboard = '';
    const clipboardApi = {
      setClipboardData: ({ data, success }: WechatMiniprogram.SetClipboardDataOption) => {
        clipboard = data; success?.({ errMsg: 'setClipboardData:ok' });
      },
      getClipboardData: ({ success }: WechatMiniprogram.GetClipboardDataOption) => {
        success?.({ data: clipboard, errMsg: 'getClipboardData:ok' });
      },
    } as Pick<typeof wx, 'setClipboardData' | 'getClipboardData'>;
    const fileApi = {
      getEnvInfoSync: () => ({ common: { USER_DATA_PATH: 'ttfile://user' } }),
      getFileSystemManager: () => ({
        mkdirSync: vi.fn(),
        writeFile: ({ filePath, data, success }: WechatMiniprogram.WriteFileOption) => {
          privateFiles.set(filePath, data as string); success?.({ errCode: 0, errMsg: 'writeFile:ok' });
        },
        readFile: ({ filePath, success }: WechatMiniprogram.ReadFileOption) => {
          success?.({ data: privateFiles.get(filePath)!, errMsg: 'readFile:ok' });
        },
        readdirSync: (directory: string) => [...privateFiles.keys()].map(path => path.slice(directory.length + 1)),
      }),
    };
    await copyNativeTimerExport(transfer, clipboardApi);
    await expect(readNativeTimerImportClipboard(clipboardApi)).resolves.toBe(transfer.text);
    const saved = await saveNativeTimerExport(transfer, fileApi);
    const scrambles = { filename: 'cuberoot-scrambles-333oh-2.txt', text: '1) R U\n2) F R', mime: 'text/plain;charset=utf-8' };
    const savedScrambles = await saveNativeTimerExport(scrambles, fileApi);
    expect(privateFiles.get(`ttfile://user/timer-files/${savedScrambles.id}`)).toBe(scrambles.text);
    expect(listNativeTimerImportFiles(fileApi)).toEqual([saved]);
    await expect(readNativeTimerImportFile(saved.id, fileApi)).resolves.toBe(transfer.text);
    await expect(readNativeTimerImportFile('../other.json', fileApi)).rejects.toThrow('Invalid timer import file');
  });
});
