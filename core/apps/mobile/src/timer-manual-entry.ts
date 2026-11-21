import { registerPlugin } from '@capacitor/core';
import type { InstalledAppHost } from '@cuberoot/app-ui';

type SheetHost = NonNullable<InstalledAppHost['manualEntrySheet']>;

const native = registerPlugin<{
  present(config: Parameters<SheetHost['present']>[0]): Promise<{ presented: boolean }>;
  update: SheetHost['update'];
  dismiss(options: { id: string }): Promise<void>;
  addListener(event: 'sheetEvent', listener: Parameters<SheetHost['addListener']>[0]): ReturnType<SheetHost['addListener']>;
}>('TimerManualEntry');

export const timerManualEntry: SheetHost = {
  async present(config) {
    return (await native.present(config)).presented;
  },
  update: feedback => native.update(feedback),
  dismiss: id => native.dismiss({ id }),
  addListener: listener => native.addListener('sheetEvent', listener),
};
