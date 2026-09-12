/** Server-only page verification diagnostics. Never retain request URLs or credentials. */
export class PageAccessTrace {
  readonly requestId = crypto.randomUUID();
  readonly startedAt = performance.now();
  readonly steps: Record<string, number> = {};
  stage = 'route';
  homeLocksStatus: number | undefined;

  async step<T>(name: 'home-locks' | 'auth-me', run: () => Promise<T>): Promise<T> {
    this.stage = name;
    const start = performance.now();
    try { return await run(); }
    finally { this.steps[name] = Math.round(performance.now() - start); }
  }

  finish(failed = false, error?: unknown): void {
    const elapsedMs = Math.round(performance.now() - this.startedAt);
    if (!failed && elapsedMs < 1000) return;
    const errorType = error instanceof Error && ['TimeoutError', 'AbortError', 'TypeError', 'SyntaxError', 'URIError'].includes(error.name)
      ? error.name : failed ? 'Error' : undefined;
    try {
      const line = JSON.stringify({
        event: 'page_access', time: new Date().toISOString(), requestId: this.requestId,
        region: process.env.VERCEL_REGION ?? 'self-hosted', stage: this.stage,
        elapsedMs, stepsMs: this.steps, homeLocksStatus: this.homeLocksStatus, failed, errorType,
      });
      if (failed) console.error(line); else console.warn(line);
    } catch { /* diagnostics must not affect access decisions */ }
  }
}
