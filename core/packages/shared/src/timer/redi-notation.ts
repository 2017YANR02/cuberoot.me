/** csTimer MoYu scrambles contain x-separated R/L blocks. The timer's
 * cubing.js notation uses F/UL for those two front upper corner turns.
 * Keep saved scramble text intact; normalize only at the rendering boundary.
 */
export function rediScrambleForCubing(scramble: string): string {
  const tokens = scramble.trim().split(/\s+/);
  if (!tokens.some((token) => /^x(?:2|')?$/.test(token))
    || !tokens.every((token) => /^[RLx](?:2|')?$/.test(token))) return scramble;
  return tokens.map((token) => token.replace(/^[RL]/, (face) => face === 'R' ? 'F' : 'UL')).join(' ');
}
