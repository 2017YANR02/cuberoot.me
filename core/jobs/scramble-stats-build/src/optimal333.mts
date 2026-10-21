import { closeSync, createReadStream, existsSync, fstatSync, openSync, readSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';

export interface Opt333 { htm: number; scr: string }

// The master corpus is already canonical. Only legacy 1/3 markers and spacing
// need the shared normalizer; avoid parsing every canonical row as an Alg.
function canonicalFaceText(text: string): string | null {
  if (/^[UDLRFB][2']?(?: [UDLRFB][2']?)*$/.test(text)) return text;
  if (!/^(?:\s*[UDLRFB][123']?)+\s*$/.test(text)) return null;
  return normalizeWcaScramble(text);
}

async function* completeLines(file: string): AsyncGenerator<string> {
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    if (size) {
      const last = Buffer.alloc(1);
      readSync(fd, last, 0, 1, size - 1);
      if (last[0] !== 10) throw new Error(`Incomplete final row: ${file}`);
    }
  } finally { closeSync(fd); }
  const input = createReadStream(file, 'utf8');
  const reader = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of reader) yield line; }
  finally { reader.close(); input.destroy(); }
}

/** Stream id,htm,solution; retain only requested IDs. The output is the inverse
 * solution (an equivalent scramble), not the sequence that solves the input. */
export async function loadOptimal333(outCsv: string, wanted: ReadonlySet<string>): Promise<Map<string, Opt333>> {
  const out = new Map<string, Opt333>();
  if (!wanted.size || !existsSync(outCsv)) return out;
  for await (const line of completeLines(outCsv)) {
    const first = line.indexOf(',');
    const id = line.slice(0, first);
    if (first < 1 || !wanted.has(id)) continue;
    const c = line.split(',');
    const htm = Number(c[1]);
    const solution = c[2]?.trim();
    if (c.length !== 3 || !/^\d+$/.test(c[1]) || !Number.isInteger(htm) || htm > 20
      || (solution !== '' && !/^[UDLRFB][2']?(?:\s+[UDLRFB][2']?)*$/.test(solution ?? ''))
      || (solution ? solution.split(/\s+/).length : 0) !== htm) {
      throw new Error(`Invalid optimal 333 row for ${id}: ${outCsv}`);
    }
    if (out.has(id)) throw new Error(`Duplicate optimal 333 ID ${id}: ${outCsv}`);
    // cubing.js spells inverse half-turns R2'; retain the corpus's R2 notation.
    out.set(id, { htm, scr: normalizeWcaScramble(invertAlg(solution))! });
  }
  return out;
}

/** Join only requested face texts to existing corpus IDs and completed solves.
 * Multiple IDs may share a text: a missing solve for one must not hide another. */
export async function loadOptimal333ByText(corpus: string, outCsv: string, texts: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!texts.length || !existsSync(corpus) || !existsSync(outCsv)) return out;
  const wanted = new Map<string, string[]>();
  for (const text of texts) {
    const canonical = canonicalFaceText(text);
    if (canonical === null) continue;
    const originals = wanted.get(canonical) ?? [];
    originals.push(text);
    wanted.set(canonical, originals);
  }
  const textById = new Map<string, string>();
  for await (const line of completeLines(corpus)) {
    const comma = line.indexOf(',');
    if (comma < 1) continue;
    const canonical = canonicalFaceText(line.slice(comma + 1));
    if (canonical === null || !wanted.has(canonical)) continue;
    const id = line.slice(0, comma);
    if (textById.has(id)) throw new Error(`Duplicate corpus ID ${id}: ${corpus}`);
    textById.set(id, canonical);
  }
  const solved = await loadOptimal333(outCsv, new Set(textById.keys()));
  const lengths = new Map<string, number>();
  for (const [id, { htm, scr }] of solved) {
    const canonical = textById.get(id)!;
    if (lengths.has(canonical) && lengths.get(canonical) !== htm) {
      throw new Error(`Conflicting optimal lengths for corpus text: ${canonical}`);
    }
    lengths.set(canonical, htm);
    for (const text of wanted.get(canonical)!) if (!out.has(text)) out.set(text, scr);
  }
  return out;
}
