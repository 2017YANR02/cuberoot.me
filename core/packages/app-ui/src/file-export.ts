import type { InstalledAppHost } from './platform';

function downloadBackup(text: string, filename: string, mime: string): void {
  const blobUrl = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export async function shareOrDownloadBackup(host: InstalledAppHost, text: string, fileSpec = {
  filename: `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`, mime: 'application/json',
}): Promise<void> {
  const { filename, mime } = fileSpec;
  if (host.exportFile) return host.exportFile(text, filename, mime);
  if (host.isInstalled()) throw new Error('Native file export unavailable');
  const file = new File([text], filename, { type: mime });
  const shareData: ShareData = { files: [file], title: 'CubeRoot timer backup' };
  if (navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
  downloadBackup(text, filename, mime);
}

