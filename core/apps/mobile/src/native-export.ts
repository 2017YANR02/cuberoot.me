import { registerPlugin } from '@capacitor/core';
const files = registerPlugin<{ exportFile(options: { text: string; filename: string; mime: string }): Promise<{ completed: boolean }> }>('NativeFiles');
export async function exportNativeFile(text: string, filename: string, mime: string): Promise<void> {
  const result = await files.exportFile({ text, filename, mime });
  if (!result.completed) throw new DOMException('Export cancelled', 'AbortError');
}
