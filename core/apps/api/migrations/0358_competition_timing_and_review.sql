ALTER TABLE platform_competition_match_games
  ADD COLUMN inspect_a_at TIMESTAMPTZ,
  ADD COLUMN inspect_b_at TIMESTAMPTZ,
  ADD COLUMN solve_a_at TIMESTAMPTZ,
  ADD COLUMN solve_b_at TIMESTAMPTZ,
  ADD COLUMN authoritative_timing BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT competition_match_timing_order CHECK (
    (inspect_a_at IS NULL OR (start_at IS NOT NULL AND inspect_a_at >= start_at)) AND
    (inspect_b_at IS NULL OR (start_at IS NOT NULL AND inspect_b_at >= start_at)) AND
    (solve_a_at IS NULL OR (inspect_a_at IS NOT NULL AND solve_a_at >= inspect_a_at)) AND
    (solve_b_at IS NULL OR (inspect_b_at IS NOT NULL AND solve_b_at >= inspect_b_at))
  );

-- A revealed scramble has no historical inspection timestamps. Finish that game under its original rules.
UPDATE platform_competition_match_games SET authoritative_timing=FALSE
WHERE resolved_at IS NULL AND start_at IS NOT NULL;

ALTER TABLE platform_competition_evidence
  ADD COLUMN attempt_number SMALLINT,
  ADD CONSTRAINT competition_evidence_attempt_fk
    FOREIGN KEY (registration_id, attempt_number)
    REFERENCES platform_competition_attempts (registration_id, attempt_number) ON DELETE RESTRICT;
