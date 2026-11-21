/** Ordered downstream work with bounded upstream admission. No replacement/skips. */
export class OrderedStage<T> {
  private queued: T[] = [];
  private active = false;
  private waiters: (() => void)[] = [];
  constructor(
    readonly capacity: number,
    private run: (item: T) => Promise<void>,
    private release: (item: T) => void,
    private changed: (size: number) => void = () => {},
    private failed: (error: unknown) => void = () => {},
  ) {}
  get size() { return this.queued.length + Number(this.active); }
  get canAdmit() { return this.size < this.capacity; }
  enqueue(item: T) {
    if (!this.canAdmit) throw new Error("Frame pipeline capacity exceeded");
    this.queued.push(item);
    this.changed(this.size);
    void this.pump();
  }
  whenIdle() {
    return this.size ? new Promise<void>((resolve) => this.waiters.push(resolve)) : Promise.resolve();
  }
  clear() {
    for (const item of this.queued.splice(0)) this.release(item);
    this.notify();
  }
  private notify() {
    this.changed(this.size);
    if (!this.size) for (const resolve of this.waiters.splice(0)) resolve();
  }
  private async pump() {
    if (this.active || !this.queued.length) return;
    this.active = true;
    const item = this.queued.shift()!;
    try { await this.run(item); }
    catch (error) { this.failed(error); }
    finally {
      this.release(item);
      this.active = false;
      this.notify();
      void this.pump();
    }
  }
}
