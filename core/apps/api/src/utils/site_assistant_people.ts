import { pinyin } from 'pinyin-pro';
import { query, type QueryRunner } from '../db/connection.js';
import { buildWcaPersonNameFilter, MAIN_NAME_SQL } from './wca_name_filter.js';

const compactName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const compactSql = (value: string) => `LOWER(REGEXP_REPLACE(${value}, '[^a-zA-Z]', '', 'g'))`;
// Cheap superset filter before applying the full name regex to ~300k people.
// Either surname order is a rotation of the same compact name. Checking the
// doubled query keeps continuous pinyin ("mazhiyuan") searchable too.
const COARSE_NAME_SQL = `TRANSLATE(LOWER(SPLIT_PART(name, '(', 1)), ' -.’' || CHR(39) || CHR(9) || CHR(10) || CHR(13), '')`;
// WCA usually stores Chinese names as "Givenname Surname (本地名)".
// Compare both orders, ignoring spaces/case/tones, without rewriting the
// official name or trusting a model-generated transliteration/identity.
const PINYIN_NAME_SQL = `${compactSql(MAIN_NAME_SQL)} = ? OR ${compactSql(`REGEXP_REPLACE(${MAIN_NAME_SQL}, '^(.*)\\s+(\\S+)$', '\\2\\1')`)} = ?`;

/** Same imported public people and name matching used by the site's WCA pages. */
export async function findAssistantPeople(search: string, run: QueryRunner = query) {
  const input = search.trim();
  if (!input) return [];
  const filter = buildWcaPersonNameFilter(input, 'any');
  const exact = buildWcaPersonNameFilter(input, 'exact');
  const phonetic = compactName(pinyin(input, { toneType: 'none', surname: 'head', nonZh: 'consecutive' }));
  const phoneticSql = phonetic ? `(CASE WHEN LENGTH(${COARSE_NAME_SQL}) = ? AND POSITION(${COARSE_NAME_SQL} IN ?) > 0 THEN (${PINYIN_NAME_SQL}) ELSE FALSE END)` : 'FALSE';
  const phoneticParams = phonetic ? [phonetic.length, phonetic + phonetic, phonetic, phonetic] : [];
  const rows = await run<{ wcaId: string; name: string; country: string; matchRank: number }>(
    `SELECT wca_id AS "wcaId", name, country_id AS country,
       CASE WHEN wca_id = ? THEN 0 WHEN ${exact.sql} THEN 1
         WHEN ${phoneticSql} THEN 2 ELSE 3 END AS "matchRank"
     FROM wca_persons
     WHERE wca_id = ? OR (${filter.sql}) OR ${phoneticSql}
     ORDER BY "matchRank", name, wca_id LIMIT 10`,
    [input.toUpperCase(), ...exact.params, ...phoneticParams, input.toUpperCase(), ...filter.params, ...phoneticParams],
  );
  // Keep every equally strong match: homophones are candidates, not proof that
  // two records describe the same person. Exact names outrank phonetic matches.
  return rows.filter(row => row.matchRank === rows[0].matchRank).map(({ matchRank, ...person }) => ({
    ...person, match: (['id', 'exact', 'pinyin', 'partial'] as const)[matchRank],
  }));
}
