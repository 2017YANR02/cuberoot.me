ALTER TABLE teaching_trial_lesson_overrides
  ADD COLUMN title_en VARCHAR(200),
  ADD COLUMN outcome_en VARCHAR(1000),
  ADD COLUMN shots_en JSONB,
  ADD COLUMN script_en JSONB,
  ADD COLUMN english_stale BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN content_revision INTEGER NOT NULL DEFAULT 1 CHECK (content_revision > 0);

ALTER TABLE teaching_trial_lesson_overrides
  ADD CONSTRAINT teaching_trial_english_complete CHECK (
    (title_en IS NULL AND outcome_en IS NULL AND shots_en IS NULL AND script_en IS NULL)
    OR (
      title_en IS NOT NULL
      AND outcome_en IS NOT NULL
      AND shots_en IS NOT NULL
      AND script_en IS NOT NULL
      AND length(trim(title_en)) > 0
      AND length(trim(outcome_en)) > 0
      AND jsonb_typeof(shots_en) = 'array'
      AND jsonb_array_length(shots_en) BETWEEN 1 AND 30
      AND jsonb_array_length(shots_en) = jsonb_array_length(shots_zh)
      AND jsonb_typeof(script_en) = 'array'
      AND jsonb_array_length(script_en) BETWEEN 1 AND 100
      AND jsonb_array_length(script_en) = jsonb_array_length(script_zh)
    )
  );
