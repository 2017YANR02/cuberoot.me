export const WCA_NAME_MATCH_MODES = ['any', 'first', 'last', 'exact'] as const;
export type WcaNameMatchMode = typeof WCA_NAME_MATCH_MODES[number];

const MAIN_NAME_SQL = "BTRIM(REGEXP_REPLACE(name, '\\s*\\([^()]*\\)\\s*$', ''))";
const LOCAL_NAME_SQL = "COALESCE(SUBSTRING(name FROM '\\(([^()]*)\\)\\s*$'), '')";

export function isWcaNameMatchMode(value: string): value is WcaNameMatchMode {
  return WCA_NAME_MATCH_MODES.includes(value as WcaNameMatchMode);
}

/**
 * SQL predicate for the WCA name forms used by Name Ranks. First/last operate
 * on the Latin main name after a trailing parenthesized local name is removed.
 * Exact also accepts the raw export name and the local name by itself.
 */
export function buildWcaPersonNameFilter(
  query: string,
  mode: WcaNameMatchMode,
): { sql: string; params: string[] } {
  const escaped = query.replace(/[\\%_]/g, '\\$&');
  if (mode === 'first') {
    return {
      sql: `(${MAIN_NAME_SQL} ILIKE ? ESCAPE '\\' OR ${MAIN_NAME_SQL} ILIKE ? ESCAPE '\\')`,
      params: [`${escaped} %`, escaped],
    };
  }
  if (mode === 'last') {
    return {
      sql: `(${MAIN_NAME_SQL} ILIKE ? ESCAPE '\\' OR ${MAIN_NAME_SQL} ILIKE ? ESCAPE '\\')`,
      params: [`% ${escaped}`, escaped],
    };
  }
  if (mode === 'exact') {
    const comparison = "ILIKE ? ESCAPE '\\'";
    return {
      sql: `(name ${comparison} OR ${MAIN_NAME_SQL} ${comparison} OR ${LOCAL_NAME_SQL} ${comparison})`,
      params: [escaped, escaped, escaped],
    };
  }
  return { sql: "name ILIKE ? ESCAPE '\\'", params: [`%${escaped}%`] };
}
