-- Winner queries must not scan every historical result before joining dates.
-- Keep this small: only first-place final-round rows, across all events.
-- Normal index creation permits reads; fail rather than wait on an active import.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '3min';
SET LOCAL maintenance_work_mem = '32MB';

CREATE INDEX IF NOT EXISTS wpr_final_winners
  ON wca_person_results (event_id, comp_id)
  WHERE pos = 1 AND round_type_id IN ('f', 'c');
