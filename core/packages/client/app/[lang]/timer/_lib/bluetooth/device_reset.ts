const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** One explicit device calibration. Writes alone are not confirmation. */
export function createDeviceStateReset(options: {
  sendReset(beginConfirmation?: () => boolean): Promise<void>;
  prepareSnapshot(): void;
  requestSnapshot(): Promise<void>;
  /** The device sends its confirmation as part of the write, possibly before
   *  the GATT write promise resolves. Writers must call beginConfirmation at
   *  the head of their queue, immediately before issuing the write. */
  automaticReply?: boolean;
}) {
  let disposed = false;
  let pending: { observing: boolean; written: boolean; confirmed: boolean; finish(error?: Error): void } | null = null;
  return {
    get waiting() { return pending?.observing === true; },
    run(): Promise<void> {
      if (disposed) return Promise.reject(new Error('Cube disconnected'));
      if (pending) return Promise.reject(new Error('Device calibration already in progress'));
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => task.finish(new Error('Device did not confirm the solved state')), 4000);
        const task = { observing: false, written: false, confirmed: false, finish(error?: Error) {
          if (pending !== task) return;
          clearTimeout(timer);
          pending = null;
          if (error) reject(error); else resolve();
        } };
        pending = task;
        void (async () => {
          await options.sendReset(options.automaticReply ? () => {
            if (pending !== task) return false;
            options.prepareSnapshot();
            task.observing = true;
            return true;
          } : undefined);
          if (pending !== task) return;
          task.written = true;
          if (options.automaticReply) {
            if (task.confirmed) task.finish();
            return;
          }
          options.prepareSnapshot();
          task.observing = true;
          await options.requestSnapshot();
        })().catch(error => task.finish(error instanceof Error ? error : new Error(String(error))));
      });
    },
    observe(facelets: string): void {
      if (!pending?.observing) return;
      if (options.automaticReply) {
        // Old state replies can still be in flight; they are not a failed ACK.
        if (facelets !== SOLVED) return;
        pending.confirmed = true;
        if (pending.written) pending.finish();
        return;
      }
      pending.finish(facelets === SOLVED ? undefined : new Error('Cube state is not solved after calibration'));
    },
    cancel(error = new Error('Device calibration cancelled')): void { pending?.finish(error); },
    dispose(): void {
      disposed = true;
      pending?.finish(new Error('Cube disconnected'));
    },
  };
}
