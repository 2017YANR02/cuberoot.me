import type { Solve, EventId } from './types';
import type { LocalBattleRound } from './local-battle';
export interface LocalBattleCsvLegacyRecord { playerId: number; event: EventId; entry: { time: number; penalty: string; scramble: string; date: string } }
const csvEscape = (value: string) => /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;

function roundPlayers(round: LocalBattleRound, width: number): {
  entries: Array<Solve | undefined>;
  puzzles: string[];
} {
  const attempts = new Map(round.attempts.map((attempt) => [attempt.playerId, attempt.solve]));
  const entries = Array.from({ length: width }, (_, playerId) => attempts.get(playerId));
  return {
    entries,
    puzzles: entries.map((solve) => solve?.event ?? ''),
  };
}

export function buildLocalBattleCsv(
  rounds: readonly LocalBattleRound[],
  legacyRecords: readonly LocalBattleCsvLegacyRecord[],
  minimumPlayers: number,
): string {
  const width = Math.max(
    minimumPlayers,
    ...rounds.map((round) => Math.max(...round.attempts.map((attempt) => attempt.playerId)) + 1),
    ...legacyRecords.map((record) => record.playerId + 1),
  );
  const header = ['#', 'Round ID',
    ...Array.from({ length: width }, (_, i) => [`P${i + 1} Event`, `Player${i + 1}(ms)`, `P${i + 1} Penalty`, `P${i + 1} Scramble`]).flat(),
    'Date'];
  const rows: string[][] = [];
  for (let i = 0; i < rounds.length; i++) {
    const { entries } = roundPlayers(rounds[i], width);
    const cols = entries.flatMap((entry) => [
      entry?.event || '',
      entry ? String(entry.timeMs) : '',
      entry?.penalty || '',
      entry?.scramble || '',
    ]);
    const firstEntry = entries.find((entry): entry is Solve => entry !== undefined);
    rows.push([
      String(i + 1),
      rounds[i].id,
      ...cols,
      firstEntry ? new Date(firstEntry.ts).toISOString() : '',
    ]);
  }
  for (const record of legacyRecords) {
    const cols = Array.from({ length: width }, (_, playerId) => (
      playerId === record.playerId
        ? [record.event, String(record.entry.time), record.entry.penalty, record.entry.scramble]
        : ['', '', '', '']
    )).flat();
    rows.push(['legacy', '', ...cols, record.entry.date]);
  }
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map((field) => csvEscape(field)).join(','))
    .join('\r\n')}\r\n`;
}

