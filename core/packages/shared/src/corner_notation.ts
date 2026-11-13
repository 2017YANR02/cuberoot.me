/** Lex compact corner-turning notation without extracting moves from unknown words. */
export function lexCornerNotation(text: string, roots: RegExp): { tokens: string[]; invalid: string[] } {
  const tokens: string[] = [], invalid: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const moves = line.replace(/\/\/.*$/, '').replace(/([A-Za-z0-9])[ \t]+'/g, "$1'");
    for (const chunk of moves.trim().split(/\s+/).filter(Boolean)) {
      const parsed: string[] = [];
      let rest = chunk;
      while (rest) {
        const match = roots.exec(rest);
        if (!match) break;
        parsed.push(match[0]);
        rest = rest.slice(match[0].length);
      }
      if (rest) invalid.push(chunk);
      else tokens.push(...parsed);
    }
  }
  return { tokens, invalid };
}

/** Signed suffix, retaining the distinct order-three meanings of 2 and 2'. */
export function cornerTurnAmount(amount: string, prime: string | undefined, order: number): number {
  const signed = Number(amount || 1) * (prime ? -1 : 1);
  return ((signed % order) + order) % order;
}
