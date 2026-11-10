import { Capacitor, registerPlugin } from '@capacitor/core';
import { setHostViewportLayout, type HostViewportLayout } from '@cuberoot/timer-ui';

const viewport = registerPlugin<{
  getLayout(): Promise<Partial<HostViewportLayout>>;
  addListener(event: 'layoutChanged', listener: (layout: Partial<HostViewportLayout>) => void): Promise<unknown>;
}>('ViewportLayout');

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
