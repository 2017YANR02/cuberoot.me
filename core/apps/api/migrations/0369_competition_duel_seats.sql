ALTER TABLE platform_competition_matches
  ADD COLUMN ready_at TIMESTAMPTZ,
  ADD COLUMN video_generation UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN forfeit_reason TEXT CHECK (forfeit_reason IN ('no_show', 'double_no_show'));

UPDATE platform_competition_matches
SET ready_at = clock_timestamp()
WHERE status = 'ready';
