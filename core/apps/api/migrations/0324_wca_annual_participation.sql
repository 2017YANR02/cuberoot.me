-- Per-event buckets retain representation at the time of the result.
-- Existing all-event tables remain available during the data rollout.
CREATE TABLE IF NOT EXISTS wca_fs_person_event_year_solves (
  wca_id VARCHAR(20) NOT NULL,
  country_id VARCHAR(50) NOT NULL,
  event_id VARCHAR(20) NOT NULL,
  year SMALLINT NOT NULL,
  solve INTEGER NOT NULL CHECK (solve >= 0),
  attempt INTEGER NOT NULL CHECK (attempt >= solve),
  rounds INTEGER NOT NULL CHECK (rounds > 0 AND rounds <= attempt),
  PRIMARY KEY (wca_id, country_id, event_id, year)
);
CREATE INDEX IF NOT EXISTS fs_peys_year_event ON wca_fs_person_event_year_solves (year, event_id, country_id);
CREATE INDEX IF NOT EXISTS fs_peys_country ON wca_fs_person_event_year_solves (country_id, event_id, year);
