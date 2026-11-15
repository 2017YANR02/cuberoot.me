/** Canonical competition result modal path, shared by Web and notifications. */
export interface CompResultLocation { eventId: string; roundId: string; number: number }
export interface CompResultPerson { wcaid?: string | null; name: string }

export function compResultHref(compId: string, result: Pick<CompResultLocation, 'eventId' | 'roundId'>, person: CompResultPerson): string {
  // Dataset-local numbers can change on every live refresh and across sources.
  const identity = person.wcaid || `name:${person.name}`;
  return `/wca/comp/${encodeURIComponent(compId)}/result/${encodeURIComponent(result.eventId)}/${encodeURIComponent(result.roundId)}/${encodeURIComponent(identity)}`;
}

