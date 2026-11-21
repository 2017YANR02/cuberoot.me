import { createVideoWorker } from "./worker-assets";
import {poseWorkerCount} from '../pose-fitter/runtime/reconstruction-policy.mjs';
type Reply = Record<string, any>;
interface Task { id: number; job: Record<string, unknown>; queuedAt: number; startedAt?:number; resolve(value: Reply): void; reject(error: Error): void }
interface Slot { worker: Worker; ready: boolean; task?: Task }

/** Small CPU pool. Tasks are retained in FIFO order and never superseded. */
export class PoseWorkerPool {
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private nextId = 0;
  private closed = false;
  constructor(baseUrl: string, count = poseWorkerCount(navigator.hardwareConcurrency)) {
    for (let i = 0; i < count; i++) {
      const worker = createVideoWorker("pose");
      const slot: Slot = { worker, ready: false };
      this.slots.push(slot);
      worker.onmessage = ({ data }) => {
        if (this.closed) return;
        if (data.type === "ready") { slot.ready = true; this.pump(); }
        if (data.type === "result" && slot.task && slot.task.id === data.id) {
          const task = slot.task; slot.task = undefined;
          task.resolve({...data.result,queueMs:task.startedAt!-task.queuedAt}); this.pump();
        }
        if (data.type === "error") this.dispose(new Error(data.message));
      };
      worker.onerror = event => this.dispose(new Error(`CPU pose worker stopped${event.message ? ': ' + event.message : ''}`));
      worker.postMessage({ type: "init", baseUrl });
    }
  }
  execute(job: Record<string, unknown>): Promise<Reply> {
    if (this.closed) return Promise.reject(new Error("Pose worker pool is closed"));
    return new Promise((resolve, reject) => { this.queue.push({ id: this.nextId++, job, queuedAt:performance.now(), resolve, reject }); this.pump(); });
  }
  private pump() {
    for (const slot of this.slots) {
      if (!slot.ready || slot.task || !this.queue.length) continue;
      slot.task = this.queue.shift()!;
      slot.task.startedAt=performance.now();
      slot.worker.postMessage({ type: "job", id: slot.task.id, job: slot.task.job });
    }
  }
  dispose(error = new Error("Pose fitting cancelled")) {
    if (this.closed) return; this.closed = true;
    for (const task of this.queue.splice(0)) task.reject(error);
    for (const slot of this.slots) { slot.task?.reject(error); slot.worker.terminate(); }
    this.slots = [];
  }
}
