ALTER TABLE alg_submissions
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT alg_submissions_tags_allowed
    CHECK (
      tags <@ ARRAY['oh', 'ft', 'fmc', 'big', 'key']::TEXT[]
      AND array_position(tags, NULL) IS NULL
    );
