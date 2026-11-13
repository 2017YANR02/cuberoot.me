/** Bounded retries for public, read-only prerender inputs during API restarts.
 * Callers retain validation and ISR caching; failures never become empty data. */
export async function fetchPublicApi(url: string, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    } catch (cause) {
      const transient = cause instanceof TypeError || (cause instanceof Error && cause.name === 'TimeoutError');
      if (!transient || attempt === 2) {
        // Next annotates render errors; DOMException.message is read-only.
        throw new Error(`Public API read: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
      }
    }
    if (response) {
      if (response.ok) return response;
      await response.body?.cancel();
      if (![502, 503, 504].includes(response.status) || attempt === 2) {
        throw new Error(`Public API HTTP ${response.status}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
}
