-- Organizer category awards are independent of WCA result snapshots.
CREATE TABLE competition_group_awards (
  competition_id TEXT PRIMARY KEY,
  cubing_slug TEXT NOT NULL UNIQUE,
  rows JSONB NOT NULL CHECK (jsonb_typeof(rows) = 'array'),
  person_ids TEXT[] NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX competition_group_awards_person_ids_idx ON competition_group_awards USING GIN (person_ids);
