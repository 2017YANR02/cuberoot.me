CREATE TABLE deskpet_catalog (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(entries) = 'array')
);
INSERT INTO deskpet_catalog (id) VALUES (1);
