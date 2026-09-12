import { importTransactionStart, refreshTable } from './pg-refresh.js';

export interface HistoricalRankCounts {
  continents: number; countries: number; persons: number;
  year: number; month: number; best: number;
}

/** The same psql artifact is used by the producer and PostgreSQL regression tests. */
export function historicalRanksLoadSql(counts: HistoricalRankCounts): string {
  return `-- 由 historical_ranks_build.ts 生成,跑在服务器 PG 上
-- 使用方式: cd <此 SQL 所在目录> && psql -U recon_user -h 127.0.0.1 -d cuberoot_db -f load.sql

${importTransactionStart('historical_ranks_schema')}

-- historical_best_ranks 可能比 migration 0018 先被本管道触达 → CREATE IF NOT EXISTS 自足
CREATE TABLE IF NOT EXISTS historical_best_ranks (
  wca_id VARCHAR(20) NOT NULL, event_id VARCHAR(20) NOT NULL,
  s_world_rank INTEGER, s_world_value INTEGER, s_world_year SMALLINT,
  s_cont_rank INTEGER, s_cont_value INTEGER, s_cont_year SMALLINT,
  s_country_rank INTEGER, s_country_value INTEGER, s_country_year SMALLINT,
  a_world_rank INTEGER, a_world_value INTEGER, a_world_year SMALLINT,
  a_cont_rank INTEGER, a_cont_value INTEGER, a_cont_year SMALLINT,
  a_country_rank INTEGER, a_country_value INTEGER, a_country_year SMALLINT,
  PRIMARY KEY (wca_id, event_id)
);

COMMIT;

${importTransactionStart('historical_ranks')}

-- Stage and validate each table, then apply only changed rows. SELECT keeps
-- reading the committed snapshot; metadata commits atomically with all six tables.

${refreshTable({
  table: 'wca_continents',
  columns: ['id', 'name'],
  keyColumns: ['id'],
  file: 'wca_continents.copy.tsv', expectedRows: counts.continents,
})}

${refreshTable({
  table: 'wca_countries',
  columns: ['id', 'iso2', 'name', 'continent_id'],
  keyColumns: ['id'],
  file: 'wca_countries.copy.tsv', expectedRows: counts.countries,
})}

${refreshTable({
  table: 'wca_persons',
  columns: ['wca_id', 'name', 'country_id', 'gender'],
  keyColumns: ['wca_id'],
  file: 'wca_persons.copy.tsv', expectedRows: counts.persons,
})}

${refreshTable({
  table: 'historical_ranks_snapshot',
  columns: ['event_id', 'year', 'wca_id', 'single', 'average', 'country_id', 'single_world_rank', 'single_country_rank', 'single_continent_rank', 'avg_world_rank', 'avg_country_rank', 'avg_continent_rank', 'best_single_comp_id', 'best_single_date', 'best_single_attempts', 'best_average_comp_id', 'best_average_date', 'best_average_attempts'],
  keyColumns: ['event_id', 'year', 'wca_id'],
  file: 'historical_ranks_snapshot.copy.tsv', expectedRows: counts.year,
})}

${refreshTable({
  table: 'historical_ranks_monthly_snapshot',
  columns: ['event_id', 'year', 'month', 'wca_id', 'single', 'average', 'country_id', 'single_world_rank', 'single_country_rank', 'single_continent_rank', 'avg_world_rank', 'avg_country_rank', 'avg_continent_rank'],
  keyColumns: ['wca_id', 'event_id', 'year', 'month'],
  file: 'historical_ranks_monthly_snapshot.copy.tsv', expectedRows: counts.month,
})}

${refreshTable({
  table: 'historical_best_ranks',
  columns: ['wca_id', 'event_id', 's_world_rank', 's_world_value', 's_world_year', 's_cont_rank', 's_cont_value', 's_cont_year', 's_country_rank', 's_country_value', 's_country_year', 'a_world_rank', 'a_world_value', 'a_world_year', 'a_cont_rank', 'a_cont_value', 'a_cont_year', 'a_country_rank', 'a_country_value', 'a_country_year'],
  keyColumns: ['wca_id', 'event_id'],
  file: 'historical_best_ranks.copy.tsv', expectedRows: counts.best,
})}

INSERT INTO meta_historical (key, value, updated_at) VALUES ('last_imported_at', NOW()::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

VACUUM (ANALYZE) wca_continents;
VACUUM (ANALYZE) wca_countries;
VACUUM (ANALYZE) wca_persons;
VACUUM (ANALYZE) historical_ranks_snapshot;
VACUUM (ANALYZE) historical_ranks_monthly_snapshot;
VACUUM (ANALYZE) historical_best_ranks;
`;
}
