import { describe, expect, it, vi } from 'vitest';
import { shareOrDownloadBackup } from './file-export';
import type { InstalledAppHost } from './platform';

describe('installed file export', () => {
  it.each(['json', 'csv', 'txt'])('passes lossless %s content to the host and waits for completion', async ext => {
    let finish!: () => void;
    const exportFile = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const host = { exportFile, isInstalled: () => true } as unknown as InstalledAppHost;
    const text = '中文,😀\n"R U"\n'; let complete = false;
    const operation = shareOrDownloadBackup(host, text, { filename: `test.${ext}`, mime: 'text/plain' }).then(() => { complete = true; });
    expect(exportFile).toHaveBeenCalledWith(text, `test.${ext}`, 'text/plain');
    expect(complete).toBe(false); finish(); await operation; expect(complete).toBe(true);
  });
  it('does not fall back to browser download on native cancellation or failure', async () => {
    const error = new DOMException('cancelled', 'AbortError');
    const host = { exportFile: vi.fn().mockRejectedValue(error), isInstalled: () => true } as unknown as InstalledAppHost;
    await expect(shareOrDownloadBackup(host, 'text')).rejects.toBe(error);
    host.exportFile = undefined;
    await expect(shareOrDownloadBackup(host, 'text')).rejects.toThrow('Native file export unavailable');
  });
});
