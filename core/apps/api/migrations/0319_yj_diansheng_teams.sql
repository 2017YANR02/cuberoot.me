-- Register the brands before their rosters are supplied. No member assignments.
INSERT INTO wca_teams (name) VALUES ('永骏'), ('点盛')
ON CONFLICT (lower(name)) DO NOTHING;
