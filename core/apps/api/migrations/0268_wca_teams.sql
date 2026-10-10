CREATE TABLE IF NOT EXISTS wca_teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS wca_teams_name_unique ON wca_teams (lower(name));
INSERT INTO wca_teams (name) VALUES ('GAN'), ('魔域'), ('奇艺') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS wca_person_teams (
  wca_id VARCHAR(10) PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES wca_teams(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
