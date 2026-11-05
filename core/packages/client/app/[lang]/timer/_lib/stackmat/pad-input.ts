export type StackmatPad = 'left-palm' | 'left-thumb' | 'right-thumb' | 'right-palm';
export const STACKMAT_PADS: readonly StackmatPad[] = ['left-palm', 'left-thumb', 'right-thumb', 'right-palm'];
export function requiredPads(mode: '2-pad' | '4-pad'): readonly StackmatPad[] {
  return mode === '4-pad' ? STACKMAT_PADS : ['left-palm', 'right-palm'];
}

/** Contact adapter only. Time, readiness, inspection and solve recording stay in the host engine. */
export function createPadInput(required: readonly StackmatPad[], host: {
  down: () => void; up: () => void; cancel: () => void; running: () => boolean;
}) {
  const contacts = new Map<string, StackmatPad>();
  let allDown = false;
  let stoppedLatch = false;
  const pressed = () => new Set(contacts.values());
  return {
    pressed,
    down(source: string, pad: StackmatPad) {
      if (!required.includes(pad) || contacts.has(source)) return;
      contacts.set(source, pad);
      const complete = required.every(p => pressed().has(p));
      if (complete && !allDown && !stoppedLatch) {
        allDown = true;
        stoppedLatch = host.running();
        host.down();
      }
    },
    up(source: string) {
      if (!contacts.delete(source)) return;
      const complete = required.every(p => pressed().has(p));
      if (allDown && !complete) {
        allDown = false;
        if (!stoppedLatch) host.up();
      }
      // A stop cannot turn into another start while hands are still on the pads.
      if (contacts.size === 0) stoppedLatch = false;
    },
    lost(source: string) { if (contacts.has(source)) this.cancel(); },
    cancel() {
      const armed = allDown && !stoppedLatch;
      contacts.clear();
      allDown = false;
      stoppedLatch = false;
      if (armed) host.cancel();
    },
  };
}
