import { query, type QueryRunner } from '../db/connection.js';
import { buildWcaPersonNameFilter } from './wca_name_filter.js';

/** Same imported public people and name matching used by the site's WCA pages. */
export async function findAssistantPeople(search: string, run: QueryRunner = query) {
  const filter = buildWcaPersonNameFilter(search.trim(), 'any');
  return run<{ wcaId: string; name: string; country: string }>(
    `SELECT wca_id AS "wcaId", name, country_id AS country FROM wca_persons
     WHERE (${filter.sql}) OR wca_id = ?
     ORDER BY CASE WHEN wca_id = ? THEN 0 ELSE 1 END, name, wca_id LIMIT 10`,
    [...filter.params, search.trim().toUpperCase(), search.trim().toUpperCase()],
  );
}
