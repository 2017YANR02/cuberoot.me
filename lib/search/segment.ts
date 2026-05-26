// CJK-aware text preparation for FTS5.
// SQLite's `unicode61` tokenizer treats consecutive CJK characters as a single
// token, which makes substring/partial matching impossible. We pre-process the
// indexed text (and the query) by inserting spaces between every CJK character
// so each becomes its own token, enabling per-character prefix queries.

const CJK_RE = /([㐀-鿿豈-﫿　-〿])/g;

export function segmentCjk(input: unknown): string {
  if (input == null) return "";
  const s = typeof input === "string" ? input : String(input);
  return s.replace(CJK_RE, " $1 ").replace(/\s+/g, " ").trim();
}

// FTS5 query reserved characters that must not appear unescaped in MATCH input.
const FTS5_SPECIAL = /["*()^:]/g;

// Build an FTS5 query string from raw user input.
// Returns an empty string when there is nothing searchable.
export function buildFtsQuery(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(FTS5_SPECIAL, " ").trim();
  if (!cleaned) return "";
  const segmented = segmentCjk(cleaned);
  const tokens = segmented.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  // Each token gets a prefix wildcard so partial matches work for both
  // single CJK characters and latin terms.
  return tokens.map((t) => `${t}*`).join(" ");
}
