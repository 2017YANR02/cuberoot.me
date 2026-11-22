import { TIMER_TAIL_SECONDS } from './cube-timer';

export const TIMER_PRE_ROLL_SECONDS = 0.5;
const PRE_ROLL_CAPACITY = 18;

/** Keep a short, disposable camera buffer without running idle frames through inference. */
export class CameraPreRoll<T extends { timestamp: number; close(): void }> {
  private frames: T[] = [];

  push(frame: T) {
    this.frames.push(frame);
    while (this.frames.length > PRE_ROLL_CAPACITY ||
      this.frames[0].timestamp < frame.timestamp - TIMER_PRE_ROLL_SECONDS) {
      this.frames.shift()!.close();
    }
  }

  take(start: number): T[] {
    const frames = this.frames;
    this.frames = [];
    return frames.filter(frame => {
      if (frame.timestamp >= start) return true;
      frame.close();
      return false;
    });
  }

  clear() {
    this.frames.forEach(frame => frame.close());
    this.frames = [];
  }
}

type CaptureWindow = {
  id: string; start: number; end?: number; closed: boolean; first: boolean;
};

/** Keep the preceding window until its end marker reaches the ordered queue. */
export class TimerCaptureGate {
  private windows = new Map<string, CaptureWindow>();
  private latestId?: string;
  private previousEnd = 0;

  start(id: string, solveStart: number, preRollSeconds = TIMER_PRE_ROLL_SECONDS) {
    const start = Math.max(this.previousEnd, solveStart - preRollSeconds, 0);
    this.latestId = id;
    this.windows.set(id, { id, start, closed: false, first: true });
    return start;
  }

  stop(id: string, stop: number, tailSeconds = TIMER_TAIL_SECONDS) {
    const window = this.windows.get(id);
    if (window) {
      window.end = stop + tailSeconds;
      this.previousEnd = window.end;
    }
  }

  admit(timestamp: number) {
    const ends: { id: string; timestamp: number; latest: boolean }[] = [];
    for (const window of this.windows.values()) {
      if (window.closed || timestamp < window.start) continue;
      if (window.end !== undefined && timestamp >= window.end) {
        window.closed = true;
        ends.push({ id: window.id, timestamp: window.end, latest: window.id === this.latestId });
        continue;
      }
      const reset = window.first;
      window.first = false;
      return { ends, frame: { id: window.id, reset } };
    }
    return { ends };
  }

  finish(id: string) {
    this.windows.delete(id);
    if (this.latestId !== id) return false;
    this.latestId = undefined;
    return true;
  }

  clear() {
    this.windows.clear();
    this.latestId = undefined;
    this.previousEnd = 0;
  }
}
