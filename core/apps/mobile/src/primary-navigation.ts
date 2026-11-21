import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { InstalledAppHost } from '@cuberoot/app-ui';

type NativeNavigation = NonNullable<InstalledAppHost['primaryNavigation']>;
type NavigationId = Parameters<Parameters<NativeNavigation['addSelectListener']>[0]>[0];

const native = registerPlugin<{
  setNavigation(options: { state: Parameters<NativeNavigation['render']>[0] }): Promise<{ rendered: boolean }>;
  addListener(event: 'select', listener: (event: { id: NavigationId }) => void): Promise<PluginListenerHandle>;
}>('PrimaryNavigation');

export const primaryNavigation: NativeNavigation = {
  async render(state) {
    return (await native.setNavigation({ state })).rendered;
  },
  addSelectListener: listener => native.addListener('select', ({ id }) => listener(id)),
};
