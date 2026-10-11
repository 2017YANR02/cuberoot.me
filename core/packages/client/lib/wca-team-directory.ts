import { isWcaIdFormat } from '@cuberoot/shared/account';
import { listWcaTeams, saveWcaTeam, type WcaTeam, type WcaTeamsResponse } from './wca-teams-api';

const entries = new Map<string, { team: WcaTeam | null; fetchedAt: number }>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
const inFlight = new Set<string>();
const versions = new Map<string, number>();
const FRESH_MS = 60_000;
let scheduled = false;

export function subscribeWcaTeams(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getWcaPersonTeam(wcaId: string): WcaTeam | null | undefined {
  return entries.get(wcaId)?.team;
}
function notify() { listeners.forEach(listener => listener()); }

/** Also used by editable directories, so reads and successful writes share one cache. */
export async function fetchWcaTeamDirectory(ids: string[]): Promise<WcaTeamsResponse> {
  const before = new Map(ids.map(id => [id, versions.get(id) ?? 0]));
  const data = await listWcaTeams(ids);
  const teams = new Map(data.teams.map(team => [team.id, team]));
  const assignments = new Map(data.assignments.map(item => [item.wcaId, item.teamId]));
  for (const id of ids) {
    // An older response must not undo a successful edit made while it was loading.
    if ((versions.get(id) ?? 0) !== before.get(id)) continue;
    entries.set(id, { team: teams.get(assignments.get(id)!) ?? null, fetchedAt: Date.now() });
  }
  notify();
  return data;
}
export async function saveWcaPersonTeam(wcaId: string, name: string) {
  const result = await saveWcaTeam(wcaId, name);
  versions.set(wcaId, (versions.get(wcaId) ?? 0) + 1);
  entries.set(wcaId, { team: result.team, fetchedAt: Date.now() });
  notify();
  return result;
}

async function flush() {
  scheduled = false;
  const ids = [...pending];
  pending.clear();
  ids.forEach(id => inFlight.add(id));
  // The API accepts 100 people per request; bound concurrency on large tables.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    try { await fetchWcaTeamDirectory(batch); }
    catch { /* Decorative badges never prevent names/results from rendering. Retry on a later mount. */ }
    finally { batch.forEach(id => inFlight.delete(id)); }
  }
}
export function requestWcaPersonTeam(wcaId: string) {
  if (!isWcaIdFormat(wcaId) || inFlight.has(wcaId)) return;
  const cached = entries.get(wcaId);
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return;
  pending.add(wcaId);
  if (!scheduled) {
    scheduled = true;
    setTimeout(() => { void flush(); }, 0);
  }
}
