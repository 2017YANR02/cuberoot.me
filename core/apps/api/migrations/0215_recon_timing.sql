ALTER TABLE recons
  ADD COLUMN record_type VARCHAR(20) NOT NULL DEFAULT 'reconstruction'
    CHECK (record_type IN ('reconstruction', 'timing')),
  ADD COLUMN pickup_time NUMERIC(9,3),
  ADD COLUMN putdown_time NUMERIC(9,3),
  ADD CONSTRAINT recons_action_times CHECK (
    (pickup_time IS NULL AND putdown_time IS NULL AND record_type = 'reconstruction')
    OR (pickup_time IS NOT NULL AND putdown_time IS NOT NULL
      AND pickup_time >= 0 AND putdown_time >= 0 AND pickup_time <= 359999.999 AND putdown_time <= 359999.999)
  ),
  ADD CONSTRAINT recons_timing_no_solution CHECK (
    record_type <> 'timing' OR COALESCE(BTRIM(solution), '') = ''
  );
