/** Ignore stale/duplicate IDs and append newly available cards in source order. */
export function applyCardOrder<T extends { id: string }>(cards: readonly T[], savedIds: readonly string[]): T[] {
  const remaining = new Map(cards.map((card) => [card.id, card]));
  const ordered = savedIds.flatMap((id) => {
    const card = remaining.get(id);
    if (!card) return [];
    remaining.delete(id);
    return [card];
  });
  return [...ordered, ...remaining.values()];
}
