import { invoke } from '@tauri-apps/api/core';
import { browserPrintTransport } from '@cuberoot/timer-ui';
export async function printDesktopDocument(title: string): Promise<void> {
  // macOS reports completion only after NSPrintOperation's modal loop ends.
  // WebView2 retains its working browser print transport.
  if (!await invoke<boolean>('print_document', { title })) await browserPrintTransport(title);
}
