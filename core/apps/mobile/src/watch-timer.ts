import { registerPlugin } from '@capacitor/core';
import type { WatchTimerBatch, WatchTimerPort } from '@cuberoot/app-ui';
const native = registerPlugin<{
  read(): ReturnType<WatchTimerPort['read']>;
  publish(options: { json: string; requestId: string }): Promise<void>;
  acknowledge(options: { ids: string[]; revisions?: Record<string, number> }): Promise<void>;
}>('WatchTimer');
export const watchTimerPort: WatchTimerPort = {
  read: () => native.read(),
  publish: (batch: WatchTimerBatch, requestId: string) => native.publish({ json: JSON.stringify(batch), requestId }),
  acknowledge: (ids, revisions) => native.acknowledge({ ids, revisions }),
};
