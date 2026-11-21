import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { setHostViewportLayout, type HostViewportLayout } from '@cuberoot/timer-ui';

const viewport = registerPlugin<{
  getLayout(): Promise<Partial<HostViewportLayout>>;
  addListener(event: 'keyboardChanged', listener: (state: { top?: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'layoutChanged', listener: (layout: Partial<HostViewportLayout>) => void): Promise<unknown>;
}>('ViewportLayout');

export function addDockedKeyboardListener(listener: (top: number | null) => void) {
  return viewport.addListener('keyboardChanged', ({ top }) => {
    listener(typeof top === 'number' && Number.isFinite(top) ? top : null);
  });
}

/** Subscribe before requesting the initial frame, including cold launches. */
export async function initializeViewportLayout() {
  if (Capacitor.getPlatform() !== 'ios') return;
  const apply = (value: Partial<HostViewportLayout>) => {
    setHostViewportLayout(value.bounds && value.content ? value as HostViewportLayout : null);
  };
  let revision = 0;
  try {
    await viewport.addListener('layoutChanged', value => { revision++; apply(value); });
    const requestRevision = revision;
    const initial = await viewport.getLayout();
    if (revision === requestRevision) apply(initial);
  } catch {
    // Optional geometry must never prevent the offline timer from opening.
    setHostViewportLayout(null);
  }
}
