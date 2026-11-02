/** Bare WCA profile route; AppLink or its caller owns the language prefix. */
export function personHref(wcaId: string): string {
  return `/wca/persons/${encodeURIComponent(wcaId)}`;
}
