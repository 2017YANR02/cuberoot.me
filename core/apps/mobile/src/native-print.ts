import { Capacitor, registerPlugin } from '@capacitor/core';
import { browserPrintTransport } from '@cuberoot/timer-ui';

interface TimerPrintPlugin {
  print(options: { title: string }): Promise<{ completed?: boolean }>;
}

const NativeTimerPrint = registerPlugin<TimerPrintPlugin>('TimerPrint');

/** Shared report DOM lives in timer-ui; this adapter only opens transport. */
export async function printTimerDocument(title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NativeTimerPrint.print({ title });
    return;
  }
  await browserPrintTransport(title);
}
