/** Canonical competition result modal path, shared by Web and notifications. */
export interface CompResultLocation { eventId: string; roundId: string; number: number }

export function compResultHref(compId: string, result: CompResultLocation): string {
  return `/wca/comp/${encodeURIComponent(compId)}/result/${encodeURIComponent(result.eventId)}/${encodeURIComponent(result.roundId)}/${result.number}`;
}

