/** MYCSA's public participant API is authoritative for registrations hosted there. */
export interface ExternalRoster {
  competitors: string[];
  registered: number;
  eventRegs: Record<string, number>;
}

const EVENT_SHORT: Record<string, string> = {
  '3x3x3': '3', '2x2x2': '2', '4x4x4': '4', '5x5x5': '5', '6x6x6': '6', '7x7x7': '7',
  '3x3x3 Blindfolded': '3bf', '3x3x3 Fewest Moves': 'fm', '3x3x3 One-Handed': 'oh',
  Megaminx: 'minx', Pyraminx: 'py', Clock: 'clock', Skewb: 'sk', 'Square-1': 'sq1',
  '4x4x4 Blindfolded': '4bf', '5x5x5 Blindfolded': '5bf', '3x3x3 Multi-Blind': 'mbf',
};
type Row = Record<string, unknown>;
function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wcaIdFromUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^(?:https?:\/\/)?(?:www\.)?worldcubeassociation\.org\/competitions\/([A-Za-z0-9]+)\/?$/.exec(value)?.[1];
}

export function parseMycsaRoster(body: unknown, sourceId: string, wcaId: string): ExternalRoster {
  if (!isRow(body) || !Array.isArray(body.list) || !isRow(body.CompDetails)
    || body.CompDetails.competition_ID !== sourceId || wcaIdFromUrl(body.CompDetails.wcaURL) !== wcaId) {
    throw new Error(`Invalid MYCSA participant response: ${sourceId}`);
  }
  const competitors = new Set<string>();
  const eventRegs: Record<string, number> = {};
  let registered = 0;
  for (const row of body.list) {
    if (!isRow(row) || row.competition_ID !== sourceId || typeof row.approved !== 'boolean'
      || typeof row.deleted !== 'boolean' || (row.waitingList !== undefined && typeof row.waitingList !== 'boolean')) {
      throw new Error(`Invalid MYCSA participant row: ${sourceId}`);
    }
    if (!row.approved || row.deleted || row.waitingList === true) continue;
    if (typeof row.events !== 'string' || (row.WCAID != null && typeof row.WCAID !== 'string')) {
      throw new Error(`Invalid MYCSA accepted participant: ${sourceId}`);
    }
    registered++;
    const id = typeof row.WCAID === 'string' ? row.WCAID.trim().toUpperCase() : '';
    if (/^\d{4}[A-Z]{4}\d{2}$/.test(id)) competitors.add(id);
    for (const event of new Set(row.events.split(',').map(event => event.trim()))) {
      const short = EVENT_SHORT[event];
      if (!short) throw new Error(`Unknown MYCSA event: ${event}`);
      eventRegs[short] = (eventRegs[short] ?? 0) + 1;
    }
  }
  return { competitors: [...competitors].sort(), registered, eventRegs };
}

type Request = (method: string, data: Row) => Promise<unknown>;
async function requestPublic(method: string, requestData: Row): Promise<unknown> {
  const response = await fetch(`https://www.api.mycubeassociation.org/public/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestData }), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`MYCSA ${method}: HTTP ${response.status}`);
  return response.json();
}

/** Fetch once per run; failures abort publication instead of erasing saved registrations. */
export async function fetchMycsaRegistrations(
  catalog: readonly { id: string; end_date: string; start_date: string }[],
  today: string,
  request: Request = requestPublic,
): Promise<Record<string, ExternalRoster>> {
  const list = await request('GetCompetitionList', { ActiveStatus: 'Active' });
  if (!Array.isArray(list)) throw new Error('Invalid MYCSA competition list');
  const activeIds = new Set(catalog.filter(c => (c.end_date || c.start_date) >= today).map(c => c.id));
  const result: Record<string, ExternalRoster> = {};
  for (const comp of list) {
    if (!isRow(comp) || typeof comp.competition_ID !== 'string' || !comp.competition_ID
      || !wcaIdFromUrl(comp.wcaURL)) throw new Error('Invalid MYCSA WCA competition');
    const id = wcaIdFromUrl(comp.wcaURL)!;
    if (!activeIds.has(id)) continue;
    if (result[id]) throw new Error(`Duplicate MYCSA competition: ${id}`);
    result[id] = parseMycsaRoster(await request('GetParticipantList', { CompetitionID: comp.competition_ID }), comp.competition_ID, id);
  }
  return result;
}
