/** Public navigation presentation only; page authorization is enforced separately. */
export interface HomeLayoutSnapshot {
  locks: Record<string, boolean>;
  orders: Record<string, string[]>;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseHomeLocks(value: unknown): HomeLayoutSnapshot['locks'] {
  if (!record(value) || !record(value.locks) || !Object.values(value.locks).every(lock => typeof lock === 'boolean')) {
    throw new Error('Invalid homepage visibility response');
  }
  return value.locks as HomeLayoutSnapshot['locks'];
}

export function parseHomeOrders(value: unknown): HomeLayoutSnapshot['orders'] {
  if (!record(value) || !record(value.orders) || !Object.values(value.orders).every(
    order => Array.isArray(order) && order.every(id => typeof id === 'string'),
  )) {
    throw new Error('Invalid homepage order response');
  }
  return value.orders as HomeLayoutSnapshot['orders'];
}

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

// Fixed snapshot, not live personalization: 2026-11-15 report, trailing 7 days,
// public audience (members + anonymous, excluding admins), unique sessions per
// feature across languages/devices. Completion events do not cover most entries.
// Evidence: .local-data/analytics/2026-11-15/report.jsonl (features + entries).
const VISIT_SESSIONS: Readonly<Record<string, number>> = {
  cstimer: 241, trainer: 207, predict: 143, memo: 74, 'color-test': 60, blddb: 51,
  'comp-sim': 14, contests: 1203, calendar: 86, mosaic: 80, solver: 68,
  'frame-count': 35, lettering: 35, paint: 30, icon: 26, timezone: 24,
  'online-competitions': 1, regulation: 352, 'math-hub': 266, alg: 97,
  'why-cube': 76, 'cube-history': 39, notation: 34, wiki: 34, quiz: 27,
  platform: 16, meet: 14, 'teaching-management': 9, 'learning-center': 5,
  teachers: 3, teaching: 2, 'live-scripts': 1, dev: 201, wb: 56, creator: 47,
  site: 42, space: 40, music: 33, gallery: 26, achievements: 24, forum: 22,
  contact: 17, drive: 13, feedback: 9,
};

// These exact saved layouts predate the current section split. Migrate only
// these snapshots; a different administrator-saved order always takes priority.
const PREVIOUS_ORDERS: Readonly<Record<string, readonly string[]>> = {
  tool: ['contests', 'online-competitions', 'comp-sim', 'frame-count', 'solver', 'mosaic', 'space', 'paper-odyssey', 'paint', 'icon', 'timezone', 'calendar'],
  learn: ['platform', 'learning-center', 'teaching', 'teachers', 'live-scripts', 'meet', 'documents', 'partnership', 'interview', 'teaching-management', 'spreadsheets', 'alg', 'quiz', 'wiki', 'regulation', 'notation', 'math-hub', 'why-cube'],
};
const SECTIONS = new Set(['train', 'tool', 'learn', 'other']);
const TIED_ENTRY_CLICKS: Readonly<Record<string, number>> = { 'frame-count': 24, lettering: 33, notation: 17, wiki: 15 };

export function applyHomeSectionOrder<T extends { id: string }>(groupId: string, cards: readonly T[], savedIds: readonly string[]): T[] {
  if (!SECTIONS.has(groupId)) return applyCardOrder(cards, savedIds);
  // Missing telemetry is unknown, not zero usage. Keep unknowns in their
  // existing relative order after the comparable measured entries.
  const defaults = [...cards].sort((a, b) =>
    (VISIT_SESSIONS[b.id] ?? -1) - (VISIT_SESSIONS[a.id] ?? -1)
    || (TIED_ENTRY_CLICKS[b.id] ?? 0) - (TIED_ENTRY_CLICKS[a.id] ?? 0));
  const previous = PREVIOUS_ORDERS[groupId];
  const migrating = previous?.length === savedIds.length && previous.every((id, i) => id === savedIds[i]);
  return applyCardOrder(defaults, migrating ? [] : savedIds);
}
