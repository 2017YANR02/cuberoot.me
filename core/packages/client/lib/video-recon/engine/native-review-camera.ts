export interface NativeRecordingFormat {
  height: number;
  rate: number;
  front: boolean;
  trackId: string;
}

interface CameraBridge {
  postMessage(message: Record<string, unknown>): Promise<unknown>;
}

function cameraBridge(): CameraBridge | undefined {
  return (window as Window & { webkit?: { messageHandlers?: { cuberootReviewCamera?: CameraBridge } } })
    .webkit?.messageHandlers?.cuberootReviewCamera;
}

export async function nativeRecordingFormats(front: boolean): Promise<string[]> {
  const result = await cameraBridge()?.postMessage({ action: 'formats', front });
  return Array.isArray(result) ? result.filter((value): value is string => typeof value === 'string') : [];
}

export async function recordNativeMovie({ front, height, rate }: NativeRecordingFormat): Promise<File> {
  const bridge = cameraBridge();
  if (!bridge) throw new Error('Native camera unavailable');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.hidden = true;
  input.dataset.nativeReviewFile = '';
  document.body.append(input);
  try {
    const selected = new Promise<File>((resolve, reject) => {
      input.onchange = () => input.files?.[0] ? resolve(input.files[0]) : reject(new Error('Missing movie'));
      input.oncancel = () => reject(new Error('Capture cancelled'));
    });
    const [file] = await Promise.all([selected, bridge.postMessage({ action: 'record', front, height, rate })]);
    return file;
  } finally { input.remove(); }
}
