/** A bounded line protocol over one guarded solver. EOF is task completion,
 * never a batch boundary. The caller owns resource monitoring and checkpoints. */
import type { ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { rustCsv } from './rust-h10-adapter.mts';

export class ResidentRustSession {
  readonly startedAt = new Date().toISOString();
  readonly closed: Promise<number>;
  private error?: Error;
  private ending = false;
  private active?: {
    rows: { id: number; scramble: string }[];
    sent: number;
    pending: Set<string>;
    result: (raw: string, csv: string) => void;
    resolve: () => void;
    reject: (error: Error) => void;
  };
  constructor(readonly child: ChildProcess) {
    if (!child.stdin || !child.stdout) throw Error('Resident solver requires piped input/output');
    this.closed = new Promise(resolve => {
      child.once('error', error => { this.fail(error); resolve(1); });
      child.once('close', (code, signal) => {
        if (!this.ending || code !== 0 || signal || this.active)
          this.fail(Error(`Resident solver exited: code=${code}, signal=${signal}`));
        resolve(code ?? 1);
      });
    });
    child.stdin.on('error', error => this.fail(error));
    child.stdout.on('error', error => this.fail(error));
    const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
    reader.on('line', raw => {
      try {
        this.check();
        const batch = this.active;
        const csv = rustCsv(raw), id = csv.slice(0, csv.indexOf(','));
        if (!batch || !batch.pending.delete(id)) throw Error(`Unexpected/duplicate solver result: ${id}`);
        batch.result(raw, csv);
        this.feed();
        if (batch.sent === batch.rows.length && batch.pending.size === 0) {
          this.active = undefined;
          batch.resolve();
        }
      } catch (error) { this.fail(error); }
    });
  }
  check() { if (this.error) throw this.error; }
  private fail(error: unknown) {
    if (this.error) return;
    this.error = error instanceof Error ? error : Error(String(error));
    const batch = this.active; this.active = undefined;
    batch?.reject(this.error);
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGTERM');
  }
  private feed() {
    const batch = this.active;
    if (!batch) return;
    // Keep at most 32 states in flight, even for a multi-million-state task.
    while (batch.pending.size < 32 && batch.sent < batch.rows.length) {
      const row = batch.rows[batch.sent++];
      batch.pending.add(String(row.id));
      this.child.stdin!.write(`${row.id}\t${row.scramble}\n`, error => { if (error) this.fail(error); });
    }
  }
  async run(rows: { id: number; scramble: string }[], result: (raw: string, csv: string) => void) {
    this.check();
    if (this.active || this.ending) throw Error('Resident session busy or closing');
    if (new Set(rows.map(r => r.id)).size !== rows.length
        || rows.some(r => !Number.isSafeInteger(r.id) || r.id < 0 || /[\r\n\t]/.test(r.scramble)))
      throw Error('Invalid resident batch inputs');
    if (!rows.length) return;
    await new Promise<void>((resolve, reject) => {
      this.active = { rows, sent: 0, pending: new Set(), result, resolve, reject };
      this.feed();
    });
    this.check();
  }
  async finish() {
    this.check();
    if (this.active) throw Error('Cannot close an incomplete resident batch');
    this.ending = true;
    this.child.stdin!.end();
    const code = await this.closed;
    this.check();
    if (code !== 0) throw Error(`Resident solver exit ${code}`);
  }
}
