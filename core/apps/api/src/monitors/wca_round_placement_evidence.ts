import { query } from '../db/connection.js';
import {
  compareRoundPlacements, matchesRoundBaseline, roundComparisonPair,
  type ReasonChange, type RoundPlacementReason, type RoundStanding,
} from '../utils/wca_result_change_reason.js';

const MAX_EVENT_REQUESTS = 6;
const ARCHIVE_WINDOW = `revision.archived_at BETWEEN ch.detected_at - INTERVAL '36 hours'
                                                   AND ch.detected_at + INTERVAL '7 days'`;

interface PendingPlacement extends ReasonChange {
  competition_id: string;
  event_id: string;
  round_type_id: string;
  row_version: string;
}

interface RoundRevision {
  before_rows: RoundStanding[];
  after_rows: RoundStanding[];
}

export interface OfficialEventResults {
  id: string;
  rounds: {
    roundTypeId: string;
    results: (RoundStanding & { competition_id: string; event_id: string; round_type_id: string })[];
  }[];
}

async function pendingPlacements(): Promise<PendingPlacement[]> {
  return query<PendingPlacement>(
    `SELECT ch.id, ch.wca_id, ch.competition_id, ch.event_id, ch.round_type_id,
            ch.change_type, ch.before_json, ch.after_json, ch.detected_at, ch.source, ch.status,
            NULL AS person_name, ch.xmin::text AS row_version
       FROM wca_result_changes ch
      WHERE ch.source = 'auto' AND ch.status = 'approved' AND ch.change_type = 'modified'
        AND ch.placement_reason IS NULL AND ch.note IS NULL
        AND ch.before_json->>'f' IN ('a', 'm', '1', '2', '3', '5')
        AND ch.before_json->'p' <> ch.after_json->'p'
        AND ch.before_json->'a' = ch.after_json->'a'
        AND ch.before_json->'b' = ch.after_json->'b'
        AND ch.before_json->'at' = ch.after_json->'at'
        AND (
          ch.placement_reason_checked_at IS NULL
          OR ch.placement_reason_checked_at < NOW() - CASE
               WHEN ch.detected_at > NOW() - INTERVAL '7 days' THEN INTERVAL '3 hours'
               ELSE INTERVAL '7 days'
             END
          OR EXISTS (
            SELECT 1 FROM wca_result_watch_round_revisions revision
            WHERE revision.comp_id = ch.competition_id AND revision.event_id = ch.event_id
              AND revision.round_type_id = ch.round_type_id
              AND revision.archived_at > ch.placement_reason_checked_at
              AND ${ARCHIVE_WINDOW}
          )
        )
      ORDER BY ch.placement_reason_checked_at NULLS FIRST, ch.detected_at DESC, ch.id DESC
      LIMIT 24`,
  );
}

function officialStandings(event: OfficialEventResults, change: PendingPlacement): RoundStanding[] {
  if (event?.id !== change.event_id || !Array.isArray(event.rounds)) return [];
  const matching = event.rounds.filter(round => round?.roundTypeId === change.round_type_id);
  const rows = matching[0]?.results;
  return matching.length === 1 && Array.isArray(rows) && rows.every(row => row
    && row.competition_id === change.competition_id && row.event_id === change.event_id
    && row.round_type_id === change.round_type_id) ? rows : [];
}

async function saveCheck(change: PendingPlacement, checkedAt: Date, reason: RoundPlacementReason | null) {
  if (reason) {
    const missingNames = reason.causes.filter(cause => !cause.personName).map(cause => cause.wcaId);
    const names = missingNames.length ? await query<{ wca_id: string; name: string }>(
      'SELECT wca_id, name FROM wca_persons WHERE wca_id = ANY(?::text[])', [missingNames],
    ) : [];
    const byId = new Map(names.map(row => [row.wca_id, row.name]));
    for (const cause of reason.causes) cause.personName ??= byId.get(cause.wcaId) ?? null;
  }
  await query(
    `UPDATE wca_result_changes
        SET placement_reason = ?::jsonb, placement_reason_checked_at = ?::timestamptz
      WHERE id = ? AND xmin::text = ?`,
    [reason, checkedAt, change.id, change.row_version],
  );
}

/** Resolve previously logged changes, including older rows with a surviving baseline. */
export async function resolveRoundPlacementEvidence(
  fetchEvent: (competitionId: string, eventId: string) => Promise<OfficialEventResults>,
): Promise<void> {
  const events = new Map<string, OfficialEventResults | null>();
  let liveUnavailable = false;
  for (const change of await pendingPlacements()) {
    const checkedAt = new Date();
    if (!roundComparisonPair(change)) {
      await saveCheck(change, checkedAt, null);
      continue;
    }
    const key = [change.competition_id, change.event_id, change.round_type_id];
    const revisions = await query<RoundRevision>(
      `SELECT revision.before_rows, revision.after_rows
         FROM wca_result_watch_round_revisions revision
         JOIN wca_result_changes ch ON ch.competition_id = revision.comp_id
           AND ch.event_id = revision.event_id AND ch.round_type_id = revision.round_type_id
        WHERE ch.id = ? AND ${ARCHIVE_WINDOW}`,
      [change.id],
    );
    const archived = new Map<string, RoundPlacementReason>();
    for (const revision of revisions) {
      const comparison = compareRoundPlacements(change, revision.before_rows, revision.after_rows);
      if (comparison) archived.set(JSON.stringify(comparison.causes), comparison);
    }
    if (archived.size > 0) {
      await saveCheck(change, checkedAt, archived.size === 1 ? [...archived.values()][0] : null);
      continue;
    }

    // The daily official mirror can still contain the old version when the live API has already changed.
    const baseline = await query<RoundStanding>(
      `SELECT wca_id, format_id, pos, best, average, attempts
         FROM wca_person_results WHERE comp_id = ? AND event_id = ? AND round_type_id = ?`,
      key,
    );
    if (!matchesRoundBaseline(change, baseline)) {
      await saveCheck(change, checkedAt, null);
      continue;
    }
    const eventKey = JSON.stringify(key.slice(0, 2));
    let event = events.get(eventKey);
    if (event === undefined) {
      if (liveUnavailable || events.size >= MAX_EVENT_REQUESTS) continue;
      try {
        event = await fetchEvent(change.competition_id, change.event_id);
      } catch (error) {
        // Keep trying local archives, but give the official API a cooldown.
        liveUnavailable = true;
        event = null;
        console.warn(`[wca-past-results] WCA round lookup failed: ${(error as Error).message}`);
      }
      events.set(eventKey, event);
    }
    const reason = event && compareRoundPlacements(change, baseline, officialStandings(event, change));
    await saveCheck(change, checkedAt, reason);
  }
}
