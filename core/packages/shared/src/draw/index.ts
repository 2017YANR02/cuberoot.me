/** Runtime-neutral draw rules. Labels are not identities: equal names retain separate tickets. */
export interface Ticket {
  id: string;
  name: string;
  number?: string;
  answer?: string;
}
export interface Result {
  ticket: Ticket;
  at: number;
  known?: boolean;
}
export interface Session {
  text: string;
  entries: Ticket[];
  history: Result[];
  repeat: boolean;
  count: number;
  training: boolean;
  stage: boolean;
}
export interface SavedList {
  name: string;
  text: string;
  training: boolean;
}
export const DRAW_STORAGE_KEY = "cuberoot.draw.v1";
/** Shared card-pool geometry; both renderers keep faces readable within a shallow 3D volume. */
export function drawStageCards(
  session: Session,
  last: Ticket[] = [],
  busy = false,
) {
  const pool = candidates(session);
  const tickets = busy
    ? [
        ...new Map(
          [...last, ...pool].map((ticket) => [ticket.id, ticket]),
        ).values(),
      ]
    : pool;
  const count = Math.min(tickets.length, 16);
  const columns = Math.min(count, 4);
  const rows = Math.ceil(count / Math.max(columns, 1));
  return tickets.slice(0, count).map((ticket, i) => {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const phase = i * 2.3;
    return {
      ...ticket,
      pose: {
        "--x": `${Math.round(((i % columns) - (inRow - 1) / 2) * 88 + Math.sin(phase) * 10)}px`,
        "--y": `${Math.round((row - (rows - 1) / 2) * 74 + Math.cos(phase) * 10)}px`,
        "--z": `${count === 1 ? 0 : ((i % 3) - 1) * 42}px`,
        "--yaw": `${Math.round(Math.sin(phase) * 16)}deg`,
        "--tilt": `${Math.round(Math.cos(phase) * 13)}deg`,
        "--delay": `${(-i * 0.29).toFixed(2)}s`,
      },
    };
  });
}
export const freshSession = (): Session => ({
  text: "",
  entries: [],
  history: [],
  repeat: false,
  count: 1,
  training: false,
  stage: true,
});
export function parseList(text: string): Ticket[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line, i) => {
      const numbered = /^#(\d+)\s+(.+)$/.exec(line);
      const body = numbered ? numbered[2] : line;
      const split = body.indexOf("=");
      return {
        id: String(i),
        name: (split < 0 ? body : body.slice(0, split)).trim(),
        ...(numbered ? { number: numbered[1] } : {}),
        ...(split < 0 ? {} : { answer: body.slice(split + 1).trim() }),
      };
    })
    .filter((t) => t.name);
}
export function duplicateCount(entries: Ticket[]): number {
  return (
    entries.length -
    new Set(entries.map((t) => `${t.number ?? ""}\0${t.name}`)).size
  );
}
export function deduplicate(text: string): string {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].join("\n");
}
export function candidates(s: Session): Ticket[] {
  const used = new Set(s.history.map((r) => r.ticket.id));
  return s.repeat ? s.entries : s.entries.filter((t) => !used.has(t.id));
}
export function draw(s: Session, random: () => number, now: number): Session {
  const pool = [...candidates(s)];
  const picked: Result[] = [];
  const count = s.training
    ? 1
    : Math.min(100, Math.max(1, Math.floor(s.count) || 1));
  for (let i = 0; i < count && pool.length; i++) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error("Invalid random value");
    const index = Math.floor(value * pool.length);
    picked.push({ ticket: pool[index], at: now });
    // A batch never duplicates tickets, even when replacement between batches is enabled.
    pool.splice(index, 1);
  }
  return { ...s, history: [...s.history, ...picked] };
}
export function replaceList(s: Session, text: string): Session {
  return { ...s, text, entries: parseList(text), history: [] };
}
export function resultsText(s: Session): string {
  return s.history
    .map(
      (r, i) =>
        `${i + 1}. ${r.ticket.number ? "#" + r.ticket.number + " " : ""}${r.ticket.name}${r.ticket.answer ? " = " + r.ticket.answer : ""}`,
    )
    .join("\n");
}
export function decodeSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Session;
  if (
    typeof s.text !== "string" ||
    s.text.length > 500000 ||
    !Array.isArray(s.history) ||
    typeof s.repeat !== "boolean" ||
    typeof s.training !== "boolean" ||
    typeof s.stage !== "boolean" ||
    !Number.isInteger(s.count) ||
    s.count < 1 ||
    s.count > 100
  )
    return null;
  const entries = parseList(s.text);
  const byId = new Map(entries.map((t) => [t.id, t]));
  if (
    s.history.some(
      (r) =>
        !r?.ticket ||
        !byId.has(r.ticket.id) ||
        typeof r.at !== "number" ||
        !Number.isFinite(r.at) ||
        (r.known !== undefined && typeof r.known !== "boolean"),
    )
  )
    return null;
  return {
    ...s,
    entries,
    history: s.history.map((r) => ({ ...r, ticket: byId.get(r.ticket.id)! })),
  };
}
export function trainingList(
  words: Record<string, string>,
  letters: string,
): string {
  const allowed = new Set(letters.toUpperCase().replace(/[^A-Z]/g, ""));
  return Object.entries(words)
    .filter(
      ([pair]) => pair.length === 2 && [...pair].every((c) => allowed.has(c)),
    )
    .map(([pair, word]) => `${pair} = ${word}`)
    .join("\n");
}
export function weakList(s: Session): string {
  const latest = new Map<string, Result>();
  for (const r of s.history)
    if (r.known !== undefined) latest.set(r.ticket.id, r);
  return [...latest.values()]
    .filter((r) => r.known === false)
    .map(
      (r) =>
        `${r.ticket.name}${r.ticket.answer ? " = " + r.ticket.answer : ""}`,
    )
    .join("\n");
}
