// Explicit quarter-turn pushes from a two-hand home grip.
export const pushRules = [
  { token: "D'p", hand: 'L', finger: 'ring', label: ['左无名指', 'Left ring finger'], layer: 'low', dir: 1 },
  { token: 'Dp', hand: 'R', finger: 'ring', label: ['右无名指', 'Right ring finger'], layer: 'low', dir: -1 },
  { token: "U'p", hand: 'R', finger: 'index', label: ['右食指', 'Right index finger'], layer: 'high', dir: -1 },
  { token: 'Up', hand: 'L', finger: 'index', label: ['左食指', 'Left index finger'], layer: 'high', dir: 1 },
] as const;

export function pushRule(token: string) {
  return pushRules.find(rule => rule.token === token.replace(/′/g, "'"));
}

export function isPushOrder(order: unknown): order is 2 | 3 | 4 {
  return order === 2 || order === 3 || order === 4;
}
