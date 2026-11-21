import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { InstalledAppHost } from '@cuberoot/app-ui';

type TimerMoreMenuHost = NonNullable<InstalledAppHost['timerMoreMenu']>;

const native = registerPlugin<{
  render(options: { state: Parameters<TimerMoreMenuHost['render']>[0] }): Promise<{ rendered: boolean }>;
  addListener(event: 'select', listener: (event: { id: string }) => void): Promise<PluginListenerHandle>;
}>('TimerMoreMenu');

export const timerMoreMenu: TimerMoreMenuHost = {
  async render(state) {
    return (await native.render({ state })).rendered;
  },
  addSelectListener: listener => native.addListener('select', ({ id }) => listener(id)),
};
