const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** One explicit device calibration. Writes alone are not confirmation. */
export function createDeviceStateReset(options: {
  sendReset(): Promise<void>;
  prepareSnapshot(): void;
  requestSnapshot(): Promise<void>;
}) {
  let disposed = false;
  let pending: { observing: boolean; finish(error?: Error): void } | null = null;
  return {
    get waiting() { return pending?.observing === true; },
    run(): Promise<void> {
      if (disposed) return Promise.reject(new Error('Cube disconnected'));
      if (pending) return Promise.reject(new Error('Device calibration already in progress'));
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => task.finish(new Error('Device did not confirm the solved state')), 4000);
        const task = { observing: false, finish(error?: Error) {
          if (pending !== task) return;
          clearTimeout(timer);
          pending = null;
          if (error) reject(error); else resolve();
        } };
        pending = task;
        void (async () => {
          await options.sendReset();
          if (pending !== task) return;
          options.prepareSnapshot();
          task.observing = true;
          await options.requestSnapshot();
        })().catch(error => task.finish(error instanceof Error ? error : new Error(String(error))));
      });
    },
    observe(facelets: string): void {
      if (!pending?.observing) return;
      pending.finish(facelets === SOLVED ? undefined : new Error('Cube state is not solved after calibration'));
    },
    dispose(): void {
      disposed = true;
      pending?.finish(new Error('Cube disconnected'));
    },
  };
}
